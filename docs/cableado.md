# Cableado y conexiones

![Pinout del ESP32 DevKit V1](img/pinout-esp32.svg)

## 1. Mapa de pines (ESP32 DevKit V1, 30 pines)

```
                    ┌──────────────────────┐
       EN           │                      │ 3V3 ── DS18B20 VDD, pull-ups
  36 (VP)           │                      │ GND
  39 (VN)           │      ESP32           │ 15
  34 ── pH (ADC1)   │      DevKit V1       │ 2
  35 ── Turb (ADC1) │       30 pin         │ 4  ── DS18B20 DATA (OneWire)
  32                │                      │ 16
  33                │                      │ 17
  25                │                      │ 5
  26                │                      │ 18 ── HC-SR04 ECHO (divisor)
  27                │                      │ 19 ── HC-SR04 TRIG
  14                │                      │ 21 ── LCD SDA
  12                │                      │ 3
  13                │                      │ 1
  GND               │                      │ 22 ── LCD SCL
  VIN (5V USB)      │                      │ 23 ── YF-S201 señal
                    └──────────────────────┘
```

| Función | GPIO | Notas |
| --- | --- | --- |
| HC-SR04 TRIG | 19 | Salida 3.3 V, el sensor acepta 3.3 V en TRIG |
| HC-SR04 ECHO | 18 | **Divisor 5 V → ~3 V** |
| YF-S201 señal | 23 | Entrada con interrupción; requiere pull-up (usar 4.7 kΩ a 3.3 V) |
| DS18B20 DATA | 4 | Pull-up 4.7 kΩ a **3.3 V** |
| pH (Po) | 34 | ADC1, solo entrada. **Máx 3.3 V** |
| Turbidez (A) | 35 | ADC1, solo entrada. **Máx 3.3 V** |
| LCD SDA | 21 | I2C |
| LCD SCL | 22 | I2C |

> No uses GPIO 6–11 (flash interna), ni 0/2/12/15 para cosas que deban arrancar siempre
> igual (son pines de *strapping*). Los elegidos evitan todos esos casos.

## 2. Alimentación

| Módulo | Voltaje | Consumo aprox. |
| --- | --- | --- |
| HC-SR04 | 5 V | 15 mA |
| YF-S201 | 5–24 V (5 V sirve) | 15 mA |
| DS18B20 | 3.0–5.5 V | 1.5 mA |
| Módulo pH | 5 V (ver nota) | 10 mA |
| SEN0189 turbidez | 5 V | 3 mA |
| LCD 1602 + I2C | 5 V | 20 mA + backlight |

- Todos los **GND en común** con el ESP32.
- Para pruebas, el USB alcanza (~100 mA). Para la instalación final usa fuente de 5 V / 2 A.
- **Nunca** alimentes el HC-SR04 con 3.3 V: mide mal.

## 3. Divisores de tensión (con las resistencias de 4.7 kΩ)

### HC-SR04 ECHO (5 V → 3.3 V)

```
ECHO ──[ 4.7k ]──┬── GPIO18
                 │
              [ 4.7k ]
                 │
                GND
```

Salida ≈ 2.5 V. El ESP32 lo lee como HIGH (el umbral es ~0.75 × 3.3 V = 2.47 V), pero queda
**al límite**. Si tienes 1 kΩ y 2 kΩ, usa esa pareja (5 V → 3.33 V, más margen). Si ves
lecturas inestables, cambia a `1k + 2k` o `4.7k + 10k`.

### Turbidez SEN0189 (hasta 4.5 V → 3.3 V)

```
AO ──[ 4.7k ]──┬── GPIO35
               │
            [ 4.7k ]
               │
              GND
```

Salida ≈ mitad de la original: 4.5 V → 2.25 V. En el firmware se compensa con
`TURBIDITY_DIVIDER = 2.0` (el voltaje real es el doble del medido). Con un divisor
`4.7k + 10k` se aprovecha mejor el rango del ADC (4.5 V → 3.06 V), pero entonces hay que
ajustar el factor a `(4.7+10)/10 = 1.47`.

### pH PH-7BNC

El módulo entrega entre 0 y ~3.8 V según el pH (≈2.5 V en pH 7). Alimentado a 5 V hay que
**dividir la salida** para no pasar de 3.3 V:

- **Recomendado:** VCC a 5 V y divisor `4.7k + 4.7k` en la salida `Po` → el firmware usa
  `PH_DIVIDER = 2.0` (valor por defecto).
- Alternativa sin divisor: alimentar el módulo a **3.3 V**. La señal queda dentro de rango,
  pero hay que cambiar `PH_DIVIDER` a `1.0f` en `config.h` y recalibrar. No todos los
  módulos funcionan bien a 3.3 V.

> El electrodo de pH no debe quedarse seco. Guárdalo en la solución de almacenamiento
> (KCl 3 M) y no lo dejes sumergido en agua corriente por semanas: se degrada.

## 4. Sensores, uno por uno

### HC-SR04 — nivel

- Montaje: en la **tapa**, mirando hacia abajo, perpendicular al agua.
- Rango útil 2–400 cm; con el tanque lleno el eco debe volver sin obstáculos.
- `nivel = altura_tanque − distancia_medida − offset_sensor`.
- Calibra la altura real del tanque en el panel de ajustes del dashboard.
- Ojo con la condensación: el sensor no es sumergible. Usa un tubo guía o montura
  elevada y sella la electrónica.

### YF-S201 — caudal

- Instálalo en la tubería de entrada (o salida) respetando la flecha de flujo.
- 450 pulsos = 1 litro (`FLOW_PULSES_PER_LITER`).
- La señal es de colector abierto: **pull-up 4.7 kΩ a 3.3 V** y luego al GPIO 23.
- Evita tirones de cable largos sin apantallar; usa el cable flat solo para tramos cortos.

### DS18B20 — temperatura

- Sonda impermeable, la mayoría vienen en cable de 3 hilos (rojo VDD, negro GND, amarillo DATA).
- Pull-up 4.7 kΩ entre DATA y 3.3 V.
- Resolución 12 bits (0.0625 °C). El firmware hace la conversión de forma no bloqueante.

### PH-7BNC — pH

- Sonda BNC + módulo con potenciómetros de offset y pendiente.
- Deja los potenciómetros en posición media al principio y calibra por software
  (ver [`calibracion.md`](calibracion.md)).
- Necesita estar siempre húmedo; enjuaga con agua destilada entre mediciones.
- La lectura se filtra con mediana de 15 muestras para quitar ruido del ADC.

### SEN0189 — turbidez

- Sensor óptico: la suciedad en el lente falsea la lectura. Límpialo cada tanto.
- No lo sumerjas más allá de la marca; la electrónica va fuera del agua.
- Salida aproximada: agua clara 4.1–4.5 V, agua turbia baja hasta ~2.5 V (alimentado a 5 V).
- Conversión NTU usada (aproximada, para tendencias más que para laboratorio):
  `NTU = −1120.4·V² + 5742.3·V − 4352.9`, con V ya compensado por el divisor.
- El dashboard además muestra **% de claridad** referido al voltaje de agua clara calibrado.

### LCD 1602 I2C

- Dirección típica `0x27` (algunos `0x3F`). El firmware la detecta solo al arrancar y la
  informa por el monitor serie (`[lcd] pantalla en 0x27`).
- Alimenta a 5 V; SDA/SCL al ESP32 (3.3 V) funciona porque el backpack tiene pull-ups
  propios. Si el bus falla, prueba subir con 4.7 kΩ a 3.3 V.

## 5. Armado sugerido con el cable flat

1. Corta el flat en dos tramos: uno para señales analógicas (pH, turbidez) y otro para
   digitales (ultrasónico, flujo, OneWire, I2C).
2. Usa los hilos de los extremos como **GND** y **5 V**, y deja uno libre entre señal y
   alimentación para reducir acoplamiento.
3. Suelda o usa borneras; el flat dupont se afloja con la vibración.
4. Etiqueta cada hilo en ambos extremos (PH, TURB, TRIG, ECHO, FLOW, TEMP, SDA, SCL).
