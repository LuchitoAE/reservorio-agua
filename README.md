# Reservorio de Agua — Monitoreo con ESP32

Sistema de instrumentación para un reservorio/tanque de agua: 5 sensores conectados a un
**ESP32 DevKit V1**, pantalla LCD local y un **dashboard web** con una tarjeta por sensor.

El repositorio tiene dos mitades independientes:

| Carpeta      | Qué es                                                        | Se ejecuta en |
| ------------ | ------------------------------------------------------------- | ------------- |
| `firmware/`  | Código C++ (PlatformIO) que lee los sensores y sirve la web     | ESP32         |
| `web/`       | Dashboard estático (HTML/CSS/JS, sin dependencias)             | Navegador     |
| `tools/`     | Servidor de desarrollo local y sincronización de la web        | PC            |
| `docs/`      | Cableado, calibración, plan de pruebas y roadmap               | —             |

La misma web funciona en tres escenarios:

1. **Desde el propio ESP32** (`http://reservorio.local`) — la placa guarda la web en su
   memoria flash (LittleFS) y expone `/api/telemetry`.
2. **Local en la PC** (`node tools/dev-server.js`) — servidor estático que hace *proxy* al ESP32.
3. **Demo / Vercel** — si no hay ESP32 responde, el dashboard entra en **modo Demostración**
   con datos simulados. Sirve para revisar el diseño y enseñarlo sin hardware.

> **Estado:** fase 1 (sensores + web local) y modelo digital 3D en versión MVP. La versión
> realista del modelo y la nube quedan para fases posteriores (`docs/roadmap.md`).

> **¿Todavía no conectaste nada?** Empieza por
> [`docs/guia-paso-a-paso.md`](docs/guia-paso-a-paso.md): montaje en protoboard sin soldar,
> sensor por sensor, con pruebas y qué deberías ver en cada paso.

## Modelo digital 3D

El tanque y la caseta de válvulas están modelados con las medidas del **plano Rev. 04**
(40 × 30 × 40.6 cm, vidrio 6 mm, caseta 22 × 20 × 26 cm). La página
[`web/modelo.html`](web/modelo.html) muestra el conjunto en Three.js, con el nivel de agua
conectado a la telemetría o a un deslizador de prueba.

```bash
node tools/dev-server.js      # luego abrir http://localhost:5173/modelo.html
```

También se llega desde el botón **Modelo 3D** del dashboard.

## Informe técnico (DOCX)

[`Informe-Reservorio-Agua.docx`](Informe-Reservorio-Agua.docx) reúne todo en un solo documento:
materiales, seguridad eléctrica, pinout, conexión paso a paso de cada sensor, configuración del
firmware, API, calibración y plan de pruebas. Se regenera con
`./.venv/bin/python tools/informe/generar.py`.

El resto de la documentación está indexado en [`docs/README.md`](docs/README.md).

---

## Inicio rápido

> Antes de conectar sensores necesitas además: **protoboard de 830 puntos**, **cables
> dupont macho-macho y hembra-macho**, **cable USB-C de datos** y, recomendado, un
> **multímetro** y **buffers de pH 4 y 7**. Motivos y cantidades en la guía.

### 1. Dashboard en la PC (sin hardware)

```bash
cd Reservorio_Agua
node tools/dev-server.js      # http://localhost:5173
```

Abre el navegador: verás las tarjetas actualizándose. Como no hay placa, entra solo en modo
Demostración (el selector de fuente está arriba a la derecha).

> `package.json` trae atajos (`npm run dev`, `npm run fw:upload`, …) por si tienes npm
> instalado. Todos los comandos de esta guía funcionan igual con `node` y `./tools/pio.sh`.

### 2. Firmware en el ESP32

```bash
# instalar PlatformIO (una vez)
python3 -m venv .venv
.venv/bin/pip install platformio

# editar credenciales WiFi
cp firmware/include/secrets.example.h firmware/include/secrets.h
$EDITOR firmware/include/secrets.h

# compilar y subir
.venv/bin/pio run -d firmware -t upload

# subir la web a la memoria del ESP32 (LittleFS)
node tools/sync-web.js             # copia web/ -> firmware/data/
.venv/bin/pio run -d firmware -t uploadfs
```

Monitor serie: `.venv/bin/pio device monitor -d firmware -b 115200`

La placa muestra por serie su IP; también responde en `http://reservorio.local` (mDNS).
Si no encuentra la red WiFi, crea la red **`Reservorio-Setup`** y publica la web en
`http://192.168.4.1`.

### 3. Apuntar el servidor local al ESP32

```bash
ESP32_URL=http://192.168.1.50 node tools/dev-server.js
```

---

## Hardware

### Sensores y actuadores

| Sensor | SKU | Magnitud | Interfaz | Pin ESP32 |
| --- | --- | --- | --- | --- |
| Ultrasónico HC-SR04 | J001-HC-SR04 | Nivel de agua | 2 GPIO (Trig/Echo) | Trig 19 · Echo 18 |
| Flujo YF-S201 | F104-YF-S201 | Caudal y volumen | Pulso (interrupción) | 23 |
| Temperatura DS18B20 | N007-FM1164 | °C del agua | 1-Wire | 4 |
| pH PH-7BNC | Q004-SNS-PC-000 | pH | Analógico | 34 (ADC1) |
| Turbidez TS-300B | P001-SEN0189 | NTU / claridad | Analógico | 35 (ADC1) |
| LCD 1602 I2C | K013-EP-268 | Display local | I2C | SDA 21 · SCL 22 |
| ESP32 DevKit V1 30 p | K016-Devkit | Control + WiFi | — | — |
| Resistencias 4.7 kΩ ×20 | B313-EP-368-4K7 | Pull-up / divisores | — | — |
| Cable flat 40 pines | D101-B09 | Cableado ordenado | — | — |

### Reglas de conexión que **no** se pueden saltar

- El ESP32 es de **3.3 V**: un pin analógico o GPIO nunca debe recibir 5 V.
- `HC-SR04` ECHO y `SEN0189` (turbidez) entregan hasta 5 V → **divisor de tensión** obligatorio.
- Los ADC que funcionan con WiFi activo son **ADC1: GPIO 32–39**. Por eso pH y turbidez
  están en 34 y 35 (pines solo-entrada, sin pull-up interno).
- El `DS18B20` necesita **resistencia de 4.7 kΩ entre DATA y 3.3 V**.
- Alimenta los módulos de 5 V desde el pin `VIN`/`5V` del ESP32 solo para pruebas; en la
  instalación final usa una fuente de 5 V externa con tierra común.

Detalle completo, diagramas y divisores: [`docs/cableado.md`](docs/cableado.md).
Diagrama de pines: [`docs/img/pinout-esp32.svg`](docs/img/pinout-esp32.svg).

---

## Qué muestra el dashboard

- **Tanque virtual** con el % de nivel (sensor ultrasónico) y litros estimados.
- Tarjetas por sensor con valor, unidad, estado (`OK` / `sin lectura`) y mini-gráfica.
- **Flujo**: L/min instantáneos y litros acumulados (con botón de reinicio).
- **pH** y **turbidez** con voltaje y lectura cruda del ADC para diagnóstico.
- **Sistema**: IP, señal WiFi, memoria libre, tiempo encendido.
- **Registro** de eventos (conexión, sensores que fallan, calibraciones).
- Panel de **ajustes**: altura del tanque y calibración (pH 7 / pH 4 / agua clara).

Diseñada para leerse también en el celular (grid responsive).

---

## Estructura

```
Reservorio_Agua/
├── firmware/
│   ├── platformio.ini
│   ├── include/
│   │   ├── config.h            # pines, constantes y valores por defecto
│   │   └── secrets.h           # WiFi (editar)
│   ├── src/
│   │   ├── main.cpp
│   │   ├── ConfigStore.*       # calibración persistente (NVS)
│   │   ├── Telemetry.*         # armado del JSON
│   │   ├── sensors/            # un archivo por sensor
│   │   ├── web/WebUI.*         # servidor HTTP + API + archivos
│   │   └── util/MedianFilter.h
│   └── data/                   # copia generada de web/ (node tools/sync-web.js)
├── web/
│   ├── index.html
│   ├── styles.css
│   └── js/{api,mock,charts,app}.js
├── tools/
│   ├── dev-server.js · sync-web.js · pio.sh
│   └── informe/                # generador del informe DOCX
├── docs/
│   ├── README.md               # índice de documentación
│   ├── img/                    # diagramas y capturas (SVG + PNG)
│   └── {guia-paso-a-paso,cableado,calibracion,pruebas,roadmap}.md
└── Informe-Reservorio-Agua.docx
```

---

## API del ESP32

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/telemetry` | Todas las lecturas + estado del sistema |
| GET | `/api/config` | Altura del tanque y parámetros de calibración |
| POST | `/api/config` | Actualiza `{ tankHeightCm, sensorOffsetCm }` |
| POST | `/api/reset` | `{ "what": "flow" }` reinicia el totalizador |
| POST | `/api/calibrate` | `{ "sensor": "ph7" \| "ph4" \| "turbidity-clear" }` |
| POST | `/api/reboot` | Reinicia la placa |

Ejemplo:

```bash
curl http://192.168.1.50/api/telemetry | jq
curl -X POST http://192.168.1.50/api/calibrate -H 'Content-Type: application/json' \
     -d '{"sensor":"ph7"}'
```

---

## Siguiente fase (anotado, no implementado)

- Publicar la web en Vercel (`vercel.json` ya apunta a `web/`) y enviar telemetría a
  Supabase (`docs/roadmap.md`).
- Versión realista del modelo 3D a partir de fotos (fotogrametría o `.glb`).
- Registro histórico, alertas y OTA.

Pruebas recomendadas antes de instalar en campo: [`docs/pruebas.md`](docs/pruebas.md).
Índice completo de documentos: [`docs/README.md`](docs/README.md).
