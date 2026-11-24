import { DEFAULT_CONFIG, getConfig, getTelemetry, postAction, saveConfig } from './api.js';
import { Sparkline } from './charts.js';
import { MockSource } from './mock.js';

const POLL_MS = 1500;
const HISTORY_POINTS = 60;
const SENSOR_KEYS = ['level', 'temperature', 'ph', 'turbidity', 'flow'];

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const state = {
  mode: localStorage.getItem('reservorio.mode') || 'auto',
  source: 'demo',
  connected: false,
  config: loadStoredConfig(),
  lastTelemetry: null,
  lastFrameAt: 0,
  lastOkAt: 0,
  lastPercent: 0,
  busy: false,
  previous: { source: null, sensors: {} },
};

const mock = new MockSource(state.config);

const sparks = {
  level: new Sparkline($('[data-spark="level"]'), { color: '#38bdf8', maxPoints: HISTORY_POINTS }),
  flow: new Sparkline($('[data-spark="flow"]'), { color: '#a78bfa', maxPoints: HISTORY_POINTS }),
  temperature: new Sparkline($('[data-spark="temperature"]'), { color: '#fb923c', maxPoints: HISTORY_POINTS }),
  ph: new Sparkline($('[data-spark="ph"]'), { color: '#34d399', maxPoints: HISTORY_POINTS }),
  turbidity: new Sparkline($('[data-spark="turbidity"]'), { color: '#fbbf24', maxPoints: HISTORY_POINTS }),
};

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
  localStorage.setItem('reservorio.config', JSON.stringify(state.config));
  mock.setConfig(state.config);
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

function levelState(levelCm, maxLevel) {
  if (!isNum(levelCm) || !isNum(maxLevel)) return { text: 'SIN LECTURA', cls: '' };
  if (levelCm >= maxLevel + 1) return { text: '¡REBALSANDO!', cls: 'is-over' };
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
    if (el.dataset.state) el.title = ok ? 'lectura correcta' : 'sin lectura';
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

function flatten(t) {
  return {
    percent: t.level?.percent ?? null,
    levelCm: t.level?.levelCm ?? null,
    liters: t.level?.liters ?? null,
    distance: t.level?.distanceCm ?? null,
    tankHeight: t.level?.tankHeightCm ?? state.config.tankHeightCm,
    maxLevel: t.level?.maxLevelCm ?? state.config.maxLevelCm,
    lpm: t.flow?.lpm ?? null,
    totalL: t.flow?.totalL ?? null,
    pulses: t.flow?.pulses ?? null,
    temperature: t.temperature?.c ?? null,
    ph: t.ph?.value ?? null,
    phVoltage: t.ph?.voltage ?? null,
    phRaw: t.ph?.raw ?? null,
    ntu: t.turbidity?.ntu ?? null,
    clarity: t.turbidity?.clarity ?? null,
    turbVoltage: t.turbidity?.voltage ?? null,
    ip: t.wifi?.ip ?? '--',
    rssi: t.wifi?.rssi ? `${t.wifi.rssi} dBm` : '--',
    uptime: formatUptime(t.uptime),
    heap: isNum(t.system?.heap) ? `${Math.round(t.system.heap / 1024)} KB` : '--',
    sensorsOk: t.system?.sensorsOk ?? SENSOR_KEYS.filter((k) => t[k]?.ok).length,
  };
}

function formatUptime(seconds) {
  if (!isNum(seconds)) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min ${s} s`;
  return `${s} s`;
}

function render(t) {
  state.lastTelemetry = t;
  state.lastFrameAt = Date.now();

  const values = flatten(t);

  setField('percent', fmt(values.percent, 0));
  setField('levelCm', fmt(values.levelCm, 1));
  setField('liters', fmt(values.liters, 0));
  setField('distance', fmt(values.distance, 1));
  setField('tankHeight', fmt(values.tankHeight, 1));

  setField('lpm', fmt(values.lpm, 2));
  setField('totalL', fmt(values.totalL, 1));
  setField('pulses', isNum(values.pulses) ? Math.round(values.pulses).toLocaleString('es-ES') : '--');

  setField('temperature', fmt(values.temperature, 1));
  setField('ph', fmt(values.ph, 2));
  setField('phVoltage', fmt(values.phVoltage, 2));
  setField('phRaw', isNum(values.phRaw) ? Math.round(values.phRaw) : '--');

  setField('ntu', fmt(values.ntu, 0));
  setField('clarity', fmt(values.clarity, 0));
  setField('turbVoltage', fmt(values.turbVoltage, 2));

  setField('ip', values.ip);
  setField('rssi', values.rssi);
  setField('uptime', values.uptime);
  setField('heap', values.heap);
  setField('sensorsOk', String(values.sensorsOk));

  // Si el ultrasónico falla, no vaciamos el tanque de golpe: conservamos el último nivel.
  if (isNum(values.percent)) state.lastPercent = values.percent;
  const displayPercent = isNum(values.percent) ? values.percent : state.lastPercent;

  const water = $('[data-tank-water]');
  if (water) water.style.setProperty('--level', `${Math.min(100, Math.max(0, displayPercent ?? 0))}%`);

  // Estado por sensor
  SENSOR_KEYS.forEach((key) => {
    setStateDot(key, t[key]?.ok !== false);
  });
  setStateDot('system', state.source === 'esp32' ? true : null);

  // Textos secundarios
  const levelMeta = $('[data-meta="level"]');
  const levelInfo = levelState(values.levelCm, values.maxLevel);
  levelMeta.className = `card-meta ${levelInfo.cls}`.trim();
  levelMeta.textContent = t.level?.ok
    ? `${levelInfo.text} · ${fmt(values.levelCm, 1)} cm de ${fmt(values.maxLevel, 1)} cm`
    : 'Sin eco: revisa el montaje del HC-SR04';
  $('[data-meta="flow"]').textContent =
    values.lpm > 0.05 ? 'Caudal activo' : 'Sin caudal (en reposo)';
  $('[data-meta="temperature"]').textContent = t.temperature?.ok
    ? 'Sonda OneWire en línea'
    : 'Sonda desconectada o sin pull-up';
  $('[data-meta="ph"]').textContent = t.ph?.ok
    ? 'Electrodo estable'
    : 'Revisa la sonda y la calibración';
  $('[data-meta="turbidity"]').textContent = t.turbidity?.ok
    ? `${fmt(values.clarity, 0)} % de claridad`
    : 'Sensor fuera de rango';
  $('[data-meta="system"]').textContent =
    state.source === 'esp32'
      ? `${values.ip} · ${values.rssi}`
      : 'Datos simulados (modo demo)';

  // Sparklines
  sparks.level.push(values.percent);
  sparks.flow.push(values.lpm);
  sparks.temperature.push(values.temperature);
  sparks.ph.push(values.ph);
  sparks.turbidity.push(values.ntu);

  // Tabla cruda
  $('[data-raw="ph"]').textContent = isNum(values.phRaw) ? Math.round(values.phRaw) : '--';
  $('[data-raw="phV"]').textContent = withUnit(values.phVoltage, 3, 'V');
  $('[data-raw="turb"]').textContent = isNum(t.turbidity?.raw) ? Math.round(t.turbidity.raw) : '--';
  $('[data-raw="turbV"]').textContent = withUnit(values.turbVoltage, 3, 'V');
  $('[data-raw="distance"]').textContent = withUnit(values.distance, 1, 'cm');
  $('[data-raw="pulses"]').textContent = isNum(values.pulses)
    ? Math.round(values.pulses).toLocaleString('es-ES')
    : '--';

  // Pista del hero
  const hint = $('#hero-hint');
  if (state.source === 'esp32') {
    hint.textContent = `ESP32 en ${values.ip} · ${values.sensorsOk}/5 sensores respondiendo`;
  } else {
    hint.textContent = 'Modo demostración: datos simulados, sin hardware conectado.';
  }

  // Título de la pestaña
  const pct = isNum(values.percent) ? `${Math.round(values.percent)}%` : '--';
  document.title = `${pct} · Reservorio de Agua`;

  trackEvents(t);
}

function trackEvents(t) {
  SENSOR_KEYS.forEach((key) => {
    const ok = t[key]?.ok !== false;
    const before = state.previous.sensors[key];
    if (before !== undefined && before !== ok) {
      if (key === 'flow') return; // el caudal 0 no es un fallo
      logEvent(`${labelFor(key)}: ${ok ? 'lectura recuperada' : 'sin lectura'}`, ok ? 'ok' : 'bad');
    }
    state.previous.sensors[key] = ok;
  });
}

function labelFor(key) {
  return (
    {
      level: 'Nivel',
      flow: 'Caudal',
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

function updateSourceUI() {
  const isEsp32 = state.source === 'esp32';
  $('#diag-mode').textContent = isEsp32 ? 'ESP32 conectado' : 'modo demo';
  $$('[data-calibrate]').forEach((btn) => (btn.disabled = !isEsp32));
  $$('[data-action="reset-flow"]').forEach((btn) => (btn.disabled = !isEsp32));

  if (isEsp32) {
    setBadge('ok', `ESP32 · ${state.lastTelemetry?.wifi?.ip ?? 'conectado'}`);
  } else if (state.mode === 'esp32') {
    setBadge('bad', 'ESP32 sin conexión');
  } else if (state.mode === 'auto') {
    setBadge('warn', 'Demo · sin hardware');
  } else {
    setBadge('warn', 'Demo · datos simulados');
  }

  const last = $('#last-update');
  if (isEsp32 && state.lastOkAt) last.textContent = timeAgo(state.lastOkAt);
  else if (state.mode === 'esp32') last.textContent = 'reintentando…';
  else last.textContent = 'simulado';
}

async function refreshConfig() {
  if (state.source !== 'esp32') {
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
  let data = null;

  try {
    if (state.mode === 'demo') {
      data = mock.next();
      state.source = 'demo';
    } else {
      try {
        data = await getTelemetry();
        if (!state.connected) {
          state.connected = true;
          logEvent('ESP32 conectado', 'ok');
          setTimeout(refreshConfig, 0);
        }
        state.source = 'esp32';
        state.lastOkAt = Date.now();
      } catch (error) {
        state.connected = false;
        if (state.mode === 'auto') {
          data = mock.next();
          state.source = 'demo';
        } else {
          state.source = 'demo';
          setBadge('bad', 'ESP32 sin conexión');
        }
      }
    }

    if (data) {
      if (state.previous.source !== state.source) {
        state.previous.source = state.source;
        if (state.source === 'demo' && state.mode !== 'demo') {
          logEvent('Sin respuesta del ESP32: mostrando datos simulados', 'warn');
        }
      }
      render(data);
    }

    updateSourceUI();
  } finally {
    state.busy = false;
    const elapsed = performance.now() - started;
    setTimeout(tick, Math.max(250, POLL_MS - elapsed));
  }
}

function applyMode(mode) {
  state.mode = mode;
  localStorage.setItem('reservorio.mode', mode);
  $('#source-select').value = mode;
  if (mode === 'esp32') {
    state.connected = false;
    setBadge('warn', 'conectando…');
    logEvent('Buscando el ESP32…');
  } else if (mode === 'demo') {
    logEvent('Modo demo activado', 'ok');
  } else {
    logEvent('Modo automático');
  }
  updateSourceUI();
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
  if (state.source !== 'esp32') {
    toast('La calibración necesita el ESP32 conectado', 'bad');
    return;
  }
  const names = { ph7: 'buffer pH 7', ph4: 'buffer pH 4', 'turbidity-clear': 'agua clara' };
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
  if (state.source !== 'esp32') {
    mock.resetTotal();
    toast('Total reiniciado (demo)', 'ok');
    return;
  }
  try {
    await postAction('/api/reset', { what: 'flow' });
    toast('Totalizador de flujo reiniciado', 'ok');
    logEvent('Totalizador de flujo reiniciado', 'ok');
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

  if (state.source !== 'esp32') {
    storeConfig(payload);
    mock.setConfig(state.config);
    toast('Ajustes guardados (demo, solo en este navegador)', 'ok');
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
  $('#source-select').value = state.mode;
  $('#source-select').addEventListener('change', (event) => {
    applyMode(event.target.value);
  });

  $$('[data-calibrate]').forEach((btn) => {
    btn.addEventListener('click', () => handleCalibration(btn.dataset.calibrate));
  });

  $$('[data-action="reset-flow"]').forEach((btn) => {
    btn.addEventListener('click', handleResetFlow);
  });

  $('#config-form').addEventListener('submit', handleConfigSubmit);
  $('#reload-config').addEventListener('click', () => {
    if (state.source === 'esp32') refreshConfig();
    else fillConfigForm(state.config);
    toast('Configuración recargada');
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });
}

function start() {
  bindEvents();
  fillConfigForm(state.config);
  updateSourceUI();
  logEvent('Dashboard iniciado');

  if (state.mode === 'esp32') setBadge('warn', 'conectando…');

  setInterval(() => {
    if (state.source === 'esp32' && state.lastOkAt) {
      $('#last-update').textContent = timeAgo(state.lastOkAt);
    }
  }, 1000);

  tick();
}

start();

// Acceso desde la consola del navegador para depurar:
window.reservorio = { state, mock };
