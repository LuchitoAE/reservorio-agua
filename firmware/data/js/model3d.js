/**
 * Modelo digital del reservorio — Three.js
 *
 * Medidas tomadas del plano "Reservorio + caseta de válvulas (Rev. 04)":
 *   exterior 40 × 30 × 40.6 cm · vidrio 6 mm · interior 38.8 × 28.8 × 40
 *   caseta 22 × 20 × 26 cm · rebose 31 cm · 4 válvulas PVC Ø 1/2"
 *
 * 1 unidad = 1 cm.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getTelemetry, pollMs } from './api.js';
import { createSimulator } from './simulador.js';

const D = {
  L: 40,
  A: 30,
  H: 40.6,
  e: 0.6,
  inL: 38.8,
  inA: 28.8,
  inH: 40,
  maxLevel: 30,
  caseta: { l: 22, a: 20, h: 26, z: -25 },
  pipe: 0.635,
};

const COLORS = {
  glass: 0xcdefff,
  edge: 0x8fe3ff,
  water: 0x0e9bbd,
  waterTop: 0x6fe4ff,
  pvc: 0xdde5ec,
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
let soloCaseta = false;

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
keyLight.shadow.bias = -0.0004;
keyLight.shadow.normalBias = 0.4;
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
  roughness: 0.34,
  metalness: 0.04,
});

const pvcDarkMat = new THREE.MeshStandardMaterial({
  color: COLORS.pvcDark,
  roughness: 0.5,
  metalness: 0.1,
});

// Cuerpo de las llaves de paso: PVC blanco algo más brillante que el tubo.
const valveBodyMat = new THREE.MeshStandardMaterial({
  color: 0xf2f5f8,
  roughness: 0.26,
  metalness: 0.04,
});

// Palanca roja de las llaves de paso.
const valveMat = new THREE.MeshStandardMaterial({
  color: COLORS.valve,
  roughness: 0.42,
  metalness: 0.08,
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

// level = altura del agua en cm sobre el fondo interior (lo que mide el ESP32).
function applyLevel(level) {
  const h = Math.max(0.35, Math.min(level, D.inH));
  waterVolume.scale.y = h;
  waterVolume.position.y = wall + h / 2;
  waterSurface.position.y = wall + h + 0.03;
  waterLine.position.y = wall + h + 0.04;
  waterGroup.visible = !soloCaseta && level > 0.1;
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
const PR = D.pipe;              // radio del tubo (PVC 1/2")
const FIT_R = PR * 1.26;        // radio de campanas y cuerpos
const SOCKET_L = 1.15;

const gasketMat = new THREE.MeshStandardMaterial({
  color: 0x2a3946,
  roughness: 0.95,
  metalness: 0.05,
});
const nutMat = new THREE.MeshStandardMaterial({
  color: 0xcfd8e0,
  roughness: 0.55,
  metalness: 0.08,
});

const V = (a) => new THREE.Vector3(...a);
const AXIS = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

function fit(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  pipes.add(mesh);
  return mesh;
}

function orient(mesh, dir) {
  mesh.quaternion.setFromUnitVectors(up, dir.clone().normalize());
  return mesh;
}

function tube(a, b, { r = PR, mat = pvcMat } = {}) {
  const p1 = V(a);
  const p2 = V(b);
  const d = new THREE.Vector3().subVectors(p2, p1);
  const len = d.length();
  if (len < 0.01) return null;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 20), mat);
  mesh.position.copy(p1).add(p2).multiplyScalar(0.5);
  orient(mesh, d);
  return fit(mesh);
}

// Campana (boca del accesorio) donde entra el tubo.
function socket(a, dir, { len = SOCKET_L, r = FIT_R, mat = pvcMat } = {}) {
  if (len < 0.1) return;
  const d = dir.clone().normalize();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 20, 1, true), mat);
  mesh.position.copy(V(a)).addScaledVector(d, len / 2);
  orient(mesh, d);
  fit(mesh);

  const mouth = new THREE.Mesh(new THREE.RingGeometry(r * 0.79, r, 24), mat);
  mouth.position.copy(V(a));
  mouth.quaternion.setFromUnitVectors(AXIS.z, d.clone().negate());
  fit(mouth);

}

// Tramo recto entre dos accesorios.
function leg(a, b, { r = PR, s0 = true, s1 = true } = {}) {
  const p1 = V(a);
  const p2 = V(b);
  const d = new THREE.Vector3().subVectors(p2, p1);
  const len = d.length();
  if (len < 0.01) return;
  const dir = d.clone().normalize();
  tube(p1, p2, { r });
  const sl = Math.min(SOCKET_L, len * 0.45);
  if (s0) socket(p1, dir, { len: sl });
  if (s1) socket(p2, dir.clone().negate(), { len: sl });
}

// Codo 90° con curva real y campanas en las dos puntas.
function elbow(P, din, dout, bend = 1.8, { s0 = SOCKET_L, s1 = SOCKET_L, r = PR } = {}) {
  const p = V(P);
  const a = p.clone().addScaledVector(din, -bend);
  const b = p.clone().addScaledVector(dout, bend);
  const curva = new THREE.QuadraticBezierCurve3(a, p.clone(), b);
  fit(new THREE.Mesh(new THREE.TubeGeometry(curva, 14, r, 18, false), pvcMat));
  socket(a, din.clone().negate(), { len: s0 });
  socket(b, dout, { len: s1 });
}

// Tee: cuerpo del tramo, ramal y refuerzo central.
function tee(P, runDir, branchDir) {
  const p = V(P);
  const run = runDir.clone().normalize();
  const br = branchDir.clone().normalize();
  const bodyLen = 3.0;
  const bodyR = PR * 1.22;
  const branchLen = 1.5;

  const body = new THREE.Mesh(new THREE.CylinderGeometry(bodyR, bodyR, bodyLen, 22, 1, true), pvcMat);
  body.position.copy(p);
  orient(body, run);
  fit(body);

  const branch = new THREE.Mesh(
    new THREE.CylinderGeometry(bodyR * 0.98, bodyR * 0.98, branchLen, 22, 1, true),
    pvcMat,
  );
  branch.position.copy(p).addScaledVector(br, branchLen / 2);
  orient(branch, br);
  fit(branch);

  socket(p.clone().addScaledVector(run, bodyLen / 2), run.clone().negate(), { len: 0.55 });
  socket(p.clone().addScaledVector(run, -bodyLen / 2), run, { len: 0.55 });
  socket(p.clone().addScaledVector(br, branchLen), br.clone().negate(), { len: 0.55 });
}

// Pasamuros: cuerpo, bridas, empaques de goma y tuerca exterior.
function bulkhead(x, y) {
  const z = -D.A / 2;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 1.95, 20, 1, true), pvcMat);
  body.position.set(x, y, z - 0.225);
  body.rotation.x = Math.PI / 2;
  fit(body);

  for (const s of [-1, 1]) {
    const gasket = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.08, 24), gasketMat);
    gasket.position.set(x, y, z + s * 0.34);
    gasket.rotation.x = Math.PI / 2;
    fit(gasket);

    const flange = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.3, 24), pvcMat);
    flange.position.set(x, y, z + s * 0.56);
    flange.rotation.x = Math.PI / 2;
    fit(flange);
  }

  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.5, 6), nutMat);
  nut.position.set(x, y, z - 0.96);
  nut.rotation.x = Math.PI / 2;
  fit(nut);
}

// Boca del tubo: interior oscuro para que el extremo no parezca un tapón.
const boreMat = new THREE.MeshStandardMaterial({
  color: 0x0a1119,
  roughness: 1,
  side: THREE.DoubleSide,
});

function bore(endPos, outward) {
  const d = outward.clone().normalize();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(PR * 0.82, 22), boreMat);
  disc.position.copy(V(endPos)).addScaledVector(d, 0.015);
  disc.quaternion.setFromUnitVectors(AXIS.z, d);
  fit(disc);
}

// Campana abierta del rebose.
function bellMouth(pos) {
  const p = V(pos);
  const h = 1.3;
  const coneMat = new THREE.MeshStandardMaterial({
    color: COLORS.pvc,
    roughness: 0.42,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(1.55, PR, h, 26, 1, true), coneMat);
  cone.position.copy(p).add(new THREE.Vector3(0, -h / 2, 0));
  fit(cone);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.1, 10, 28), pvcDarkMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.copy(p);
  fit(rim);
}

// Llave de paso de PVC (válvula de bola): manguitos, tuercas de unión, cuerpo blanco,
// bonete, vástago y palanca roja.
function addValve(pos, axis, { len = 5.0, handleRotY = 0 } = {}) {
  const half = len / 2;
  const compact = len < 4.5;
  const bodyR = compact ? 0.8 : 1.02;
  const nutR = bodyR * (compact ? 1.24 : 1.2);
  const nutLen = compact ? 0.42 : 0.75;
  const socketLen = compact ? 0.42 : 0.9;

  const group = new THREE.Group();
  group.position.copy(V(pos));
  group.quaternion.setFromUnitVectors(AXIS.z, axis.clone().normalize());

  for (const s of [-1, 1]) {
    const socketMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, socketLen, 22, 1, true),
      pvcMat,
    );
    socketMesh.position.z = s * (half - socketLen / 2);
    socketMesh.rotation.x = Math.PI / 2;
    group.add(socketMesh);

    const mouth = new THREE.Mesh(new THREE.RingGeometry(0.63, 0.8, 26), pvcMat);
    mouth.position.z = s * half;
    mouth.rotation.y = s > 0 ? 0 : Math.PI;
    group.add(mouth);


    const nutZ = s * (half - socketLen - nutLen / 2);
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(nutR, nutR, nutLen, 28), pvcMat);
    nut.position.z = nutZ;
    nut.rotation.x = Math.PI / 2;
    group.add(nut);

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.14, nutLen * 0.82),
        pvcMat,
      );
      rib.position.set(Math.cos(a) * nutR * 0.995, Math.sin(a) * nutR * 0.995, nutZ);
      rib.rotation.z = a;
      group.add(rib);
    }
  }

  // Llave de paso clásica de PVC: cuerpo blanco (tambor + abombado) y palanca roja.
  const body = new THREE.Mesh(new THREE.SphereGeometry(bodyR, 28, 20), valveBodyMat);
  body.scale.set(1, 1, 0.95);
  group.add(body);

  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(bodyR * 0.86, bodyR * 0.86, bodyR * 1.9, 28),
    valveBodyMat,
  );
  drum.rotation.x = Math.PI / 2;
  group.add(drum);

  const bonnet = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.52, 0.34, 6), valveBodyMat);
  bonnet.position.y = bodyR * 0.94;
  group.add(bonnet);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.3, 16), valveBodyMat);
  stem.position.y = bodyR * 0.94 + 0.76;
  group.add(stem);

  const oring = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.05, 8, 20), gasketMat);
  oring.rotation.x = Math.PI / 2;
  oring.position.y = bodyR * 0.94 + 0.42;
  group.add(oring);

  const thread = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.035, 8, 20), nutMat);
  thread.rotation.x = Math.PI / 2;
  thread.position.y = bodyR * 0.94 + 1.16;
  group.add(thread);

  const lever = new THREE.Group();
  lever.rotation.y = handleRotY;
  lever.position.y = bodyR * 0.94 + 1.5;

  const bar = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.24, 0.82), valveMat);
  bar.position.x = 1.15;
  lever.add(bar);

  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.82, 20), valveMat);
  tip.rotation.x = Math.PI / 2;
  tip.position.x = 3.3;
  lever.add(tip);

  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.36, 6), valveMat);
  boss.position.y = 0.04;
  lever.add(boss);

  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 12), gasketMat);
  hole.position.x = 2.85;
  lever.add(hole);

  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.28, 10), nutMat);
  screw.position.y = 0.22;
  lever.add(screw);

  group.add(lever);

  group.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  pipes.add(group);
  return group;
}

/* --- Entrada: acometida, paso directo, válvula, subida y codo al tanque --- */

leg([3, 5.5, -35], [3, 5.5, -33.5], { s0: false, s1: false });
tee([3, 5.5, -32], AXIS.z, AXIS.x.clone().negate());
leg([3, 5.5, -30.5], [3, 5.5, -28.5], { s0: false, s1: false });
addValve([3, 5.5, -26], AXIS.z);
leg([3, 5.5, -23.5], [3, 5.5, -20.8], { s0: false, s1: false });
elbow([3, 5.5, -19], AXIS.z, AXIS.y);
leg([3, 7.3, -19], [3, 34.2, -19], { s0: false, s1: false });
elbow([3, 36, -19], AXIS.y, AXIS.z, 1.8, { s1: 0.6 });
leg([3, 36, -17.2], [3, 36, -16.2], { s0: false, s1: false });
bulkhead(3, 36);
leg([3, 36, -14.25], [3, 36, -12.45], { s0: false, s1: false });
elbow([3, 36, -12], AXIS.z, AXIS.y.clone().negate(), 0.45, { s0: 0.6, s1: 0.4 });
tube([3, 35.55, -12], [3, 35, -12]);
bore([3, 35, -12], AXIS.y.clone().negate());

/* --- Paso directo: tee de entrada -> válvula -> tee de salida --- */

leg([1.5, 5.5, -32], [-5.5, 5.5, -32], { s0: false, s1: false });
addValve([-2, 5.5, -32], AXIS.x, { handleRotY: Math.PI / 2 });
tee([-7, 5.5, -32], AXIS.z, AXIS.x);

/* --- Salida del tanque: canastilla, pasamuros, válvula y tee --- */

leg([-7, 5.5, -10], [-7, 5.5, -14.25], { s0: false, s1: false });

// Canastilla de succión: filtro de PVC ranurado en la boca de salida.
const strainerLen = 4.2;
const strainerR = 1.15;
const strainerZ = -11.9;

const strainerBody = new THREE.Mesh(
  new THREE.CylinderGeometry(strainerR, strainerR, strainerLen, 26, 1, true),
  pvcMat,
);
strainerBody.rotation.x = Math.PI / 2;
strainerBody.position.set(-7, 5.5, strainerZ);
fit(strainerBody);

const strainerCap = new THREE.Mesh(
  new THREE.SphereGeometry(strainerR, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2),
  pvcMat,
);
strainerCap.rotation.x = Math.PI / 2;
strainerCap.position.set(-7, 5.5, strainerZ + strainerLen / 2);
fit(strainerCap);

for (let i = 0; i < 10; i++) {
  const a = (i / 10) * Math.PI * 2;
  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.17, strainerLen * 0.7),
    gasketMat,
  );
  slot.position.set(
    -7 + Math.cos(a) * (strainerR + 0.01),
    5.5 + Math.sin(a) * (strainerR + 0.01),
    strainerZ,
  );
  slot.rotation.z = a;
  fit(slot);
}

bulkhead(-7, 5.5);
leg([-7, 5.5, -16.2], [-7, 5.5, -23.5], { s0: false, s1: false });
addValve([-7, 5.5, -26], AXIS.z);
leg([-7, 5.5, -28.5], [-7, 5.5, -30.5], { s0: false, s1: false });
leg([-7, 5.5, -33.5], [-7, 5.5, -35], { s0: false, s1: false });

/* --- Limpia: fondo, pasamuros, válvula cerca del tanque y tee --- */

leg([8, 1.5, -12], [8, 1.5, -14.25], { s0: true, s1: false });
bulkhead(8, 1.5);
addValve([8, 1.5, -18.2], AXIS.z, { len: 3.6 });
leg([8, 1.5, -20.0], [8, 1.5, -22.0], { s0: false, s1: false });
tee([8, 1.5, -23.5], AXIS.z, AXIS.y);
leg([8, 1.5, -25.0], [8, 1.5, -35], { s0: false, s1: false });
bore([8, 1.5, -35], AXIS.z.clone().negate());

/* --- Rebose: campana a 31, sin válvula, baja por la línea de limpia --- */

bellMouth([8, 31, -7]);
leg([8, 29.7, -7], [8, 21.8, -7], { s0: false, s1: false });
elbow([8, 20, -7], AXIS.y.clone().negate(), AXIS.z.clone().negate());
leg([8, 20, -8.8], [8, 20, -14.25], { s0: false, s1: false });
bulkhead(8, 20);
leg([8, 20, -16.2], [8, 20, -21.7], { s0: false, s1: false });
elbow([8, 20, -23.5], AXIS.z.clone().negate(), AXIS.y.clone().negate());
leg([8, 18.2, -23.5], [8, 3.0, -23.5], { s0: false, s1: false });

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

function addLabel(text, position, cls = '', flags = {}) {
  const el = document.createElement('div');
  el.className = `tag ${cls}`.trim();
  el.textContent = text;
  labelLayer.appendChild(el);
  labels.push({
    el,
    pos: new THREE.Vector3(...position),
    dim: cls.includes('tag--dim'),
    ...flags,
  });
}

addLabel('Entrada al tanque · 36 cm', [4.4, 38.2, -11], 'tag--valve', { tankOnly: true });
addLabel('Rebose · 31 cm', [9.5, 32.7, -7], 'tag--water', { tankOnly: true });
addLabel('Salida del tanque · 5.5 cm', [-7, 8, -12.6], 'tag--water tag--secondary', { tankOnly: true });
addLabel('Limpia · 1.5 cm', [8, 3.8, -12], 'tag--water tag--secondary', { tankOnly: true });
addLabel('Paso directo', [-2, 9.5, -32], 'tag--valve', { casetaOnly: true });
addLabel('Entrada de agua (del manantial)', [4.5, 2.2, -45], 'tag--secondary', { casetaOnly: true });
addLabel('Salida a la población', [-8.5, 2.2, -45], 'tag--secondary', { casetaOnly: true });
addLabel('Limpia', [9.2, 3.2, -18], 'tag--secondary', { casetaOnly: true });
addLabel('Desfogue automático (sin válvula)', [9, 15, -23.5], 'tag--water tag--secondary', { casetaOnly: true });
addLabel('40.0 cm', [0, -0.6, 20.4], 'tag--dim');
addLabel('30.0 cm', [25.6, -0.6, 0], 'tag--dim');

/* ----------------------------------------------------------- gemelo digital */
// Los 6 sensores dibujados en su lugar y animados con los datos reales del ESP32:
// haz del ultrasónico hasta el agua, flujo en las tuberías de entrada/salida (y el
// rebose si el tanque rebalsa), chorro de entrada, color del agua según la turbidez
// y etiquetas con los valores en vivo. No mueve ninguna pieza del modelo aprobado.

const SENSOR_FACE_Y = wall + 36;     // cara del HC-SR04: 36 cm sobre el fondo interior (ocupa 36–38 cm)
const PROBE_Z = 6;                   // fila de sondas, lejos de tuberías y rebose
const BAR_Y = D.H + 0.55;            // regleta de aluminio apoyada sobre el marco
const BAR_BOTTOM = BAR_Y - 0.25;
const OVERFLOW_CM = 31;              // rebose físico

const tankSensors = new THREE.Group();
world.add(tankSensors);

const darkPlasticMat = new THREE.MeshStandardMaterial({ color: 0x1a2129, roughness: 0.55, metalness: 0.05 });
const pcbMat = new THREE.MeshStandardMaterial({ color: 0x1f5fbf, roughness: 0.6, metalness: 0.1 });
const meshMat = new THREE.MeshStandardMaterial({ color: 0xc3ccd6, roughness: 0.38, metalness: 0.75 });
const cableMat = new THREE.MeshStandardMaterial({ color: 0x0e141a, roughness: 0.85 });
const clearPlasticMat = new THREE.MeshPhysicalMaterial({
  color: 0xe6f8ff,
  roughness: 0.05,
  transparent: true,
  opacity: 0.42,
  depthWrite: false,
});

function part(geometry, material, x, y, z, parent = tankSensors) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function cable(x, fromY) {
  const len = BAR_BOTTOM - fromY;
  part(new THREE.CylinderGeometry(0.17, 0.17, len, 10), cableMat, x, fromY + len / 2, PROBE_Z);
}

// Regleta de soporte de los sensores, apoyada sobre el marco del tanque.
part(new THREE.BoxGeometry(D.L + 1.2, 0.5, 2.4), rimMat, 0, BAR_Y, PROBE_Z);

// HC-SR04 mirando hacia abajo: placa, dos transductores con malla y soporte.
{
  const pcbY = SENSOR_FACE_Y + 1.28;
  part(new THREE.BoxGeometry(4.5, 0.16, 2.0), pcbMat, 0, pcbY, PROBE_Z);
  part(new THREE.BoxGeometry(1.0, 0.3, 0.45), meshMat, 0, pcbY + 0.22, PROBE_Z);    // cristal
  part(new THREE.BoxGeometry(1.4, BAR_BOTTOM - pcbY, 0.3), rimMat, 0, (BAR_BOTTOM + pcbY) / 2, PROBE_Z - 0.6);
  for (const x of [-1.3, 1.3]) {
    part(new THREE.CylinderGeometry(0.8, 0.8, 1.2, 26), meshMat, x, SENSOR_FACE_Y + 0.6, PROBE_Z);
    const face = part(new THREE.CircleGeometry(0.68, 26), darkPlasticMat, x, SENSOR_FACE_Y - 0.01, PROBE_Z);
    face.rotation.x = Math.PI / 2;
  }
}

// Sonda de pH (PH-7BNC): cuerpo, protector abierto y bulbo de vidrio.
const PH_X = -13;
part(new THREE.CylinderGeometry(0.6, 0.6, 11, 22), darkPlasticMat, PH_X, 11.8, PROBE_Z);
part(new THREE.CylinderGeometry(0.64, 0.64, 1.3, 22, 1, true), darkPlasticMat, PH_X, 5.7, PROBE_Z);
part(new THREE.SphereGeometry(0.42, 20, 14), clearPlasticMat, PH_X, 5.45, PROBE_Z);
part(new THREE.CylinderGeometry(0.42, 0.6, 1.0, 20), darkPlasticMat, PH_X, 17.8, PROBE_Z);
cable(PH_X, 18.3);

// Turbidez (TS-300B): cuerpo y las dos patas transparentes del camino óptico.
const TURB_X = -6.5;
part(new THREE.CylinderGeometry(1.3, 1.3, 3.2, 28), darkPlasticMat, TURB_X, 7.6, PROBE_Z);
for (const dx of [-0.75, 0.75]) {
  part(new THREE.BoxGeometry(0.8, 1.7, 2.0), clearPlasticMat, TURB_X + dx, 5.15, PROBE_Z);
}
part(new THREE.CylinderGeometry(0.5, 0.5, 0.8, 16), darkPlasticMat, TURB_X, 9.6, PROBE_Z);
cable(TURB_X, 10);

// Temperatura (DS18B20 sumergible): vaina de acero y termocontraíble.
const TEMP_X = 13;
part(new THREE.CylinderGeometry(0.3, 0.3, 5, 16), meshMat, TEMP_X, 7, PROBE_Z);
part(new THREE.SphereGeometry(0.3, 14, 10), meshMat, TEMP_X, 4.5, PROBE_Z);
part(new THREE.CylinderGeometry(0.34, 0.34, 1.3, 16), cableMat, TEMP_X, 10.1, PROBE_Z);
cable(TEMP_X, 10.7);

// Caudalímetros ZJ-S201 sobre las tuberías existentes (no se mueve ningún tubo).
function addFlowMeter(pos, axis, housingDir) {
  const g = new THREE.Group();
  g.position.copy(V(pos));
  g.quaternion.setFromUnitVectors(AXIS.y, axis.clone().normalize());

  part(new THREE.CylinderGeometry(1.25, 1.25, 4.0, 30), darkPlasticMat, 0, 0, 0, g);
  for (const s of [-1, 1]) {
    part(new THREE.CylinderGeometry(0.95, 0.95, 1.1, 24), darkPlasticMat, 0, s * 2.55, 0, g);
    for (let i = 0; i < 3; i++) {
      const ring = part(new THREE.TorusGeometry(0.95, 0.05, 6, 24), darkPlasticMat, 0, s * (2.2 + i * 0.32), 0, g);
      ring.rotation.x = Math.PI / 2;
    }
  }
  // Caja del sensor Hall con sus tres cables (rojo, negro, amarillo).
  const h = housingDir.clone().normalize();
  const housing = part(new THREE.BoxGeometry(2.0, 2.0, 2.0), darkPlasticMat, 0, 0, 0, g);
  housing.position.copy(h.clone().multiplyScalar(1.6));
  housing.scale.set(Math.abs(h.x) > 0.5 ? 0.8 : 1, 1, Math.abs(h.z) > 0.5 ? 0.8 : 1);
  [0xd63b3b, 0x111111, 0xf2c230].forEach((color, i) => {
    const wire = part(
      new THREE.CylinderGeometry(0.11, 0.11, 1.4, 8),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
      0, 0, 0, g,
    );
    wire.position.copy(h.clone().multiplyScalar(3.2)).add(new THREE.Vector3(0, (i - 1) * 0.28, 0));
    wire.quaternion.setFromUnitVectors(AXIS.y, h);
  });
  // Flecha en relieve: sentido del agua.
  const side = new THREE.Vector3(1, 0, 0);
  part(new THREE.CylinderGeometry(0.09, 0.09, 1.6, 8), pvcMat, side.x * 1.27, -0.3, 0, g);
  part(new THREE.ConeGeometry(0.32, 0.7, 14), pvcMat, side.x * 1.27, 0.85, 0, g);

  pipes.add(g);
  return g;
}

// Fuera de la caseta, en los tubos que llegan desde afuera (como en la maqueta real):
// el de entrada mide lo que llega del manantial; el de salida, lo que va al pueblo.
const OUT_Z = -46;      // extremo exterior de las tuberías
const METER_Z = -40.5;  // centro de los caudalímetros
for (const x of [3, -7]) {
  leg([x, 5.5, -35], [x, 5.5, OUT_Z], { s0: false, s1: false });
  bore([x, 5.5, OUT_Z], AXIS.z.clone().negate());
  // Soporte de concreto bajo el caudalímetro.
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(2.2, 5.25, 2.2), baseMat);
  pedestal.position.set(x, 1.625, METER_Z);  // del piso (-1) hasta debajo del caudalímetro
  fit(pedestal);
}
addFlowMeter([3, 5.5, METER_Z], AXIS.z, new THREE.Vector3(0, 1, 0).applyAxisAngle(AXIS.x, -Math.PI / 2));
addFlowMeter([-7, 5.5, METER_Z], AXIS.z.clone().negate(), new THREE.Vector3(0, 0, 1));

// Flujo animado: franjas que avanzan sobre la tubería según los L/min reales.
const FLOW_PERIOD = 2.4; // cm entre franjas

function stripeTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 4;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.75, 'rgba(255,255,255,0.95)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Recorrido con las mismas curvas que los codos del modelo (bend = radio del codo).
function flowPath(points, bends = []) {
  const P = points.map(V);
  const path = new THREE.CurvePath();
  let start = P[0];
  for (let i = 1; i < P.length - 1; i++) {
    const b = bends[i - 1] ?? 1.8;
    const a = P[i].clone().addScaledVector(P[i].clone().sub(P[i - 1]).normalize(), -b);
    const c2 = P[i].clone().addScaledVector(P[i + 1].clone().sub(P[i]).normalize(), b);
    path.add(new THREE.LineCurve3(start, a));
    path.add(new THREE.QuadraticBezierCurve3(a, P[i].clone(), c2));
    start = c2;
  }
  path.add(new THREE.LineCurve3(start, P[P.length - 1]));
  return path;
}

function flowLine(path, color, radius = PR * 1.16) {
  const length = path.getLength();
  const tex = stripeTexture();
  tex.repeat.set(length / FLOW_PERIOD, 1);
  const mat = new THREE.MeshBasicMaterial({ color, map: tex, transparent: true, opacity: 0, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, Math.ceil(length * 3), radius, 12, false), mat);
  mesh.renderOrder = 4;
  mesh.visible = false;
  world.add(mesh);
  return { mesh, mat, tex, speed: 6 };
}

function stepFlow(f, lpm, dt, maxOpacity = 0.92) {
  const active = lpm > 0.02;
  f.mat.opacity += ((active ? maxOpacity : 0) - f.mat.opacity) * Math.min(1, dt * 4);
  f.mesh.visible = f.mat.opacity > 0.02;
  // 1 L/min en PVC de 1/2" son ~8 cm/s; se limita para que se vea bien.
  if (active) f.speed = THREE.MathUtils.clamp(lpm * 8.3, 4, 60);
  f.tex.offset.x -= (f.speed / FLOW_PERIOD) * dt;
}

const flowIn = flowLine(
  flowPath([[3, 5.5, OUT_Z], [3, 5.5, -19], [3, 36, -19], [3, 36, -12], [3, 35, -12]], [1.8, 1.8, 0.45]),
  0xa78bfa,
);
const flowOut = flowLine(flowPath([[-7, 5.5, -14], [-7, 5.5, OUT_Z]]), 0xf472b6);
const flowOverflow = flowLine(
  flowPath([[8, 29.7, -7], [8, 20, -7], [8, 20, -23.5], [8, 1.5, -23.5], [8, 1.5, -35]], [1.8, 1.8, 0.6]),
  0x38bdf8,
);

// Chorro de entrada: cae desde la boca (35 cm) hasta la superficie del agua.
const jetTex = stripeTexture();
const jetMat = new THREE.MeshBasicMaterial({ color: 0xbfe9ff, map: jetTex, transparent: true, opacity: 0, depthWrite: false });
const jet = new THREE.Mesh(
  new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0)), 8, 0.32, 12),
  jetMat,
);
jet.position.set(3, 35, -12);
jet.renderOrder = 4;
tankSensors.add(jet);
const jetFlow = { mesh: jet, mat: jetMat, tex: jetTex, speed: 20 };

const splashMat = new THREE.MeshBasicMaterial({ color: 0xd9f6ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
const splash = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 32), splashMat);
splash.rotation.x = -Math.PI / 2;
splash.renderOrder = 5;
tankSensors.add(splash);

// Haz del HC-SR04 (15°) y pulsos que bajan hasta el agua.
const BEAM_TAN = Math.tan(THREE.MathUtils.degToRad(7.5));
const beamMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false });
const beam = new THREE.Mesh(new THREE.BufferGeometry(), beamMat);
beam.renderOrder = 5;
tankSensors.add(beam);
let beamLen = -1;

const pulses = [0, 1, 2].map((i) => {
  const mat = new THREE.MeshBasicMaterial({ color: 0x9be7ff, transparent: true, opacity: 0, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 6, 48), mat);
  ring.rotation.x = Math.PI / 2;
  ring.renderOrder = 5;
  tankSensors.add(ring);
  return { ring, mat, phase: i / 3 };
});

function updateBeam(surfaceY, dt) {
  const len = Math.max(0.5, SENSOR_FACE_Y - surfaceY);
  if (Math.abs(len - beamLen) > 0.15) {
    beamLen = len;
    beam.geometry.dispose();
    beam.geometry = new THREE.CylinderGeometry(1.5, 1.5 + BEAM_TAN * len, len, 32, 1, true);
    beam.position.set(0, SENSOR_FACE_Y - len / 2, PROBE_Z);
  }
  for (const p of pulses) {
    p.phase = (p.phase + dt / 1.6) % 1;
    const d = p.phase * beamLen;
    const r = 1.5 + BEAM_TAN * d;
    p.ring.position.set(0, SENSOR_FACE_Y - d, PROBE_Z);
    p.ring.scale.set(r, r, 1);
    p.mat.opacity = 0.55 * (1 - p.phase);
  }
}

// Color del agua: de celeste (100 % de claridad) a marrón (0 %).
const WATER_CLEAR = { body: new THREE.Color(0x07566e), top: new THREE.Color(0x5fd8f5), glow: new THREE.Color(0x0a4b60) };
const WATER_TURBID = { body: new THREE.Color(0x5b4426), top: new THREE.Color(0xa07f52), glow: new THREE.Color(0x2a1d0c) };
let turbidMix = 0;

function updateWaterColor(dt) {
  const clarity = live.data?.turbidity?.ok ? live.data.turbidity.clarity : 100;
  const target = 1 - THREE.MathUtils.clamp(Number(clarity) || 0, 0, 100) / 100;
  turbidMix = live.snap ? target : turbidMix + (target - turbidMix) * Math.min(1, dt * 2);
  live.snap = false;
  waterMat.color.copy(WATER_CLEAR.body).lerp(WATER_TURBID.body, turbidMix);
  waterTopMat.color.copy(WATER_CLEAR.top).lerp(WATER_TURBID.top, turbidMix);
  waterTopMat.emissive.copy(WATER_CLEAR.glow).lerp(WATER_TURBID.glow, turbidMix);
  waterMat.opacity = 0.66 + 0.24 * turbidMix;
}

// Etiquetas con valores en vivo (se ocultan sin datos del ESP32).
function liveLabel(position, cls, flags = {}) {
  addLabel('', position, `tag--live ${cls}`.trim(), { ...flags, off: true });
  return labels[labels.length - 1];
}

const liveTags = {
  level: liveLabel([0, 44.2, PROBE_Z], '', { tankOnly: true }),
  ph: liveLabel([PH_X - 1, 21.5, PROBE_Z + 1], '', { tankOnly: true }),
  turbidity: liveLabel([TURB_X, 12.4, PROBE_Z + 1.5], '', { tankOnly: true }),
  temperature: liveLabel([TEMP_X + 1, 12.6, PROBE_Z + 1], '', { tankOnly: true }),
  flowIn: liveLabel([5.5, 11, METER_Z], 'tag--flow'),
  flowOut: liveLabel([-9.5, 11, METER_Z], 'tag--flow'),
};

const live = { data: null };
const fmt = (v, d) => (typeof v === 'number' && Number.isFinite(v)
  ? v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d })
  : '--');

const liveRows = Object.fromEntries(
  [...document.querySelectorAll('[data-live]')].map((li) => [li.dataset.live, li]),
);

function setRow(key, text, state) {
  const li = liveRows[key];
  if (!li) return;
  li.querySelector('b').textContent = text;
  li.className = state ? `is-${state}` : '';
}

function setTag(tag, text, ok) {
  tag.off = false;
  if (tag.el.textContent !== text) tag.el.textContent = text;
  tag.el.classList.toggle('is-bad', !ok);
}

function renderLive(t) {
  live.data = t;
  if (!t) {
    live.started = false;  // al volver los datos se vuelve a mostrar el estado real al instante
    Object.values(liveTags).forEach((tag) => (tag.off = true));
    Object.keys(liveRows).forEach((key) => setRow(key, '--', ''));
    return;
  }
  const lv = t.level ?? {};
  const tp = t.temperature ?? {};
  const ph = t.ph ?? {};
  const tb = t.turbidity ?? {};
  const fi = t.flowIn ?? {};
  const fo = t.flowOut ?? {};

  setTag(liveTags.level, lv.ok ? `Sensor de nivel · ${fmt(lv.distanceCm, 1)} cm hasta el agua` : 'Sensor de nivel · sin lectura', lv.ok);
  setTag(liveTags.ph, ph.ok ? `pH ${fmt(ph.value, 2)}` : 'pH · sin lectura', ph.ok);
  setTag(liveTags.turbidity, tb.ok ? `Claridad ${fmt(tb.clarity, 0)} %` : 'Claridad · sin lectura', tb.ok);
  setTag(liveTags.temperature, tp.ok ? `${fmt(tp.c, 1)} °C` : 'Temperatura · sin lectura', tp.ok);
  setTag(liveTags.flowIn, `Entrada ${fmt(fi.ok ? fi.lpm : 0, 1)} L/min`, true);
  setTag(liveTags.flowOut, `Salida ${fmt(fo.ok ? fo.lpm : 0, 1)} L/min`, true);

  setRow('temperature', tp.ok ? `${fmt(tp.c, 1)} °C` : 'sin señal', tp.ok ? 'ok' : 'bad');
  setRow('ph', ph.ok ? fmt(ph.value, 2) : 'sin señal', ph.ok ? 'ok' : 'bad');
  setRow('turbidity', tb.ok ? `${fmt(tb.clarity, 0)} %` : 'sin señal', tb.ok ? 'ok' : 'bad');
  const lpmIn = fi.ok ? fi.lpm : 0;
  const lpmOut = fo.ok ? fo.lpm : 0;
  setRow('flowIn', `${fmt(lpmIn, 2)} L/min`, lpmIn > 0.02 ? 'flow' : '');
  setRow('flowOut', `${fmt(lpmOut, 2)} L/min`, lpmOut > 0.02 ? 'flow' : '');
  const net = lpmIn - lpmOut;
  setRow('net', `${net > 0.005 ? '+' : ''}${fmt(net, 2)} L/min`, '');
}

function updateTwin(dt) {
  tankSensors.visible = !soloCaseta;
  const t = live.data;
  const lpmIn = t?.flowIn?.ok ? t.flowIn.lpm : 0;
  const lpmOut = t?.flowOut?.ok ? t.flowOut.lpm : 0;
  const surfaceY = wall + Math.max(0.35, currentLevel);

  stepFlow(flowIn, lpmIn, dt);
  stepFlow(flowOut, lpmOut, dt);
  stepFlow(flowOverflow, t && currentLevel >= OVERFLOW_CM ? 3 : 0, dt, 0.8);

  // Chorro: largo hasta el agua y franjas a la misma escala.
  const drop = Math.max(0.3, 35 - surfaceY);
  jet.scale.y = drop;
  jetTex.repeat.set(drop / FLOW_PERIOD, 1);
  stepFlow(jetFlow, lpmIn > 0.02 ? Math.max(lpmIn, 3) : 0, dt, 0.7);
  splash.position.set(3, surfaceY + 0.08, -12);
  const s = 1 + ((clock.elapsedTime * 1.4) % 1) * 1.8;
  splash.scale.set(s, s, 1);
  splashMat.opacity = jetMat.opacity * 0.8 * (1 - ((clock.elapsedTime * 1.4) % 1));

  updateBeam(surfaceY, dt);
  updateWaterColor(dt);
}

const projected = new THREE.Vector3();

function updateLabels() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const showDims = medidas.visible;

  for (const label of labels) {
    const hidden =
      label.off ||
      (label.dim && !showDims) ||
      (label.tankOnly && soloCaseta) ||
      (label.casetaOnly && !soloCaseta);
    if (hidden) {
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
  aislarBtn: document.getElementById('toggle-aislar'),
  loading: document.getElementById('loading'),
  state: document.getElementById('level-state'),
  simNote: document.getElementById('sim-note'),
  simClock: document.getElementById('sim-clock'),
};

let targetLevel = D.maxLevel * 0.72;
let currentLevel = targetLevel;
let sourceMode = 'auto';
let hasTelemetry = false;
let lastTelemetry = null;

function litersFor(level) {
  return (D.inL * D.inA * level) / 1000;
}

// Nivel de "lleno" que usa el ESP32 (29 cm, con margen); sin datos, el del plano.
function fullLevel() {
  const v = live.data?.level?.maxLevelCm;
  return typeof v === 'number' && v > 0 ? v : D.maxLevel;
}

function levelState(cm, full) {
  if (cm >= OVERFLOW_CM) return ['¡REBALSANDO!', 'is-over'];
  if (cm >= full) return ['TANQUE LLENO', 'is-full'];
  if (cm >= full - 5) return ['CASI LLENO', 'is-high'];
  if (cm <= 2) return ['TANQUE VACÍO', 'is-low'];
  if (cm <= 5) return ['NIVEL BAJO', 'is-low'];
  return ['NIVEL NORMAL', ''];
}

function updateReadout() {
  const full = fullLevel();
  const pct = Math.min(100, Math.max(0, (currentLevel / full) * 100));
  ui.pct.textContent = pct.toFixed(0);
  ui.cm.textContent = currentLevel.toFixed(1);
  ui.liters.textContent = litersFor(Math.min(currentLevel, D.inH)).toFixed(1);
  ui.bar.style.width = `${pct}%`;
  const [text, cls] = levelState(targetLevel, full);
  if (ui.state.textContent !== text) ui.state.textContent = text;
  ui.state.className = `state ${cls}`.trim();
}

function setBadge(kind) {
  const map = {
    esp32: ['is-esp32', 'En vivo'],
    demo: ['is-demo', 'Manual · nivel de prueba'],
    sim: ['is-demo', `Simulación · ${lastTelemetry?.sim?.clock ?? ''}`.trim()],
    offline: ['is-demo', 'Sin conexión'],
  };
  const [cls, text] = map[kind] || map.demo;
  ui.badge.className = `chip ${cls}`;
  ui.badge.textContent = text;
}

function setSource(mode) {
  sourceMode = mode;
  if (mode === 'demo') {
    renderLive(null);
    ui.simNote.hidden = true;
  }
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
  targetLevel = (pct / 100) * fullLevel();
  if (sourceMode !== 'demo') {
    sourceMode = 'demo';
    ui.source.value = 'demo';
    renderLive(null);
    ui.simNote.hidden = true;
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

ui.aislarBtn.addEventListener('click', () => {
  soloCaseta = !soloCaseta;
  reservoir.visible = !soloCaseta;
  waterGroup.visible = !soloCaseta;
  spillLine.visible = !soloCaseta;
  caseta.visible = true;
  medidas.visible = !soloCaseta;
  ui.medidasBtn.textContent = soloCaseta ? 'Mostrar medidas' : 'Ocultar medidas';
  ui.aislarBtn.textContent = soloCaseta ? 'Ver conjunto' : 'Aislar caseta';
  applyLevel(currentLevel);
  goToView(soloCaseta ? 'caseta' : 'iso');
});

const views = {
  iso: { pos: [74, 54, 94], target: [0, 19, 2] },
  front: { pos: [0, 22, 112], target: [0, 20, 2] },
  top: { pos: [0.1, 140, 2.1], target: [0, 0, 2] },
  caseta: { pos: [48, 40, -92], target: [0, 12, cZ] },
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

const simulator = createSimulator();

// Auto: datos reales del ESP32 si responde; si no, la simulación (claramente marcada).
// ESP32: solo datos reales. Manual: nivel con el deslizador.
async function pollTelemetry() {
  if (sourceMode === 'demo') return;
  let data = null;
  try {
    data = await getTelemetry();
  } catch {
    data = sourceMode === 'auto' ? simulator.telemetry() : null;
  }
  if (sourceMode === 'demo') return;  // se cambió a manual mientras llegaba la respuesta

  try {
    if (!data) throw new Error('sin ESP32');
    // Al pasar de simulación a datos reales (o al revés) se muestra el nuevo estado al instante.
    const kind = data.simulated ? 'sim' : 'real';
    if (live.kind !== kind) {
      live.kind = kind;
      live.started = false;
    }
    hasTelemetry = !data.simulated;
    lastTelemetry = data;
    ui.simNote.hidden = !data.simulated;
    if (data.simulated) ui.simClock.textContent = data.sim?.clock ?? '--';
    renderLive(data);
    // Altura real del agua (no el %, que se corta en 100 y ocultaría el rebalse).
    const cm = data?.level?.levelCm;
    if (data?.level?.ok && typeof cm === 'number' && Number.isFinite(cm)) {
      targetLevel = Math.min(D.inH, Math.max(0, cm));
      // Primer dato: se muestra el estado real al instante, sin animar desde el demo.
      if (!live.started) currentLevel = targetLevel;
    }
    if (!live.started) {
      live.started = true;
      live.snap = true;
    }
    ui.slider.disabled = true;
    setBadge(data.simulated ? 'sim' : 'esp32');
  } catch {
    hasTelemetry = false;
    ui.simNote.hidden = true;
    renderLive(null);
    if (sourceMode === 'esp32') {
      setBadge('offline');
    } else {
      setBadge('demo');
      ui.slider.disabled = false;
    }
  }
}

setInterval(pollTelemetry, pollMs(1000));

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
  // modelo.html#front, #top o #caseta abre directamente en esa vista.
  const fromHash = location.hash.slice(1);
  if (views[fromHash]) currentView = fromHash;
  const view = views[currentView];
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
  updateTwin(dt);

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

  const sliderPct = String(Math.round(Math.min(100, (targetLevel / fullLevel()) * 100)));
  if (ui.slider.value !== sliderPct) ui.slider.value = sliderPct;

  if (firstFrame) {
    firstFrame = false;
    ui.loading.classList.add('is-hidden');
    pollTelemetry();
  }
}

applyLevel(currentLevel);
animate();

window.reservorioModelo = { scene, camera, controls, D, goToView };
