# Prueba de banco del sensor de turbidez TS-300B

Sketch mínimo para verificar el módulo TS-300B (4 pines `V D G A`) y el divisor
antes de cargar el firmware completo.

## Conexión

| Módulo | Va a |
| --- | --- |
| V | 5 V (VIN del ESP32) |
| G | GND |
| A | divisor 4.7 kΩ + 4.7 kΩ → GPIO 35 |
| D | sin conectar |

```
A ──[4.7k]──┬── GPIO 35
             │
          [4.7k]
             │
            GND
```

La sonda va al conector de 4 pines numerado (`4 3 2 1`); usa 3 y deja uno libre.
El conector de la sonda tiene una pestaña y entra de una sola forma.

## Uso

```bash
./tools/pio.sh run -d pruebas/turbidez -t upload
```

Para leer la salida sin el monitor interactivo:

```bash
./.venv/bin/python - <<'PY'
import serial, time
s = serial.Serial('/dev/ttyUSB0', 115200, timeout=1)
time.sleep(2.5)
s.reset_input_buffer()
end = time.time() + 15
while time.time() < end:
    line = s.readline()
    if line:
        print(line.decode('utf-8', 'replace').rstrip())
s.close()
PY
```

## Qué muestra

```
raw 1360   pin 1.096 V   sonda 2.190 V   NTU 2851   claridad 52 %   -> TURBIA
```

- `raw`: lectura del ADC (0–4095).
- `pin`: voltaje en GPIO 35 (ya dividido).
- `sonda`: voltaje real de A (pin × 2).
- `NTU` y `claridad`: según la curva del fabricante y la referencia de 4.20 V.

## Valores esperados

| Condición | `sonda` | `pin` | `raw` | Claridad |
| --- | --- | --- | --- | --- |
| Agua clara | 4.0–4.3 V | 2.0–2.15 V | ~2500–2700 | 95–100 % |
| Agua turbia | 3.4–3.8 V | 1.7–1.9 V | ~2100–2350 | 80–90 % |
| Sonda en aire / mal conectada | ≈2.2 V | ≈1.1 V | ≈1360 | ~50 % |

El valor de ~2.2 V en aire o con la sonda desconectada es la referencia típica de
entrada flotante; no es una medición válida.

## Si no funciona

- **Sonda ≈2.2 V y no cambia**: revisar que V del módulo esté en **5 V** (no 3.3 V),
  que la sonda esté bien enchufada y que el LED infrarrojo encienda (brillo rojizo
  tenue en uno de los dos "cuernos", a oscuras).
- **ADC saturado (`raw` ≈4095)**: el divisor no está conectado o A va directo a GPIO 35.
- **`raw` ≈0**: A no llega al GPIO 35 o falta el divisor.
- **Valores que saltan**: burbujas en el lente; golpear suavemente la sonda.
- La sonda se sumerge **solo hasta la marca**; la parte azul con la electrónica queda afuera.
