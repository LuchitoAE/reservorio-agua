# Prueba de banco del sensor de turbidez TS-300B

Sketch de banco y monitor de consola para verificar el módulo TS-300B (pines `V D A G`),
el divisor y la sonda, y para hacer pruebas propias (agua de caño, agua con tierra, café...).

- El **ESP32** envía cada 0.5 s una línea con la lectura cruda (mediana de 15 muestras).
- El **monitor** (`monitor.py`) calcula y muestra todo en vivo: voltajes, turbidez estimada
  (NTU), claridad, calidad del agua, estabilidad, historial y diagnóstico.

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

El LED de la sonda es **infrarrojo**: para verlo usa la cámara **frontal** del celular
(muchas cámaras traseras filtran el infrarrojo) y mira la ranura de la sonda a oscuras.

## Uso

```bash
# 1. Cargar el sketch (una sola vez)
./tools/pio.sh run -d pruebas/turbidez -t upload

# 2. Abrir el monitor
./.venv/bin/python pruebas/turbidez/monitor.py
```

Otras formas:

```bash
./.venv/bin/python pruebas/turbidez/monitor.py --lineas            # una línea por lectura
./.venv/bin/python pruebas/turbidez/monitor.py --grabar            # graba todo desde el inicio
./.venv/bin/python pruebas/turbidez/monitor.py --puerto /dev/ttyUSB1
./.venv/bin/python pruebas/turbidez/monitor.py --lineas --segundos 30
```

Si dice *Sin permiso para abrir /dev/ttyUSB0*: `sudo usermod -aG uucp $USER` y volver a
iniciar sesión (permanente), o `sudo chmod 666 /dev/ttyUSB0` (hasta desconectar el USB).

### Teclas

| Tecla | Qué hace |
| --- | --- |
| `c` | Guarda la lectura actual (promedio de 3 s) como **agua clara** = 100 % |
| `t` | Guarda la lectura actual como **agua turbia** = 0 % |
| `m` | Mide una **muestra con nombre**: promedia 10 s y la guarda en `muestras.csv` |
| `g` | Empieza / detiene la **grabación** de todas las lecturas en `registros/*.csv` |
| `b` | Borra la calibración (presionar dos veces) |
| `q` | Salir |

La calibración se guarda en `calibracion.json` y se mantiene al cerrar el monitor.
`calibracion.json`, `muestras.csv` y `registros/` son datos locales (ignorados por Git).

### Prueba sugerida

1. Sonda en agua de caño, **hasta la marca**. Espera a que diga *estable* → `c`.
2. `m` → `caño`.
3. Agrega una pizca de tierra, revuelve y espera → `m` → `tierra`.
4. Más tierra (o café / leche) → `m` → `muy turbia`. Si quieres esa como 0 %, presiona `t`.
5. Compara las muestras en el panel o abre `muestras.csv` en una hoja de cálculo.

## Qué muestra

```
 LECTURA
   ADC (0–4095)          1630
   Voltaje en GPIO35     1.447 V
   Voltaje salida A      2.894 V  GPIO35 × 2: lo que entrega el módulo
   Ruido de la lectura   0.020 V
   Estabilidad (5 s)     ±0.003 V  estable

 RESULTADO
   Turbidez estimada     0.0 NTU  igual o más clara que tu referencia
   Claridad              100.0 %  ████████████████████████
   Calidad del agua      Excelente (≤ 1 NTU)
```

| Dato | Significado |
| --- | --- |
| ADC | Lectura cruda del GPIO 35 (0–4095) |
| Voltaje en GPIO35 | Voltaje del pin, con la calibración de fábrica del ADC |
| Voltaje salida A | El doble: lo que entrega el módulo antes del divisor |
| Ruido | Diferencia entre la muestra mayor y la menor de una lectura |
| Estabilidad | Desviación de las últimas 10 lecturas (5 s) |
| Turbidez estimada | Curva del fabricante ajustada a tu agua clara (ver abajo) |
| Claridad | `(V − V_turbia) / (V_clara − V_turbia) × 100`, con tus referencias `c`/`t` o las del firmware |
| Calidad | ≤ 1 NTU excelente, ≤ 5 buena, ≤ 50 ligeramente turbia, ≤ 500 turbia, más: muy turbia |

**NTU estimadas.** Este módulo da ~2.9 V en agua de caño, no los 4.2 V de la curva del
fabricante. Por eso la lectura se escala para que tu agua clara equivalga a 4.2 V y luego
se aplica la curva:

```
Ve  = V × 4.2 / V_clara
NTU = −1120.4·Ve² + 5742.3·Ve − 4352.9      (válida para Ve de 2.5 a 4.2 V)
```

Es el mismo cálculo que hace el firmware (`TurbiditySensor::ntu()`). Sirve para tendencias;
para NTU reales hay que calibrar con patrones. La **claridad** es la medida más confiable
para comparar tus muestras entre sí.

Sin `calibracion.json`, el monitor usa las referencias del firmware: clara 2.89 V y
turbia 2.52 V.

### Formato que envía el ESP32

```
turb ms=5197 raw=1631 mv=1453 min=1440 max=1466 n=15
```

`raw` y `mv` son la mediana; `min` y `max`, la muestra menor y mayor (en mV del GPIO 35).

## Valores medidos (25/11/2026)

Con este módulo, alimentado desde VIN:

| Muestra | Salida A | Claridad | NTU estimadas |
| --- | --- | --- | --- |
| Agua de caño (referencia clara) | 2.89 V | 100 % | 0 |
| Agua con una pizca de tierra | 2.63 V | 31 % | ~1200 |
| Agua con más tierra (referencia turbia) | 2.52 V | 0 % | ~1650 |
| Sonda tapada / muy sucia | 2.07–2.27 V | 0 % | > 2000 |

La guía del fabricante habla de 4.0–4.3 V en agua clara; este módulo entrega menos (rango
comprimido), por eso hay que calibrar. Si cambias la alimentación o el módulo, recalibra.

| Falla | Salida A | GPIO 35 | ADC |
| --- | --- | --- | --- |
| A desconectado | 0 V | 0 V | 0 |
| Divisor saturado | > 3.3 V | 3.3 V | 4095 |

## Si no funciona

- **ADC 0** → A desconectado o divisor abierto.
- **ADC 4095** → falta la resistencia a GND o A va directo a GPIO 35.
- **El voltaje no cambia al tapar la sonda o al ensuciar el agua** → la sonda no entrega
  señal: LED infrarrojo apagado, cable en otros pines del conector `1 2 3 4` o V sin 5 V.
- **Valores que saltan** → burbujas o contacto flojo.
- **Esperando datos / "versión anterior del sketch"** → vuelve a cargar el sketch.
- La sonda se sumerge **solo hasta la marca**; la electrónica queda afuera.
