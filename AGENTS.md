# Contexto del proyecto (para agentes)

Este archivo resume el estado y las decisiones del proyecto para que otra sesión o agente
pueda continuar sin reconstruir el contexto. Actualizado: **25/11/2026**.

## Qué es

Sistema de monitoreo de un reservorio de agua con ESP32 DevKit V1 (30 pines, USB-C):

- Nivel: HC-SR04 (GPIO 19 TRIG / 18 ECHO con divisor).
- Caudal: 2 × ZJ-S201/YF-S201, entrada GPIO 23 y salida GPIO 26 (4.7 kΩ en serie, pull-up interno).
- Temperatura: DS18B20 (GPIO 4, pull-up 4.7 kΩ).
- pH: PH-7BNC (GPIO 34, ADC1, divisor).
- Turbidez: TS-300B (GPIO 35, ADC1, divisor 4.7k + 4.7k).
- Pantalla: LCD 1602 I2C (GPIO 21/22, dirección detectada 0x27).
- Dashboard web sin dependencias + modelo 3D con Three.js.

Repositorio público: <https://github.com/LuchitoAE/reservorio-agua>

## Web (26/11/2026, pedidos del usuario)

- **`index.html` = tablero unido al modelo 3D**: el gemelo digital a pantalla completa con 6
  tarjetas flotantes (nivel, agua que entra, agua que sale, temperatura, pH, claridad).
  `js/tablero.js` pinta las tarjetas; `js/datos.js` es la única fuente de datos (real o
  simulación); `js/model3d.js` solo dibuja y recibe `setTelemetry()`. En celular: modelo arriba
  y tarjetas debajo en 2 columnas.
- **Lenguaje para el público**: sin nombres de sensores, pines, voltajes, "ESP32", IP ni NTU.
- **`mantenimiento.html`**: lo técnico (estado del ESP32, valores crudos, ajustes del tanque,
  calibraciones, reinicio de totales). Solo funciona en la red de la maqueta; el enlace no
  aparece en la web publicada.
- `modelo.html` redirige al tablero (conserva `#vista`). `app.js` (dashboard viejo) se eliminó.
- Modelo: tubería de **PVC gris** (`0x7c8389`); llaves de paso como la UyusTools XP112L
  "liso": cuerpo blanco de una pieza con abultamiento central y **manija roja de mariposa**
  con estrías; el by-pass se dibuja cerrado (manija cruzada).
- Vercel publica solo la carpeta `web` (Root Directory); el informe y el firmware quedan solo
  en el repositorio.
- Publicado en <https://reservorio-agua-web.vercel.app/> (proyecto de Vercel conectado a `main`).
  Vercel usa **direcciones sin `.html`** (`/escenario`, `/mantenimiento`; `web/vercel.json` con
  `cleanUrls: true`). Los enlaces de la web van sin `.html`; el ESP32 y `tools/dev-server.js`
  sirven `/escenario` como `escenario.html`.
- **Modelo 3D sin sensores (26/11/2026, pedido del usuario):** se quitaron el sensor de nivel,
  su haz, las sondas, la regleta, los caudalímetros y sus etiquetas (los valores están en las
  tarjetas). Quedan el flujo animado, el chorro, el rebose y el color del agua. Las tuberías
  vuelven a terminar en la pared de la caseta (z = −35). El "Caso real" conserva sus
  caudalímetros ilustrativos.
- **WiFi en cualquier red (26/11/2026):** módulo `firmware/src/Redes.*`. Redes conocidas = casa
  (`secrets.h`) + hasta 3 guardadas en NVS (`w0s/w0p`…) desde la página `/wifi`
  (`GET/POST /api/wifi`, `POST /api/wifi/olvidar`). Al arrancar escanea y elige la conocida con mejor
  señal; **IP fija solo en la red de la casa**, DHCP en las demás (`WiFi.persistent(false)`). Sin red
  conocida abre el AP «Reservorio-Setup» con **portal cautivo** (DNS a 192.168.4.1, rutas de
  detección de Android/Apple/Windows → `/wifi`); reintenta cada 20 s (no si hay alguien en el AP) y
  cierra el AP tras 60 s con WiFi. La LCD muestra «WiFi <red> / <IP>» al conectarse y, sin red, las
  páginas «Reservorio-Setup / Clave reservorio» y «Abre en celular: 192.168.4.1/wifi». En la web
  publicada, «Conectar con la maqueta» pide la IP de la LCD si no la encuentra
  (`reservorio.esp32Ip` en localStorage). Probado: red inexistente → AP → vuelve a la casa.
- **Banquito y mangueras (26/11/2026):** patas hasta el tablero con faldón y travesaños; la manguera de
  entrada sale fuera del banquito antes de bajar y entra recta a la espiga; la de salida pasa por
  fuera del borde del balde.
- **Tablero con tema claro (26/11/2026, pedido del usuario):** fondo y piso claros, tarjetas
  blancas con letras oscuras, etiquetas 3D blancas con texto oscuro, medidas y bordes del vidrio
  en azul oscuro, agua azul (`styles-tablero.css`, colores en `model3d.js`). Se agregó la
  medida del alto del tanque (40.6 cm).
- **Interruptor "Maqueta 3D | Caso real"** al centro de la cabecera de ambas páginas
  (`styles-claro.css`: tema claro compartido, cabecera, chips y etiquetas 3D).
- **Flujo de agua sutil y lento** (tablero y caso real): brillo suave pegado al tubo, opacidad
  ~0.45 y 1.5–12 cm/s, en lugar del "tubo de color" rápido.
- **Tarjetas más grandes** (`--cardw` 262–330 px, números ~2.6 rem, gráfica 54 px).
- **Maqueta completa y fondo gris medio (26/11/2026):** los tubos de entrada y salida salen 6 cm de
  la caseta (z = −41) con adaptador, espiga y abrazadera; **balde azul elevado** sobre un banquito
  (fondo a 40 cm, sobre la entrada de 36 cm) con llavecita y **manguera verde** por gravedad;
  manguera de salida a un **balde blanco de recolección** en el piso (chorro cuando sale agua); la
  limpia baja con un codo a un **sumidero** con rejilla (ahí cae el rebose). Flujo animado también
  en las mangueras. Etiquetas de estos elementos solo con la cámara detrás (`backOnly`). Vista
  "Ver caseta" desde atrás y arriba. Fondo y piso gris medio (`styles-tablero.css`, `model3d.js`).
- **Caso real mejorado:** tema claro, cabecera sólida, noche azulada (no a oscuras), datos en
  cuadritos (reservorio %, m³ reales, llega/sale, balance) y **recorrido guiado de 6 pasos**
  (general, manantial, conducción, reservorio, caseta, pueblo) que mueve la cámara, resalta la
  etiqueta y muestra el dato en vivo; flechas del teclado y `escenario#paso`.

## Estado actual

| Parte | Estado |
| --- | --- |
| Firmware | Compila (PlatformIO 6.2.0). Última versión compilada incluye tanque rectangular. |
| Placa | Conectada por USB. Tiene el **firmware del proyecto y la web** con las calibraciones de turbidez y pH (25/11/2026). Para los monitores de banco hay que cargar `pruebas/turbidez` o `pruebas/ph`. |
| LCD | **Funciona (26/11/2026)** en 0x27. Pantalla para el público: 4 páginas, **4 s cada una**: nivel % + litros + estado del tanque; pH (Ácido/Neutro/Alcalino) + temperatura; claridad % + AGUA CLARA/POCO TURBIA/AGUA TURBIA; agua que entra/sale. Usa los mismos valores calibrados que la web. Salta las páginas de sensores que no responden. Se vuelve a buscar cada 5 s si se desconecta. |
| DS18B20 | Verificado: 1 dispositivo en el bus, ~20.5 °C. Desde el 25/11/2026 el firmware lo vuelve a buscar cada 5 s si no está (se puede conectar con la placa encendida). Desconectado en la protoboard actual. |
| HC-SR04 | Verificado en protoboard y conectado al ESP32 (25/11/2026). Firmware: un disparo cada 70 ms sin bloquear y mediana de 5 ecos; ~1 s sin eco → no conectado. Dashboard consulta cada 0.5 s (animación 0.4 s); `modelo.html` cada 1 s. Sketch de banco en `pruebas/hcsr04/`. Falta montarlo en el tanque. ECHO con **una sola 4.7 kΩ en serie** a D18 (este clon tiene ECHO débil: con divisor a GND no lee). |
| Turbidez | **Recalibrado (26/11/2026)** con el divisor nuevo: agua de caño 2.759 V (100 %), agua con tierra recién batida 2.225 V (0 %); rango 0.53 V (el doble que antes). Lectura estable: cada muestra promedia 16 lecturas del ADC y la claridad/NTU usan la media recortada de ~7 s (`MedianFilter::trimmedMean`); la calibración guarda ese mismo valor (lo que se ve). Valores por defecto en `config.h`; NVS `turbC2`/`turbT2`. Verificado: la LCD marcó AGUA CLARA 100 % en agua de caño. |
| pH | **Calibrado (25/11/2026)** con `pruebas/ph/monitor.py`, sin buffers: agua de caño pH 7.55 = 2.515 V y limón pH 2.2 = 3.353 V → neutro 2.6015 V, pendiente 0.1565 V/pH (±0.3 pH aprox.). Offset del módulo ajustado (Po ≈ 2.5 V en agua). Firmware con `analogReadMilliVolts`; claves NVS `phN2`/`phS2`. Mejorar con bicarbonato o buffers. |
| Caudal | Firmware y web listos para **dos** caudalímetros (25/11/2026): entrada D23, salida D26, telemetría `flowIn`/`flowOut`, tarjetas separadas y "Neto" en el dashboard, LCD "Entra/Sale", acumulados en NVS `flowTot`/`flowTotS`. Falta conectarlos y probarlos con agua. |
| Simulación | **Desde el 25/11/2026 (pedido del usuario, para Vercel):** sin ESP32 la web muestra una simulación (`web/js/simulador.js`) SIEMPRE marcada ("SIMULACIÓN", aviso amarillo); con ESP32, solo datos reales. Día típico de un reservorio rural con manantial: 1 día = 12 min, manantial ~6.6 L/min, consumo con picos 7 h y 19 h, rebalsa al amanecer, baja a ~44 % en la tarde, lluvia 1 de cada 3 días. Determinista por la hora (todos ven lo mismo). Dashboard, gemelo y caso real. En simulación y en la nube la web es de solo lectura. |
| Caso real | `web/escenario.html` + `js/escenario.js` (25/11/2026): escena 3D ilustrativa de un sistema rural por gravedad con **manantial** (elección del usuario): captación → línea de conducción → reservorio apoyado con caseta y cerco en una loma → aducción → pueblo con red de distribución; quebrada y rebose. Flujo animado con datos reales o simulados, nivel en un corte del reservorio, color por turbidez, luz según la hora. Equivalencia: maqueta al 100 % ≈ reservorio real de 10 m³ (300–400 personas). Vistas `#general`, `#manantial`, `#reservorio`, `#pueblo`. |
| Dashboard | Verificado en escritorio y móvil. Desde el 25/11/2026 **sin modo demo**: solo datos reales; sensor no conectado (`ok=false`) o ESP32 sin respuesta → valores en 0 e indicador rojo (`web/js/lecturas.js`). El caudal cuenta como conectado solo con caudal > 0. El diagnóstico muestra los valores crudos reales. `modelo.html` conserva su modo demo (nivel manual) por la regla del modelo aprobado. |
| Modelo 3D | **Aprobado para la fase 1 (24/11/2026).** Trazado y acabado realista (codos, tees, uniones, pasamuros, válvulas de bola). No cambiar salvo pedido explícito. **Gemelo digital (25/11/2026, pedido del usuario):** sin mover piezas, se agregaron los 6 sensores (HC-SR04 a 36 cm con haz y pulsos, sondas de pH/turbidez/DS18B20 en una regleta, caudalímetros ZJ-S201 sobre la subida de entrada y la salida), flujo animado según L/min (entrada, salida y rebose si nivel ≥ 31 cm), chorro de entrada, color del agua según la claridad, etiquetas y panel "Sensores en vivo". El nivel usa `levelCm` (antes el % cortaba en 100). Probado con un ESP32 simulado. **Ajustes (25/11/2026, pedidos del usuario):** llaves de paso de **PVC blanco con palanca roja**; los **caudalímetros van fuera de la caseta**, en los tubos que llegan desde afuera (tuberías extendidas hasta z = −46, soportes de concreto). `modelo.html#caseta` (o `#front`, `#top`) abre en esa vista. Auto = ESP32 o simulación; Manual = deslizador. |
| Documentos | **26/11/2026 (pedido del usuario):** se borraron los 8 `.md` de `docs/` y la copia `Informe-Reservorio-Aguagvvgh.docx`. Quedan dos Word **sin código**: `Informe-Reservorio-Agua.docx` (reporte, 13 páginas: sensores, calibración, web, caso real, enlace en tiempo real, alimentación, pruebas y pendientes) y `docs/Conexion-de-sensores.docx` (9 páginas, cable por cable). Se generan con `tools/informe/generar.py` (+ `estilo.py`, `diagramas.py`); capturas en `docs/img/captura-*.png`. |
| WiFi | **Conectado** a la red de la casa (2.4 GHz, WPA2) con **IP fija 192.168.2.200** (router/gateway 192.168.2.100; `WIFI_STATIC_IP`, `WIFI_GATEWAY`, `WIFI_SUBNET`, `WIFI_DNS` en `secrets.h`). `http://reservorio.local`. **OTA activo y verificado** (ArduinoOTA, puerto 3232, clave `OTA_PASSWORD` en `secrets.h`): `./tools/ota.sh` y `./tools/ota.sh uploadfs`. Si falla, AP `Reservorio-Setup` (clave `reservorio`, 192.168.4.1). |

## Tanque (plano Rev. 04)

- Exterior 40.0 × 30.0 × 40.6 cm (plano); medición real 41.0 cm con la base de vidrio; interior
  38.8 × 28.8 × 40.0 cm.
- Caseta de válvulas 22 × 20 × 26 cm detrás del tanque.
- Medidas reales (usuario, 25/11/2026): tanque 41 cm exterior con base, **40 cm interior**.
- El tanque llena a 30 cm, pero **"lleno" (100 %) se marca a 29 cm** (1 cm de margen por precisión);
  rebose físico **31 cm** (`OVERFLOW_LEVEL_CM`, independiente del nivel de lleno).
- Calibración del nivel: el HC-SR04 ocupa de 36 a 38 cm → su **cara queda a 36 cm** del fondo.
- **Calibración "tanque vacío" (25/11/2026):** con el tanque vacío el HC-SR04 mide 33.5 cm al
  fondo (no 36): esa es la altura usada. Botón "Calibrar tanque vacío" en el dashboard
  (`/api/calibrate` con `level-empty`, mediana de ~2 s). Zona muerta: < 1 cm = 0 % (vacío).
- Firmware: `DEFAULT_TANK_HEIGHT_CM 33.5`, `DEFAULT_MAX_LEVEL_CM 29`, `OVERFLOW_LEVEL_CM 31`,
  `LEVEL_DEADBAND_CM 1`, volumen rectangular. También guardado en la NVS del ESP32.

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
- Documentos Word: `./.venv/bin/python tools/informe/generar.py` (python-docx). Para revisar como
  PDF: `flatpak run --filesystem=/tmp --filesystem=home org.libreoffice.LibreOffice --headless
  --convert-to pdf ...` (el comando dentro del flatpak no se llama `soffice`). La consola es
  **zsh**: no separa palabras de variables; para varios comandos con `brave` usar un script bash.
- Puerto serie `/dev/ttyUSB0` (CP2102) requiere grupo `uucp`; se puede habilitar con
  `sudo usermod -aG uucp $USER` o, temporalmente, `chmod 666` vía Docker.
- La PC tiene **ufw** activo: para OTA el ESP32 se conecta de vuelta al puerto TCP 8266
  (`--host_port=8266` en `[env:ota]`). Regla ya agregada el 25/11/2026
  (`sudo ufw allow from 192.168.2.200 to any port 8266 proto tcp`); OTA verificado.
- `firmware/include/secrets.h` está **ignorado por Git**; el repo versiona
  `secrets.example.h`. No subir credenciales.

## Comandos

```bash
node tools/dev-server.js                  # dashboard + modelo en :5173
./tools/pio.sh run -d firmware -t upload  # firmware por USB
./tools/ota.sh                            # firmware por WiFi (IP y clave de secrets.h)
./tools/ota.sh uploadfs                   # web por WiFi (antes: node tools/sync-web.js)
node tools/sync-web.js                    # web -> firmware/data
./tools/pio.sh run -d firmware -t uploadfs
./tools/pio.sh device monitor -d firmware -b 115200
./tools/pio.sh run -d pruebas/hcsr04 -t upload   # prueba de banco del HC-SR04
./tools/pio.sh run -d pruebas/turbidez -t upload # prueba de banco de turbidez
./.venv/bin/python pruebas/turbidez/monitor.py   # monitor de turbidez en consola
./tools/pio.sh run -d pruebas/ph -t upload       # prueba de banco de pH
./.venv/bin/python pruebas/ph/monitor.py         # monitor de pH en consola
./.venv/bin/python tools/informe/generar.py
```

## Próximos pasos

0. **Fase 3 (pendiente): publicar en Vercel** con datos reales vía nube: ESP32 → `POST /api/ingest`
   (Vercel, con token) → Supabase (último dato + historial) → `GET /api/telemetry` devuelve el
   mismo JSON + `source: "cloud"` y `ageS`; si `ageS > 20` la web pasa a simulación
   (`STALE_S` en `web/js/api.js`). El usuario tiene cuentas de Vercel y Supabase. Código listo
   (CloudSync en el firmware, `docs/supabase.sql`, `web/js/nube.js`); nube apagada hasta tener
   URL y clave publishable (token del ESP32 ya en `secrets.h`; hash registrado en la guía).
   **Conexión directa** (sin Supabase): botón "Conectar con el ESP32 de mi casa" en la web
   publicada; `fetch` con `targetAddressSpace: 'local'` (Chrome/Edge 141+, permiso de red local,
   solo en el WiFi de la casa); se recuerda en localStorage (`reservorio.esp32Directo`).
   Publicado en Vercel (`vercel.json` en la raíz: `outputDirectory: web`, `cleanUrls`).
1. Activar Supabase (pasos en el informe; `docs/supabase.sql`) para ver datos reales desde cualquier lugar.
2. Verificar los caudalímetros con 1 litro (~450 pulsos) y calibrar el pH con buffers 4 y 7.
3. Montar los sensores en la maqueta definitiva (nivel a 36 cm, mirando al agua).
