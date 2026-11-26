/**
 * Simulador del reservorio para cuando el ESP32 no está conectado.
 *
 * Representa un día típico de un reservorio rural apoyado, alimentado por gravedad desde
 * un manantial y que abastece a un pueblo:
 *   - Entrada: el manantial da un caudal casi constante.
 *   - Salida: el consumo del pueblo sube en la mañana (6-8 h) y en la tarde (18-20 h),
 *     es medio al mediodía y casi nulo de noche.
 *   - Nivel: balance de masa (entrada - salida) sobre el área real de la maqueta. De noche
 *     el tanque se llena y el exceso sale por el rebose (31 cm), como en un sistema real.
 *   - Calidad: el agua de manantial es clara; algunos días llueve por la tarde y la
 *     turbidez sube un poco. Temperatura estable (~17 °C) y pH ~7.3.
 *
 * Un día simulado dura DAY_S segundos reales. El estado depende solo de la hora, así que
 * todos los que abren la página ven la misma simulación y no salta al cambiar de página.
 * Devuelve un objeto con la misma forma que /api/telemetry del ESP32 (+ simulated: true).
 */

export const DAY_S = 720;                 // 12 min reales = 24 h simuladas
const TANK_AREA_CM2 = 38.8 * 28.8;        // interior de la maqueta
const CM_PER_L = 1000 / TANK_AREA_CM2;    // ~0.895 cm por litro
const PPL = 450;                          // pulsos por litro (ZJ-S201)
const SPRING_LPM = 6.6;                   // caudal del manantial

const DEFAULTS = { tankHeightCm: 33.5, maxLevelCm: 29, overflowCm: 31 };

// Ruido determinista en [-1, 1] (igual para todos los visitantes en el mismo segundo).
function noise(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

const bump = (h, center, width) => Math.exp(-(((h - center) / width) ** 2));

// Consumo del pueblo en L/min según la hora simulada (0-24).
export function demandLpm(hour) {
  return (
    0.9 +
    19.8 * bump(hour, 7, 1.3) +    // mañana: cocina, aseo, salida al trabajo/colegio
    9.9 * bump(hour, 13, 2.2) +    // mediodía: almuerzo
    19.8 * bump(hour, 19, 1.4)     // tarde: regreso a casa, cena
  );
}

function rainy(day) {
  return day % 3 === 2;            // un día de cada tres llueve por la tarde
}

function step(s, t, dt) {
  const hour = ((t % DAY_S) / DAY_S) * 24;
  const second = Math.floor(t);
  const inLpm = SPRING_LPM * (1 + 0.03 * noise(second));
  let outLpm = demandLpm(hour) * (1 + 0.06 * noise(second + 0.5));

  const overflowL = DEFAULTS.overflowCm / CM_PER_L;
  let volume = s.volume + ((inLpm - outLpm) / 60) * dt;
  if (volume < 0) {                // tanque vacío: el pueblo solo recibe lo que entra
    outLpm = Math.max(0, outLpm + (volume * 60) / dt);
    volume = 0;
  }
  let overflowLpm = 0;
  if (volume > overflowL) {        // el exceso sale por el rebose
    overflowLpm = ((volume - overflowL) * 60) / dt;
    volume = overflowL;
  }

  s.volume = volume;
  s.inLpm = inLpm;
  s.outLpm = outLpm;
  s.overflowLpm = overflowLpm;
  s.totalIn += (inLpm / 60) * dt;
  s.totalOut += (outLpm / 60) * dt;
  s.t = t;
}

// Arranca un día antes con el tanque lleno: de noche siempre rebalsa, así que al llegar
// a "ahora" el estado es el mismo sin importar desde dónde se empezó.
function stateAt(t) {
  const dayStart = Math.floor(t / DAY_S) * DAY_S;
  const s = {
    volume: DEFAULTS.overflowCm / CM_PER_L,
    inLpm: 0, outLpm: 0, overflowLpm: 0, totalIn: 0, totalOut: 0,
    t: dayStart - DAY_S,
  };
  for (let x = s.t + 1; x <= t; x += 1) {
    if (x === dayStart) {           // acumulados del día: se reinician a las 00:00
      s.totalIn = 0;
      s.totalOut = 0;
    }
    step(s, x, 1);
  }
  return s;
}

export function createSimulator(options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  let s = null;

  return {
    /** Telemetría simulada para el instante `nowMs` (por defecto, ahora). */
    telemetry(nowMs = Date.now()) {
      const t = nowMs / 1000;
      if (!s || t < s.t || t - s.t > DAY_S) {
        s = stateAt(Math.floor(t));
      } else {
        const dayStart = Math.floor(t / DAY_S) * DAY_S;
        while (s.t + 1 <= t) {
          if (s.t < dayStart && s.t + 1 >= dayStart) {
            s.totalIn = 0;
            s.totalOut = 0;
          }
          step(s, s.t + 1, 1);
        }
      }

      const day = Math.floor(t / DAY_S);
      const hour = ((t % DAY_S) / DAY_S) * 24;
      const levelCm = s.volume * CM_PER_L;
      const percent = Math.min(100, (levelCm / cfg.maxLevelCm) * 100);

      // Lluvia: la claridad baja entre las 14 y las 18 h y se recupera de a pocos.
      const rain = rainy(day) ? bump(hour, 16, 1.6) : 0;
      const clarity = Math.max(0, Math.min(100, 98 - 30 * rain + 1.5 * noise(Math.floor(t) + 7)));
      const voltage = 2.225 + (clarity / 100) * (2.759 - 2.225);
      const ve = (voltage * 4.2) / 2.759;
      const ntu = Math.max(0, -1120.4 * ve * ve + 5742.3 * ve - 4352.9);

      const tempC = 17.4 + 0.9 * Math.sin(((hour - 9) / 24) * 2 * Math.PI) + 0.05 * noise(Math.floor(t / 5));
      const ph = 7.32 + 0.06 * Math.sin((hour / 24) * 2 * Math.PI) - 0.15 * rain + 0.02 * noise(Math.floor(t / 3));

      return {
        simulated: true,
        sim: {
          hour,
          clock: `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}`,
          day,
          raining: rain > 0.2,
          overflowLpm: s.overflowLpm,
        },
        ts: nowMs,
        uptime: Math.floor(t % 86400),
        wifi: { connected: false, mode: 'sim', ip: 'simulación', rssi: 0 },
        level: {
          ok: true,
          distanceCm: cfg.tankHeightCm - levelCm,
          levelCm,
          percent,
          liters: s.volume,
          tankHeightCm: cfg.tankHeightCm,
          maxLevelCm: cfg.maxLevelCm,
          overflowCm: cfg.overflowCm,
        },
        temperature: { ok: true, c: tempC },
        ph: { ok: true, value: ph, voltage: 2.6015 - (ph - 7) * 0.1565, raw: 0 },
        turbidity: { ok: true, ntu, clarity, voltage, raw: 0 },
        flowIn: { ok: true, lpm: s.inLpm, totalL: s.totalIn, pulses: Math.round(s.totalIn * PPL) },
        flowOut: { ok: true, lpm: s.outLpm, totalL: s.totalOut, pulses: Math.round(s.totalOut * PPL) },
        system: { heap: 0, sensorsOk: 6, sensorsTotal: 6 },
      };
    },
  };
}
