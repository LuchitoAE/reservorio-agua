# Web publicada en Vercel con datos reales (Supabase)

La web del reservorio se puede ver desde internet. Si el ESP32 está enviando datos se ven
**en vivo**; si no, se muestra una **simulación** claramente marcada.

## Tres formas de ver la web publicada

| Forma | Quién ve datos reales | Necesita |
| --- | --- | --- |
| Solo Vercel | Nadie: siempre **simulación** | Importar el repo en Vercel |
| **Conexión directa** | Quien esté en el **WiFi de la casa**, con Chrome o Edge | Pulsar "Conectar con el ESP32 de mi casa" y **Permitir** el acceso a la red local |
| Vercel + Supabase | **Cualquiera**, desde cualquier lugar | Supabase (pasos de abajo) |

### Conexión directa (sin Supabase)

- Botón **"Conectar con el ESP32 de mi casa"** (dashboard publicado, debajo del aviso de
  simulación). Chrome muestra un aviso de *acceso a la red local*: pulsa **Permitir**.
- La página lee `http://192.168.2.200/api/telemetry` (dirección en `web/js/nube.js`, campo
  `esp32`) con `fetch(..., { targetAddressSpace: 'local' })`: así Chrome (141+) permite el
  `http://` desde la página `https://` si el usuario da permiso.
- El navegador recuerda la elección en **localStorage**: el dashboard, el gemelo y el caso real
  se conectan solos. Si el ESP32 no responde (fuera de casa), reintenta cada 30 s y mientras
  tanto usa Supabase (si está configurada) o la simulación.
- Firefox y Safari no lo permiten. Fuera del WiFi de la casa es imposible: `192.168.2.200`
  solo existe dentro de esa red.

## Cómo funciona con Supabase

```
ESP32 ──(HTTPS cada 5 s, con su token secreto)──► Supabase: función ingest()
                                                     │  guarda el último dato
                                                     │  y uno por minuto en el historial
Página en Vercel ◄──(función ultimo(), solo lectura)─┘
```

- Desde fuera de la casa nadie puede llegar al ESP32 (`192.168.x.x` es una dirección privada),
  y sin el permiso de red local el navegador bloquea el `http://` desde una página `https://`.
  Por eso, para verlo desde cualquier lugar, el ESP32 sube sus datos a Supabase.
- `localStorage` no sirve para esto: guarda datos solo en el navegador de cada persona.
- Si el último dato tiene más de 20 s (`STALE_S` en `web/js/api.js`), la web pasa a
  simulación.
- En internet la web es **de solo lectura**: calibrar y cambiar ajustes solo funciona en la
  red de la casa (`http://192.168.2.200`).
- El ESP32 no publica el nombre de la red WiFi ni su IP.

## Claves: qué es público y qué es secreto

| Valor | Dónde va | ¿Secreto? |
| --- | --- | --- |
| URL del proyecto Supabase | `web/js/nube.js` y `secrets.h` (`CLOUD_URL`) | No |
| Clave *publishable* (o *anon*) | `web/js/nube.js` y `secrets.h` (`CLOUD_KEY`) | No: solo permite leer el último dato |
| Token del ESP32 | Solo `secrets.h` (`CLOUD_TOKEN`) | **Sí**. En Supabase se guarda solo su hash SHA-256 |
| Clave *secret* / *service_role* de Supabase | **En ningún lado del proyecto** | **Sí**, no se usa |

## Paso 1 · Supabase (una vez)

1. Entra a <https://supabase.com/dashboard> → **New project** (región: South America (São Paulo)).
2. Menú **SQL Editor** → **New query** → pega todo `docs/supabase.sql` → **Run**.
3. En otra consulta, registra el ESP32 con el hash de su token:

   ```sql
   insert into public.dispositivo (token_hash) values ('HASH_SHA256_DEL_TOKEN')
   on conflict do nothing;
   ```

   Para obtener el hash del token que está en `secrets.h` (no muestra el token):

   ```bash
   python3 -c "import re,hashlib;t=re.search(r'CLOUD_TOKEN\s+\"([^\"]+)\"',open('firmware/include/secrets.h').read()).group(1);print(hashlib.sha256(t.encode()).hexdigest())"
   ```

4. **Project Settings → API Keys**: copia la **URL del proyecto** y la clave
   **publishable** (`sb_publishable_...`; en proyectos antiguos, la clave `anon`).

## Paso 2 · Poner la URL y la clave pública

- `web/js/nube.js`: `url` y `key`.
- `firmware/include/secrets.h`: `CLOUD_URL` y `CLOUD_KEY`.
- Subir el firmware (`./tools/ota.sh`). En el monitor serie debe aparecer
  `[nube] primer envio OK`; en el dashboard local, Sistema → `nube: ok`.

## Paso 3 · Vercel (una vez)

1. <https://vercel.com/new> → **Import** el repositorio `reservorio-agua` de GitHub.
2. **Root Directory**: `web` · **Framework Preset**: `Other` · sin comando de build.
3. **Deploy**. Cada `git push` a `main` vuelve a publicar la web.

## Probar

- Con el ESP32 encendido: la web de Vercel dice **EN VIVO · ESP32**.
- Desenchufa el ESP32: a los ~20 s pasa a **SIMULACIÓN**.
- Para probar el modo nube en la computadora: `node tools/dev-server.js` y abrir
  `http://localhost:5173/?nube=1`.

## Seguridad y límites

- El ESP32 no verifica el certificado de Supabase (`setInsecure`). Es aceptable en la red de
  la casa; para más seguridad se puede incluir el certificado raíz.
- El historial guarda 1 dato por minuto y borra lo que tenga más de 90 días
  (~1 MB por día).
- Si el token se filtra: genera otro en `secrets.h`, registra el hash nuevo y borra el viejo
  (`delete from public.dispositivo where token_hash = '...'`).
