# Reservorio de Agua — Monitoreo con ESP32

Maqueta de un reservorio de agua (tanque de vidrio con caseta de válvulas) que mide en tiempo
real **6 variables** con un **ESP32 DevKit V1**: nivel de agua, agua que entra, agua que sale,
temperatura, pH y claridad (turbidez). Muestra los datos en una **pantalla LCD** y en una
**página web** con la maqueta en 3D y un caso de uso real.

- **Página publicada:** <https://reservorio-agua-web.vercel.app/>
- **En el WiFi de la maqueta:** <http://192.168.2.200> (datos en vivo y mantenimiento)
- **En otra red WiFi:** la dirección que muestra la pantalla LCD al conectarse. Si la maqueta no
  conoce la red, abre la red «Reservorio-Setup» (clave `reservorio`) para elegir el WiFi desde el
  celular (`http://192.168.4.1/wifi`). Guarda hasta 3 redes además de la de la casa.

## Documentos

| Documento | Contenido |
| --- | --- |
| [`Informe-Reservorio-Agua.docx`](Informe-Reservorio-Agua.docx) | Reporte de lo que se hizo: sensores, calibración, página web, caso real, conexión en tiempo real y alimentación (sin código). |
| [`docs/Conexion-de-sensores.docx`](docs/Conexion-de-sensores.docx) | Conexión de cada sensor al ESP32, cable por cable, con pruebas y problemas comunes. |
| [`docs/planos/reservorio-rev04.pdf`](docs/planos/reservorio-rev04.pdf) | Plano del reservorio y la caseta de válvulas. |

Los dos Word se regeneran con `./.venv/bin/python tools/informe/generar.py`
(diagramas: `tools/informe/diagramas.py`; capturas: `docs/img/captura-*.png`).

## Sensores y pines

| Sensor | Mide | Pin | Con |
| --- | --- | --- | --- |
| HC-SR04 | Nivel de agua | TRIG D19 · ECHO D18 | ECHO con 4.7 kΩ en serie |
| ZJ-S201 | Agua que entra | D23 | 4.7 kΩ en serie |
| ZJ-S201 | Agua que sale | D26 | 4.7 kΩ en serie |
| DS18B20 | Temperatura | D4 | 4.7 kΩ entre DATA y 3.3 V |
| PH-7BNC | pH | D34 | divisor 4.7 kΩ + 4.7 kΩ |
| TS-300B | Claridad | D35 | divisor 4.7 kΩ + 4.7 kΩ |
| LCD 1602 I2C | Pantalla | SDA D21 · SCL D22 | — |

Alimentación: 5 V por el USB-C (laptop, PC o cargador de 5 V y 2 A). No usar pilas.

## La página web

| Página | Qué muestra |
| --- | --- |
| `/` (Tablero) | Maqueta 3D con 6 tarjetas de datos; balde de entrada, balde de salida y sumidero. |
| `/escenario` (Caso real) | Sistema de agua rural por gravedad: manantial → reservorio → pueblo, con recorrido guiado. |
| `/mantenimiento` | Calibración y valores técnicos. Solo desde el WiFi de la maqueta. |
| `/wifi` | Elegir la red WiFi de la maqueta (se abre sola al conectarse a «Reservorio-Setup»). |

Sin conexión con la maqueta, la web muestra una **simulación** de un día típico, siempre
marcada como tal. En la página publicada, el botón «Conectar con la maqueta (mismo WiFi)» lee
los datos reales si estás en el WiFi de la maqueta (Chrome o Edge). Para verlos desde cualquier
lugar falta activar la nube (Supabase): el firmware y la página ya están preparados
(`docs/supabase.sql`, `web/js/nube.js`, claves en `firmware/include/secrets.h`).

## Estructura

```
firmware/   programa del ESP32 (PlatformIO); firmware/data = copia de web/
web/        página web (HTML, CSS, JavaScript y Three.js); la publica Vercel
tools/      servidor de pruebas, copia de la web, actualización por WiFi e informe
docs/       documento de conexión, imágenes, plano y configuración de la nube
```

## Comandos

```bash
node tools/dev-server.js                          # página en http://localhost:5173
ESP32_URL=http://192.168.2.200 node tools/dev-server.js   # con los datos de la maqueta

./tools/pio.sh run -d firmware -t upload          # programa del ESP32 por USB
node tools/sync-web.js                            # copia web/ a firmware/data/
./tools/pio.sh run -d firmware -t uploadfs        # página web al ESP32 por USB
./tools/ota.sh                                    # programa por WiFi
./tools/ota.sh uploadfs                           # página web por WiFi
./tools/pio.sh device monitor -d firmware -b 115200   # monitor serie
```

`firmware/include/secrets.h` (WiFi, IP fija, clave de actualización y de la nube) **no se sube
al repositorio**; se parte de `secrets.example.h`.
