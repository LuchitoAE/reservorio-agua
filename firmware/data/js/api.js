/**
 * Acceso a los datos.
 *
 * - En el ESP32, en la red de la casa o en el servidor de desarrollo: API del ESP32
 *   (/api/*). La URL base se puede fijar con ?api=http://192.168.1.50 o en localStorage
 *   (clave "reservorio.apiBase").
 * - Publicada en internet (Vercel): último dato del ESP32 guardado en Supabase (nube.js).
 *   Si no hay dato reciente, la web pasa a simulación.
 */

import { NUBE } from './nube.js';

export const DEFAULT_CONFIG = {
  tankHeightCm: 33.5,
  maxLevelCm: 29,
  sensorOffsetCm: 0,
  tankLengthCm: 38.8,
  tankWidthCm: 28.8,
  flowPulsesPerLiter: 450,
  phNeutralV: 2.6015,
  phSlopeV: 0.1565,
  turbClearV: 2.759,
  turbTurbidV: 2.225,
  flowTotalInL: 0,
  flowTotalOutL: 0,
};

export function apiBase() {
  const fromQuery = new URLSearchParams(location.search).get('api');
  if (fromQuery) return fromQuery.replace(/\/$/, '');
  try {
    const stored = localStorage.getItem('reservorio.apiBase');
    if (stored) return stored.replace(/\/$/, '');
  } catch {
    // sin almacenamiento local: se usa el mismo origen
  }
  return '';
}

// ¿La página está publicada en internet (y no en el ESP32 ni en la red de la casa)?
// ?nube=1 / ?nube=0 lo fuerza (para pruebas).
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)|\.local$/;
export const cloudHost = (() => {
  const forced = new URLSearchParams(location.search).get('nube');
  if (forced !== null) return forced !== '0';
  if (apiBase()) return false;
  return location.protocol !== 'file:' && !PRIVATE_HOST.test(location.hostname);
})();

// Conexión directa al ESP32 desde la web publicada (solo en el WiFi de la casa, Chrome/Edge).
// La elección se guarda en localStorage: la usan el dashboard, el gemelo y el caso real.
const DIRECT_KEY = 'reservorio.esp32Directo';
let directRetryAt = 0;  // si falla, se reintenta cada 30 s (sin frenar la página)

export function directEnabled() {
  try {
    return localStorage.getItem(DIRECT_KEY) === '1';
  } catch {
    return false;
  }
}

export function setDirect(on) {
  try {
    if (on) localStorage.setItem(DIRECT_KEY, '1');
    else localStorage.removeItem(DIRECT_KEY);
  } catch {
    // sin almacenamiento local: vale solo mientras la página esté abierta
  }
  directRetryAt = 0;
}

// Dirección de la maqueta para la conexión directa: la de la casa (nube.js) o la que el
// usuario escribió al verla en la LCD (en otra red, la maqueta recibe otra dirección).
const IP_KEY = 'reservorio.esp32Ip';

export function esp32Base() {
  try {
    const ip = localStorage.getItem(IP_KEY);
    if (ip) return `http://${ip}`;
  } catch {
    // sin almacenamiento local: se usa la dirección de la casa
  }
  return NUBE.esp32;
}

export function setEsp32Ip(ip) {
  try {
    if (ip) localStorage.setItem(IP_KEY, ip);
    else localStorage.removeItem(IP_KEY);
  } catch {
    // sin almacenamiento local
  }
  directRetryAt = 0;
}

export async function directTelemetry(timeoutMs = 2500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // targetAddressSpace: 'local' le dice a Chrome que es un aparato de la red de la casa:
    // pide permiso al usuario y permite el http:// desde una página https://.
    const res = await fetch(`${esp32Base().replace(/\/$/, '')}/api/telemetry`, {
      cache: 'no-store',
      signal: controller.signal,
      targetAddressSpace: 'local',
    });
    if (!res.ok) throw new Error(`ESP32 HTTP ${res.status}`);
    const data = await res.json();
    data.source = 'directo';
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function cloudTelemetry(timeoutMs = 6000) {
  if (!NUBE.url || !NUBE.key) throw new Error('nube sin configurar');
  const headers = { apikey: NUBE.key, 'Content-Type': 'application/json' };
  if (NUBE.key.startsWith('eyJ')) headers.Authorization = `Bearer ${NUBE.key}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${NUBE.url.replace(/\/$/, '')}/rest/v1/rpc/ultimo`, {
      method: 'POST',
      cache: 'no-store',
      headers,
      body: '{}',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`nube HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export function setApiBase(value) {
  if (value) localStorage.setItem('reservorio.apiBase', value);
  else localStorage.removeItem('reservorio.apiBase');
}

async function request(path, options = {}, timeoutMs = 2500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      cache: 'no-store',
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${text ? `: ${text.slice(0, 120)}` : ''}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Un dato del ESP32 que llega por la nube (Vercel) trae su antigüedad en `ageS`. Si es
// más viejo que esto, el ESP32 se considera desconectado y la web pasa a simulación.
export const STALE_S = 20;

async function publishedTelemetry() {
  if (esp32Base() && directEnabled() && Date.now() >= directRetryAt) {
    try {
      return await directTelemetry();
    } catch {
      directRetryAt = Date.now() + 30000;
    }
  }
  return cloudTelemetry();
}

export async function getTelemetry() {
  const data = cloudHost ? await publishedTelemetry() : await request('/api/telemetry');
  if (!data || typeof data !== 'object' || !data.level) throw new Error('sin datos del ESP32');
  if (data.offline || (typeof data.ageS === 'number' && data.ageS > STALE_S)) {
    throw new Error('ESP32 sin conexión');
  }
  return data;
}

// En la web publicada es de solo lectura (nube o conexión directa): calibrar y cambiar
// ajustes solo desde la página del propio ESP32 (http://192.168.2.200).
export const isCloud = (t) => t?.source === 'cloud' || t?.source === 'directo';

// Cada cuánto pedir datos: el ESP32 local responde rápido; la nube se actualiza cada 5 s.
export const pollMs = (localMs) => (cloudHost ? Math.max(localMs, 2500) : localMs);
export const getConfig = () => request('/api/config');

export const saveConfig = (patch) =>
  request('/api/config', { method: 'POST', body: JSON.stringify(patch) });

export function postAction(path, body) {
  return request(path, { method: 'POST', body: JSON.stringify(body) });
}
