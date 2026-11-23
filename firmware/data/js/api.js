/**
 * Acceso a la API del ESP32.
 *
 * La URL base se puede fijar con ?api=http://192.168.1.50 o en localStorage
 * (clave "reservorio.apiBase"). Por defecto se usa el mismo origen, que es lo
 * correcto cuando la web la sirve el propio ESP32 o el servidor de desarrollo.
 */

export const DEFAULT_CONFIG = {
  tankHeightCm: 100,
  sensorOffsetCm: 0,
  tankDiameterCm: 80,
  flowPulsesPerLiter: 450,
  phNeutralV: 2.5,
  phSlopeV: 0.18,
  turbClearV: 4.2,
  flowTotalL: 0,
};

export function apiBase() {
  const fromQuery = new URLSearchParams(location.search).get('api');
  if (fromQuery) return fromQuery.replace(/\/$/, '');
  const stored = localStorage.getItem('reservorio.apiBase');
  if (stored) return stored.replace(/\/$/, '');
  return '';
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

export const getTelemetry = () => request('/api/telemetry');
export const getConfig = () => request('/api/config');

export const saveConfig = (patch) =>
  request('/api/config', { method: 'POST', body: JSON.stringify(patch) });

export function postAction(path, body) {
  return request(path, { method: 'POST', body: JSON.stringify(body) });
}
