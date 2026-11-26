/**
 * Tablero: el modelo 3D del reservorio con 6 tarjetas flotantes (nivel, agua que entra,
 * agua que sale, temperatura, pH y claridad).
 *
 * Con la maqueta conectada se muestran SOLO sus datos reales; sin maqueta, la simulación
 * (siempre marcada). Las herramientas técnicas están en mantenimiento.html.
 */

import { cloudHost, directEnabled, directTelemetry, setDirect } from './api.js';
import { Sparkline } from './charts.js';
import { iniciarDatos } from './datos.js';
import { FLOW_KEYS, SENSOR_KEYS, lecturas } from './lecturas.js';
import { setTelemetry } from './model3d.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

const fmt = (value, decimals = 1) => (isNum(value)
  ? value.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  : '--');

const sparks = Object.fromEntries(
  $$('[data-spark]').map((canvas) => [
    canvas.dataset.spark,
    new Sparkline(canvas, {
      color: getComputedStyle(canvas.closest('.fcard')).getPropertyValue('--accent').trim() || '#38bdf8',
      maxPoints: 60,
    }),
  ]),
);

/* ------------------------------------------------------- textos simples */

function levelState(cm, full, overflow) {
  if (cm >= overflow) return ['¡REBALSANDO!', 'is-over'];
  if (cm >= full) return ['TANQUE LLENO', 'is-full'];
  if (cm >= full - 5) return ['CASI LLENO', 'is-high'];
  if (cm <= 2) return ['TANQUE VACÍO', 'is-low'];
  if (cm <= 5) return ['NIVEL BAJO', 'is-low'];
  return ['NIVEL NORMAL', ''];
}

function temperatureText(c) {
  if (c < 10) return 'Agua muy fría';
  if (c <= 25) return 'Temperatura normal';
  return 'Agua tibia';
}

function phText(ph) {
  if (ph < 6.5) return 'Agua ácida';
  if (ph > 8.5) return 'Agua alcalina';
  return 'Neutra: dentro de lo normal';
}

function clarityText(percent) {
  if (percent >= 80) return 'Agua clara';
  if (percent >= 40) return 'Un poco turbia';
  return 'Agua turbia';
}

function timeAgo(ms) {
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (seconds < 2) return 'ahora';
  if (seconds < 60) return `hace ${seconds} s`;
  return `hace ${Math.floor(seconds / 60)} min`;
}

/* -------------------------------------------------------------- pintar */

function setField(name, text) {
  $$(`[data-field="${name}"]`).forEach((el) => {
    if (el.textContent !== text) el.textContent = text;
  });
}

function setMeta(key, text, cls = '') {
  const el = $(`[data-meta="${key}"]`);
  if (!el) return;
  if (el.textContent !== text) el.textContent = text;
  el.className = `fcard-meta ${cls}`.trim();
}

function setDot(key, state) {
  const el = $(`[data-state="${key}"]`);
  if (!el) return;
  el.classList.toggle('is-ok', state === true);
  el.classList.toggle('is-bad', state === false);
  el.title = state === true ? 'funcionando' : state === false ? 'sin lectura' : 'sin agua pasando';
}

let lastOkAt = 0;
let wasSimulated = null;

function render(t, estado) {
  const { connected, simulated } = estado;
  lastOkAt = estado.lastOkAt;
  const v = lecturas(t);

  // Al cambiar entre simulación y datos reales se limpian las gráficas (no se mezclan).
  if (wasSimulated !== null && wasSimulated !== simulated) {
    Object.values(sparks).forEach((spark) => spark.clear());
  }
  wasSimulated = simulated;

  setTelemetry(t);

  // Nivel
  const full = isNum(v.maxLevel) ? v.maxLevel : 29;
  setField('percent', fmt(v.percent, 0));
  setField('liters', fmt(v.liters, 1));
  setField('levelCm', fmt(v.levelCm, 1));
  $('[data-bar="level"]').style.width = `${Math.min(100, Math.max(0, v.percent))}%`;
  if (v.ok.level) {
    const [text, cls] = levelState(v.levelCm, full, v.overflow);
    setMeta('level', text, cls);
  } else {
    setMeta('level', 'Sin lectura del sensor de nivel', 'is-bad');
  }

  // Agua que entra / sale
  setField('lpmIn', fmt(v.flowIn.lpm, 2));
  setField('totalLIn', fmt(v.flowIn.totalL, 1));
  setField('lpmOut', fmt(v.flowOut.lpm, 2));
  setField('totalLOut', fmt(v.flowOut.totalL, 1));
  setMeta('flowIn', v.flowing.flowIn
    ? simulated ? 'Llega agua del manantial' : 'Entrando agua al tanque'
    : 'Ahora no está entrando agua');
  setMeta('flowOut', v.flowing.flowOut
    ? simulated ? 'El pueblo está usando agua' : 'Saliendo agua del tanque'
    : 'Ahora no está saliendo agua');

  // Calidad
  setField('temperature', fmt(v.temperature, 1));
  setField('ph', fmt(v.ph, 2));
  setField('clarity', fmt(v.clarity, 0));
  setMeta('temperature', v.ok.temperature ? temperatureText(v.temperature) : 'Sin lectura del sensor', v.ok.temperature ? '' : 'is-bad');
  setMeta('ph', v.ok.ph ? phText(v.ph) : 'Sin lectura del sensor', v.ok.ph ? '' : 'is-bad');
  setMeta('turbidity', v.ok.turbidity ? clarityText(v.clarity) : 'Sin lectura del sensor', v.ok.turbidity ? '' : 'is-bad');

  // Puntos de estado: verde = funcionando; rojo = sin lectura; gris = sin agua pasando
  // (un medidor de agua sin agua no envía señal y no se puede comprobar).
  SENSOR_KEYS.forEach((key) => {
    if (FLOW_KEYS.includes(key)) setDot(key, v.flowing[key] ? true : v.ok[key] ? null : false);
    else setDot(key, v.ok[key]);
  });

  sparks.level?.push(v.percent);
  sparks.flowIn?.push(v.flowIn.lpm);
  sparks.flowOut?.push(v.flowOut.lpm);
  sparks.temperature?.push(v.temperature);
  sparks.ph?.push(v.ph);
  sparks.turbidity?.push(v.clarity);

  // Estado general
  const badge = $('#mode-badge');
  badge.className = `chip ${connected ? 'is-esp32' : 'is-demo'}`;
  badge.textContent = connected ? 'En vivo' : `Simulación · ${t.sim?.clock ?? ''}`.trim();
  $('#sim-banner').hidden = !simulated;
  if (simulated) $('#sim-clock').textContent = t.sim?.clock ?? '--';
  updateLastUpdate(connected);

  const directBtn = $('#direct-btn');
  directBtn.hidden = !cloudHost;
  directBtn.textContent = directEnabled() ? 'Desconectar de la maqueta' : 'Conectar con la maqueta (mismo WiFi)';
  $('#maint-link').hidden = cloudHost;

  document.title = `${simulated ? 'Simulación · ' : ''}${Math.round(v.percent)}% · Reservorio de Agua`;
}

function updateLastUpdate(connected = lastOkAt > 0) {
  const el = $('#last-update');
  el.textContent = connected && lastOkAt ? timeAgo(lastOkAt) : lastOkAt ? `último dato ${timeAgo(lastOkAt)}` : '—';
}

/* ------------------------------------------------------------ acciones */

let toastTimer = null;
function toast(message, kind = '') {
  const el = $('#toast');
  el.textContent = message;
  el.className = `t-toast is-visible${kind ? ` is-${kind}` : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 't-toast'), 4200);
}

const datos = iniciarDatos(render, 700);

$('#direct-btn').addEventListener('click', async () => {
  if (directEnabled()) {
    setDirect(false);
    toast('Desconectado de la maqueta en este navegador');
    datos.refresh();
    return;
  }
  toast('Conectando con la maqueta… si el navegador lo pide, pulsa "Permitir"');
  try {
    await directTelemetry(8000);  // aquí aparece el aviso de permiso del navegador
    setDirect(true);
    toast('Conectado con la maqueta: datos reales', 'ok');
    datos.refresh();
  } catch {
    toast('No se pudo. Conéctate al mismo WiFi de la maqueta, usa Chrome o Edge y pulsa "Permitir".', 'bad');
  }
});

setInterval(() => updateLastUpdate(datos.estado.connected), 1000);
window.addEventListener('resize', () => Object.values(sparks).forEach((spark) => spark.render()));
