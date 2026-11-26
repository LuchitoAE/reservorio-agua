/**
 * Caso real — dónde estaría este reservorio en la vida real.
 *
 * Escena ilustrativa (sin escala) de un sistema de agua potable rural por gravedad:
 * manantial con su captación en el cerro → línea de conducción → reservorio apoyado con
 * caseta de válvulas en una loma → línea de aducción → pueblo con su red de distribución.
 *
 * El agua se anima con los datos del ESP32 (entrada = caudal de la conducción, salida =
 * consumo del pueblo, nivel, turbidez). Sin ESP32 se usa la simulación de simulador.js,
 * siempre marcada como tal. La hora del día (luz, ventanas) sale de la simulación o del
 * reloj real.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getTelemetry, pollMs } from './api.js';
import { createSimulator } from './simulador.js';

const REAL_M3 = 10;          // reservorio real que representa la maqueta (al 100 %)
const OVERFLOW_CM = 31;
const INNER_CM = 40;         // altura interior de la maqueta

/* ------------------------------------------------------------------ setup */

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const DAY_SKY = new THREE.Color(0x9ccbe8);
const NIGHT_SKY = new THREE.Color(0x3a5472);  // noche azulada: la escena se sigue viendo
scene.background = DAY_SKY.clone();
scene.fog = new THREE.Fog(scene.background, 240, 560);

const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 2000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.maxPolarAngle = Math.PI * 0.47;
controls.minDistance = 25;
controls.maxDistance = 420;

const hemi = new THREE.HemisphereLight(0xdff2ff, 0x3b4a2a, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -200, right: 200, top: 200, bottom: -200, near: 10, far: 700 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

const clock = new THREE.Clock();

/* ---------------------------------------------------------------- terreno */

const SIZE = 680;
const SEG = 180;
const RES = { x: -6, z: 8 };      // reservorio en la loma
const VIL = { x: 16, z: 108 };    // centro del pueblo
const SPRING = { x: -42, z: -112 }; // manantial

const smooth = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function rawHeight(x, z) {
  const t = THREE.MathUtils.clamp((112 - z) / 262, 0, 1);  // 0 en el valle, 1 en el cerro
  let h = 80 * t ** 1.35;
  h += 5 * Math.sin(x * 0.035 + 1.3) * Math.cos(z * 0.03) + 2.2 * Math.sin(x * 0.09 + z * 0.07);
  h += 0.07 * Math.abs(x) * t;                             // laderas a los costados
  h += 18 * smooth(-150, -215, z);                         // cumbre al fondo
  return h;
}

const RES_Y = rawHeight(RES.x, RES.z) + 1.5;
const VIL_Y = rawHeight(VIL.x, VIL.z);

function flatten(h, x, z, cx, cz, r, target) {
  const w = 1 - smooth(r * 0.55, r, Math.hypot(x - cx, z - cz));
  return h + (target - h) * w;
}

function height(x, z) {
  let h = rawHeight(x, z);
  h = flatten(h, x, z, RES.x, RES.z, 24, RES_Y);
  h = flatten(h, x, z, VIL.x, VIL.z, 72, VIL_Y);
  return h;
}

{
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  const c = new THREE.Color();
  const low = new THREE.Color(0x5f8f3e);
  const mid = new THREE.Color(0x77924a);
  const high = new THREE.Color(0x8c7b58);
  const rock = new THREE.Color(0x9b968c);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = height(x, z);
    pos.setY(i, y);
    const k = y / 95;
    if (k < 0.3) c.copy(low).lerp(mid, k / 0.3);
    else if (k < 0.75) c.copy(mid).lerp(high, (k - 0.3) / 0.45);
    else c.copy(high).lerp(rock, Math.min(1, (k - 0.75) / 0.25));
    const jitter = 0.94 + 0.12 * Math.abs(Math.sin(x * 12.9 + z * 78.2));
    colors.push(c.r * jitter, c.g * jitter, c.b * jitter);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }),
  );
  terrain.receiveShadow = true;
  scene.add(terrain);
}

/* ------------------------------------------------------------- materiales */

const concreteMat = new THREE.MeshStandardMaterial({ color: 0xb9b6ad, roughness: 0.85 });
const concreteDarkMat = new THREE.MeshStandardMaterial({ color: 0x8f8c84, roughness: 0.9 });
const pipeMat = new THREE.MeshStandardMaterial({ color: 0x7c8389, roughness: 0.4 });  // PVC gris
const meterMat = new THREE.MeshStandardMaterial({ color: 0x1a2129, roughness: 0.55 });
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0xd9f2ff, roughness: 0.05, transparent: true, opacity: 0.18, depthWrite: false,
});
const waterMat = new THREE.MeshPhysicalMaterial({
  color: 0x0e7fa0, roughness: 0.12, transparent: true, opacity: 0.8, depthWrite: false,
});
const windowMat = new THREE.MeshStandardMaterial({ color: 0x1c2630, emissive: 0xffc56b, emissiveIntensity: 0 });

function add(mesh, { shadow = true } = {}) {
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return add(m);
}

/* ----------------------------------------------------- flujo animado (agua) */

const FLOW_PERIOD = 8;

function stripeTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 4;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 64, 0);
  // Brillo suave: se ve como agua que avanza, no como un tubo de color.
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.65)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Tubería apoyada sobre el terreno siguiendo los puntos (x, z) dados.
function groundCurve(points, lift = 0.5) {
  const pts = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i];
    const [x1, z1] = points[i + 1];
    const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 4));
    for (let k = 0; k < n; k++) {
      const x = x0 + ((x1 - x0) * k) / n;
      const z = z0 + ((z1 - z0) * k) / n;
      pts.push(new THREE.Vector3(x, height(x, z) + lift, z));
    }
  }
  const [xl, zl] = points[points.length - 1];
  pts.push(new THREE.Vector3(xl, height(xl, zl) + lift, zl));
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
}

function pipeLine(curve, { radius = 0.55, color = 0xa78bfa, pipe = true } = {}) {
  const length = curve.getLength();
  const segments = Math.ceil(length * 1.5);
  if (pipe) add(new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 10), pipeMat));
  const tex = stripeTexture();
  tex.repeat.set(length / FLOW_PERIOD, 1);
  const mat = new THREE.MeshBasicMaterial({ color, map: tex, transparent: true, opacity: 0, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius * 1.12, 10), mat);
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, mat, tex, speed: 8, curve };
}

let snapFlows = true;  // primer dato: sin transición

function stepFlow(f, lpm, dt, { max = 0.5, scale = 1.2 } = {}) {
  const active = lpm > 0.02;
  const k = snapFlows ? 1 : Math.min(1, dt * 3);
  f.mat.opacity += ((active ? max : 0) - f.mat.opacity) * k;
  f.mesh.visible = f.mat.opacity > 0.02;
  if (active) f.speed = THREE.MathUtils.clamp(lpm * scale, 2, 12);  // lento y tranquilo
  f.tex.offset.x -= (f.speed / FLOW_PERIOD) * dt;
}

/* ------------------------------------------------------------- manantial */

const springY = height(SPRING.x, SPRING.z);
// Cámara de captación: caja de concreto con tapa, enterrada en la ladera.
box(7, 4, 6, concreteMat, SPRING.x, springY + 1.2, SPRING.z);
box(7.6, 0.5, 6.6, concreteDarkMat, SPRING.x, springY + 3.45, SPRING.z);
box(1.8, 0.3, 1.8, concreteDarkMat, SPRING.x + 1.5, springY + 3.85, SPRING.z);  // tapa sanitaria
// Afloramiento: agua que brota de las rocas detrás de la captación.
for (let i = 0; i < 7; i++) {
  const r = 1.4 + (i % 3) * 0.6;
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), concreteDarkMat);
  const a = (i / 7) * Math.PI;
  rock.position.set(SPRING.x - 5 + Math.cos(a) * 6, springY + 0.6, SPRING.z - 6 - Math.sin(a) * 3);
  add(rock);
}
const pool = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24), waterMat);
pool.rotation.x = -Math.PI / 2;
pool.position.set(SPRING.x - 4, springY + 0.35, SPRING.z - 5);
scene.add(pool);

// Quebrada: el agua que la captación no toma sigue cerro abajo.
const stream = pipeLine(
  groundCurve([[-46, -106], [-60, -72], [-73, -32], [-82, 8], [-88, 50], [-92, 92], [-97, 150], [-100, 215]], 0.15),
  { radius: 1.3, color: 0x7fd9f5, pipe: false },
);
stream.mesh.visible = true;  // la quebrada corre siempre
stream.mat.opacity = 0.6;

/* ------------------------------------------------------------- reservorio */

const RW = 12;   // lado
const RH = 7;    // alto
const WALL = 0.6;
const resBase = RES_Y;
box(RW + 3, 0.6, RW + 3, concreteDarkMat, RES.x, resBase + 0.3, RES.z);           // losa de apoyo
// Muros (el frontal, hacia el pueblo, es un "corte" transparente para ver el nivel).
box(RW, RH, WALL, concreteMat, RES.x, resBase + 0.6 + RH / 2, RES.z - RW / 2 + WALL / 2);
box(WALL, RH, RW, concreteMat, RES.x - RW / 2 + WALL / 2, resBase + 0.6 + RH / 2, RES.z);
box(WALL, RH, RW, concreteMat, RES.x + RW / 2 - WALL / 2, resBase + 0.6 + RH / 2, RES.z);
{
  const front = new THREE.Mesh(new THREE.BoxGeometry(RW, RH, 0.2), glassMat);
  front.position.set(RES.x, resBase + 0.6 + RH / 2, RES.z + RW / 2 - 0.1);
  scene.add(front);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(front.geometry),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }),
  );
  edges.position.copy(front.position);
  scene.add(edges);
}
// Techo con tapa sanitaria y dos ventilaciones en cuello de ganso.
box(RW + 0.6, 0.6, RW + 0.6, concreteMat, RES.x, resBase + 0.6 + RH + 0.3, RES.z);
box(2.2, 0.4, 2.2, concreteDarkMat, RES.x - 2.5, resBase + RH + 1.35, RES.z - 2);
for (const dx of [-4, 4]) {
  const v = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2, 10), pipeMat);
  v.position.set(RES.x + dx, resBase + RH + 2.1, RES.z + 3);
  add(v);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.3, 8, 16, Math.PI), pipeMat);
  hook.position.set(RES.x + dx + 0.6, resBase + RH + 3.1, RES.z + 3);
  add(hook);
}
// Agua interior: su altura sigue al nivel medido (maqueta: 40 cm interiores).
const innerH = RH - 0.4;
const water = new THREE.Mesh(new THREE.BoxGeometry(RW - WALL * 2, 1, RW - WALL * 2), waterMat);
water.position.set(RES.x, resBase + 0.6, RES.z);
water.renderOrder = 1;
scene.add(water);
// Línea de rebose dibujada en el corte.
{
  const yOver = resBase + 0.6 + (OVERFLOW_CM / INNER_CM) * innerH;
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(RES.x - RW / 2, yOver, RES.z + RW / 2 + 0.05),
      new THREE.Vector3(RES.x + RW / 2, yOver, RES.z + RW / 2 + 0.05),
    ]),
    new THREE.LineDashedMaterial({ color: 0x38bdf8, dashSize: 0.6, gapSize: 0.4 }),
  );
  line.computeLineDistances();
  scene.add(line);
}

// Caseta de válvulas detrás del reservorio (lado del cerro), con puerta.
const CASETA = { x: RES.x + 2, z: RES.z - RW / 2 - 4 };
box(7, 4.5, 5, concreteMat, CASETA.x, resBase + 2.25, CASETA.z);
box(7.4, 0.4, 5.4, concreteDarkMat, CASETA.x, resBase + 4.7, CASETA.z);
box(1.6, 3, 0.15, new THREE.MeshStandardMaterial({ color: 0x3d6e8f, roughness: 0.6 }), CASETA.x + 2, resBase + 1.5, CASETA.z - 2.55);

// Cerco perimétrico.
{
  const postMat = new THREE.MeshStandardMaterial({ color: 0x6b6f75, roughness: 0.6 });
  const fx0 = RES.x - 12;
  const fx1 = RES.x + 12;
  const fz0 = RES.z - 20;
  const fz1 = RES.z + 12;
  const posts = [];
  for (let x = fx0; x <= fx1; x += 4) posts.push([x, fz0], [x, fz1]);
  for (let z = fz0 + 4; z < fz1; z += 4) posts.push([fx0, z], [fx1, z]);
  posts.forEach(([x, z]) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.4, 6), postMat);
    p.position.set(x, height(x, z) + 1.2, z);
    add(p);
  });
}

/* --------------------------------------------- conducción, aducción, rebose */

const inlet = pipeLine(
  groundCurve([[SPRING.x + 3, SPRING.z + 3], [-34, -84], [-24, -52], [-14, -26], [CASETA.x - 2, CASETA.z - 3]]),
  { color: 0xa78bfa },
);
const outlet = pipeLine(
  groundCurve([[CASETA.x + 3.5, CASETA.z], [RES.x + 9, RES.z - 6], [RES.x + 10, RES.z + 14], [6, 44], [12, 74], [VIL.x, VIL.z - 16]]),
  { color: 0xf472b6 },
);
const overflow = pipeLine(
  groundCurve([[RES.x - 7, RES.z], [RES.x - 16, RES.z + 6], [-40, 30], [-62, 30], [-84, 30]], 0.3),
  { radius: 0.4, color: 0x38bdf8 },
);

// Caudalímetros: fuera de la caseta, sobre la llegada y la salida (como en la maqueta).
function meterAt(f, t, label) {
  const p = f.curve.getPointAt(t);
  const dir = f.curve.getTangentAt(t);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.6, 18), meterMat);
  m.position.copy(p);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  add(m);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), meterMat);
  head.position.copy(p).add(new THREE.Vector3(0, 1.3, 0));
  add(head);
  return { pos: p.clone().add(new THREE.Vector3(0, 3, 0)), label };
}
const inMeter = meterAt(inlet, 0.93, 'Caudalímetro de entrada');
const outMeter = meterAt(outlet, 0.06, 'Caudalímetro de salida');

/* ------------------------------------------------------------------ pueblo */

// Números pseudoaleatorios fijos: el pueblo es siempre igual.
let seed = 7;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const wallColors = [0xc9a27a, 0xd8b98f, 0xb98d66, 0xe3d2b4, 0xc4b19a];
const roofMats = [
  new THREE.MeshStandardMaterial({ color: 0xa0472c, roughness: 0.8 }),   // teja
  new THREE.MeshStandardMaterial({ color: 0x8d949c, roughness: 0.45, metalness: 0.4 }), // calamina
];
const houses = [];

function house(x, z, rot) {
  const w = 5 + rand() * 2.5;
  const d = 4 + rand() * 2;
  const h = 3 + rand() * 1.5;
  const y = height(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rot;
  const wallMat = new THREE.MeshStandardMaterial({ color: wallColors[Math.floor(rand() * wallColors.length)], roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.4, 2, 4), roofMats[rand() < 0.6 ? 0 : 1]);
  roof.position.y = h + 1;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(w / Math.hypot(w, d) * 1.45, 1, d / Math.hypot(w, d) * 1.45);
  roof.castShadow = true;
  g.add(roof);
  for (const dx of [-w / 4, w / 4]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), windowMat);
    win.position.set(dx, h * 0.55, d / 2 + 0.02);
    g.add(win);
  }
  scene.add(g);
  houses.push(g);
}

const streetsZ = [94, 114, 132];
for (const zs of streetsZ) {
  for (let x = -36; x <= 70; x += 9 + rand() * 3) {
    if (Math.abs(x - VIL.x) < 10 && zs === 114) continue;  // plaza
    for (const side of [-1, 1]) {
      if (rand() < 0.18) continue;
      house(x + rand() * 2, zs + side * (5 + rand() * 1.5), side > 0 ? 0 : Math.PI);
    }
  }
}

// Plaza con iglesia.
box(16, 0.3, 14, concreteDarkMat, VIL.x, VIL_Y + 0.15, 114);
{
  const churchMat = new THREE.MeshStandardMaterial({ color: 0xf1ece2, roughness: 0.8 });
  const cy = height(VIL.x, 126);
  box(8, 6, 12, churchMat, VIL.x, cy + 3, 128);
  box(3.2, 11, 3.2, churchMat, VIL.x - 2.4, cy + 5.5, 121);
  const top = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3, 4), roofMats[0]);
  top.position.set(VIL.x - 2.4, cy + 12.5, 121);
  top.rotation.y = Math.PI / 4;
  add(top);
}

// Red de distribución: calles con tubería y ramal a cada calle.
const network = [];
network.push(pipeLine(groundCurve([[VIL.x, VIL.z - 16], [VIL.x, 94], [VIL.x, 132]], 0.35), { radius: 0.4, color: 0xf472b6 }));
for (const zs of streetsZ) {
  network.push(pipeLine(groundCurve([[VIL.x, zs], [-36, zs]], 0.35), { radius: 0.32, color: 0xf472b6 }));
  network.push(pipeLine(groundCurve([[VIL.x, zs], [70, zs]], 0.35), { radius: 0.32, color: 0xf472b6 }));
}

/* ----------------------------------------------------------------- árboles */

{
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6);
  const crownGeo = new THREE.ConeGeometry(1.8, 5.5, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x2f5e2e, roughness: 0.9, flatShading: true });
  const N = 170;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, N);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, N);
  const m = new THREE.Matrix4();
  let n = 0;
  let guard = 0;
  while (n < N && guard++ < 3000) {
    const x = -200 + rand() * 400;
    const z = -190 + rand() * 390;
    const nearRes = Math.hypot(x - RES.x, z - RES.z) < 28;
    const inVillage = x > -45 && x < 80 && z > 82 && z < 145;
    const nearSpring = Math.hypot(x - SPRING.x, z - SPRING.z) < 14;
    const nearPipe = Math.abs(x - (-20 + (z + 100) * 0.14)) < 6 && z < 10 && z > -110;
    if (nearRes || inVillage || nearSpring || nearPipe) continue;
    const s = 0.8 + rand() * 0.9;
    const y = height(x, z);
    m.makeScale(s, s, s).setPosition(x, y + 1.2 * s, z);
    trunks.setMatrixAt(n, m);
    m.makeScale(s, s, s).setPosition(x, y + 4.6 * s, z);
    crowns.setMatrixAt(n, m);
    n++;
  }
  trunks.count = n;
  crowns.count = n;
  trunks.castShadow = true;
  crowns.castShadow = true;
  scene.add(trunks, crowns);
}

/* ---------------------------------------------------------------- etiquetas */

const labelLayer = document.getElementById('labels');
const labels = [];

// near: la etiqueta solo se muestra con la cámara a menos de esa distancia (detalles).
function label(html, position, cls = 'tag--step', { near = 0 } = {}) {
  const el = document.createElement('div');
  el.className = `tag ${cls}`;
  el.innerHTML = html;
  labelLayer.appendChild(el);
  const item = { el, near, pos: position.clone ? position.clone() : new THREE.Vector3(...position) };
  labels.push(item);
  return item;
}

const tagSpring = label('Manantial y captación<small>el agua brota del cerro</small>', [SPRING.x, springY + 9, SPRING.z]);
const tagIn = label('Línea de conducción', inlet.curve.getPointAt(0.45).add(new THREE.Vector3(0, 6, 0)));
const tagRes = label('Reservorio apoyado', [RES.x, RES_Y + RH + 7, RES.z]);
const tagCaseta = label('Caseta de válvulas', [CASETA.x + 6, resBase + 7.5, CASETA.z - 2], 'tag--step tag--secondary', { near: 120 });
const tagOut = label('Línea de aducción', outlet.curve.getPointAt(0.6).add(new THREE.Vector3(0, 6, 0)));
const tagVillage = label('Pueblo<small>red de distribución y piletas</small>', [VIL.x + 26, VIL_Y + 14, 104]);
label('Quebrada', stream.curve.getPointAt(0.55).add(new THREE.Vector3(0, 3, 0)), 'tag--water tag--secondary');
const tagOver = label('Rebose', overflow.curve.getPointAt(0.6).add(new THREE.Vector3(0, 3, 0)), 'tag--water tag--secondary');
label(inMeter.label, inMeter.pos, 'tag--flow tag--secondary', { near: 120 });
label(outMeter.label, outMeter.pos, 'tag--flow tag--secondary', { near: 120 });

const projected = new THREE.Vector3();
function updateLabels() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (const item of labels) {
    projected.copy(item.pos).project(camera);
    const tooFar = item.near > 0 && !item.active && camera.position.distanceTo(item.pos) > item.near;
    const visible = projected.z > -1 && projected.z < 1 && !item.off && !tooFar;
    item.el.style.opacity = visible ? '0.96' : '0';
    if (!visible) continue;
    item.el.style.transform = `translate(-50%, -50%) translate(${(projected.x * 0.5 + 0.5) * w}px, ${(-projected.y * 0.5 + 0.5) * h}px)`;
  }
}

/* -------------------------------------------------------------- vistas */

const views = {
  general: { pos: [150, 125, 215], target: [-4, 22, 20] },
  manantial: { pos: [-5, 98, -62], target: [SPRING.x, springY, SPRING.z] },
  reservorio: { pos: [32, RES_Y + 24, RES.z + 40], target: [RES.x, RES_Y + 3, RES.z] },
  pueblo: { pos: [80, 60, 190], target: [VIL.x, VIL_Y, 112] },
};
{
  const mid = inlet.curve.getPointAt(0.5);
  views.conduccion = { pos: [mid.x + 62, mid.y + 46, mid.z + 34], target: [mid.x, mid.y, mid.z] };
  views.caseta = { pos: [CASETA.x + 30, resBase + 20, CASETA.z - 24], target: [CASETA.x, resBase + 2, CASETA.z + 2] };
}
let camAnim = null;

function goToView(name, instant = false) {
  const v = views[name];
  if (!v) return;
  const k = Math.max(1, 0.8 / camera.aspect);
  const target = new THREE.Vector3(...v.target);
  const pos = new THREE.Vector3(...v.pos).sub(target).multiplyScalar(k).add(target);
  if (instant) {
    camera.position.copy(pos);
    controls.target.copy(target);
    return;
  }
  camAnim = { t: 0, fromPos: camera.position.clone(), toPos: pos, fromTarget: controls.target.clone(), toTarget: target };
}

document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => goToView(b.dataset.view)));
controls.addEventListener('start', () => (camAnim = null));
canvas.addEventListener('dblclick', () => goToView('general'));

/* ---------------------------------------------------------------- datos */

const $ = (id) => document.getElementById(id);
const ui = {
  badge: $('mode-badge'),
  simNote: $('sim-note'),
  simClock: $('sim-clock'),
  pct: $('k-pct'),
  m3: $('k-m3'),
  inLpm: $('k-in'),
  outLpm: $('k-out'),
  net: $('k-net'),
  state: $('state'),
  bar: $('bar'),
  loading: $('loading'),
  stepNum: $('paso-num'),
  stepTitle: $('paso-titulo'),
  stepText: $('paso-texto'),
  stepData: $('paso-dato'),
  prev: $('prev'),
  next: $('next'),
  dots: $('dots'),
};
const fmt = (v, d) => (typeof v === 'number' && Number.isFinite(v)
  ? v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d })
  : '--');

function levelState(cm, full) {
  if (cm >= OVERFLOW_CM) return ['¡REBALSANDO!', 'is-over'];
  if (cm >= full) return ['TANQUE LLENO', 'is-full'];
  if (cm >= full - 5) return ['CASI LLENO', 'is-high'];
  if (cm <= 2) return ['TANQUE VACÍO', 'is-low'];
  if (cm <= 5) return ['NIVEL BAJO', 'is-low'];
  return ['NIVEL NORMAL', ''];
}

const simulator = createSimulator();
const live = { data: null, levelCm: 15, targetLevelCm: 15, clarity: 100, started: false, kind: null };
const now = { lpmIn: 0, lpmOut: 0, pct: null, m3: null };

/* --------------------------------------------------------- recorrido guiado */

const STEPS = [
  {
    view: 'general',
    title: 'Un sistema de agua por gravedad',
    text: 'El agua baja sola desde un manantial en el cerro hasta un reservorio, y del reservorio al pueblo. No necesita bombas: todo funciona por la pendiente del terreno.',
    tag: null,
    data: () => (now.pct === null ? '' : `Ahora el reservorio está al ${now.pct.toFixed(0)} %.`),
  },
  {
    view: 'manantial',
    title: 'Manantial y captación',
    text: 'El agua brota entre las rocas del cerro. Una caja de concreto (la cámara de captación) la recoge y la protege para que no se contamine. Lo que no se capta sigue por la quebrada.',
    tag: tagSpring,
  },
  {
    view: 'conduccion',
    title: 'Línea de conducción',
    text: 'Una tubería enterrada baja el agua por gravedad hasta el reservorio. Al llegar, un medidor de caudal cuenta cuánta agua entra.',
    tag: tagIn,
    data: () => `Ahora llegan ${fmt(now.lpmIn, 1)} litros por minuto.`,
  },
  {
    view: 'reservorio',
    title: 'Reservorio apoyado',
    text: 'Guarda el agua para las horas en que el pueblo usa más, y ahí se clora. Está en una loma más alta que el pueblo para que el agua llegue sola a las casas.',
    tag: tagRes,
    data: () => (now.pct === null ? '' : `Ahora está al ${now.pct.toFixed(0)} %: unos ${fmt(now.m3, 1)} m³ de 10 m³.`),
  },
  {
    view: 'caseta',
    title: 'Caseta de válvulas',
    text: 'Controla la entrada, la salida, el by-pass, la limpia y el rebose: las mismas tuberías de la maqueta. Otro medidor de caudal mide el agua que sale hacia el pueblo.',
    tag: tagCaseta,
    data: () => `Ahora salen ${fmt(now.lpmOut, 1)} litros por minuto.`,
  },
  {
    view: 'pueblo',
    title: 'El pueblo',
    text: 'La línea de aducción lleva el agua a la red de distribución y a las piletas de cada casa. Un reservorio de unos 10 m³ alcanza para 300 a 400 personas.',
    tag: tagVillage,
    data: () => {
      const net = now.lpmIn - now.lpmOut;
      if (net > 0.05) return 'Ahora entra más agua de la que se usa: el reservorio se llena.';
      if (net < -0.05) return 'Ahora el pueblo usa más agua de la que llega: el reservorio baja.';
      return 'Ahora entra y sale casi la misma cantidad de agua.';
    },
  },
];

let step = 0;

STEPS.forEach((_, i) => {
  const dot = document.createElement('button');
  dot.type = 'button';
  dot.setAttribute('role', 'tab');
  dot.setAttribute('aria-label', `Paso ${i + 1}: ${STEPS[i].title}`);
  dot.addEventListener('click', () => setStep(i));
  ui.dots.appendChild(dot);
});

function updateStepData() {
  const text = STEPS[step].data?.() ?? '';
  ui.stepData.hidden = !text;
  if (ui.stepData.textContent !== text) ui.stepData.textContent = text;
}

function setStep(i, { fly = true } = {}) {
  step = Math.max(0, Math.min(STEPS.length - 1, i));
  const st = STEPS[step];
  ui.stepNum.textContent = `Paso ${step + 1} de ${STEPS.length}`;
  ui.stepTitle.textContent = st.title;
  ui.stepText.textContent = st.text;
  updateStepData();
  ui.prev.disabled = step === 0;
  ui.next.textContent = step === STEPS.length - 1 ? 'Volver al inicio ›' : 'Siguiente ›';
  [...ui.dots.children].forEach((dot, k) => {
    dot.classList.toggle('is-active', k === step);
    dot.setAttribute('aria-selected', String(k === step));
  });
  // Resalta la etiqueta de la parte que se explica.
  for (const item of labels) {
    item.active = item === st.tag;
    item.el.classList.toggle('is-active', item.active);
  }
  goToView(st.view, !fly);
}

ui.prev.addEventListener('click', () => setStep(step - 1));
ui.next.addEventListener('click', () => setStep(step === STEPS.length - 1 ? 0 : step + 1));
window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight') setStep(Math.min(STEPS.length - 1, step + 1));
  if (event.key === 'ArrowLeft') setStep(step - 1);
});

/* -------------------------------------------------------------------- datos */

function render(t) {
  live.data = t;
  const sim = !!t.simulated;
  if (live.kind !== (sim ? 'sim' : 'real')) {
    live.kind = sim ? 'sim' : 'real';
    live.started = false;
  }
  ui.simNote.hidden = !sim;
  if (sim) ui.simClock.textContent = t.sim?.clock ?? '--';
  ui.badge.className = `chip ${sim ? 'is-demo' : 'is-esp32'}`;
  ui.badge.textContent = sim ? `Simulación · ${t.sim?.clock ?? ''}` : 'En vivo';

  const lv = t.level ?? {};
  const full = typeof lv.maxLevelCm === 'number' ? lv.maxLevelCm : 29;
  if (lv.ok && typeof lv.levelCm === 'number') {
    live.targetLevelCm = lv.levelCm;
    if (!live.started) live.levelCm = lv.levelCm;
  }
  const pct = Math.max(0, Math.min(100, (live.targetLevelCm / full) * 100));
  now.pct = lv.ok ? pct : null;
  now.m3 = lv.ok ? (pct / 100) * REAL_M3 : null;
  ui.pct.textContent = lv.ok ? pct.toFixed(0) : '--';
  ui.m3.textContent = lv.ok ? fmt(now.m3, 1) : '--';
  ui.bar.style.width = `${lv.ok ? pct : 0}%`;
  const [text, cls] = lv.ok ? levelState(live.targetLevelCm, full) : ['Sin lectura de nivel', ''];
  ui.state.textContent = text;
  ui.state.className = `state ${cls}`.trim();

  now.lpmIn = t.flowIn?.ok ? t.flowIn.lpm : 0;
  now.lpmOut = t.flowOut?.ok ? t.flowOut.lpm : 0;
  const net = now.lpmIn - now.lpmOut;
  ui.inLpm.textContent = fmt(now.lpmIn, 1);
  ui.outLpm.textContent = fmt(now.lpmOut, 1);
  ui.net.textContent = net > 0.05
    ? `+${fmt(net, 1)} L/min · el reservorio se llena`
    : net < -0.05 ? `${fmt(net, 1)} L/min · el reservorio baja` : 'Estable: entra lo mismo que sale';
  ui.net.className = net > 0.05 ? 'is-up' : net < -0.05 ? 'is-down' : '';
  const tb = t.turbidity ?? {};
  if (tb.ok) live.clarity = tb.clarity;

  tagIn.el.innerHTML = `Línea de conducción<small>llega ${fmt(now.lpmIn, 1)} L/min</small>`;
  tagOut.el.innerHTML = `Línea de aducción<small>sale ${fmt(now.lpmOut, 1)} L/min al pueblo</small>`;
  tagRes.el.innerHTML = `Reservorio apoyado<small>${lv.ok ? `${pct.toFixed(0)} % · ≈ ${fmt(now.m3, 1)} m³` : 'sin lectura'}</small>`;
  updateStepData();
  live.started = true;
}

async function poll() {
  let data;
  try {
    data = await getTelemetry();
  } catch {
    data = simulator.telemetry();
  }
  render(data);
}
setInterval(poll, pollMs(1000));

/* ---------------------------------------------------------- hora del día */

const tmp = new THREE.Color();
function applyDaylight(hour) {
  const elev = Math.sin(((hour - 6) / 12) * Math.PI);          // >0 de día
  const day = THREE.MathUtils.clamp(elev * 1.6 + 0.15, 0.42, 1);  // de noche no queda a oscuras
  scene.background.copy(NIGHT_SKY).lerp(DAY_SKY, day);
  scene.fog.color.copy(scene.background);
  sun.intensity = 0.15 + 2.3 * day;
  hemi.intensity = 0.35 + 0.85 * day;
  const az = ((hour - 6) / 12) * Math.PI;                       // sale por el este
  sun.position.set(Math.cos(az) * 260, 40 + Math.max(0, elev) * 220, 120);
  sun.color.copy(tmp.setHex(0xffb37a)).lerp(new THREE.Color(0xfff1d6), Math.min(1, Math.max(0, elev) * 2));
  windowMat.emissiveIntensity = (1 - day) * 1.8;
}

/* ------------------------------------------------------------------ bucle */

const WATER_CLEAR = new THREE.Color(0x0e7fa0);
const WATER_TURBID = new THREE.Color(0x6b5332);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
{
  // escenario#manantial, #reservorio, #pueblo… abre en ese paso del recorrido.
  const fromHash = STEPS.findIndex((st) => st.view === location.hash.slice(1));
  setStep(fromHash >= 0 ? fromHash : 0, { fly: false });
}

let first = true;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.06);
  const t = live.data;

  if (t) {
    live.levelCm += (live.targetLevelCm - live.levelCm) * Math.min(1, dt * 3);
    const lpmIn = t.flowIn?.ok ? t.flowIn.lpm : 0;
    const lpmOut = t.flowOut?.ok ? t.flowOut.lpm : 0;
    stepFlow(inlet, lpmIn, dt);
    stepFlow(outlet, lpmOut, dt);
    network.forEach((f) => stepFlow(f, lpmOut, dt, { max: 0.4 }));
    stepFlow(overflow, live.levelCm >= OVERFLOW_CM ? 4 : 0, dt);
    tagOver.off = live.levelCm < OVERFLOW_CM;
    applyDaylight(t.simulated ? t.sim.hour : new Date().getHours() + new Date().getMinutes() / 60);
    snapFlows = false;
  }
  stream.tex.offset.x -= (5 / FLOW_PERIOD) * dt;

  const frac = THREE.MathUtils.clamp(live.levelCm / INNER_CM, 0.01, 1);
  water.scale.y = Math.max(0.05, frac * innerH);
  water.position.y = resBase + 0.6 + water.scale.y / 2;
  waterMat.color.copy(WATER_CLEAR).lerp(WATER_TURBID, 1 - THREE.MathUtils.clamp(live.clarity, 0, 100) / 100);

  if (camAnim) {
    camAnim.t = Math.min(1, camAnim.t + dt * 1.2);
    const e = camAnim.t < 0.5 ? 4 * camAnim.t ** 3 : 1 - (-2 * camAnim.t + 2) ** 3 / 2;
    camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, e);
    controls.target.lerpVectors(camAnim.fromTarget, camAnim.toTarget, e);
    if (camAnim.t >= 1) camAnim = null;
  }

  controls.update();
  renderer.render(scene, camera);
  updateLabels();

  if (first) {
    first = false;
    ui.loading.classList.add('is-hidden');
    poll();
  }
}

animate();

window.reservorioEscenario = { scene, camera, controls, goToView };
