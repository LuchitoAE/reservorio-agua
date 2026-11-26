/**
 * Configurar WiFi: elige la red a la que se conecta la maqueta (se guarda en el ESP32).
 * Se abre sola al conectarse a la red "Reservorio-Setup" (portal) o desde Mantenimiento.
 */

import { cloudHost } from './api.js';

const $ = (sel) => document.querySelector(sel);
const form = $('#form');
let seleccion = null;
let enviando = false;

function toast(msg, kind = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast is-visible${kind ? ` is-${kind}` : ''}`;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.className = 'toast'), 4500);
}

function barras(rssi) {
  const n = rssi >= -60 ? 3 : rssi >= -72 ? 2 : 1;
  return `<span class="bars" aria-label="señal">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(path, body) {
  const res = await fetch(path, body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function elegir(ssid, segura = true) {
  seleccion = ssid;
  form.hidden = false;
  form.elements.ssid.value = ssid;
  form.elements.pass.value = '';
  form.elements.pass.disabled = !segura;
  form.elements.pass.placeholder = segura ? 'De 8 a 63 caracteres' : 'Red abierta: sin clave';
  document.querySelectorAll('#redes button').forEach((b) => b.classList.toggle('is-selected', b.dataset.ssid === ssid));
  (segura ? form.elements.pass : form.elements.ssid).focus();
}

function render(d) {
  const estado = $('#estado');
  if (d.connected) {
    estado.innerHTML = `Conectada a <b>${esc(d.ssid)}</b>${d.home ? ' (red de la casa, dirección fija)' : ''}.<br>`
      + `Dirección: <b>${esc(d.ip)}</b> — desde esa red, abre <a href="http://${esc(d.ip)}/">http://${esc(d.ip)}</a>`;
  } else if (d.trying) {
    estado.innerHTML = `Intentando conectar a <b>${esc(d.trying)}</b>…`;
  } else {
    estado.innerHTML = 'La maqueta <b>no está conectada</b> a ninguna red WiFi.';
  }
  const aviso = $('#aviso');
  aviso.hidden = !d.ap;
  if (d.ap) {
    aviso.innerHTML = `Estás en la red de configuración <b>${esc(d.apSsid)}</b>. Al guardar una red, la maqueta se `
      + 'conecta a ella y este celular puede perder la conexión: es normal. <b>Mira la pantalla LCD</b>: mostrará '
      + 'la red y la dirección nueva. Conecta tu celular o laptop a esa misma red y abre esa dirección.';
  }

  const lista = $('#redes');
  const redes = d.networks ?? [];
  if (!redes.length) {
    lista.innerHTML = `<li class="meta">${d.scanning ? 'Buscando redes…' : 'No se encontraron redes. Pulsa «Buscar de nuevo».'}</li>`;
  } else {
    lista.innerHTML = redes.map((r) => `
      <li><button type="button" data-ssid="${esc(r.ssid)}" data-secure="${r.secure}">
        ${barras(r.rssi)}<span class="name">${esc(r.ssid)}</span>
        <span class="meta">${r.secure ? '🔒' : 'abierta'}${d.connected && r.ssid === d.ssid ? ' · conectada' : ''}</span>
      </button></li>`).join('') + `
      <li><button type="button" data-ssid="" data-secure="true"><span class="name">Otra red (escribir el nombre)…</span></button></li>`;
    lista.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      elegir(b.dataset.ssid, b.dataset.secure === 'true');
      if (!b.dataset.ssid) form.elements.ssid.focus();
    }));
    if (seleccion !== null) {
      lista.querySelectorAll('button').forEach((b) => b.classList.toggle('is-selected', b.dataset.ssid === seleccion));
    }
  }

  const guardadas = $('#guardadas');
  guardadas.innerHTML = (d.saved ?? []).map((r) => `
    <li><span>${esc(r.ssid)}${r.home ? ' <span class="meta">· red de la casa (no se puede borrar)</span>' : ''}</span>
      ${r.home ? '' : `<button type="button" class="btn btn--ghost" data-olvidar="${esc(r.ssid)}">Olvidar</button>`}</li>`).join('')
    || '<li class="meta">Ninguna.</li>';
  guardadas.querySelectorAll('[data-olvidar]').forEach((b) => b.addEventListener('click', async () => {
    try {
      await api('/api/wifi/olvidar', { ssid: b.dataset.olvidar });
      toast(`Se olvidó «${b.dataset.olvidar}»`, 'ok');
      actualizar();
    } catch (e) {
      toast(`No se pudo: ${e.message}`, 'bad');
    }
  }));
}

async function actualizar() {
  try {
    render(await api('/api/wifi'));
  } catch {
    if (!enviando) $('#estado').textContent = 'No se pudo consultar a la maqueta. ¿Estás conectado a su red?';
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const ssid = form.elements.ssid.value.trim();
  const pass = form.elements.pass.disabled ? '' : form.elements.pass.value;
  if (!ssid) return toast('Escribe el nombre de la red', 'bad');
  if (pass && (pass.length < 8 || pass.length > 63)) return toast('La clave debe tener de 8 a 63 caracteres', 'bad');
  enviando = true;
  try {
    await api('/api/wifi', { ssid, pass });
    form.hidden = true;
    seleccion = null;
    $('#estado').innerHTML = `Guardado. La maqueta se está conectando a <b>${esc(ssid)}</b>… `
      + 'Si este celular se desconecta, <b>mira la pantalla LCD</b>: mostrará la dirección nueva.';
    toast('Red guardada', 'ok');
  } catch (err) {
    toast(err.message, 'bad');
  } finally {
    setTimeout(() => (enviando = false), 8000);
  }
});

$('#cancelar').addEventListener('click', () => {
  form.hidden = true;
  seleccion = null;
  document.querySelectorAll('#redes button').forEach((b) => b.classList.remove('is-selected'));
});
$('#ver').addEventListener('change', (e) => (form.elements.pass.type = e.target.checked ? 'text' : 'password'));
$('#refrescar').addEventListener('click', () => {
  $('#redes').innerHTML = '<li class="meta">Buscando redes…</li>';
  setTimeout(actualizar, 3500);
});

if (cloudHost) {
  $('#estado').innerHTML = 'Esta página funciona solo conectado a la maqueta: a su red <b>Reservorio-Setup</b> '
    + '(abre <b>http://192.168.4.1/wifi</b>) o al mismo WiFi que ella.';
} else {
  actualizar();
  setInterval(actualizar, 4000);
}
