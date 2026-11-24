# Prueba de banco del HC-SR04

Sketch mínimo para verificar el sensor ultrasónico **sin** cargar el firmware completo.
Sirve para descartar cableado, divisor de ECHO y alimentación antes de montar el sensor
en el tanque.

## Conexión

| HC-SR04 | ESP32 |
| --- | --- |
| VCC | 5 V (VIN o riel de 5 V) |
| GND | GND |
| TRIG | GPIO 19 |
| ECHO | GPIO 18 **a través de un divisor** (por ejemplo 1 kΩ + 2 kΩ, o 4.7 kΩ + 4.7 kΩ) |

ECHO entrega 5 V. No lo conectes directo al GPIO del ESP32.

## Uso

```bash
./tools/pio.sh run -d pruebas/hcsr04 -t upload
```

Para leer la salida sin el monitor interactivo de PlatformIO:

```bash
./.venv/bin/python - <<'PY'
import serial, time
s = serial.Serial('/dev/ttyUSB0', 115200, timeout=1)
time.sleep(2.5)
s.reset_input_buffer()
end = time.time() + 10
while time.time() < end:
    line = s.readline()
    if line:
        print(line.decode('utf-8', 'replace').rstrip())
s.close()
PY
```

En Arch, si `/dev/ttyUSB0` pertenece a `uucp`:

```bash
sudo usermod -aG uucp $USER   # cerrar y volver a entrar
```

## Qué muestra

```
eco 3/3   pulsos 10743/10718/10719 us   distancia 183.81 cm   nivel -147.31 cm   (24 ok / 0 fallos)
```

- `eco n/3`: muestras válidas de cada ciclo (3 es lo esperado).
- `pulsos`: duración del eco de las tres muestras, en microsegundos.
- `distancia`: mediana de las últimas 5 muestras válidas.
- `nivel`: `36.5 − distancia` (calibración prevista para el tanque).
- `-> estado`: `FUERA DEL TANQUE`, `TANQUE VACIO`, `NIVEL BAJO`, `NIVEL NORMAL`, `CASI LLENO`,
  `TANQUE LLENO` o `REBALSANDO`.
- Contadores acumulados de aciertos y fallos: cada fallo es una muestra sin eco.

## Valores de referencia

| Nivel de agua | Distancia esperada |
| --- | --- |
| 0 cm (vacío) | 36.5 cm |
| 15 cm | 21.5 cm |
| 30 cm (lleno) | 6.5 cm |
| 31 cm (rebose) | 5.5 cm |

Con el sensor apuntando a una pared lejana, el nivel sale negativo: es correcto, no está
midiendo el tanque.

## Notas

- El sketch toma 3 muestras separadas 60 ms (ciclo mínimo recomendado por el datasheet).
- Descarta ecos menores a 2 cm (zona muerta) y mayores a 450 cm.
- El firmware del proyecto usa la misma lógica y los mismos pines; si el test funciona,
  el nivel del firmware también.
