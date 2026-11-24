# Contexto del proyecto (para agentes)

Este archivo resume el estado y las decisiones del proyecto para que otra sesión o agente
pueda continuar sin reconstruir el contexto. Actualizado: **24/11/2026**.

## Qué es

Sistema de monitoreo de un reservorio de agua con ESP32 DevKit V1 (30 pines, USB-C):

- Nivel: HC-SR04 (GPIO 19 TRIG / 18 ECHO con divisor).
- Caudal: YF-S201 (GPIO 23, pull-up 4.7 kΩ).
- Temperatura: DS18B20 (GPIO 4, pull-up 4.7 kΩ).
- pH: PH-7BNC (GPIO 34, ADC1, divisor).
- Turbidez: SEN0189 (GPIO 35, ADC1, divisor).
- Pantalla: LCD 1602 I2C (GPIO 21/22, dirección detectada 0x27).
- Dashboard web sin dependencias + modelo 3D con Three.js.

Repositorio público: <https://github.com/LuchitoAE/reservorio-agua>

## Estado actual

| Parte | Estado |
| --- | --- |
| Firmware | Compila (PlatformIO 6.2.0). Última versión compilada incluye tanque rectangular. |
| Placa | Conectada por USB. Tiene cargado el **sketch de prueba del HC-SR04**; falta reflashear el firmware del proyecto. |
| LCD | Verificado en 0x27, muestra las 4 páginas. |
| DS18B20 | Verificado: 1 dispositivo en el bus, ~20.5 °C. |
| HC-SR04 | Verificado en protoboard: 3/3 ecos, 0 fallos, lectura estable. Sketch de banco en `pruebas/hcsr04/`. Falta montarlo en el tanque. |
| YF-S201 / pH / turbidez | Aún no conectados. |
| Dashboard | Verificado en escritorio y móvil. |
| Modelo 3D | **Aprobado para la fase 1 (24/11/2026).** Trazado y acabado realista (codos, tees, uniones, pasamuros, válvulas de bola). No cambiar salvo pedido explícito. |
| Informe DOCX | Generado y validado (34 páginas). |
| WiFi | `secrets.h` tiene SSID "RESERVORIO" pero no conecta; la placa queda en AP `Reservorio-Setup` (clave `reservorio`, 192.168.4.1). Revisar clave / 2.4 GHz / WPA3. |

## Tanque (plano Rev. 04)

- Exterior 40.0 × 30.0 × 40.6 cm (plano); medición real 41.0 cm con la base de vidrio; interior
  38.8 × 28.8 × 40.0 cm.
- Caseta de válvulas 22 × 20 × 26 cm detrás del tanque.
- Nivel de operación 30.0 cm; rebose físico 31.0 cm; capacidad útil 33.5 L (total 44.7 L).
- Calibración del nivel: la cara del sensor queda a 36.5 cm del fondo (40 − tapa 2 − sensor 1.5).
- Firmware: `DEFAULT_TANK_HEIGHT_CM 36.5`, `DEFAULT_MAX_LEVEL_CM 30.0`, volumen rectangular.

## Trazado de tuberías aprobado (modelo 3D)

Coordenadas en cm; X positivo a la derecha, Z negativo hacia la caseta/atrás.

- Entrada y salida entran **en paralelo a 5.5 cm**; la pareja queda a la derecha visto desde atrás.
- Entrada: acometida exterior en X=3; sube a 36 cm junto al tanque (Z=-19); entra al tanque
  cerca de la cara posterior (Z=-12) con un **codo corto de 1 cm** hacia abajo.
- Válvula de **paso directo** apenas entra (Z=-32), une entrada y salida.
- Válvula de **ingreso** abajo (Y=5.5, Z=-26), cerca de la de paso directo.
- Válvula de **salida** a la misma altura y distancia (Y=5.5, Z=-26), antes de la unión con el by-pass.
- **Limpia** en X=8, válvula cerca del tanque (Z=-18).
- **Rebose** sin válvula, alineado en X=8; baja por la misma línea y conecta a la **mitad**
  de la línea de limpia (Z=-23.5), aguas abajo de su válvula.
- Vista "Aislar caseta" en `modelo.html` para inspeccionar el conjunto.

### Acabado del modelo (24/11/2026)

- Tuberías de PVC blanco con codos de 90°, tees, uniones universales, pasamuros con bridas y
  empaques, campana en el rebose y canastilla ranurada en la salida.
- Válvulas de bola con cuerpo y palanca **rojos** (color de identificación del modelo) y tuercas
  de unión blancas. La leyenda y las etiquetas de válvulas usan rojo (`--valve: #e05252`).
- Los extremos exteriores muestran la boca del tubo (interior oscuro), no tapones.
- No mover posiciones al retocar el acabado.

## Entorno de trabajo

- Linux (Arch). **No hay npm**; usar `node` y `./tools/pio.sh`.
- `.venv/` contiene PlatformIO, `python-docx` y Pillow.
- Informe: `./.venv/bin/python tools/informe/generar.py`. Usa LibreOffice (flatpak) para el
  PDF y calcula el índice a dos pasadas. `x2t` de OnlyOffice no funciona en esta máquina.
- Puerto serie `/dev/ttyUSB0` (CP2102) requiere grupo `uucp`; se puede habilitar con
  `sudo usermod -aG uucp $USER` o, temporalmente, `chmod 666` vía Docker.
- `firmware/include/secrets.h` está **ignorado por Git**; el repo versiona
  `secrets.example.h`. No subir credenciales.

## Comandos

```bash
node tools/dev-server.js                  # dashboard + modelo en :5173
./tools/pio.sh run -d firmware -t upload  # firmware
node tools/sync-web.js                    # web -> firmware/data
./tools/pio.sh run -d firmware -t uploadfs
./tools/pio.sh device monitor -d firmware -b 115200
./tools/pio.sh run -d pruebas/hcsr04 -t upload   # prueba de banco del HC-SR04
./.venv/bin/python tools/informe/generar.py
```

## Próximos pasos

1. Flashear el firmware y la web del proyecto (la placa tiene el sketch de prueba del HC-SR04).
2. Corregir la conexión WiFi (clave / 2.4 GHz) o dejarla en AP.
3. Conectar HC-SR04, YF-S201, turbidez y pH; calibrar y completar el plan de pruebas.
4. Fase 2: Vercel + Supabase e histórico. Fase 3: versión realista del modelo 3D.
