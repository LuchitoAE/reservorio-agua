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

function applyLevel(level) {
  const h = Math.max(0.35, level - wall);
  waterVolume.scale.y = h;
  waterVolume.position.y = wall + h / 2;
  waterSurface.position.y = level + 0.03;
  waterLine.position.y = level + 0.04;
  waterGroup.visible = !soloCaseta && level > 0.7;
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

// Válvula de bola de PVC: manguitos, tuercas de unión, cuerpo esférico,
// bonete, vástago y palanca azul.
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

  const body = new THREE.Mesh(new THREE.SphereGeometry(bodyR, 28, 20), valveMat);
  body.scale.set(1, 1, 0.95);
  group.add(body);

  const bonnet = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.52, 0.34, 6), valveMat);
  bonnet.position.y = bodyR * 0.94;
  group.add(bonnet);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.3, 16), valveMat);
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
bore([3, 5.5, -35], AXIS.z.clone().negate());
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
bore([-7, 5.5, -35], AXIS.z.clone().negate());

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
addLabel('Entrada de agua', [4.5, 2.2, -34], 'tag--secondary', { casetaOnly: true });
addLabel('Salida a la población', [-8.5, 2.2, -34], 'tag--secondary', { casetaOnly: true });
addLabel('Limpia', [9.2, 3.2, -18], 'tag--secondary', { casetaOnly: true });
addLabel('Desfogue automático (sin válvula)', [9, 15, -23.5], 'tag--water tag--secondary', { casetaOnly: true });
addLabel('40.0 cm', [0, -0.6, 20.4], 'tag--dim');
addLabel('30.0 cm', [25.6, -0.6, 0], 'tag--dim');

const projected = new THREE.Vector3();

function updateLabels() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const showDims = medidas.visible;

  for (const label of labels) {
    const hidden =
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
