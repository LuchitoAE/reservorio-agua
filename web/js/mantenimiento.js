/**
 * Mantenimiento (solo en el WiFi de la maqueta): estado técnico del ESP32, valores crudos
 * de los sensores, ajustes del tanque, calibraciones y reinicio de los totales de agua.
 */

import { cloudHost, getConfig, getTelemetry, postAction, saveConfig } from './api.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const fmt = (v, d = 1) => (isNum(v)
  ? v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d })
  : '--');

let connected = false;

function setField(name, text) {
  $$(`[data-field="${name}"]`).forEach((el) => (el.textContent = text));
}

function setRaw(name, text) {
  const el = $(`[data-raw="${name}"]`);
  if (el) el.textContent = text;
}

function formatUptime(seconds) {
  if (!isNum(seconds)) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min ${Math.floor(seconds % 60)} s`;
}

function logEvent(message, kind = '') {
  const li = document.createElement('li');
  if (kind) li.className = `is-${kind}`;
  const time = document.createElement('time');
  time.textContent = new Date().toLocaleTimeString('es-ES', { hour12: false });
  const span = document.createElement('span');
  span.textContent = message;
  li.append(time, span);
  $('#log').prepend(li);
  while ($('#log').children.length > 40) $('#log').lastElementChild.remove();
}

let toastTimer = null;
function toast(message, kind = '') {
  const el = $('#toast');
  el.textContent = message;
  el.className = `toast is-visible${kind ? ` is-${kind}` : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast'), 3800);
}

function setConnected(value) {
  if (value !== connected) logEvent(value ? 'Maqueta conectada' : 'La maqueta no responde', value ? 'ok' : 'warn');
  connected = value;
  const badge = $('#source-badge');
  badge.className = `chip chip--${value ? 'ok' : 'bad'}`;
  badge.textContent = value ? 'Maqueta conectada' : 'Sin conexión';
  $('#diag-mode').textContent = value ? 'en línea' : 'sin conexión';
  $$('[data-calibrate], [data-action="reset-flow"], #config-form button, #config-form input')
    .forEach((el) => (el.disabled = !value));
}

function render(t) {
  const sensors = ['level', 'temperature', 'ph', 'turbidity', 'flowIn', 'flowOut'];
  setField('sensors', `${sensors.filter((k) => t[k]?.ok).length} de ${sensors.length}`);
  setField('ip', t.wifi?.ip ?? '--');
  setField('rssi', isNum(t.wifi?.rssi) && t.wifi.rssi !== 0 ? `${t.wifi.rssi} dBm` : '--');
  setField('uptime', formatUptime(t.uptime));
  setField('heap', isNum(t.system?.heap) ? `${Math.round(t.system.heap / 1024)} KB` : '--');
  setField('cloud', t.system?.cloud ?? '--');

  setRaw('ph', isNum(t.ph?.raw) ? String(Math.round(t.ph.raw)) : '--');
  setRaw('phV', isNum(t.ph?.voltage) ? `${fmt(t.ph.voltage, 3)} V · pH ${fmt(t.ph.value, 2)}` : '--');
  setRaw('turb', isNum(t.turbidity?.raw) ? String(Math.round(t.turbidity.raw)) : '--');
  setRaw('turbV', isNum(t.turbidity?.voltage)
    ? `${fmt(t.turbidity.voltage, 3)} V · ${fmt(t.turbidity.clarity, 0)} % · ${fmt(t.turbidity.ntu, 0)} NTU`
    : '--');
  setRaw('distance', isNum(t.level?.distanceCm)
    ? `${fmt(t.level.distanceCm, 1)} cm al agua · nivel ${fmt(t.level.levelCm, 1)} cm`
    : 'sin eco');
  setRaw('temp', isNum(t.temperature?.c) ? `${fmt(t.temperature.c, 2)} °C` : 'no responde');
  setRaw('pulsesIn', isNum(t.flowIn?.pulses) ? `${Math.round(t.flowIn.pulses).toLocaleString('es-ES')} · ${fmt(t.flowIn.lpm, 2)} L/min` : '--');
  setRaw('pulsesOut', isNum(t.flowOut?.pulses) ? `${Math.round(t.flowOut.pulses).toLocaleString('es-ES')} · ${fmt(t.flowOut.lpm, 2)} L/min` : '--');
}

async function poll() {
  try {
    const t = await getTelemetry();
    if (!connected) setTimeout(refreshConfig, 0);
    setConnected(true);
    render(t);
  } catch {
    setConnected(false);
  } finally {
    setTimeout(poll, 1000);
  }
}

function fillConfigForm(config) {
  const form = $('#config-form');
  form.elements.tankHeightCm.value = Number(config.tankHeightCm).toFixed(1);
  form.elements.maxLevelCm.value = Number(config.maxLevelCm).toFixed(1);
  form.elements.sensorOffsetCm.value = Number(config.sensorOffsetCm).toFixed(1);
}

async function refreshConfig() {
  try {
    fillConfigForm(await getConfig());
  } catch {
    logEvent('No se pudo leer la configuración', 'warn');
  }
}

const names = {
  'level-empty': 'tanque vacío',
  ph7: 'buffer pH 7',
  ph4: 'buffer pH 4',
  'turbidity-clear': 'agua clara',
  'turbidity-turbid': 'agua turbia',
};

async function calibrate(sensor) {
  if (sensor === 'level-empty'
    && !window.confirm('¿El tanque está completamente vacío? Se guardará la distancia actual como el fondo (0 %).')) {
    return;
  }
  toast(`Midiendo ${names[sensor] ?? sensor}…`);
  try {
    const result = await postAction('/api/calibrate', { sensor });
    if (result.ok) {
      toast(`Calibración de ${names[sensor]} guardada`, 'ok');
      logEvent(`Calibración ${names[sensor]} aplicada`, 'ok');
      refreshConfig();
    } else {
      toast(result.error || 'Lectura fuera de rango', 'bad');
      logEvent(`Calibración ${names[sensor]} rechazada`, 'warn');
    }
  } catch (error) {
    toast(`Error al calibrar: ${error.message}`, 'bad');
  }
}

$$('[data-calibrate]').forEach((btn) => btn.addEventListener('click', () => calibrate(btn.dataset.calibrate)));

$('[data-action="reset-flow"]').addEventListener('click', async () => {
  if (!window.confirm('¿Poner en 0 los totales de agua que entra y sale?')) return;
  try {
    await postAction('/api/reset', { what: 'flow' });
    toast('Totales de agua en 0', 'ok');
    logEvent('Totales de agua reiniciados', 'ok');
  } catch (error) {
    toast(`No se pudo reiniciar: ${error.message}`, 'bad');
  }
});

$('#config-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    tankHeightCm: Number(form.elements.tankHeightCm.value),
    maxLevelCm: Number(form.elements.maxLevelCm.value),
    sensorOffsetCm: Number(form.elements.sensorOffsetCm.value),
  };
  if (!Number.isFinite(payload.tankHeightCm) || payload.tankHeightCm < 10) {
    toast('La altura debe ser mayor que 10 cm', 'bad');
    return;
  }
  try {
    fillConfigForm(await saveConfig(payload));
    toast('Ajustes guardados', 'ok');
    logEvent('Ajustes del tanque guardados', 'ok');
  } catch (error) {
    toast(`No se pudo guardar: ${error.message}`, 'bad');
  }
});

$('#reload-config').addEventListener('click', refreshConfig);

// En la web publicada esta página no puede calibrar ni cambiar ajustes.
if (cloudHost) {
  $('#local-note').hidden = false;
  setConnected(false);
  $('#source-badge').textContent = 'Solo en la red local';
} else {
  logEvent('Mantenimiento abierto');
  poll();
}
