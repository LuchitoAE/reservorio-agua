/**
 * Convierte la telemetría del ESP32 en los valores que muestra el dashboard.
 *
 * Regla: solo datos reales. Si un sensor no está conectado (el ESP32 lo informa con
 * ok = false) o el ESP32 no responde, sus valores se muestran en 0. Los valores crudos
 * del panel de diagnóstico se dejan tal cual, para poder ver por qué falla un sensor.
 *
 * Hay dos caudalímetros: entrada (flowIn) y salida (flowOut). No se pueden detectar:
 * sin agua circulando no mandan pulsos, igual que si estuvieran desconectados. Por eso
 * cada uno solo cuenta como conectado mientras mide caudal.
 */

export const FLOW_KEYS = ['flowIn', 'flowOut'];
export const SENSOR_KEYS = ['level', 'temperature', 'ph', 'turbidity', ...FLOW_KEYS];

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const real = (ok, value) => (ok && isNum(value) ? value : 0);
const rawOrNull = (value) => (isNum(value) ? value : null);

export function lecturas(t = {}, config = {}) {
  const ok = Object.fromEntries(SENSOR_KEYS.map((key) => [key, t[key]?.ok === true]));
  const flowing = Object.fromEntries(
    FLOW_KEYS.map((key) => [key, ok[key] && isNum(t[key]?.lpm) && t[key].lpm > 0]),
  );
  const conectado = { ...ok, ...flowing };
  const flow = (key) => ({
    lpm: real(ok[key], t[key]?.lpm),
    totalL: real(ok[key], t[key]?.totalL),
    pulses: real(ok[key], t[key]?.pulses),
  });
  const flowIn = flow('flowIn');
  const flowOut = flow('flowOut');

  return {
    ok,          // valores reales (true) o en 0 (false)
    conectado,   // para los indicadores y el conteo de sensores
    flowing,     // { flowIn, flowOut }: true mientras circula agua
    sensorsOk: SENSOR_KEYS.filter((key) => conectado[key]).length,

    percent: real(ok.level, t.level?.percent),
    levelCm: real(ok.level, t.level?.levelCm),
    liters: real(ok.level, t.level?.liters),
    distance: real(ok.level, t.level?.distanceCm),
    tankHeight: rawOrNull(t.level?.tankHeightCm) ?? config.tankHeightCm ?? null,
    maxLevel: rawOrNull(t.level?.maxLevelCm) ?? config.maxLevelCm ?? null,
    overflow: rawOrNull(t.level?.overflowCm) ?? 31,  // rebose físico

    flowIn,
    flowOut,
    netLpm: flowIn.lpm - flowOut.lpm,  // > 0: el tanque se llena; < 0: se vacía

    temperature: real(ok.temperature, t.temperature?.c),

    ph: real(ok.ph, t.ph?.value),
    phVoltage: real(ok.ph, t.ph?.voltage),
    phRaw: real(ok.ph, t.ph?.raw),

    ntu: real(ok.turbidity, t.turbidity?.ntu),
    clarity: real(ok.turbidity, t.turbidity?.clarity),
    turbVoltage: real(ok.turbidity, t.turbidity?.voltage),

    // Diagnóstico: lo que mide el ESP32, aunque el sensor esté marcado como no conectado.
    raw: {
      phRaw: rawOrNull(t.ph?.raw),
      phVoltage: rawOrNull(t.ph?.voltage),
      turbRaw: rawOrNull(t.turbidity?.raw),
      turbVoltage: rawOrNull(t.turbidity?.voltage),
      distance: rawOrNull(t.level?.distanceCm),
      pulsesIn: rawOrNull(t.flowIn?.pulses),
      pulsesOut: rawOrNull(t.flowOut?.pulses),
    },
  };
}
