# Prueba de banco del sensor de pH PH-7BNC

Sketch de banco y monitor de consola para verificar el módulo de pH (PH-7BNC, equivalente
PH-4502C), el divisor y la sonda, calibrar con buffers y hacer pruebas propias (agua de caño,
vinagre, bicarbonato...).

- El **ESP32** envía cada 0.5 s una línea con la lectura cruda (mediana de 15 muestras).
- El **monitor** (`monitor.py`) calcula y muestra todo en vivo: voltajes, pH, tipo de agua,
  estabilidad, historial, diagnóstico y calibración.

## Conexión

| Módulo | Va a |
| --- | --- |
| VCC | 5 V (VIN del ESP32) |
| GND | GND |
| Po | divisor 4.7 kΩ + 4.7 kΩ → GPIO 34 |
| Do | sin conectar |
| To | sin conectar |

```
Po ──[4.7k]──┬── GPIO 34
              │
           [4.7k]
              │
             GND
```

La sonda se enrosca en el conector **BNC** del módulo (empujar y girar).

## Uso

```bash
# 1. Cargar el sketch (una sola vez)
./tools/pio.sh run -d pruebas/ph -t upload

# 2. Abrir el monitor
./.venv/bin/python pruebas/ph/monitor.py
```

Otras formas:

```bash
./.venv/bin/python pruebas/ph/monitor.py --lineas            # una línea por lectura
./.venv/bin/python pruebas/ph/monitor.py --grabar            # graba todo desde el inicio
./.venv/bin/python pruebas/ph/monitor.py --lineas --segundos 30
```

Si dice *Sin permiso para abrir /dev/ttyUSB0*: `sudo usermod -aG uucp $USER` y volver a
iniciar sesión (permanente), o `sudo chmod 666 /dev/ttyUSB0` (hasta desconectar el USB).

### Teclas

| Tecla | Qué hace |
| --- | --- |
| `c` | **Calibrar**: pregunta la referencia (`vinagre`, `bicarbonato`... o el pH de un buffer), mide 15 s y la guarda |
| `m` | Mide una **muestra con nombre**: promedia 10 s y la guarda en `muestras.csv` |
| `g` | Empieza / detiene la **grabación** de todas las lecturas en `registros/*.csv` |
| `b` | Borra la calibración (presionar dos veces) |
| `q` | Salir |

La calibración se guarda en `calibracion.json` y se mantiene al cerrar el monitor.
`calibracion.json`, `muestras.csv` y `registros/` son datos locales (ignorados por Git).

## Paso 1: ajustar el offset (sin buffers)

El módulo tiene dos potenciómetros. Uno mueve la salida `Po` (offset) y el otro solo cambia
el umbral de `Do`.

1. Desenrosca la sonda del BNC.
2. Une el **pin central** del BNC con el **aro exterior** (un cable o un clip). Eso equivale
   a pH 7 (0 mV).
3. Con el monitor abierto, gira el potenciómetro de offset (normalmente el más cercano al
   BNC) hasta que **Voltaje salida Po** marque **2.50 V**. Si al girarlo no cambia `Po`,
   es el otro.
4. Quita el puente y vuelve a enroscar la sonda.

Así queda margen para todo el rango de pH (≈ 3.0 V en pH 4, ≈ 2.0 V en pH 10).

## Paso 2: calibrar

Con `c` el monitor pregunta en qué está la sonda. Se puede responder con el **pH de un
buffer** comprado (`6.86`, `4`, `9.18`...) o con el **nombre de una referencia casera**.

### Sin buffers: referencias caseras

| Escribe | Qué es | pH | Precisión | Cómo prepararla |
| --- | --- | --- | --- | --- |
| `cremor` | Cremor tártaro (repostería) | 3.56 | ±0.05 | ½ cucharadita en un vaso de agua, agitar 2 min; **debe quedar polvo sin disolver** |
| `borax` | Bórax (boticas) | 9.18 | ±0.05 | 1 g en 250 ml de agua (no hace falta exactitud) |
| `vinagre` | Vinagre blanco 4–5 % | 2.45 | ±0.15 | Tal cual, **sin diluir** |
| `bicarbonato` | Bicarbonato de sodio | 8.30 | ±0.15 | 1 cucharadita en un vaso de agua; usar **recién hecho** |
| `limon` | Jugo de limón | 2.20 | ±0.30 | Recién exprimido y colado (varía según el limón) |
| `magnesia` | Leche de magnesia | 10.4 | ±0.30 | Tal cual; enjuagar muy bien después |
| `agua 7.55` | Agua con pH conocido (etiqueta o reporte de la empresa de agua) | el que escribas | ±0.30 | Tal cual; tarda 1–3 min en estabilizarse |
| `puente` | BNC en corto (paso 1) | 7.00 | ±0.50 | Sin sonda: une el pin central y el aro del BNC |

`cremor` y `borax` son patrones de laboratorio de verdad: si los consigues, la calibración
queda casi como con buffers comprados.

**Combinaciones recomendadas** (de mejor a peor):

1. `cremor` + `bicarbonato` o `borax` → ±0.1 pH
2. `vinagre` + `bicarbonato` → ±0.2 pH
3. `limon` + `bicarbonato` → ±0.3 pH
4. `puente` + `limon` o `vinagre` → ±0.5 pH (solo una referencia química)

Una ácida y una alcalina: cuanto más separadas, mejor la pendiente. El puente solo se usa
si no hay dos referencias químicas, porque no incluye el error propio del electrodo.

### Procedimiento

1. Enjuaga la sonda con agua (destilada si tienes) y sécala con papel sin frotar el bulbo.
2. Sumérgela en la referencia, agita suave y espera **30–60 s** hasta que diga *estable*.
3. Presiona `c`, escribe el nombre (por ejemplo `vinagre`) o el pH, y Enter. No muevas la
   sonda durante los 15 s.
4. Enjuaga **muy bien** y repite con la otra referencia.
5. Comprueba con agua de caño: debe dar entre 6.5 y 8.5. Si tienes agua embotellada con el
   pH en la etiqueta, compárala (±0.3).

Con una sola referencia se corrige el offset y se usa la pendiente del firmware (157 mV/pH). Con
dos o más se calcula la recta completa (mínimos cuadrados). Si la lectura se mueve más de
±0.02 V durante la medición, la calibración no se guarda. Calibra con las referencias a
temperatura ambiente (~20–25 °C).

**No uses** lejía, limpiadores con amoníaco ni detergentes: dañan el bulbo de vidrio.

## Qué muestra

| Dato | Significado |
| --- | --- |
| ADC | Lectura cruda del GPIO 34 (0–4095) |
| Voltaje en GPIO34 | Voltaje del pin, con la calibración de fábrica del ADC |
| Voltaje salida Po | El doble: lo que entrega el módulo antes del divisor |
| Ruido | Diferencia entre la muestra mayor y la menor de una lectura |
| Estabilidad | Desviación de las últimas 10 lecturas (5 s), en V y en pH |
| pH | `7 + (V_neutro − V) / pendiente` (mismo modelo que el firmware) |
| Tipo de agua | Muy ácida < 4 ≤ ácida < 6.5 ≤ ligeramente ácida < 6.8 ≤ neutra ≤ 7.2 < … |
| Agua potable | Si está dentro de 6.5–8.5 |

Sin `calibracion.json` se usan los valores del firmware: neutro 2.6015 V y pendiente
0.1565 V/pH (calibración del 25/11/2026). El voltaje **baja** cuando el pH **sube**.

### Formato que envía el ESP32

```
ph ms=5197 raw=1402 mv=1250 min=1240 max=1262 n=15
```

`raw` y `mv` son la mediana; `min` y `max`, la muestra menor y mayor (en mV del GPIO 34).

## Valores típicos (módulo a 5 V, offset ajustado)

| pH | Salida Po | GPIO 34 |
| --- | --- | --- |
| 4.00 | ≈ 3.04 V | ≈ 1.52 V |
| 6.86 / 7.00 | ≈ 2.53 / 2.50 V | ≈ 1.26 / 1.25 V |
| 9.18 | ≈ 2.11 V | ≈ 1.05 V |

## Si no funciona

- **ADC 0** → Po desconectado o divisor abierto.
- **ADC 4095** → falta la resistencia a GND o Po va directo a GPIO 34.
- **Po fijo cerca de 3.9 V o de 0 V, pH fuera de escala** → offset muy corrido o sonda sin
  señal: haz el paso 1 (puente en el BNC). Si con el puente tampoco llega a 2.5 V, el
  módulo no está recibiendo 5 V.
- **Valor que deriva lento** → normal los primeros 30–60 s; si sigue, el bulbo puede estar
  seco: déjalo 30 min en la solución de guardado (KCl) o en buffer 4.
- **Valores que saltan** → cable de la sonda movido o contacto flojo en el BNC.
- Guarda la sonda **siempre húmeda**, con su tapa y la solución de guardado.
