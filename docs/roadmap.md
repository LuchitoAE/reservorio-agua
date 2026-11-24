# Roadmap

## Fase 1 — Sensores + dashboard local (actual)

- [x] Firmware ESP32: lectura de los 5 sensores, LCD I2C, WiFi.
- [x] Dashboard con tarjetas por sensor, tanque virtual y diagnóstico.
- [x] API HTTP y calibración persistente.
- [x] Modo Demostración (datos simulados) para trabajar sin hardware.
- [ ] Validación física con los sensores reales ([`pruebas.md`](pruebas.md)).

## Fase 2 — Web publicada + datos en la nube

Objetivo: que la web en Vercel muestre el reservorio desde cualquier lugar.

Problema técnico: una página **HTTPS** no puede hacer `fetch` a un ESP32 **HTTP** local
(mixed content + NAT). Hay que sacar los datos del ESP32 hacia un servicio público.

Ruta propuesta (encaja con las herramientas ya disponibles):

1. **Supabase**: tablas `readings` y `devices`; el ESP32 hace `POST /rest/v1/readings`
   cada 10–30 s con su clave anónima y RLS de solo inserción.
2. **Vercel**: el dashboard actual se despliega tal cual como sitio estático y lee la última
   lectura con la API REST de Supabase (o Realtime para actualización en vivo).
3. Variables de entorno en Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. El embed del ESP32 (WiFi + HTTPS + token) se implementa en
   `firmware/src/net/CloudUploader.*`.

Alternativas si no se quiere nube: túnel (Cloudflare Tunnel / Tailscale) o un broker MQTT.

Pendientes concretos:

- [ ] Definir esquema Supabase (`readings`: ts, device_id, level_pct, flow_lpm, total_l, temp_c, ph, ntu).
- [ ] Política RLS: inserción solo con device token, lectura pública o autenticada.
- [ ] Endpoint de ingesta y reintentos con buffer en NVS si no hay red.
- [ ] Añadir `web/lib/source-supabase.js` al selector de fuente.
- [ ] Deploy en Vercel + dominio.

## Fase 3 — Modelo digital 3D del reservorio

- [x] MVP en `web/modelo.html` con Three.js: tanque, caseta, válvulas y nivel real.
- [x] Medidas del plano Rev. 04 (40 × 30 × 40.6 cm, vidrio 6 mm, caseta 22 × 20 × 26 cm).
- [x] Nivel conectado a `/api/telemetry` y modo demo con deslizador.
- [ ] Corte dinámico y animación del histórico.
- [ ] Versión realista con fotogrametría o un `.glb` texturizado.
- [ ] Zonas de estado (óptimo / bajo / crítico) y alertas sobre el modelo.

## Fase 4 — Operación

- [ ] Alertas (nivel bajo, pH fuera de rango, flujo anómalo) por correo/Telegram.
- [ ] OTA del firmware.
- [ ] Caja IP65, prensaestopas y protección contra sobretensión en la línea de 5 V.
- [ ] Registro histórico y gráficas de 24 h / 7 días.
- [ ] Mantenimiento: limpieza del lente de turbidez y recalibración de pH.
