/**
 * Fuente única de datos del tablero.
 *
 * Pide la telemetría (a la maqueta, a la nube o por conexión directa; ver api.js). Si no
 * llega ningún dato real, entrega la simulación (simulador.js), siempre marcada con
 * `simulated: true`. Nunca mezcla datos simulados con reales.
 */

import { getTelemetry, isCloud, pollMs } from './api.js';
import { createSimulator } from './simulador.js';

const simulator = createSimulator();

/**
 * Llama a `onData(t, estado)` en cada lectura.
 * estado: { connected, simulated, cloud, lastOkAt }
 */
export function iniciarDatos(onData, localMs = 1000) {
  const estado = { connected: false, simulated: false, cloud: false, lastOkAt: 0 };
  let busy = false;
  let timer = null;

  async function tick() {
    if (busy) return;
    busy = true;
    clearTimeout(timer);
    const started = performance.now();
    let t;
    try {
      t = await getTelemetry();
      estado.connected = true;
      estado.simulated = false;
      estado.cloud = isCloud(t);
      estado.lastOkAt = Date.now();
    } catch {
      t = simulator.telemetry();
      estado.connected = false;
      estado.simulated = true;
      estado.cloud = false;
    }
    try {
      onData(t, { ...estado });
    } finally {
      busy = false;
      timer = setTimeout(tick, Math.max(250, pollMs(localMs) - (performance.now() - started)));
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });
  tick();
  return { refresh: tick, estado };
}
