/**
 * Mini gráfica de línea (canvas puro, sin librerías).
 * Se adapta al ancho del contenedor y al devicePixelRatio.
 */

export class Sparkline {
  constructor(canvas, { maxPoints = 60, color = '#38bdf8', fill = true } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.maxPoints = maxPoints;
    this.color = color;
    this.fill = fill;
    this.values = [];
    this.width = 0;
    this.height = 0;
  }

  push(value) {
    this.values.push(typeof value === 'number' && Number.isFinite(value) ? value : null);
    if (this.values.length > this.maxPoints) this.values.shift();
    this.render();
  }

  clear() {
    this.values = [];
    this.render();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = Math.max(10, this.canvas.clientWidth);
    const cssHeight = Math.max(10, this.canvas.clientHeight || 46);
    if (this.width === cssWidth && this.height === cssHeight) return false;
    this.width = cssWidth;
    this.height = cssHeight;
    this.canvas.width = Math.round(cssWidth * dpr);
    this.canvas.height = Math.round(cssHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  render() {
    this.resize();
    const { ctx, width, height } = this;
    ctx.clearRect(0, 0, width, height);

    const values = this.values;
    const numeric = values.filter((v) => v !== null);
    if (numeric.length < 2) return;

    let min = Math.min(...numeric);
    let max = Math.max(...numeric);
    if (max - min < 1e-6) {
      const pad = Math.max(1, Math.abs(max) * 0.05);
      min -= pad;
      max += pad;
    }
    const span = max - min;
    const padY = span * 0.15;
    min -= padY;
    max += padY;

    const stepX = width / (this.maxPoints - 1);
    const xFor = (index) => width - (values.length - 1 - index) * stepX;
    const yFor = (value) => height - ((value - min) / (max - min)) * height;

    // Área
    if (this.fill) {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, hexToRgba(this.color, 0.32));
      gradient.addColorStop(1, hexToRgba(this.color, 0));
      ctx.beginPath();
      let started = false;
      values.forEach((v, i) => {
        if (v === null) {
          started = false;
          return;
        }
        const x = xFor(i);
        const y = yFor(v);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.lineTo(xFor(values.length - 1), height);
      ctx.lineTo(xFor(0), height);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Línea
    ctx.beginPath();
    let drawing = false;
    values.forEach((v, i) => {
      if (v === null) {
        drawing = false;
        return;
      }
      const x = xFor(i);
      const y = yFor(v);
      if (!drawing) {
        ctx.moveTo(x, y);
        drawing = true;
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Punto final
    const lastIndex = values.length - 1;
    if (values[lastIndex] !== null) {
      ctx.beginPath();
      ctx.arc(xFor(lastIndex), yFor(values[lastIndex]), 2.6, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    }
  }
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
