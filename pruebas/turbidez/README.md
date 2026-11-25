# Prueba de banco del sensor de turbidez TS-300B

Sketch de banco para verificar el módulo TS-300B (4 pines `V D G A`), el divisor y la
sonda. Mide 9 muestras, calcula la mediana y permite guardar dos referencias para obtener
un índice relativo de claridad. **No calcula NTU**: eso requiere calibrar con muestras
conocidas.

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

La sonda va al conector numerado (`1 2 3 4`) del módulo:

| Pin | Función | Cable |
| --- | --- | --- |
| 1 | Sensor + | rojo |
| 2 | Sensor out | amarillo (o azul) |
| 3 | Sensor − | azul (o amarillo) |
| 4 | Power negative | libre |

Si el LED de la sonda no enciende, intercambiá amarillo y azul (pines 2 y 3). El LED
es infrarrojo: miralo con la cámara del celular.

## Uso

```bash
./tools/pio.sh run -d pruebas/turbidez -t upload
./tools/pio.sh device monitor -d pruebas/turbidez -b 115200
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
========== TS-300B ==========
ADC: 1630
Voltaje GPIO35: 1.457 V
Voltaje salida A: 2.914 V
Promedio GPIO: 1.457 V
Minimo GPIO: 1.450 V
Maximo GPIO: 1.466 V
Variacion: 0.016 V
Indice de claridad: SIN CALIBRAR
=============================
```

- `ADC`: lectura cruda (0–4095).
- `GPIO35`: voltaje calibrado del pin (ya dividido).
- `Salida A`: el doble, o sea la salida real del módulo.
- `Variacion`: diferencia entre la muestra mínima y la máxima; sirve para detectar ruido.
- `Indice de claridad`: relativo entre las dos referencias calibradas.

`analogReadMilliVolts()` usa la calibración de fábrica del ADC del ESP32, por eso el
voltaje puede ser algo distinto del cálculo simple `raw × 3.3 / 4095`.

## Calibración

Con el monitor abierto:

| Tecla | Qué hace |
| --- | --- |
| `c` + Enter | Guarda la lectura actual como **agua clara** |
| `t` + Enter | Guarda la lectura actual como **agua turbia** |

Después de las dos, el índice se calcula como:

```
claridad = (V - V_turbia) / (V_clara - V_turbia) × 100
```

Las referencias **no se guardan** al reiniciar; son solo para esta prueba.

## Valores esperados

| Condición | Salida A | GPIO 35 | ADC |
| --- | --- | --- | --- |
| Agua clara | 4.0–4.3 V | 2.0–2.15 V | ~2500–2700 |
| Agua con café o leche | 3.4–3.9 V | 1.7–1.95 V | ~2100–2400 |
| Sonda en aire / sin señal | ~2.7 V | ~1.35 V | ~1670 |
| Divisor saturado | > 3.3 V | 3.3 V | 4095 |

## NTU

El índice de claridad es **relativo** a las muestras usadas. Para NTU reales hay que
calibrar con patrones o muestras preparadas; la fórmula del fabricante es solo una
aproximación.

## Si no funciona

- **ADC 0** → A desconectado o divisor abierto.
- **ADC 4095** → falta la resistencia a GND o A va directo a GPIO 35.
- **Estable en ~2.7–2.9 V y no cambia en agua** → la sonda no entrega señal: revisar los
  pines 2 y 3, el LED infrarrojo y que V esté en 5 V.
- **Valores que saltan** → burbujas o contacto flojo.
- La sonda se sumerge **solo hasta la marca**; la electrónica queda afuera.
