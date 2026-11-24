/**
 * Generador de telemetría simulada para trabajar sin hardware (modo Demo).
 * Mantiene un estado propio para que las lecturas se muevan de forma creíble:
 * el nivel sube y baja, el caudal acompaña, el total acumula.
 */

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const noise = (amount) => (Math.random() - 0.5) * amount;

export class MockSource {
  constructor(config = {}) {
    this.config = { tankHeightCm: 40.6, maxLevelCm: 31.5, tankLengthCm: 38.8, tankWidthCm: 28.8, ...config };
    this.startedAt = Date.now();
    this.t = 0;
    this.percent = 64;
    this.totalL = this.config.flowTotalL || 128.4;
    this.temp = 22.3;
    this.ph = 7.24;
    this.ntu = 9.5;
    this.lpm = 0;
    this.lastPulseTick = 0;
  }

  setConfig(config = {}) {
    this.config = { ...this.config, ...config };
  }

  resetTotal() {
    this.totalL = 0;
  }

  next() {
    this.t += 1.5;

    // Ciclo de llenado/vaciado lento (≈4 min) con un poco de ruido.
    const target = 66 + 26 * Math.sin(this.t / 38) + 3 * Math.sin(this.t / 7);
    const previous = this.percent;
    this.percent += (target - this.percent) * 0.08;
    this.percent = clamp(this.percent + noise(0.25), 2, 99);

    const deltaPercent = this.percent - previous;
    const litresNow = Math.max(0, deltaPercent) * 0.01 * this.tankLiters();
    this.lpm = deltaPercent > 0.02 ? clamp(deltaPercent * 9 + noise(0.3), 0, 9) : 0;
    if (this.lpm < 0.05) this.lpm = 0;
    this.totalL += litresNow;

    this.temp = clamp(22.3 + 0.9 * Math.sin(this.t / 90) + noise(0.12), 15, 30);
    this.ph = clamp(7.24 + 0.18 * Math.sin(this.t / 120) + noise(0.03), 5, 9);
    this.ntu = clamp(9.5 + 6 * Math.sin(this.t / 55) + noise(1.2), 0.5, 60);

    const height = this.config.tankHeightCm || 40.6;
    const maxLevel = this.config.maxLevelCm || 31.5;
    const levelCm = (this.percent / 100) * maxLevel;
    const distanceCm = Math.max(2, height - levelCm - (this.config.sensorOffsetCm || 0));

    return {
      ts: Date.now(),
      uptime: Math.floor((Date.now() - this.startedAt) / 1000),
      demo: true,
      wifi: {
        connected: true,
        mode: 'sta',
        ssid: 'Red de ejemplo',
        ip: '192.168.1.50',
        rssi: Math.round(-57 + noise(4)),
      },
      level: {
        ok: true,
        distanceCm,
        levelCm,
        percent: this.percent,
        liters: (this.percent / 100) * this.tankLiters(),
        tankHeightCm: height,
        maxLevelCm: maxLevel,
      },
      flow: {
        ok: true,
        lpm: this.lpm,
        totalL: this.totalL,
        pulses: Math.round(this.totalL * (this.config.flowPulsesPerLiter || 450)),
      },
      temperature: { ok: true, c: this.temp },
      ph: {
        ok: true,
        value: this.ph,
        voltage: 2.5 - (this.ph - 7) * 0.18,
        raw: Math.round(((2.5 - (this.ph - 7) * 0.18) / 3.3) * 4095),
      },
      turbidity: {
        ok: true,
        ntu: this.ntu,
        clarity: clamp(100 - this.ntu * 2.4, 0, 100),
        voltage: 4.2 - this.ntu * 0.02,
        raw: Math.round(((4.2 - this.ntu * 0.02) / 3.3) * 4095),
      },
      system: {
        heap: 214000 + Math.round(noise(4000)),
        sensorsOk: 5,
        sensorsTotal: 5,
        flowPpl: this.config.flowPulsesPerLiter || 450,
      },
    };
  }

  tankLiters() {
    const length = this.config.tankLengthCm || 38.8;
    const width = this.config.tankWidthCm || 28.8;
    const maxLevel = this.config.maxLevelCm || 31.5;
    return (length * width * maxLevel) / 1000;
  }
}
