#!/usr/bin/env python3
"""Monitor de consola para la prueba de banco del sensor de pH PH-7BNC (PH-4502C).

Lee las líneas que envía el sketch de pruebas/ph y muestra en vivo el voltaje, el pH,
el tipo de agua y un diagnóstico. Permite calibrar con buffers de cualquier valor
(7.00, 6.86, 4.00, 9.18, 10.00...) y guardar muestras con nombre (agua de caño,
vinagre, bicarbonato...) para compararlas.

Uso:
    ./.venv/bin/python pruebas/ph/monitor.py               # panel en vivo
    ./.venv/bin/python pruebas/ph/monitor.py --lineas      # una línea por lectura
    ./.venv/bin/python pruebas/ph/monitor.py --grabar      # además guarda todo en CSV
    ./.venv/bin/python pruebas/ph/monitor.py --puerto /dev/ttyUSB1

Teclas del panel:
    c  calibrar: pide la referencia (vinagre, limon, bicarbonato, cremor, borax,
       magnesia, puente o el pH de un buffer) y mide 15 s
    m  medir una muestra con nombre (promedia 10 s y la guarda en muestras.csv)
    g  empezar / detener la grabación de todas las lecturas en CSV
    b  borrar la calibración (pide confirmación)
    q  salir

Modelo (igual que PhSensor del firmware):
    pH = 7 + (V_neutro - V) / pendiente
"""

from __future__ import annotations

import argparse
import csv
import errno
import json
import os
import re
import select
import statistics
import sys
import termios
import textwrap
import time
import tty
from collections import deque
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

try:
    import serial
except ImportError:
    sys.exit("Falta pyserial. Ejecuta el script con ./.venv/bin/python")

CARPETA = Path(__file__).resolve().parent
ARCHIVO_CALIBRACION = CARPETA / "calibracion.json"
ARCHIVO_MUESTRAS = CARPETA / "muestras.csv"
CARPETA_REGISTROS = CARPETA / "registros"

FACTOR_DIVISOR = 2.0             # divisor 4.7k + 4.7k
# Valores por defecto: iguales a cfg::DEFAULT_PH_NEUTRAL_V / DEFAULT_PH_SLOPE_V del firmware
# (calibración del 25/11/2026: agua 7.55 = 2.515 V, limón 2.2 = 3.353 V).
NEUTRO_DEFECTO = 2.6015
PENDIENTE_DEFECTO = 0.1565       # V por unidad de pH; también la "pendiente típica" con 1 referencia
CENTRO_MODULO = 2.50             # salida a 0 mV (puente en el BNC) con el offset bien ajustado
PENDIENTE_MIN, PENDIENTE_MAX = 0.02, 0.6   # mismos límites que el firmware
SEGUNDOS_MUESTRA = 10
SEGUNDOS_CALIBRACION = 15
LECTURAS_ESTABILIDAD = 10        # ~5 s (una lectura cada 0.5 s)
LECTURAS_HISTORIAL = 60          # ~30 s
ESTABLE_V = 0.01                 # ±0.01 V ≈ ±0.06 pH
SEGUNDOS_SIN_DATOS = 3.0
ANCHO = 76

# Referencias para calibrar sin buffers de laboratorio: (pH, precisión aprox., descripción).
REFERENCIAS = {
    "cremor": (3.56, 0.05, "cremor tártaro saturado (patrón de laboratorio a 25 °C)"),
    "borax": (9.18, 0.05, "bórax 0.01 M (patrón de laboratorio)"),
    "vinagre": (2.45, 0.15, "vinagre blanco 4–5 % sin diluir"),
    "bicarbonato": (8.30, 0.15, "bicarbonato de sodio recién disuelto"),
    "limon": (2.20, 0.30, "jugo de limón recién exprimido y colado"),
    "magnesia": (10.40, 0.30, "leche de magnesia"),
    "puente": (7.00, 0.50, "BNC en corto: cero eléctrico, sin sonda"),
}
PRECISION_BUFFER = 0.02          # buffer comprado, escrito como número
PRECISION_AGUA = 0.3             # agua con pH conocido ("agua 7.55"): casi no tiene buffer

PATRON = re.compile(r"^ph\s+(.*)$")
BLOQUES = "▁▂▃▄▅▆▇█"
OTROS_PROGRAMAS = [
    ("turb ", "la prueba de turbidez"),
    ("TS-300B ====", "la prueba de turbidez"),
    ("[datos]", "el firmware del proyecto"),
    ("=== Reservorio", "el firmware del proyecto"),
    ("[HC-SR04]", "la prueba del HC-SR04"),
]

USAR_COLOR = sys.stdout.isatty() and "NO_COLOR" not in os.environ
VERDE, AMARILLO, ROJO, GRIS, CIAN, NEGRITA = "32", "33", "31", "90", "36", "1"


def color(texto: str, codigo: str) -> str:
    return f"\033[{codigo}m{texto}\033[0m" if USAR_COLOR else texto


# --------------------------------------------------------------------------- datos


@dataclass
class Lectura:
    hora: datetime
    ms: int
    raw: int
    v_gpio: float
    v_min: float
    v_max: float

    @property
    def v_salida(self) -> float:
        """Voltaje real de la salida Po del módulo (antes del divisor)."""
        return self.v_gpio * FACTOR_DIVISOR

    @property
    def ruido(self) -> float:
        """Diferencia entre la muestra mayor y la menor, en la salida Po."""
        return (self.v_max - self.v_min) * FACTOR_DIVISOR


def parsear(linea: str) -> Lectura | None:
    coincidencia = PATRON.match(linea.strip())
    if not coincidencia:
        return None
    campos = dict(par.split("=", 1) for par in coincidencia.group(1).split() if "=" in par)
    try:
        return Lectura(
            hora=datetime.now(),
            ms=int(campos["ms"]),
            raw=int(campos["raw"]),
            v_gpio=int(campos["mv"]) / 1000,
            v_min=int(campos["min"]) / 1000,
            v_max=int(campos["max"]) / 1000,
        )
    except (KeyError, ValueError):
        return None


# --------------------------------------------------------------------------- calibración y pH


@dataclass
class Modelo:
    neutro: float      # voltaje de Po en pH 7
    pendiente: float   # V que baja Po por cada unidad de pH que sube
    origen: str
    aviso: str = ""
    precision: float | None = None   # ± pH aproximado según las referencias usadas


def precision_punto(punto: dict) -> float:
    return punto.get("precision", PRECISION_BUFFER)


def ajustar_recta(puntos: list[dict]) -> tuple[float, float] | None:
    """Mínimos cuadrados V = a + b·pH. Devuelve (neutro, pendiente) o None si no se puede."""
    phs = [p["ph"] for p in puntos]
    if len(puntos) < 2 or max(phs) - min(phs) < 1.0:
        return None
    vs = [p["v"] for p in puntos]
    media_ph, media_v = statistics.fmean(phs), statistics.fmean(vs)
    b = sum((x - media_ph) * (y - media_v) for x, y in zip(phs, vs)) / \
        sum((x - media_ph) ** 2 for x in phs)
    return media_v + b * (7.0 - media_ph), -b


def modelo(cal: dict) -> Modelo:
    """Recta pH ↔ voltaje a partir de las referencias medidas (o los valores del firmware).

    Si hay dos o más referencias químicas se usan solo esas; el puente en el BNC (cero
    eléctrico, no incluye el error propio del electrodo) entra solo si hace falta.
    """
    puntos = cal.get("puntos", [])
    quimicos = [p for p in puntos if p.get("nombre") != "puente"]
    aviso = ""
    for grupo in (quimicos, puntos):
        recta = ajustar_recta(grupo)
        if recta is None:
            continue
        neutro, pendiente = recta
        if PENDIENTE_MIN <= pendiente <= PENDIENTE_MAX:
            precision = max(precision_punto(p) for p in grupo)
            return Modelo(neutro, pendiente, f"calibrado con {len(grupo)} referencias", precision=precision)
        if pendiente < 0:
            aviso = ("Con tus referencias el voltaje SUBE con el pH (al revés de lo normal): revisa "
                     "que cada una tenga el valor correcto o bórrala con b y repite.")
        else:
            aviso = (f"Pendiente de {pendiente * 1000:.0f} mV/pH fuera de rango (20–600): revisa las "
                     "referencias o la sonda.")
        break
    if len(puntos) >= 2 and not aviso:
        aviso = "Tus referencias difieren en menos de 1 pH: usa dos más separadas (ej. vinagre y bicarbonato)."
    if puntos:
        p = min(puntos, key=lambda punto: abs(punto["ph"] - 7.0))
        neutro = p["v"] - (7.0 - p["ph"]) * PENDIENTE_DEFECTO
        return Modelo(neutro, PENDIENTE_DEFECTO,
                      f"1 referencia ({p.get('nombre', p['ph'])}) + pendiente típica", aviso,
                      precision=max(0.5, precision_punto(p)))
    return Modelo(NEUTRO_DEFECTO, PENDIENTE_DEFECTO, "valores típicos del firmware (sin calibrar)", aviso)


def interpretar_referencia(texto: str) -> tuple[float, str, float] | None:
    """'vinagre', 'limón', 'agua 7.55', '6.86', '4,00'... -> (pH, nombre, precisión)."""
    limpio = texto.strip().lower()
    for con, sin in zip("áéíóú", "aeiou"):
        limpio = limpio.replace(con, sin)
    if limpio.startswith("agua"):
        numero = re.search(r"\d+(?:[.,]\d+)?", limpio)
        if numero is None:
            return None
        ph = float(numero.group().replace(",", "."))
        return (ph, "agua", PRECISION_AGUA) if 0 < ph < 14 else None
    for nombre, (ph, precision, _) in REFERENCIAS.items():
        if limpio and (limpio.startswith(nombre[:4]) or nombre.startswith(limpio)) and len(limpio) >= 3:
            return ph, nombre, precision
    try:
        ph = float(limpio.replace(",", "."))
    except ValueError:
        return None
    return (ph, f"buffer {ph:g}", PRECISION_BUFFER) if 0 < ph < 14 else None


def calcular_ph(v: float, mod: Modelo) -> float:
    return 7.0 + (mod.neutro - v) / mod.pendiente


def tipo_agua(ph: float) -> tuple[str, str]:
    if ph < 0 or ph > 14:
        return "Fuera de escala (0–14)", ROJO
    if ph < 4:
        return "Muy ácida", ROJO
    if ph < 6.5:
        return "Ácida", AMARILLO
    if ph < 6.8:
        return "Ligeramente ácida", VERDE
    if ph <= 7.2:
        return "Neutra", VERDE
    if ph <= 8.5:
        return "Ligeramente alcalina", VERDE
    if ph <= 10:
        return "Alcalina", AMARILLO
    return "Muy alcalina", ROJO


def texto_potable(ph: float) -> tuple[str, str]:
    if 6.5 <= ph <= 8.5:
        return "Dentro de 6.5–8.5 (rango usual del agua potable)", VERDE
    return "Fuera de 6.5–8.5 (rango usual del agua potable)", AMARILLO


def escala(ph: float, codigo: str, ancho: int = 29) -> str:
    posicion = round(min(14.0, max(0.0, ph)) / 14 * (ancho - 1))
    return (color("ácido 0 ├", GRIS) + "─" * posicion + color("●", codigo) +
            "─" * (ancho - 1 - posicion) + color("┤ 14 alcalino", GRIS))


def diagnostico(lectura: Lectura, estabilidad: float | None, mod: Modelo) -> list[tuple[str, str]]:
    mensajes: list[tuple[str, str]] = []
    v = lectura.v_salida
    ph = calcular_ph(v, mod)
    if lectura.raw <= 20:
        mensajes.append((ROJO, "Lee ~0 V: Po no llega a GPIO34 (cable suelto o divisor abierto)."))
    elif lectura.raw >= 4075:
        mensajes.append((ROJO, "ADC saturado: falta la resistencia a GND o Po va directo a GPIO34. "
                               "Desconecta: el ESP32 no debe pasar de 3.3 V."))
    elif v > 4.6:
        mensajes.append((AMARILLO, "Salida mayor a 4.6 V: revisa el divisor."))
    elif ph < 0 or ph > 14:
        mensajes.append((AMARILLO, "pH fuera de escala: sonda sin enroscar en el BNC, electrodo seco "
                                   "o falta calibrar."))
    if lectura.ruido > 0.08:
        mensajes.append((AMARILLO, f"Ruido alto ({lectura.ruido:.2f} V): cable de la sonda movido, "
                                   "burbujas o contacto flojo."))
    if estabilidad is not None and estabilidad > ESTABLE_V:
        mensajes.append((AMARILLO, "La lectura está cambiando: el electrodo tarda 30–60 s en "
                                   "estabilizarse. Espera antes de calibrar o medir."))
    if mod.aviso:
        mensajes.append((AMARILLO, mod.aviso))
    if not mensajes:
        mensajes.append((VERDE, "Lectura normal."))
    return mensajes


def sparkline(valores: list[float], rango_minimo: float = 0.2) -> str:
    if not valores:
        return ""
    bajo, alto = min(valores), max(valores)
    if alto - bajo < rango_minimo:  # no exagerar el ruido cuando la señal está quieta
        centro = (alto + bajo) / 2
        bajo, alto = centro - rango_minimo / 2, centro + rango_minimo / 2
    rango = alto - bajo
    return "".join(BLOQUES[min(7, int((v - bajo) / rango * 8))] for v in valores)


# --------------------------------------------------------------------------- archivos


def cargar_calibracion() -> dict:
    try:
        return json.loads(ARCHIVO_CALIBRACION.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def guardar_calibracion(cal: dict) -> None:
    mod = modelo(cal)
    cal["resultado"] = {
        "neutro_v": round(mod.neutro, 4),
        "pendiente_v_por_ph": round(mod.pendiente, 4),
        "origen": mod.origen,
    }
    ARCHIVO_CALIBRACION.write_text(json.dumps(cal, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


COLUMNAS_MUESTRAS = [
    "fecha", "nombre", "ph", "ph_desv", "v_salida_prom", "v_salida_desv", "v_salida_min",
    "v_salida_max", "lecturas", "tipo", "neutro_v", "pendiente_v_ph", "calibracion",
]

COLUMNAS_REGISTRO = ["fecha_hora", "ms_esp32", "adc", "v_gpio34", "v_salida", "ruido", "ph"]


def cargar_muestras_recientes(cuantas: int = 5) -> list[dict]:
    try:
        with ARCHIVO_MUESTRAS.open(newline="", encoding="utf-8") as archivo:
            return list(csv.DictReader(archivo))[-cuantas:]
    except FileNotFoundError:
        return []


def agregar_muestra(fila: dict) -> None:
    nuevo = not ARCHIVO_MUESTRAS.exists()
    with ARCHIVO_MUESTRAS.open("a", newline="", encoding="utf-8") as archivo:
        escritor = csv.DictWriter(archivo, fieldnames=COLUMNAS_MUESTRAS)
        if nuevo:
            escritor.writeheader()
        escritor.writerow(fila)


# --------------------------------------------------------------------------- puerto serie


def explicar_error(error: Exception, puerto: str) -> str:
    codigo = getattr(error, "errno", None)
    if codigo == errno.EACCES:
        return (f"Sin permiso para abrir {puerto}. Permanente: sudo usermod -aG uucp $USER "
                f"(y volver a iniciar sesión). Temporal: sudo chmod 666 {puerto}")
    if codigo == errno.ENOENT:
        return f"No se encuentra {puerto}: conecta el ESP32 por USB (o indica otro con --puerto)."
    if codigo == errno.EBUSY:
        return f"{puerto} está ocupado: cierra el otro monitor serie (pio device monitor, Arduino IDE...)."
    return str(error)


class Lector:
    """Lee líneas del ESP32 sin bloquear y se reconecta si se desconecta el USB."""

    def __init__(self, puerto: str, baudios: int):
        self.puerto = puerto
        self.baudios = baudios
        self.ser: serial.Serial | None = None
        self.buffer = b""
        self.error = ""
        self.otro_programa = ""
        self.ultimo_dato = 0.0
        self.ultimo_intento = 0.0

    def conectar(self) -> None:
        self.ultimo_intento = time.monotonic()
        try:
            ser = serial.Serial()
            ser.port = self.puerto
            ser.baudrate = self.baudios
            ser.timeout = 0
            ser.dtr = False  # no dejar el ESP32 en reset al abrir el puerto
            ser.rts = False
            ser.open()
            self.ser = ser
            self.buffer = b""
            self.error = ""
        except (serial.SerialException, OSError) as error:
            self.ser = None
            self.error = explicar_error(error, self.puerto)

    def fileno(self) -> int | None:
        return self.ser.fileno() if self.ser is not None else None

    def leer(self) -> list[Lectura]:
        if self.ser is None:
            if time.monotonic() - self.ultimo_intento > 1.0:
                self.conectar()
            return []
        try:
            datos = self.ser.read(self.ser.in_waiting or 1)
        except (serial.SerialException, OSError):
            self.ser.close()
            self.ser = None
            self.error = "Se perdió la conexión con el ESP32 (¿se desconectó el USB?). Reintentando..."
            return []
        self.buffer = (self.buffer + datos)[-4096:]
        *lineas, self.buffer = self.buffer.split(b"\n")
        lecturas = []
        for crudo in lineas:
            texto = crudo.decode("utf-8", "replace").strip()
            lectura = parsear(texto)
            if lectura is not None:
                lecturas.append(lectura)
                self.ultimo_dato = time.monotonic()
                self.otro_programa = ""
                continue
            for marca, nombre in OTROS_PROGRAMAS:
                if texto.startswith(marca) or marca in texto:
                    self.otro_programa = nombre
        return lecturas

    def cerrar(self) -> None:
        if self.ser is not None:
            self.ser.close()


# --------------------------------------------------------------------------- monitor


class Monitor:
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.lector = Lector(args.puerto, args.baudios)
        self.cal = cargar_calibracion()
        self.mod = modelo(self.cal)
        self.historial: deque[Lectura] = deque(maxlen=LECTURAS_HISTORIAL)
        self.ultima: Lectura | None = None
        self.sesion_min: float | None = None
        self.sesion_max: float | None = None
        self.muestras = cargar_muestras_recientes()
        self.medicion: dict | None = None   # muestra o calibración en curso
        self.registro = None
        self.registro_escritor = None
        self.registro_ruta: Path | None = None
        self.registro_filas = 0
        self.mensaje = ("", GRIS, 0.0)
        self.confirmar_borrado_hasta = 0.0
        self.diagnostico_previo: list[str] = []
        self.terminal_original = None
        self.salir = False

    # ----------------------------------------------------------------- utilidades

    def avisar(self, texto: str, codigo: str = CIAN, segundos: float = 8.0) -> None:
        self.mensaje = (texto, codigo, time.monotonic() + segundos)
        if self.args.lineas:
            print(color(f"  » {texto}", codigo), flush=True)

    def estabilidad(self) -> float | None:
        recientes = [l.v_salida for l in list(self.historial)[-LECTURAS_ESTABILIDAD:]]
        return statistics.pstdev(recientes) if len(recientes) >= 3 else None

    def recalcular_modelo(self) -> None:
        self.mod = modelo(self.cal)

    # ----------------------------------------------------------------- lecturas

    def procesar(self, lectura: Lectura) -> None:
        v = lectura.v_salida
        self.ultima = lectura
        self.historial.append(lectura)
        self.sesion_min = v if self.sesion_min is None else min(self.sesion_min, v)
        self.sesion_max = v if self.sesion_max is None else max(self.sesion_max, v)

        if self.registro_escritor is not None:
            self.registro_escritor.writerow([
                lectura.hora.isoformat(timespec="milliseconds"), lectura.ms, lectura.raw,
                f"{lectura.v_gpio:.3f}", f"{v:.3f}", f"{lectura.ruido:.3f}",
                f"{calcular_ph(v, self.mod):.2f}",
            ])
            self.registro.flush()
            self.registro_filas += 1

        if self.medicion is not None:
            self.medicion["valores"].append(v)
            if time.monotonic() >= self.medicion["fin"]:
                self.terminar_medicion()

        if self.args.lineas:
            self.imprimir_linea(lectura)

    def imprimir_linea(self, lectura: Lectura) -> None:
        v = lectura.v_salida
        ph = calcular_ph(v, self.mod)
        texto_tipo, codigo = tipo_agua(ph)
        print(
            f"{lectura.hora:%H:%M:%S}  ADC {lectura.raw:4d}  GPIO34 {lectura.v_gpio:.3f} V  "
            f"Po {v:.3f} V  ruido {lectura.ruido:.3f} V  pH {ph:5.2f}  {color(texto_tipo, codigo)}",
            flush=True,
        )
        actual = [texto for _, texto in diagnostico(lectura, self.estabilidad(), self.mod)]
        if actual != self.diagnostico_previo:
            for texto in actual:
                print(color(f"  diagnóstico: {texto}", GRIS), flush=True)
            self.diagnostico_previo = actual

    # ----------------------------------------------------------------- acciones

    def pedir_texto(self, pregunta: str) -> str:
        if self.args.lineas:
            return ""
        self.restaurar_terminal()
        sys.stdout.write("\033[?25h" + f"\n {pregunta}")
        sys.stdout.flush()
        try:
            return input().strip()
        except EOFError:
            return ""
        finally:
            self.preparar_terminal()

    def empezar_medicion(self, tipo: str, segundos: float, **datos) -> None:
        for lectura in self.lector.leer():  # lo que llegó mientras escribías no cuenta
            self.procesar(lectura)
        self.medicion = {"tipo": tipo, "fin": time.monotonic() + segundos, "valores": [], **datos}

    def cancelar_si_mide(self) -> bool:
        if self.medicion is None:
            return False
        self.medicion = None
        self.avisar("Medición cancelada.", AMARILLO)
        return True

    def iniciar_calibracion(self) -> None:
        if self.cancelar_si_mide():
            return
        if self.ultima is None:
            self.avisar("Todavía no hay lecturas del ESP32.", AMARILLO)
            return
        texto = self.pedir_texto("¿En qué está la sonda? agua 7.55 (agua con pH conocido), vinagre, limon, "
                                 "bicarbonato, cremor, borax, magnesia, puente, o el pH de un buffer (ej. 6.86): ")
        referencia = interpretar_referencia(texto)
        if referencia is None:
            self.avisar("Calibración cancelada: escribe un nombre de la lista, 'agua' seguido de su pH "
                        "(ej. agua 7.55) o un pH entre 0 y 14.", AMARILLO, 12)
            return
        ph_ref, nombre, precision = referencia
        self.empezar_medicion("calibracion", SEGUNDOS_CALIBRACION, ph=ph_ref, nombre=nombre,
                              precision=precision)

    def iniciar_muestra(self) -> None:
        if self.cancelar_si_mide():
            return
        if self.ultima is None:
            self.avisar("Todavía no hay lecturas del ESP32.", AMARILLO)
            return
        nombre = self.pedir_texto("Nombre de la muestra (ej. caño, vinagre, bicarbonato) y Enter: ")
        if not nombre:
            self.avisar("Muestra cancelada (sin nombre).", AMARILLO)
            return
        self.empezar_medicion("muestra", SEGUNDOS_MUESTRA, nombre=nombre)

    def terminar_medicion(self) -> None:
        medicion, self.medicion = self.medicion, None
        valores = medicion["valores"]
        if len(valores) < 5:
            self.avisar("Muy pocas lecturas; repite la medición.", AMARILLO)
            return
        if medicion["tipo"] == "calibracion":
            self.terminar_calibracion(medicion["ph"], medicion["nombre"], medicion["precision"], valores)
        else:
            self.terminar_muestra(medicion["nombre"], valores)

    def terminar_calibracion(self, ph_buffer: float, nombre: str, precision: float,
                             valores: list[float]) -> None:
        v = statistics.fmean(valores)
        desv = statistics.pstdev(valores)
        if desv > 2 * ESTABLE_V:
            self.avisar(f"No se guardó: la lectura se movió ±{desv:.3f} V. Espera a que se estabilice "
                        "(30–60 s en el buffer) y vuelve a presionar c.", ROJO, 12)
            return
        if not 0.2 < v < 4.8:
            self.avisar(f"No se guardó: {v:.3f} V no es válido. Revisa la conexión.", ROJO, 12)
            return
        puntos = [p for p in self.cal.get("puntos", []) if abs(p["ph"] - ph_buffer) > 0.05]
        puntos.append({"nombre": nombre, "ph": ph_buffer, "v": round(v, 4), "desv": round(desv, 4),
                       "precision": precision, "fecha": datetime.now().isoformat(timespec="seconds")})
        self.cal["puntos"] = sorted(puntos, key=lambda p: p["ph"])
        guardar_calibracion(self.cal)
        self.recalcular_modelo()
        texto = (f"{nombre.capitalize()} (pH {ph_buffer:g}) = {v:.3f} V guardado. Ahora: neutro "
                 f"{self.mod.neutro:.3f} V, pendiente {self.mod.pendiente * 1000:.0f} mV/pH "
                 f"({self.mod.origen}).")
        if len(self.cal["puntos"]) == 1:
            texto += " Enjuaga la sonda y mide otra referencia para calcular la pendiente."
        self.avisar(texto, VERDE, 15)

    def terminar_muestra(self, nombre: str, valores: list[float]) -> None:
        v = statistics.fmean(valores)
        desv = statistics.pstdev(valores)
        ph = calcular_ph(v, self.mod)
        texto_tipo, _ = tipo_agua(ph)
        fila = {
            "fecha": datetime.now().isoformat(timespec="seconds"),
            "nombre": nombre,
            "ph": f"{ph:.2f}",
            "ph_desv": f"{desv / self.mod.pendiente:.2f}",
            "v_salida_prom": f"{v:.3f}",
            "v_salida_desv": f"{desv:.3f}",
            "v_salida_min": f"{min(valores):.3f}",
            "v_salida_max": f"{max(valores):.3f}",
            "lecturas": len(valores),
            "tipo": texto_tipo,
            "neutro_v": f"{self.mod.neutro:.3f}",
            "pendiente_v_ph": f"{self.mod.pendiente:.4f}",
            "calibracion": self.mod.origen,
        }
        agregar_muestra(fila)
        self.muestras = (self.muestras + [fila])[-5:]
        self.avisar(f"Muestra '{nombre}': pH {ph:.2f} ± {desv / self.mod.pendiente:.2f} ({texto_tipo}), "
                    f"{v:.3f} V → guardada en muestras.csv", VERDE, 12)

    def borrar_calibracion(self) -> None:
        if time.monotonic() > self.confirmar_borrado_hasta:
            self.confirmar_borrado_hasta = time.monotonic() + 3
            self.avisar("Presiona b otra vez para borrar la calibración.", AMARILLO, 3)
            return
        self.cal = {}
        self.recalcular_modelo()
        ARCHIVO_CALIBRACION.unlink(missing_ok=True)
        self.confirmar_borrado_hasta = 0.0
        self.avisar("Calibración borrada: se usan los valores típicos del firmware.", VERDE)

    def alternar_registro(self) -> None:
        if self.registro is not None:
            self.registro.close()
            ruta, filas = self.registro_ruta, self.registro_filas
            self.registro = self.registro_escritor = self.registro_ruta = None
            self.avisar(f"Grabación detenida: {filas} lecturas en {ruta.relative_to(CARPETA)}", VERDE, 10)
            return
        CARPETA_REGISTROS.mkdir(exist_ok=True)
        self.registro_ruta = CARPETA_REGISTROS / f"ph-{datetime.now():%Y%m%d-%H%M%S}.csv"
        self.registro = self.registro_ruta.open("w", newline="", encoding="utf-8")
        self.registro_escritor = csv.writer(self.registro)
        self.registro_escritor.writerow(COLUMNAS_REGISTRO)
        self.registro_filas = 0
        self.avisar(f"Grabando en {self.registro_ruta.relative_to(CARPETA)} (g para detener)", VERDE)

    def tecla(self, caracter: str) -> None:
        acciones = {
            "c": self.iniciar_calibracion,
            "m": self.iniciar_muestra,
            "g": self.alternar_registro,
            "b": self.borrar_calibracion,
            "q": lambda: setattr(self, "salir", True),
        }
        accion = acciones.get(caracter.lower())
        if accion is not None:
            accion()

    # ----------------------------------------------------------------- panel

    def panel(self) -> list[str]:
        ahora = datetime.now()
        linea = color("─" * ANCHO, GRIS)
        titulo = " PH-7BNC · Monitor de pH"
        estado = f"{self.args.puerto} · {ahora:%H:%M:%S} "
        filas = [color(titulo, NEGRITA) + " " * max(1, ANCHO - len(titulo) - len(estado)) + color(estado, GRIS), linea]

        def seccion(nombre: str, extra: str = "") -> None:
            filas.append("")
            filas.append(" " + color(nombre, NEGRITA) + (color(f"  {extra}", GRIS) if extra else ""))

        def dato(etiqueta: str, valor: str, nota: str = "") -> None:
            filas.append(f"   {etiqueta:<22}{valor}" + (color(f"  {nota}", GRIS) if nota else ""))

        def envolver(texto: str, codigo: str, prefijo: str) -> None:
            for i, parte in enumerate(textwrap.wrap(texto, ANCHO - 6)):
                filas.append("   " + color((prefijo if i == 0 else "  ") + parte, codigo))

        if self.lector.error:
            filas.append("")
            envolver(self.lector.error, ROJO, "✖ ")

        lectura = self.ultima
        sin_datos = time.monotonic() - self.lector.ultimo_dato if self.lector.ultimo_dato else None
        if lectura is None:
            filas.append("")
            filas.append("   Esperando datos del ESP32...")
            if self.lector.otro_programa:
                envolver(f"El ESP32 tiene cargado {self.lector.otro_programa}. Carga la prueba de pH: "
                         "./tools/pio.sh run -d pruebas/ph -t upload", AMARILLO, "⚠ ")
            elif self.lector.ser is not None:
                envolver("Si no aparece nada en unos segundos, carga el sketch: "
                         "./tools/pio.sh run -d pruebas/ph -t upload", GRIS, "")
        else:
            v = lectura.v_salida
            est = self.estabilidad()
            ph = calcular_ph(v, self.mod)
            seccion("LECTURA")
            dato("ADC (0–4095)", f"{lectura.raw}")
            dato("Voltaje en GPIO34", f"{lectura.v_gpio:.3f} V")
            dato("Voltaje salida Po", color(f"{v:.3f} V", NEGRITA), "GPIO34 × 2: lo que entrega el módulo")
            dato("Ruido de la lectura", f"{lectura.ruido:.3f} V")
            if est is None:
                dato("Estabilidad (5 s)", "—")
            else:
                estable = color("estable", VERDE) if est <= ESTABLE_V else color("cambiando", AMARILLO)
                dato("Estabilidad (5 s)", f"±{est:.3f} V (±{est / self.mod.pendiente:.2f} pH)  {estable}")

            texto_tipo, codigo = tipo_agua(ph)
            texto_pot, codigo_pot = texto_potable(ph)
            seccion("RESULTADO")
            precision = f" (±{self.mod.precision:.1f} aprox.)" if self.mod.precision else ""
            dato("pH", color(f"{ph:.2f}", NEGRITA) + precision, self.mod.origen)
            dato("", escala(ph, codigo))
            dato("Tipo de agua", color(texto_tipo, codigo))
            dato("Agua potable", color(texto_pot, codigo_pot))

            valores = [l.v_salida for l in self.historial]
            ph_hist = [calcular_ph(x, self.mod) for x in valores]
            seccion("HISTORIAL", f"últimos {len(valores) / 2:.0f} s · pH {min(ph_hist):.2f} a {max(ph_hist):.2f}")
            # el pH sube cuando el voltaje baja: se grafica el pH
            filas.append("   " + color(sparkline(ph_hist), CIAN))
            filas.append(color(f"   Toda la sesión: Po {self.sesion_min:.3f} a {self.sesion_max:.3f} V", GRIS))

            seccion("DIAGNÓSTICO")
            for codigo_diag, texto in diagnostico(lectura, est, self.mod):
                envolver(texto, codigo_diag, "✔ " if codigo_diag == VERDE else "⚠ ")
            if sin_datos is not None and sin_datos > SEGUNDOS_SIN_DATOS:
                envolver(f"Sin datos nuevos hace {sin_datos:.0f} s.", ROJO, "✖ ")

        seccion("CALIBRACIÓN", "calibracion.json · c para agregar una referencia")
        filas.append(f"   Neutro (pH 7)  {self.mod.neutro:.3f} V      "
                     f"Pendiente  {self.mod.pendiente * 1000:.0f} mV/pH")
        filas.append(color(f"   {self.mod.origen}", GRIS))
        puntos = self.cal.get("puntos", [])
        if puntos:
            for p in puntos:
                filas.append(f"   · {p.get('nombre', 'buffer'):<12} pH {p['ph']:5.2f}  →  {p['v']:.3f} V"
                             + color(f"   ±{precision_punto(p):.2f} pH", GRIS))
        diferencia = self.mod.neutro - CENTRO_MODULO
        if puntos and abs(diferencia) > 0.3:
            envolver(f"El neutro está {diferencia:+.2f} V lejos de 2.50 V. Funciona igual, pero puedes "
                     "girar el potenciómetro de offset (el más cercano al BNC) y recalibrar.", GRIS, "ℹ ")

        seccion("MUESTRAS GUARDADAS", "muestras.csv · pH con la calibración actual")
        if self.muestras:
            for fila in self.muestras:
                hora = fila["fecha"][11:16]
                v_fila = float(fila["v_salida_prom"])
                ph_fila = calcular_ph(v_fila, self.mod)
                filas.append(f"   {hora}  {fila['nombre'][:20]:<20}  pH {ph_fila:5.2f}  "
                             f"{v_fila:.3f} V  {tipo_agua(ph_fila)[0]}")
        else:
            filas.append(color("   (ninguna todavía: pon la sonda en el agua y presiona m)", GRIS))

        if self.medicion is not None:
            restante = max(0.0, self.medicion["fin"] - time.monotonic())
            if self.medicion["tipo"] == "calibracion":
                que = f"Calibrando con {self.medicion['nombre']} (pH {self.medicion['ph']:g})"
            else:
                que = f"Midiendo '{self.medicion['nombre']}'"
            filas.append("")
            filas.append(color(f" ● {que}... faltan {restante:.0f} s ({len(self.medicion['valores'])} "
                               "lecturas). No muevas la sonda. c/m = cancelar", AMARILLO))
        if self.registro is not None:
            filas.append("")
            filas.append(color(f" ● GRABANDO {self.registro_ruta.relative_to(CARPETA)} "
                               f"({self.registro_filas} lecturas)", ROJO))

        texto, codigo, expira = self.mensaje
        if texto and time.monotonic() < expira:
            filas.append("")
            for i, parte in enumerate(textwrap.wrap(texto, ANCHO - 4)):
                filas.append(color((" » " if i == 0 else "   ") + parte, codigo))

        filas.append(linea)
        filas.append(" [c] calibrar  [m] muestra  [g] grabar  [b] borrar cal.  [q] salir")
        return filas

    def dibujar(self) -> None:
        contenido = "\033[H" + "".join(f"{fila}\033[K\n" for fila in self.panel()) + "\033[J"
        sys.stdout.write(contenido)
        sys.stdout.flush()

    # ----------------------------------------------------------------- terminal

    def preparar_terminal(self) -> None:
        if self.terminal_original is None:
            self.terminal_original = termios.tcgetattr(sys.stdin)
        tty.setcbreak(sys.stdin)
        sys.stdout.write("\033[?25l")

    def restaurar_terminal(self) -> None:
        if self.terminal_original is not None:
            termios.tcsetattr(sys.stdin, termios.TCSADRAIN, self.terminal_original)
        sys.stdout.write("\033[?25h")
        sys.stdout.flush()

    # ----------------------------------------------------------------- bucle

    def ejecutar(self) -> None:
        interactivo = not self.args.lineas
        fin = time.monotonic() + self.args.segundos if self.args.segundos else None
        self.lector.conectar()
        if self.args.grabar:
            self.alternar_registro()
        if self.args.lineas:
            if self.lector.error:
                print(color(self.lector.error, ROJO), flush=True)
            print(color(f"Leyendo {self.args.puerto}... (Ctrl+C para salir)", GRIS), flush=True)
            print(color(f"Calibración: neutro {self.mod.neutro:.3f} V, pendiente "
                        f"{self.mod.pendiente * 1000:.0f} mV/pH ({self.mod.origen})", GRIS), flush=True)
        else:
            sys.stdout.write("\033[?1049h")
            self.preparar_terminal()
        ultimo_dibujo = 0.0
        error_mostrado = self.lector.error
        otro_mostrado = ""
        try:
            while not self.salir:
                entradas = [sys.stdin] if interactivo else []
                fd = self.lector.fileno()
                if fd is not None:
                    entradas.append(fd)
                if entradas:
                    listos, _, _ = select.select(entradas, [], [], 0.2)
                else:
                    listos = []
                    time.sleep(0.2)
                if interactivo and sys.stdin in listos:
                    for caracter in os.read(sys.stdin.fileno(), 32).decode("utf-8", "ignore"):
                        self.tecla(caracter)
                for lectura in self.lector.leer():
                    self.procesar(lectura)
                if self.args.lineas:
                    if self.lector.error != error_mostrado:
                        if self.lector.error:
                            print(color(self.lector.error, ROJO), flush=True)
                        error_mostrado = self.lector.error
                    if self.lector.otro_programa and self.lector.otro_programa != otro_mostrado:
                        print(color(f"El ESP32 tiene cargado {self.lector.otro_programa}. Carga la prueba "
                                    "de pH: ./tools/pio.sh run -d pruebas/ph -t upload", AMARILLO), flush=True)
                    otro_mostrado = self.lector.otro_programa
                if interactivo and time.monotonic() - ultimo_dibujo > 0.25:
                    self.dibujar()
                    ultimo_dibujo = time.monotonic()
                if fin is not None and time.monotonic() >= fin:
                    break
        except KeyboardInterrupt:
            pass
        finally:
            if interactivo:
                self.restaurar_terminal()
                sys.stdout.write("\033[?1049l")
                sys.stdout.flush()
            if self.registro is not None:
                self.alternar_registro()
                if interactivo:
                    print(self.mensaje[0])
            self.lector.cerrar()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Monitor de consola del sensor de pH PH-7BNC (prueba de banco).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            Teclas del panel:
              c  calibrar (vinagre, bicarbonato, 6.86...)    m  muestra con nombre
              g  grabar CSV    b  borrar calibración    q  salir"""),
    )
    parser.add_argument("--puerto", default="/dev/ttyUSB0", help="puerto serie (por defecto /dev/ttyUSB0)")
    parser.add_argument("--baudios", type=int, default=115200)
    parser.add_argument("--lineas", action="store_true", help="una línea por lectura, sin panel")
    parser.add_argument("--grabar", action="store_true", help="guardar todas las lecturas en registros/*.csv")
    parser.add_argument("--segundos", type=float, default=0, help="salir después de N segundos")
    args = parser.parse_args()
    if not args.lineas and not sys.stdin.isatty():
        args.lineas = True
    Monitor(args).ejecutar()


if __name__ == "__main__":
    main()
