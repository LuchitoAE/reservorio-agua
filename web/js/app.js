import { DEFAULT_CONFIG, getConfig, getTelemetry, isCloud, pollMs, postAction, saveConfig } from './api.js';
import { Sparkline } from './charts.js';
import { FLOW_KEYS, SENSOR_KEYS, lecturas } from './lecturas.js';
import { createSimulator } from './simulador.js';

// Con el ESP32 conectado se muestran SOLO sus datos reales (un sensor que no responde se
// muestra en 0; ver lecturas.js). Sin ESP32, la web muestra una simulación claramente
// marcada (simulador.js): nunca se mezclan datos simulados con reales.

const POLL_MS = pollMs(500);   // cada cuánto se piden datos (ESP32 local: 0.5 s; nube: 2.5 s)
const HISTORY_POINTS = 60;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const state = {
  connected: false,
  simulated: false,
  cloud: false,
  config: loadStoredConfig(),
  lastTelemetry: null,
  lastOkAt: 0,
  busy: false,
  previous: { connected: null, sensors: {} },
};

const sparks = {
  level: new Sparkline($('[data-spark="level"]'), { color: '#38bdf8', maxPoints: HISTORY_POINTS }),
  flowIn: new Sparkline($('[data-spark="flowIn"]'), { color: '#a78bfa', maxPoints: HISTORY_POINTS }),
  flowOut: new Sparkline($('[data-spark="flowOut"]'), { color: '#f472b6', maxPoints: HISTORY_POINTS }),
  temperature: new Sparkline($('[data-spark="temperature"]'), { color: '#fb923c', maxPoints: HISTORY_POINTS }),
  ph: new Sparkline($('[data-spark="ph"]'), { color: '#34d399', maxPoints: HISTORY_POINTS }),
  turbidity: new Sparkline($('[data-spark="turbidity"]'), { color: '#fbbf24', maxPoints: HISTORY_POINTS }),
};

function clearSparks() {
  Object.values(sparks).forEach((spark) => spark.clear());
}

/* ------------------------------------------------------------------ utils - */

function loadStoredConfig() {
  try {
    const raw = localStorage.getItem('reservorio.config');
    return { ...DEFAULT_CONFIG, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function storeConfig(config) {
  state.config = { ...state.config, ...config };
  try {
    localStorage.setItem('reservorio.config', JSON.stringify(state.config));
  } catch {
    // sin almacenamiento local: la configuración igual queda en el ESP32
  }
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function fmt(value, decimals = 1) {
  if (!isNum(value)) return '--';
  return value.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function withUnit(value, decimals, unit) {
  return isNum(value) ? `${fmt(value, decimals)} ${unit}` : '--';
}

function levelState(levelCm, maxLevel, overflow = 31) {
  if (!isNum(levelCm) || !isNum(maxLevel)) return { text: 'SIN LECTURA', cls: '' };
  if (levelCm >= overflow) return { text: '¡REBALSANDO!', cls: 'is-over' };
  if (levelCm >= maxLevel) return { text: 'TANQUE LLENO', cls: 'is-full' };
  if (levelCm >= maxLevel - 5) return { text: 'CASI LLENO', cls: 'is-high' };
  if (levelCm <= 2) return { text: 'TANQUE VACÍO', cls: 'is-low' };
  if (levelCm <= 5) return { text: 'NIVEL BAJO', cls: 'is-low' };
  return { text: 'NIVEL NORMAL', cls: '' };
}

function timeAgo(ms) {
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (seconds < 2) return 'ahora';
  if (seconds < 60) return `hace ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  return `hace ${minutes} min`;
}

function setField(name, text) {
  $$(`[data-field="${name}"]`).forEach((el) => {
    if (el.textContent !== text) el.textContent = text;
  });
}

function setStateDot(name, ok) {
  $$(`[data-state="${name}"], [data-state-dot="${name}"]`).forEach((el) => {
    if (ok === null) {
      el.classList.remove('is-ok', 'is-bad');
      return;
    }
    el.classList.toggle('is-ok', !!ok);
    el.classList.toggle('is-bad', !ok);
    if (el.dataset.state) el.title = ok ? 'lectura correcta' : 'no conectado';
  });
}

/* --------------------------------------------------------------- logging - */

const logEl = $('#log');

function logEvent(message, kind = '') {
  const li = document.createElement('li');
  if (kind) li.className = `is-${kind}`;
  const time = document.createElement('time');
  time.textContent = new Date().toLocaleTimeString('es-ES', { hour12: false });
  const span = document.createElement('span');
  span.textContent = message;
  li.append(time, span);
  logEl.prepend(li);
  while (logEl.children.length > 40) logEl.lastElementChild.remove();
}

/* --------------------------------------------------------------- render - */

function formatUptime(seconds) {
  if (!isNum(seconds)) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min ${s} s`;
  return `${s} s`;
}

const simulator = createSimulator();

function render(t) {
  state.lastTelemetry = t;

  const connected = state.connected;
  const simulated = state.simulated;
  const showing = connected || simulated;   // hay valores para mostrar
  const v = lecturas(t, state.config);
  // Un caudalímetro sin agua circulando no se puede detectar: se aclara en vez de
  // contarlo como falla.
  const idleFlows = FLOW_KEYS.filter((key) => !v.flowing[key]).length;
  const ip = connected ? (t.wifi?.ip ?? '--') : '--';
  const rssi = connected && t.wifi?.rssi ? `${t.wifi.rssi} dBm` : '--';

  setField('percent', fmt(v.percent, 0));
  setField('levelCm', fmt(v.levelCm, 1));
  setField('liters', fmt(v.liters, 0));
  setField('distance', fmt(v.distance, 1));
  setField('tankHeight', fmt(v.tankHeight, 1));

  [['In', v.flowIn], ['Out', v.flowOut]].forEach(([suffix, flow]) => {
    setField(`lpm${suffix}`, fmt(flow.lpm, 2));
    setField(`totalL${suffix}`, fmt(flow.totalL, 1));
    setField(`pulses${suffix}`, Math.round(flow.pulses).toLocaleString('es-ES'));
  });
  setField('netLpm', `${v.netLpm > 0.005 ? '+' : ''}${fmt(v.netLpm, 2)}`);

  setField('temperature', fmt(v.temperature, 1));
  setField('ph', fmt(v.ph, 2));
  setField('phVoltage', fmt(v.phVoltage, 2));
  setField('phRaw', String(Math.round(v.phRaw)));

  setField('ntu', fmt(v.ntu, 0));
  setField('clarity', fmt(v.clarity, 0));
  setField('turbVoltage', fmt(v.turbVoltage, 2));

  setField('ip', ip);
  setField('rssi', rssi);
  setField('uptime', connected ? formatUptime(t.uptime) : '--');
  setField('heap', connected && isNum(t.system?.heap) ? `${Math.round(t.system.heap / 1024)} KB` : '--');
  setField('sensorsOk', String(v.sensorsOk));

  const water = $('[data-tank-water]');
  if (water) water.style.setProperty('--level', `${Math.min(100, Math.max(0, v.percent))}%`);

  // Estado por sensor: verde = conectado y con lectura; rojo = no conectado (valor en 0).
  // Un caudalímetro sin agua circulando queda neutro: no se puede saber si está conectado.
  SENSOR_KEYS.forEach((key) => {
    const neutral = FLOW_KEYS.includes(key) && showing && !v.flowing[key];
    setStateDot(key, neutral ? null : v.conectado[key]);
  });
  setStateDot('system', simulated ? null : connected);

  // Textos secundarios
  const sinEsp32 = simulated ? 'Simulación' : 'ESP32 sin conexión';
  const levelMeta = $('[data-meta="level"]');
  const levelInfo = levelState(v.levelCm, v.maxLevel, v.overflow);
  levelMeta.className = `card-meta ${v.ok.level ? levelInfo.cls : ''}`.trim();
  levelMeta.textContent = !showing
    ? sinEsp32
    : v.ok.level
      ? `${levelInfo.text} · ${fmt(v.levelCm, 1)} cm de ${fmt(v.maxLevel, 1)} cm`
      : 'No conectado: el HC-SR04 no devuelve eco';
  $('[data-meta="flowIn"]').textContent = !showing
    ? sinEsp32
    : v.flowing.flowIn
      ? simulated ? 'Llega agua del manantial' : 'Entrando agua al tanque'
      : 'Sin caudal (válvula cerrada o sin sensor)';
  $('[data-meta="flowOut"]').textContent = !showing
    ? sinEsp32
    : v.flowing.flowOut
      ? simulated ? 'Consumo del pueblo' : 'Saliendo agua del tanque'
      : 'Sin caudal (válvula cerrada o sin sensor)';
  $('[data-meta="temperature"]').textContent = !showing
    ? sinEsp32
    : v.ok.temperature
      ? 'Sonda OneWire en línea'
      : 'No conectado: el DS18B20 no responde';
  $('[data-meta="ph"]').textContent = !showing
    ? sinEsp32
    : v.ok.ph
      ? 'Electrodo en línea'
      : 'No conectado o sin señal válida';
  $('[data-meta="turbidity"]').textContent = !showing
    ? sinEsp32
    : v.ok.turbidity
      ? `${fmt(v.clarity, 0)} % de claridad`
      : 'No conectado o sin señal válida';
  $('[data-meta="system"]').textContent = connected
    ? `${ip} · ${rssi}${idleFlows ? ' · caudalímetros en reposo no se cuentan' : ''}`
    : sinEsp32;

  // Sparklines
  sparks.level.push(v.percent);
  sparks.flowIn.push(v.flowIn.lpm);
  sparks.flowOut.push(v.flowOut.lpm);
  sparks.temperature.push(v.temperature);
  sparks.ph.push(v.ph);
  sparks.turbidity.push(v.ntu);

  // Tabla cruda (diagnóstico): lo que lee el ESP32, aunque el sensor no esté conectado
  $('[data-raw="ph"]').textContent = isNum(v.raw.phRaw) ? Math.round(v.raw.phRaw) : '--';
  $('[data-raw="phV"]').textContent = withUnit(v.raw.phVoltage, 3, 'V');
  $('[data-raw="turb"]').textContent = isNum(v.raw.turbRaw) ? Math.round(v.raw.turbRaw) : '--';
  $('[data-raw="turbV"]').textContent = withUnit(v.raw.turbVoltage, 3, 'V');
  $('[data-raw="distance"]').textContent = withUnit(v.raw.distance, 1, 'cm');
  ['pulsesIn', 'pulsesOut'].forEach((key) => {
    $(`[data-raw="${key}"]`).textContent = isNum(v.raw[key])
      ? Math.round(v.raw[key]).toLocaleString('es-ES')
      : '--';
  });

  // Pista del hero
  const idleText = idleFlows === 0
    ? ''
    : ` · ${idleFlows === 2 ? 'los 2 caudalímetros' : '1 caudalímetro'} sin agua circulando`;
  const tendencia = v.netLpm > 0.05
    ? 'el tanque se está llenando'
    : v.netLpm < -0.05
      ? 'el pueblo consume más de lo que entra'
      : 'entrada y salida equilibradas';
  $('#hero-hint').textContent = connected
    ? `${state.cloud ? 'ESP32 en vivo por internet' : `ESP32 en ${ip}`} · ${v.sensorsOk}/${SENSOR_KEYS.length} sensores con lectura${idleText}`
    : simulated
      ? `SIMULACIÓN · hora simulada ${t.sim?.clock ?? '--'}${t.sim?.raining ? ' · lloviendo' : ''} · ${tendencia}`
      : 'ESP32 sin conexión: los valores se muestran en 0 hasta que responda.';

  // Aviso de simulación (visible siempre que los datos no sean reales).
  $('#sim-banner').hidden = !simulated;
  if (simulated) $('#sim-clock').textContent = t.sim?.clock ?? '--';

  // Título de la pestaña
  document.title = `${simulated ? 'Simulación · ' : ''}${Math.round(v.percent)}% · Reservorio de Agua`;

  if (connected) trackEvents(v.ok);
}

function trackEvents(ok) {
  SENSOR_KEYS.forEach((key) => {
    const before = state.previous.sensors[key];
    if (before !== undefined && before !== ok[key] && !FLOW_KEYS.includes(key)) {
      logEvent(`${labelFor(key)}: ${ok[key] ? 'conectado' : 'no conectado'}`, ok[key] ? 'ok' : 'bad');
    }
    state.previous.sensors[key] = ok[key];
  });
}

function labelFor(key) {
  return (
    {
      level: 'Nivel',
      flowIn: 'Caudal de entrada',
      flowOut: 'Caudal de salida',
      temperature: 'Temperatura',
      ph: 'pH',
      turbidity: 'Turbidez',
    }[key] || key
  );
}

/* ------------------------------------------------------------ connection - */

function setBadge(kind, text) {
  const badge = $('#source-badge');
  badge.className = `chip chip--${kind}`;
  badge.textContent = text;
}

function updateConnectionUI() {
  const connected = state.connected;
  // Calibrar y cambiar ajustes solo con el ESP32 en la red local (no en la nube ni en simulación).
  const canControl = connected && !state.cloud;
  $$('[data-calibrate]').forEach((btn) => (btn.disabled = !canControl));
  $$('[data-action="reset-flow"]').forEach((btn) => (btn.disabled = !canControl));
  $$('#config-form button, #config-form input').forEach((el) => (el.disabled = !canControl));
  $('#diag-mode').textContent = connected
    ? state.cloud ? 'En vivo por internet · solo lectura' : 'ESP32 conectado'
    : state.simulated ? 'Simulación · solo lectura' : 'ESP32 sin conexión';

  if (connected) {
    setBadge('ok', state.cloud ? 'EN VIVO · ESP32' : `ESP32 · ${state.lastTelemetry?.wifi?.ip ?? 'conectado'}`);
  } else if (state.simulated) {
    setBadge('warn', 'SIMULACIÓN · ESP32 sin conexión');
  } else {
    setBadge('bad', 'ESP32 sin conexión');
  }

  const last = $('#last-update');
  if (connected && state.lastOkAt) last.textContent = timeAgo(state.lastOkAt);
  else if (state.lastOkAt) last.textContent = `último dato ${timeAgo(state.lastOkAt)}`;
  else last.textContent = 'reintentando…';
}

async function refreshConfig() {
  if (!state.connected) {
    fillConfigForm(state.config);
    return;
  }
  try {
    const config = await getConfig();
    storeConfig(config);
    fillConfigForm(config);
  } catch (error) {
    logEvent('No se pudo leer la configuración', 'warn');
  }
}

function fillConfigForm(config) {
  const form = $('#config-form');
  form.elements.tankHeightCm.value = Number(config.tankHeightCm).toFixed(1);
  form.elements.maxLevelCm.value = Number(config.maxLevelCm).toFixed(1);
  form.elements.sensorOffsetCm.value = Number(config.sensorOffsetCm).toFixed(1);
}

async function tick() {
  if (state.busy) return;
  state.busy = true;

  const started = performance.now();

  try {
    let data;
    try {
      data = await getTelemetry();
      state.cloud = isCloud(data);
      if (!state.connected) {
        if (state.simulated) clearSparks();  // no mezclar la simulación con datos reales
        state.connected = true;
        state.simulated = false;
        logEvent(state.cloud ? 'ESP32 en vivo por internet: datos reales' : 'ESP32 conectado: datos reales', 'ok');
        if (!state.cloud) setTimeout(refreshConfig, 0);
      }
      state.lastOkAt = Date.now();
    } catch (error) {
      if (state.connected || state.previous.connected === null) {
        logEvent('Sin respuesta del ESP32: se muestra una SIMULACIÓN', 'warn');
        clearSparks();
      }
      state.connected = false;
      state.simulated = true;
      state.cloud = false;
      state.previous.sensors = {};
      data = simulator.telemetry();
    }
    state.previous.connected = state.connected;

    render(data);
    updateConnectionUI();
  } finally {
    state.busy = false;
    const elapsed = performance.now() - started;
    setTimeout(tick, Math.max(250, POLL_MS - elapsed));
  }
}

/* --------------------------------------------------------------- actions - */

let toastTimer = null;

function toast(message, kind = '') {
  const el = $('#toast');
  el.textContent = message;
  el.className = `toast is-visible${kind ? ` is-${kind}` : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.className = 'toast';
  }, 3800);
}

async function handleCalibration(sensor) {
  if (!state.connected) {
    toast('La calibración necesita el ESP32 conectado', 'bad');
    return;
  }
  if (
    sensor === 'level-empty' &&
    !window.confirm('¿El tanque está completamente vacío? Se guardará la distancia actual como el fondo (0 %).')
  ) {
    return;
  }
  const names = {
    'level-empty': 'tanque vacío',
    ph7: 'buffer pH 7',
    ph4: 'buffer pH 4',
    'turbidity-clear': 'agua clara',
    'turbidity-turbid': 'agua turbia',
  };
  toast(`Midiendo ${names[sensor] ?? sensor}…`);
  try {
    const result = await postAction('/api/calibrate', { sensor });
    if (result.ok) {
      toast(`Calibración de ${names[sensor]} guardada`, 'ok');
      logEvent(`Calibración ${names[sensor]} aplicada`, 'ok');
      await refreshConfig();
    } else {
      toast(result.error || 'No se pudo calibrar: lectura fuera de rango', 'bad');
      logEvent(`Calibración ${names[sensor]} rechazada`, 'warn');
    }
  } catch (error) {
    toast(`Error al calibrar: ${error.message}`, 'bad');
  }
}

async function handleResetFlow() {
  if (!state.connected) {
    toast('Reiniciar el total necesita el ESP32 conectado', 'bad');
    return;
  }
  try {
    await postAction('/api/reset', { what: 'flow' });
    toast('Acumulados de entrada y salida en 0', 'ok');
    logEvent('Acumulados de caudal reiniciados', 'ok');
  } catch (error) {
    toast(`No se pudo reiniciar: ${error.message}`, 'bad');
  }
}

async function handleConfigSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    tankHeightCm: Number(form.elements.tankHeightCm.value),
    maxLevelCm: Number(form.elements.maxLevelCm.value),
    sensorOffsetCm: Number(form.elements.sensorOffsetCm.value),
  };

  if (!Number.isFinite(payload.tankHeightCm) || payload.tankHeightCm < 10) {
    toast('La altura del tanque debe ser mayor que 10 cm', 'bad');
    return;
  }

  if (!state.connected) {
    toast('No se puede guardar: el ESP32 no responde', 'bad');
    return;
  }

  try {
    const config = await saveConfig(payload);
    storeConfig(config);
    fillConfigForm(config);
    toast('Ajustes guardados en el ESP32', 'ok');
    logEvent('Altura del tanque actualizada', 'ok');
  } catch (error) {
    toast(`No se pudo guardar: ${error.message}`, 'bad');
  }
}

/* ------------------------------------------------------------------ init - */

function bindEvents() {
  $$('[data-calibrate]').forEach((btn) => {
    btn.addEventListener('click', () => handleCalibration(btn.dataset.calibrate));
  });

  $$('[data-action="reset-flow"]').forEach((btn) => {
    btn.addEventListener('click', handleResetFlow);
  });

  $('#config-form').addEventListener('submit', handleConfigSubmit);
  $('#reload-config').addEventListener('click', () => {
    refreshConfig();
    toast('Configuración recargada');
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });
}

function start() {
  bindEvents();
  fillConfigForm(state.config);
  logEvent('Dashboard iniciado');

  setInterval(() => {
    if (state.connected && state.lastOkAt) {
      $('#last-update').textContent = timeAgo(state.lastOkAt);
    }
  }, 1000);

  tick();
}

start();

// Acceso desde la consola del navegador para depurar:
window.reservorio = { state };
