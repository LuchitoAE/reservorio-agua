#!/usr/bin/env python3
"""Monitor de consola para la prueba de banco del sensor de turbidez TS-300B.

Lee las líneas que envía el sketch de pruebas/turbidez y muestra en vivo el voltaje,
la turbidez estimada (NTU), la claridad, la calidad del agua y un diagnóstico.
Permite calibrar con agua clara / turbia y guardar muestras con nombre
(agua de caño, agua con tierra, ...) para compararlas.

Uso:
    ./.venv/bin/python pruebas/turbidez/monitor.py               # panel en vivo
    ./.venv/bin/python pruebas/turbidez/monitor.py --lineas      # una línea por lectura
    ./.venv/bin/python pruebas/turbidez/monitor.py --grabar      # además guarda todo en CSV
    ./.venv/bin/python pruebas/turbidez/monitor.py --puerto /dev/ttyUSB1

Teclas del panel:
    c  guardar la lectura actual como AGUA CLARA  (claridad 100 %)
    t  guardar la lectura actual como AGUA TURBIA (claridad 0 %)
    m  medir una muestra con nombre (promedia 10 s y la guarda en muestras.csv)
    g  empezar / detener la grabación de todas las lecturas en CSV
    b  borrar la calibración (pide confirmación)
    q  salir
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
# Referencias por defecto: iguales a cfg::DEFAULT_TURB_CLEAR_V / DEFAULT_TURB_TURBID_V
# del firmware (medidas el 25/11/2026 con agua de caño y agua con tierra).
REFERENCIA_CLARA_DEFECTO = 2.89
REFERENCIA_TURBIA_DEFECTO = 2.52
FORMULA_V_CLARA = 4.20           # agua clara en la curva NTU del fabricante
FORMULA_V_MIN = 2.5              # debajo de esto la curva ya no vale
SEGUNDOS_MUESTRA = 10
LECTURAS_CALIBRACION = 6         # ~3 s (una lectura cada 0.5 s)
LECTURAS_ESTABILIDAD = 10        # ~5 s
LECTURAS_HISTORIAL = 60          # ~30 s
SEGUNDOS_SIN_DATOS = 3.0
ANCHO = 74

PATRON = re.compile(r"^turb\s+(.*)$")
BLOQUES = "▁▂▃▄▅▆▇█"

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
        """Voltaje real de la salida A del módulo (antes del divisor)."""
        return self.v_gpio * FACTOR_DIVISOR

    @property
    def ruido(self) -> float:
        """Diferencia entre la muestra mayor y la menor, en la salida A."""
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


# --------------------------------------------------------------------------- cálculos


def referencias(cal: dict) -> tuple[float, float]:
    """Voltajes de agua clara y turbia: los de calibracion.json o los del firmware."""
    return cal.get("clara", REFERENCIA_CLARA_DEFECTO), cal.get("turbia", REFERENCIA_TURBIA_DEFECTO)


def v_equivalente(v: float, cal: dict) -> float:
    """Escala la lectura para que tu agua clara equivalga a los 4.2 V del fabricante."""
    clara, _ = referencias(cal)
    return v * FORMULA_V_CLARA / clara


def ntu_estimado(v: float, cal: dict) -> float:
    """Curva del fabricante (DFRobot SEN0189) aplicada al voltaje equivalente.

    Igual que TurbiditySensor::ntu() del firmware. Solo vale entre 2.5 y 4.2 V
    equivalentes; debajo de 2.5 V la parábola vuelve a bajar, así que se devuelve
    el tope de 3000 NTU.
    """
    ve = v_equivalente(v, cal)
    if ve < FORMULA_V_MIN:
        return 3000.0
    return min(3000.0, max(0.0, -1120.4 * ve * ve + 5742.3 * ve - 4352.9))


def texto_ntu(v: float, cal: dict) -> str:
    if v_equivalente(v, cal) < FORMULA_V_MIN:
        return "> 3000 NTU"
    ntu = ntu_estimado(v, cal)
    return f"{ntu:.1f} NTU" if ntu < 10 else f"{ntu:.0f} NTU"


def nota_ntu(v: float, cal: dict) -> str:
    ve = v_equivalente(v, cal)
    if ve < FORMULA_V_MIN:
        return "más turbia que el rango de la fórmula"
    if ve >= FORMULA_V_CLARA:
        return "igual o más clara que tu referencia"
    return "estimado: curva del fabricante ajustada a tu agua clara"


def claridad(v: float, cal: dict) -> tuple[float, str]:
    clara, turbia = referencias(cal)
    propias = "clara" in cal or "turbia" in cal
    if clara - turbia > 0.02:
        pct = (v - turbia) / (clara - turbia) * 100
        metodo = ("entre tus referencias" if propias else "entre las referencias del firmware") + \
                 f" ({clara:.2f} V = 100 %, {turbia:.2f} V = 0 %)"
    else:
        pct = v / clara * 100
        metodo = f"respecto al agua clara ({clara:.2f} V); la turbia no es válida"
    return min(100.0, max(0.0, pct)), metodo


def calidad(v: float, cal: dict) -> tuple[str, str]:
    if v_equivalente(v, cal) < FORMULA_V_MIN:
        return "Muy turbia (o la sonda tapada / sin señal)", ROJO
    ntu = ntu_estimado(v, cal)
    if ntu <= 1:
        return "Excelente (≤ 1 NTU)", VERDE
    if ntu <= 5:
        return "Buena: dentro de 5 NTU (límite usual de agua potable)", VERDE
    if ntu <= 50:
        return "Ligeramente turbia", AMARILLO
    if ntu <= 500:
        return "Turbia", AMARILLO
    return "Muy turbia", ROJO


def diagnostico(lectura: Lectura, estabilidad: float | None, cal: dict) -> list[tuple[str, str]]:
    mensajes: list[tuple[str, str]] = []
    v = lectura.v_salida
    clara, turbia = referencias(cal)
    if lectura.raw <= 20:
        mensajes.append((ROJO, "Lee ~0 V: el pin A no llega a GPIO35 (cable suelto o divisor abierto)."))
    elif lectura.raw >= 4075:
        mensajes.append((ROJO, "ADC saturado: falta la resistencia a GND o A va directo a GPIO35. "
                               "Desconecta: el ESP32 no debe pasar de 3.3 V."))
    elif v > 4.6:
        mensajes.append((AMARILLO, "Salida mayor a 4.6 V: revisa el divisor."))
    elif v > clara + 0.15:
        mensajes.append((AMARILLO, f"Más voltaje que tu agua clara ({clara:.2f} V): ¿sonda fuera del "
                                   "agua o con luz directa? Si es agua limpia de verdad, recalibra con c."))
    elif v < turbia - 0.15:
        mensajes.append((AMARILLO, f"Más turbia que tu referencia turbia ({turbia:.2f} V): agua muy "
                                   "sucia o sonda tapada. Si no cambia al limpiar el agua, revisa el "
                                   "cable 1-2-3."))
    if lectura.ruido > 0.10:
        mensajes.append((AMARILLO, f"Ruido alto ({lectura.ruido:.2f} V): burbujas en la ranura o cable flojo."))
    if estabilidad is not None and estabilidad > 0.05:
        mensajes.append((AMARILLO, "La lectura está cambiando: espera a que se estabilice antes de "
                                   "calibrar o medir una muestra."))
    if not mensajes:
        mensajes.append((VERDE, "Lectura normal."))
    return mensajes


def sparkline(valores: list[float]) -> str:
    if not valores:
        return ""
    bajo, alto = min(valores), max(valores)
    if alto - bajo < 0.05:  # no exagerar el ruido cuando la señal está quieta
        centro = (alto + bajo) / 2
        bajo, alto = centro - 0.025, centro + 0.025
    rango = alto - bajo
    return "".join(BLOQUES[min(7, int((v - bajo) / rango * 8))] for v in valores)


def barra(pct: float, ancho: int = 24) -> str:
    llenos = round(pct / 100 * ancho)
    return "█" * llenos + "░" * (ancho - llenos)


# --------------------------------------------------------------------------- archivos


def cargar_calibracion() -> dict:
    try:
        return json.loads(ARCHIVO_CALIBRACION.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def guardar_calibracion(cal: dict) -> None:
    ARCHIVO_CALIBRACION.write_text(json.dumps(cal, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


COLUMNAS_MUESTRAS = [
    "fecha", "nombre", "v_salida_prom", "v_salida_desv", "v_salida_min", "v_salida_max",
    "lecturas", "ntu_estimado", "claridad_pct", "metodo_claridad", "calidad",
    "ref_clara", "ref_turbia",
]

COLUMNAS_REGISTRO = [
    "fecha_hora", "ms_esp32", "adc", "v_gpio35", "v_salida", "ruido",
    "ntu_estimado", "claridad_pct",
]


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
        self.formato_viejo = False
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
                self.formato_viejo = False
            elif "TS-300B ====" in texto or texto.startswith("Voltaje salida A"):
                self.formato_viejo = True
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
        self.historial: deque[Lectura] = deque(maxlen=LECTURAS_HISTORIAL)
        self.ultima: Lectura | None = None
        self.sesion_min: float | None = None
        self.sesion_max: float | None = None
        self.muestras = cargar_muestras_recientes()
        self.muestra_en_curso: dict | None = None
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

    def avisar(self, texto: str, codigo: str = CIAN, segundos: float = 6.0) -> None:
        self.mensaje = (texto, codigo, time.monotonic() + segundos)
        if self.args.lineas:
            print(color(f"  » {texto}", codigo), flush=True)

    def estabilidad(self) -> float | None:
        recientes = [l.v_salida for l in list(self.historial)[-LECTURAS_ESTABILIDAD:]]
        return statistics.pstdev(recientes) if len(recientes) >= 3 else None

    # ----------------------------------------------------------------- lecturas

    def procesar(self, lectura: Lectura) -> None:
        v = lectura.v_salida
        self.ultima = lectura
        self.historial.append(lectura)
        self.sesion_min = v if self.sesion_min is None else min(self.sesion_min, v)
        self.sesion_max = v if self.sesion_max is None else max(self.sesion_max, v)

        if self.registro_escritor is not None:
            pct, _ = claridad(v, self.cal)
            self.registro_escritor.writerow([
                lectura.hora.isoformat(timespec="milliseconds"), lectura.ms, lectura.raw,
                f"{lectura.v_gpio:.3f}", f"{v:.3f}", f"{lectura.ruido:.3f}",
                f"{ntu_estimado(v, self.cal):.1f}", f"{pct:.1f}",
            ])
            self.registro.flush()
            self.registro_filas += 1

        if self.muestra_en_curso is not None:
            self.muestra_en_curso["valores"].append(v)
            if time.monotonic() >= self.muestra_en_curso["fin"]:
                self.terminar_muestra()

        if self.args.lineas:
            self.imprimir_linea(lectura)

    def imprimir_linea(self, lectura: Lectura) -> None:
        v = lectura.v_salida
        pct, _ = claridad(v, self.cal)
        texto_calidad, codigo = calidad(v, self.cal)
        print(
            f"{lectura.hora:%H:%M:%S}  ADC {lectura.raw:4d}  GPIO35 {lectura.v_gpio:.3f} V  "
            f"A {v:.3f} V  ruido {lectura.ruido:.3f} V  {texto_ntu(v, self.cal):>10}  "
            f"claridad {pct:5.1f} %  {color(texto_calidad, codigo)}",
            flush=True,
        )
        actual = [texto for _, texto in diagnostico(lectura, self.estabilidad(), self.cal)]
        if actual != self.diagnostico_previo:
            for texto in actual:
                print(color(f"  diagnóstico: {texto}", GRIS), flush=True)
            self.diagnostico_previo = actual

    # ----------------------------------------------------------------- acciones

    def calibrar(self, tipo: str) -> None:
        recientes = [l.v_salida for l in list(self.historial)[-LECTURAS_CALIBRACION:]]
        if len(recientes) < LECTURAS_CALIBRACION:
            self.avisar("Espera unos segundos de lecturas antes de calibrar.", AMARILLO)
            return
        v = statistics.fmean(recientes)
        if not 0.2 < v < 5.0:
            self.avisar(f"{v:.3f} V no es un valor válido para calibrar: revisa la conexión.", ROJO)
            return
        self.cal[tipo] = round(v, 3)
        self.cal[f"{tipo}_fecha"] = datetime.now().isoformat(timespec="seconds")
        guardar_calibracion(self.cal)
        nombre = "AGUA CLARA" if tipo == "clara" else "AGUA TURBIA"
        self.avisar(f"{nombre} guardada: {v:.3f} V (promedio de 3 s) en calibracion.json", VERDE)
        clara, turbia = self.cal.get("clara"), self.cal.get("turbia")
        if clara is not None and turbia is not None and clara <= turbia:
            self.avisar("Ojo: la referencia clara debería tener MÁS voltaje que la turbia.", AMARILLO, 10)

    def borrar_calibracion(self) -> None:
        if time.monotonic() > self.confirmar_borrado_hasta:
            self.confirmar_borrado_hasta = time.monotonic() + 3
            self.avisar("Presiona b otra vez para borrar la calibración.", AMARILLO, 3)
            return
        self.cal = {}
        ARCHIVO_CALIBRACION.unlink(missing_ok=True)
        self.confirmar_borrado_hasta = 0.0
        self.avisar("Calibración borrada.", VERDE)

    def pedir_texto(self, pregunta: str) -> str:
        self.restaurar_terminal()
        sys.stdout.write("\033[?25h" + f"\n {pregunta}")
        sys.stdout.flush()
        try:
            return input().strip()
        except EOFError:
            return ""
        finally:
            self.preparar_terminal()

    def iniciar_muestra(self) -> None:
        if self.muestra_en_curso is not None:
            self.muestra_en_curso = None
            self.avisar("Muestra cancelada.", AMARILLO)
            return
        if self.ultima is None:
            self.avisar("Todavía no hay lecturas del ESP32.", AMARILLO)
            return
        nombre = self.pedir_texto("Nombre de la muestra (ej. caño, tierra, café) y Enter: ")
        if not nombre:
            self.avisar("Muestra cancelada (sin nombre).", AMARILLO)
            return
        for lectura in self.lector.leer():  # lo que llegó mientras escribías no cuenta
            self.procesar(lectura)
        self.muestra_en_curso = {"nombre": nombre, "fin": time.monotonic() + SEGUNDOS_MUESTRA, "valores": []}

    def terminar_muestra(self) -> None:
        muestra, self.muestra_en_curso = self.muestra_en_curso, None
        valores = muestra["valores"]
        if len(valores) < 3:
            self.avisar("Muy pocas lecturas para la muestra; repite.", AMARILLO)
            return
        v = statistics.fmean(valores)
        pct, metodo = claridad(v, self.cal)
        texto_calidad, _ = calidad(v, self.cal)
        fila = {
            "fecha": datetime.now().isoformat(timespec="seconds"),
            "nombre": muestra["nombre"],
            "v_salida_prom": f"{v:.3f}",
            "v_salida_desv": f"{statistics.pstdev(valores):.3f}",
            "v_salida_min": f"{min(valores):.3f}",
            "v_salida_max": f"{max(valores):.3f}",
            "lecturas": len(valores),
            "ntu_estimado": f"{ntu_estimado(v, self.cal):.1f}",
            "claridad_pct": f"{pct:.1f}",
            "metodo_claridad": metodo,
            "calidad": texto_calidad,
            "ref_clara": self.cal.get("clara", ""),
            "ref_turbia": self.cal.get("turbia", ""),
        }
        agregar_muestra(fila)
        self.muestras = (self.muestras + [fila])[-5:]
        self.avisar(f"Muestra '{muestra['nombre']}': {v:.3f} V · {texto_ntu(v, self.cal)} · "
                    f"claridad {pct:.1f} % → guardada en muestras.csv", VERDE, 10)

    def alternar_registro(self) -> None:
        if self.registro is not None:
            self.registro.close()
            ruta, filas = self.registro_ruta, self.registro_filas
            self.registro = self.registro_escritor = self.registro_ruta = None
            self.avisar(f"Grabación detenida: {filas} lecturas en {ruta.relative_to(CARPETA)}", VERDE, 10)
            return
        CARPETA_REGISTROS.mkdir(exist_ok=True)
        self.registro_ruta = CARPETA_REGISTROS / f"turbidez-{datetime.now():%Y%m%d-%H%M%S}.csv"
        self.registro = self.registro_ruta.open("w", newline="", encoding="utf-8")
        self.registro_escritor = csv.writer(self.registro)
        self.registro_escritor.writerow(COLUMNAS_REGISTRO)
        self.registro_filas = 0
        self.avisar(f"Grabando en {self.registro_ruta.relative_to(CARPETA)} (g para detener)", VERDE)

    def tecla(self, caracter: str) -> None:
        acciones = {
            "c": lambda: self.calibrar("clara"),
            "t": lambda: self.calibrar("turbia"),
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
        titulo = " TS-300B · Monitor de turbidez"
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
            if self.lector.formato_viejo:
                envolver("El ESP32 tiene la versión anterior del sketch. Cárgalo otra vez: "
                         "./tools/pio.sh run -d pruebas/turbidez -t upload", AMARILLO, "⚠ ")
            elif self.lector.ser is not None:
                envolver("Si no aparece nada en unos segundos, carga el sketch: "
                         "./tools/pio.sh run -d pruebas/turbidez -t upload", GRIS, "")
        else:
            v = lectura.v_salida
            est = self.estabilidad()
            seccion("LECTURA")
            dato("ADC (0–4095)", f"{lectura.raw}")
            dato("Voltaje en GPIO35", f"{lectura.v_gpio:.3f} V")
            dato("Voltaje salida A", color(f"{v:.3f} V", NEGRITA), "GPIO35 × 2: lo que entrega el módulo")
            dato("Ruido de la lectura", f"{lectura.ruido:.3f} V")
            if est is None:
                dato("Estabilidad (5 s)", "—")
            else:
                estable = color("estable", VERDE) if est <= 0.02 else color("cambiando", AMARILLO)
                dato("Estabilidad (5 s)", f"±{est:.3f} V  {estable}")

            pct, metodo = claridad(v, self.cal)
            texto_calidad, codigo = calidad(v, self.cal)
            seccion("RESULTADO")
            dato("Turbidez estimada", color(texto_ntu(v, self.cal), NEGRITA), nota_ntu(v, self.cal))
            codigo_barra = VERDE if pct >= 80 else AMARILLO if pct >= 40 else ROJO
            dato("Claridad", f"{pct:5.1f} %  " + color(barra(pct), codigo_barra))
            dato("", color(metodo, GRIS))
            dato("Calidad del agua", color(texto_calidad, codigo))

            valores = [l.v_salida for l in self.historial]
            seccion("HISTORIAL", f"últimos {len(valores) / 2:.0f} s · mín {min(valores):.3f} V · máx {max(valores):.3f} V")
            filas.append("   " + color(sparkline(valores), CIAN))
            filas.append(color(f"   Toda la sesión: mín {self.sesion_min:.3f} V · máx {self.sesion_max:.3f} V", GRIS))

            seccion("DIAGNÓSTICO")
            for codigo_diag, texto in diagnostico(lectura, est, self.cal):
                envolver(texto, codigo_diag, "✔ " if codigo_diag == VERDE else "⚠ ")
            if sin_datos is not None and sin_datos > SEGUNDOS_SIN_DATOS:
                envolver(f"Sin datos nuevos hace {sin_datos:.0f} s.", ROJO, "✖ ")

        clara, turbia = referencias(self.cal)
        origen_clara = "tuya" if "clara" in self.cal else "firmware"
        origen_turbia = "tuya" if "turbia" in self.cal else "firmware"
        seccion("CALIBRACIÓN", "calibracion.json · c / t para cambiarla")
        filas.append(f"   Agua clara   {clara:.3f} V ({origen_clara})      "
                     f"Agua turbia  {turbia:.3f} V ({origen_turbia})")

        seccion("MUESTRAS GUARDADAS", "muestras.csv")
        if self.muestras:
            for fila in self.muestras:
                hora = fila["fecha"][11:16]
                v_fila = float(fila["v_salida_prom"])
                filas.append(f"   {hora}  {fila['nombre'][:18]:<18}  {v_fila:.3f} V  "
                             f"{texto_ntu(v_fila, self.cal):>10}  {float(fila['claridad_pct']):5.1f} %")
        else:
            filas.append(color("   (ninguna todavía: pon la sonda en el agua y presiona m)", GRIS))

        if self.muestra_en_curso is not None:
            restante = max(0.0, self.muestra_en_curso["fin"] - time.monotonic())
            filas.append("")
            filas.append(color(f" ● Midiendo '{self.muestra_en_curso['nombre']}'... faltan {restante:.0f} s "
                               f"({len(self.muestra_en_curso['valores'])} lecturas). No muevas la sonda. "
                               "m = cancelar", AMARILLO))
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
        filas.append(" [c] clara  [t] turbia  [m] muestra  [g] grabar  [b] borrar cal.  [q] salir")
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
        else:
            sys.stdout.write("\033[?1049h")
            self.preparar_terminal()
        ultimo_dibujo = 0.0
        error_mostrado = self.lector.error
        try:
            while not self.salir:
                entradas = [sys.stdin] if interactivo else []
                fd = self.lector.fileno()
                if fd is not None:
                    entradas.append(fd)
                listos, _, _ = select.select(entradas, [], [], 0.2) if entradas else ([], [], [])
                if not entradas:
                    time.sleep(0.2)
                if interactivo and sys.stdin in listos:
                    for caracter in os.read(sys.stdin.fileno(), 32).decode("utf-8", "ignore"):
                        self.tecla(caracter)
                for lectura in self.lector.leer():
                    self.procesar(lectura)
                if self.args.lineas and self.lector.error != error_mostrado:
                    if self.lector.error:
                        print(color(self.lector.error, ROJO), flush=True)
                    error_mostrado = self.lector.error
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
        description="Monitor de consola del sensor de turbidez TS-300B (prueba de banco).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            Teclas del panel:
              c  agua clara    t  agua turbia    m  muestra con nombre
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
