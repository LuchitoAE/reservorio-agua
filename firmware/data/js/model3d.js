/**
 * Modelo digital del reservorio — Three.js
 *
 * Medidas tomadas del plano "Reservorio + caseta de válvulas (Rev. 04)":
 *   exterior 40 × 30 × 40.6 cm · vidrio 6 mm · interior 38.8 × 28.8 × 40
 *   caseta 22 × 20 × 26 cm · rebose 31.5 cm · 4 válvulas PVC Ø 1/2"
 *
 * 1 unidad = 1 cm.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const D = {
  L: 40,
  A: 30,
  H: 40.6,
  e: 0.6,
  inL: 38.8,
  inA: 28.8,
  inH: 40,
  maxLevel: 31.5,
  caseta: { l: 22, a: 20, h: 26, z: -25 },
  pipe: 0.635,
};

const COLORS = {
  glass: 0xcdefff,
  edge: 0x8fe3ff,
  water: 0x0e9bbd,
  waterTop: 0x6fe4ff,
  pvc: 0xb8c3ce,
  pvcDark: 0x8d99a5,
  valve: 0xd63b3b,
  steel: 0x9aa7b4,
  base: 0x0a1d2b,
  dim: 0x4cc9f0,
};

/* ------------------------------------------------------------------ setup */

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x04101b, 190, 380);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1000);
camera.position.set(74, 54, 94);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 19, 2);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 48;
controls.maxDistance = 280;
controls.maxPolarAngle = Math.PI * 0.495;
controls.zoomSpeed = 0.8;
controls.rotateSpeed = 0.65;

const clock = new THREE.Clock();

/* ----------------------------------------------------------------- lights */

scene.add(new THREE.HemisphereLight(0xd6f3ff, 0x081624, 1.35));

const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
keyLight.position.set(70, 105, 65);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -70;
keyLight.shadow.camera.right = 70;
keyLight.shadow.camera.top = 90;
keyLight.shadow.camera.bottom = -30;
keyLight.shadow.camera.near = 10;
keyLight.shadow.camera.far = 300;
keyLight.shadow.bias = -0.0006;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x7fd8ff, 0.7);
fillLight.position.set(-80, 45, -70);
scene.add(fillLight);

const rimLight = new THREE.PointLight(0x38bdf8, 28, 220, 2);
rimLight.position.set(0, 55, -55);
scene.add(rimLight);

/* --------------------------------------------------------------- materials */

const glassMat = new THREE.MeshPhysicalMaterial({
  color: COLORS.glass,
  metalness: 0,
  roughness: 0.05,
  transparent: true,
  opacity: 0.11,
  side: THREE.DoubleSide,
  depthWrite: false,
  clearcoat: 1,
  clearcoatRoughness: 0.05,
});

const edgeMat = new THREE.LineBasicMaterial({
  color: COLORS.edge,
  transparent: true,
  opacity: 0.65,
});

const waterMat = new THREE.MeshPhysicalMaterial({
  color: 0x07566e,
  metalness: 0.08,
  roughness: 0.16,
  transparent: true,
  opacity: 0.66,
  side: THREE.DoubleSide,
  depthWrite: false,
});

const waterTopMat = new THREE.MeshPhysicalMaterial({
  color: 0x5fd8f5,
  metalness: 0.12,
  roughness: 0.06,
  transparent: true,
  opacity: 0.85,
  emissive: 0x0a4b60,
  emissiveIntensity: 0.45,
  side: THREE.DoubleSide,
});

const pvcMat = new THREE.MeshStandardMaterial({
  color: COLORS.pvc,
  roughness: 0.42,
  metalness: 0.12,
});

const pvcDarkMat = new THREE.MeshStandardMaterial({
  color: COLORS.pvcDark,
  roughness: 0.5,
  metalness: 0.1,
});

const valveMat = new THREE.MeshStandardMaterial({
  color: COLORS.valve,
  roughness: 0.34,
  metalness: 0.15,
});

const steelMat = new THREE.MeshStandardMaterial({
  color: COLORS.steel,
  roughness: 0.3,
  metalness: 0.55,
});

const baseMat = new THREE.MeshStandardMaterial({ color: COLORS.base, roughness: 0.9 });

const dimMat = new THREE.LineBasicMaterial({
  color: COLORS.dim,
  transparent: true,
  opacity: 0.55,
});

/* ------------------------------------------------------------------ world */

const world = new THREE.Group();
scene.add(world);

const base = new THREE.Mesh(new THREE.BoxGeometry(46, 1, 54), baseMat);
base.position.set(0, -0.5, -10);
base.receiveShadow = true;
world.add(base);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({ color: 0x030b13, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1.02;
ground.receiveShadow = true;
world.add(ground);

const grid = new THREE.GridHelper(180, 36, 0x1c4a62, 0x0c2737);
grid.position.y = -1.0;
grid.material.transparent = true;
grid.material.opacity = 0.35;
world.add(grid);

/* --------------------------------------------------------------- reservoir */

const reservoir = new THREE.Group();
world.add(reservoir);

function addGlassPanel(w, h, d, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glassMat);
  mesh.position.set(x, y, z);
  mesh.renderOrder = 3;
  reservoir.add(mesh);

  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeMat);
  edges.position.copy(mesh.position);
  reservoir.add(edges);
}

const halfL = D.L / 2;
const halfA = D.A / 2;
const wall = D.e;

// base y laterales
addGlassPanel(D.L, wall, D.A, 0, wall / 2, 0);
addGlassPanel(D.L, D.H, wall, 0, D.H / 2, halfA - wall / 2);
addGlassPanel(D.L, D.H, wall, 0, D.H / 2, -halfA + wall / 2);
addGlassPanel(wall, D.H, D.A, -halfL + wall / 2, D.H / 2, 0);
addGlassPanel(wall, D.H, D.A, halfL - wall / 2, D.H / 2, 0);

// aristas exteriores, más marcadas
const outerEdges = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(D.L, D.H, D.A)),
  new THREE.LineBasicMaterial({ color: COLORS.edge, transparent: true, opacity: 0.75 }),
);
outerEdges.position.set(0, D.H / 2, 0);
reservoir.add(outerEdges);

// marco superior de aluminio
const rimMat = new THREE.MeshStandardMaterial({ color: 0x9fb2c4, roughness: 0.35, metalness: 0.6 });
const rim1 = new THREE.Mesh(new THREE.BoxGeometry(D.L + 0.4, 0.5, 0.9), rimMat);
rim1.position.set(0, D.H + 0.05, halfA - 0.2);
const rim2 = rim1.clone();
rim2.position.z = -halfA + 0.2;
const rim3 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, D.A), rimMat);
rim3.position.set(-halfL + 0.2, D.H + 0.05, 0);
const rim4 = rim3.clone();
rim4.position.x = halfL - 0.2;
reservoir.add(rim1, rim2, rim3, rim4);

// nivel de rebose (línea discontinua)
const spillPoints = [
  new THREE.Vector3(-halfL, D.maxLevel, halfA),
  new THREE.Vector3(halfL, D.maxLevel, halfA),
  new THREE.Vector3(halfL, D.maxLevel, -halfA),
  new THREE.Vector3(-halfL, D.maxLevel, -halfA),
  new THREE.Vector3(-halfL, D.maxLevel, halfA),
];
const spillLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints(spillPoints),
  new THREE.LineDashedMaterial({
    color: 0x38bdf8,
    dashSize: 1.3,
    gapSize: 1.1,
    transparent: true,
    opacity: 0.45,
  }),
);
spillLine.computeLineDistances();
world.add(spillLine);

/* ------------------------------------------------------------------ water */

const waterGroup = new THREE.Group();
world.add(waterGroup);

const waterVolume = new THREE.Mesh(new THREE.BoxGeometry(D.inL, 1, D.inA), waterMat);
waterVolume.position.set(0, wall, 0);
waterVolume.renderOrder = 1;
waterGroup.add(waterVolume);

const surfaceGeo = new THREE.PlaneGeometry(D.inL, D.inA, 48, 36);
surfaceGeo.rotateX(-Math.PI / 2);
const surfaceBase = Float32Array.from(surfaceGeo.attributes.position.array);

const waterSurface = new THREE.Mesh(surfaceGeo, waterTopMat);
waterSurface.position.set(0, D.maxLevel, 0);
waterSurface.renderOrder = 2;
waterGroup.add(waterSurface);

const waterLine = new THREE.LineLoop(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-D.inL / 2, 0, -D.inA / 2),
    new THREE.Vector3(D.inL / 2, 0, -D.inA / 2),
    new THREE.Vector3(D.inL / 2, 0, D.inA / 2),
    new THREE.Vector3(-D.inL / 2, 0, D.inA / 2),
  ]),
  new THREE.LineBasicMaterial({ color: 0xc9f6ff, transparent: true, opacity: 0.75 }),
);
waterGroup.add(waterLine);

function applyLevel(level) {
  const h = Math.max(0.35, level - wall);
  waterVolume.scale.y = h;
  waterVolume.position.y = wall + h / 2;
  waterSurface.position.y = level + 0.03;
  waterLine.position.y = level + 0.04;
  waterGroup.visible = level > 0.7;
}

function animateWaves(time) {
  const pos = surfaceGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = surfaceBase[i * 3];
    const z = surfaceBase[i * 3 + 2];
    pos.setY(
      i,
      Math.sin(x * 0.38 + time * 1.6) * 0.09 + Math.sin(z * 0.52 + time * 1.15) * 0.06,
    );
  }
  pos.needsUpdate = true;
  surfaceGeo.computeVertexNormals();
}

/* --------------------------------------------------------------- caseta 3D */

const caseta = new THREE.Group();
world.add(caseta);

function addCasetaPanel(w, h, d, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glassMat);
  mesh.position.set(x, y, z);
  mesh.renderOrder = 3;
  caseta.add(mesh);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeMat);
  edges.position.copy(mesh.position);
  caseta.add(edges);
}

const c = D.caseta;
const cHalfL = c.l / 2;
const cZ = c.z; // center of 15..35

addCasetaPanel(wall, c.h, c.a, -cHalfL, c.h / 2, cZ);
addCasetaPanel(wall, c.h, c.a, cHalfL, c.h / 2, cZ);
addCasetaPanel(c.l, c.h, wall, 0, c.h / 2, cZ - c.a / 2 + wall / 2);
addCasetaPanel(c.l, wall, c.a, 0, wall / 2, cZ);

const casetaEdges = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(c.l, c.h, c.a)),
  new THREE.LineBasicMaterial({ color: COLORS.edge, transparent: true, opacity: 0.5 }),
);
casetaEdges.position.set(0, c.h / 2, cZ);
caseta.add(casetaEdges);

/* ------------------------------------------------------------------ pipes */

const pipes = new THREE.Group();
world.add(pipes);

const up = new THREE.Vector3(0, 1, 0);

function pipe(a, b, { r = D.pipe, mat = pvcMat, joints = true } = {}) {
  const p1 = new THREE.Vector3(...a);
  const p2 = new THREE.Vector3(...b);
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = dir.length();
  if (len < 0.001) return;

  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 18), mat);
  mesh.position.copy(p1).add(p2).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(up, dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  pipes.add(mesh);

  if (joints) {
    addJoint(p2, r, mat);
  }
  return mesh;
}

function addJoint(pos, r = D.pipe, mat = pvcMat, scale = 1.15) {
  const joint = new THREE.Mesh(new THREE.SphereGeometry(r * scale, 14, 12), mat);
  joint.position.set(...pos);
  joint.castShadow = true;
  pipes.add(joint);
  return joint;
}

function addFlange(x, y) {
  const flange = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.05, 0.5, 18),
    pvcDarkMat,
  );
  flange.rotation.x = Math.PI / 2;
  flange.position.set(x, y, -D.A / 2 + wall / 2);
  pipes.add(flange);
}

function addValve(pos) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.SphereGeometry(1.45, 20, 16), valveMat);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 2.4, 10), valveMat);
  stem.position.y = 2.5;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.42, 1.05), valveMat);
  handle.position.y = 3.8;
  handle.rotation.y = Math.PI / 5;

  group.add(body, stem, handle);
  group.position.set(...pos);
  group.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  pipes.add(group);
  return group;
}

// Ingreso: sube desde la caseta, cruza la pared a 36 cm y baja dentro del tanque
pipe([8, 22, cZ], [8, 36, cZ]);
pipe([8, 36, cZ], [8, 36, 8]);
pipe([8, 36, 8], [8, 27, 8]);
addJoint([8, 22, cZ]);
addValve([8, 24, cZ]);
addFlange(8, 36);

// Rebose: boca abierta a 31.5, baja a 20 y pasa a la caseta
pipe([-2, 20, -7], [-2, 31.5, -7], { joints: false });
addJoint([-2, 20, -7]);
pipe([-2, 20, -7], [-2, 20, cZ]);
addValve([-2, 20, cZ - 1]);
addFlange(-2, 20);
const rim = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.12, 10, 26), pvcDarkMat);
rim.rotation.x = Math.PI / 2;
rim.position.set(-2, 31.5, -7);
pipes.add(rim);

// Salida: canastilla dentro, tubo a 5.5 hacia la caseta
pipe([-8, 5.5, -10], [-8, 5.5, cZ]);
addValve([-8, 6.1, cZ - 1]);
addFlange(-8, 5.5);

const strainer = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 5, 18, 1, true), steelMat);
strainer.rotation.x = Math.PI / 2;
strainer.position.set(-8, 5.5, -11.4);
pipes.add(strainer);
for (let i = 0; i < 4; i++) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.07, 8, 24), pvcDarkMat);
  ring.position.set(-8, 5.5, -13 + i * 1.1);
  pipes.add(ring);
}
const strainerCap = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12), steelMat);
strainerCap.position.set(-8, 5.5, -13.9);
pipes.add(strainerCap);

// Limpia: fondo a 1.5 hacia la caseta
pipe([4, 1.5, -12], [4, 1.5, cZ]);
addValve([4, 2.1, cZ - 1]);
addFlange(4, 1.5);

// By-Pass: une la línea de ingreso con la de salida dentro de la caseta
pipe([8, 10, cZ], [8, 10, -31]);
pipe([8, 10, -31], [-8, 10, -31]);
pipe([-8, 10, -31], [-8, 5.5, -31]);
pipe([-8, 5.5, cZ], [-8, 5.5, -31]);
addValve([0, 10, -31]);

/* ------------------------------------------------------------- dimensiones */

const medidas = new THREE.Group();
world.add(medidas);

function dimLine(points) {
  const geometry = new THREE.BufferGeometry().setFromPoints(
    points.map((p) => new THREE.Vector3(...p)),
  );
  medidas.add(new THREE.Line(geometry, dimMat));
}

// ancho (40 cm)
dimLine([[-halfL, 0.05, 18.2], [halfL, 0.05, 18.2]]);
dimLine([[-halfL, 0.05, 17.4], [-halfL, 0.05, 19.0]]);
dimLine([[halfL, 0.05, 17.4], [halfL, 0.05, 19.0]]);

// profundidad (30 cm)
dimLine([[23.4, 0.05, -halfA], [23.4, 0.05, halfA]]);
dimLine([[22.6, 0.05, -halfA], [24.2, 0.05, -halfA]]);
dimLine([[22.6, 0.05, halfA], [24.2, 0.05, halfA]]);

// alto (40.6 cm)
dimLine([[23.4, 0.05, 18.2], [23.4, D.H, 18.2]]);
dimLine([[22.6, 0.05, 18.2], [24.2, 0.05, 18.2]]);
dimLine([[22.6, D.H, 18.2], [24.2, D.H, 18.2]]);

/* ------------------------------------------------------------------ labels */

const labelLayer = document.getElementById('labels');
const labels = [];

function addLabel(text, position, cls = '') {
  const el = document.createElement('div');
  el.className = `tag ${cls}`.trim();
  el.textContent = text;
  labelLayer.appendChild(el);
  labels.push({
    el,
    pos: new THREE.Vector3(...position),
    dim: cls.includes('tag--dim'),
  });
}

addLabel('Ingreso · 36 cm', [15.5, 39.4, 7], 'tag--valve');
addLabel('Rebose · 31.5 cm', [-9.5, 33.4, -7], 'tag--water');
addLabel('Salida · 5.5 cm', [-8, 8, -12.6], 'tag--water tag--secondary');
addLabel('Limpia · 1.5 cm', [4, 3.8, -12], 'tag--water tag--secondary');
addLabel('40.0 cm', [0, -0.6, 20.4], 'tag--dim');
addLabel('30.0 cm', [25.6, -0.6, 0], 'tag--dim');

const projected = new THREE.Vector3();

function updateLabels() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const showDims = medidas.visible;

  for (const label of labels) {
    if (label.dim && !showDims) {
      label.el.style.opacity = '0';
      continue;
    }
    projected.copy(label.pos).project(camera);
    const visible = projected.z > -1 && projected.z < 1;
    label.el.style.opacity = visible ? '0.96' : '0';
    if (!visible) continue;
    const x = (projected.x * 0.5 + 0.5) * w;
    const y = (-projected.y * 0.5 + 0.5) * h;
    label.el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
  }
}

/* --------------------------------------------------------------------- UI */

const ui = {
  pct: document.getElementById('level-pct'),
  cm: document.getElementById('level-cm'),
  liters: document.getElementById('level-l'),
  bar: document.getElementById('level-bar'),
  slider: document.getElementById('level-slider'),
  source: document.getElementById('source'),
  badge: document.getElementById('mode-badge'),
  casetaBtn: document.getElementById('toggle-caseta'),
  medidasBtn: document.getElementById('toggle-medidas'),
  loading: document.getElementById('loading'),
};

let targetLevel = D.maxLevel * 0.72;
let currentLevel = targetLevel;
let sourceMode = 'auto';
let hasTelemetry = false;
let lastTelemetry = null;

function litersFor(level) {
  return (D.inL * D.inA * level) / 1000;
}

function updateReadout() {
  const pct = (currentLevel / D.maxLevel) * 100;
  ui.pct.textContent = pct.toFixed(0);
  ui.cm.textContent = currentLevel.toFixed(1);
  ui.liters.textContent = litersFor(currentLevel).toFixed(1);
  ui.bar.style.width = `${Math.min(100, pct)}%`;
}

function setBadge(kind) {
  const map = {
    esp32: ['is-esp32', lastTelemetry?.wifi?.ip ? `ESP32 · ${lastTelemetry.wifi.ip}` : 'ESP32'],
    demo: ['is-demo', 'Demo · nivel manual'],
    offline: ['is-demo', 'ESP32 sin conexión'],
  };
  const [cls, text] = map[kind] || map.demo;
  ui.badge.className = `chip ${cls}`;
  ui.badge.textContent = text;
}

function setSource(mode) {
  sourceMode = mode;
  ui.source.value = mode;
  ui.slider.disabled = mode === 'esp32' && hasTelemetry;
  if (mode === 'demo') setBadge('demo');
  if (mode === 'esp32') setBadge(hasTelemetry ? 'esp32' : 'offline');
  if (mode === 'auto') setBadge(hasTelemetry ? 'esp32' : 'demo');
}

ui.source.addEventListener('change', (event) => {
  setSource(event.target.value);
  if (event.target.value !== 'demo') pollTelemetry();
});

ui.slider.addEventListener('input', (event) => {
  const pct = Number(event.target.value);
  targetLevel = (pct / 100) * D.maxLevel;
  if (sourceMode !== 'demo') {
    sourceMode = 'demo';
    ui.source.value = 'demo';
  }
  setBadge('demo');
});

ui.casetaBtn.addEventListener('click', () => {
  caseta.visible = !caseta.visible;
  ui.casetaBtn.textContent = caseta.visible ? 'Ocultar caseta' : 'Mostrar caseta';
});

ui.medidasBtn.addEventListener('click', () => {
  medidas.visible = !medidas.visible;
  ui.medidasBtn.textContent = medidas.visible ? 'Ocultar medidas' : 'Mostrar medidas';
});

const views = {
  iso: { pos: [74, 54, 94], target: [0, 19, 2] },
  front: { pos: [0, 22, 112], target: [0, 20, 2] },
  top: { pos: [0.1, 140, 2.1], target: [0, 0, 2] },
};

let camAnim = null;
let currentView = 'iso';

function fitFactor() {
  return Math.max(1, 0.75 / camera.aspect);
}

function goToView(name) {
  const view = views[name];
  if (!view) return;
  currentView = name;
  const target = new THREE.Vector3(...view.target);
  if (camera.aspect < 1) target.y -= 8;
  const k = fitFactor();
  const pos = new THREE.Vector3(...view.pos).sub(new THREE.Vector3(...view.target))
    .multiplyScalar(k).add(target);

  camAnim = {
    t: 0,
    fromPos: camera.position.clone(),
    toPos: pos,
    fromTarget: controls.target.clone(),
    toTarget: target,
  };
}

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => goToView(button.dataset.view));
});

controls.addEventListener('start', () => {
  camAnim = null;
});

canvas.addEventListener('dblclick', () => goToView('iso'));

async function pollTelemetry() {
  if (sourceMode === 'demo') return;
  try {
    const response = await fetch('/api/telemetry', { cache: 'no-store' });
    if (!response.ok) throw new Error('sin respuesta');
    const data = await response.json();
    const pct = data?.level?.percent;
    if (typeof pct !== 'number' || !Number.isFinite(pct)) throw new Error('sin nivel');

    hasTelemetry = true;
    lastTelemetry = data;
    targetLevel = (Math.min(100, Math.max(0, pct)) / 100) * D.maxLevel;
    ui.slider.disabled = true;
    setBadge('esp32');
  } catch {
    hasTelemetry = false;
    if (sourceMode === 'esp32') {
      setBadge('offline');
    } else {
      setBadge('demo');
      ui.slider.disabled = false;
    }
  }
}

setInterval(pollTelemetry, 3500);

/* ------------------------------------------------------------------ resize */

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

let portrait = window.innerWidth < window.innerHeight;

window.addEventListener('resize', () => {
  const wasPortrait = portrait;
  resize();
  portrait = window.innerWidth < window.innerHeight;
  if (wasPortrait !== portrait) {
    goToView(currentView);
  }
});

resize();
{
  const view = views.iso;
  const target = new THREE.Vector3(...view.target);
  if (camera.aspect < 1) target.y -= 8;
  const k = fitFactor();
  camera.position.copy(new THREE.Vector3(...view.pos).sub(new THREE.Vector3(...view.target)))
    .multiplyScalar(k).add(target);
  controls.target.copy(target);
  controls.minDistance = 48 * k;
  controls.maxDistance = 280 * k;
}

/* ------------------------------------------------------------------- loop */

let firstFrame = true;

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.06);
  const t = clock.elapsedTime;

  currentLevel += (targetLevel - currentLevel) * Math.min(1, dt * 3.4);
  applyLevel(currentLevel);
  animateWaves(t);

  if (camAnim) {
    camAnim.t = Math.min(1, camAnim.t + dt * 1.7);
    const e = camAnim.t < 0.5
      ? 4 * camAnim.t ** 3
      : 1 - ((-2 * camAnim.t + 2) ** 3) / 2;
    camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, e);
    controls.target.lerpVectors(camAnim.fromTarget, camAnim.toTarget, e);
    if (camAnim.t >= 1) camAnim = null;
  }

  controls.update();
  renderer.render(scene, camera);
  updateLabels();
  updateReadout();

  if (ui.slider.value !== String(Math.round((targetLevel / D.maxLevel) * 100))) {
    ui.slider.value = String(Math.round((targetLevel / D.maxLevel) * 100));
  }

  if (firstFrame) {
    firstFrame = false;
    ui.loading.classList.add('is-hidden');
    pollTelemetry();
  }
}

applyLevel(currentLevel);
animate();

window.reservorioModelo = { scene, camera, controls, D, goToView };
