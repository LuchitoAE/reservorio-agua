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
  pvc: 0x7c8389,   // PVC gris (tubería de agua)
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

// Estrías de la manija (rojo más oscuro).
const valveGrooveMat = new THREE.MeshStandardMaterial({ color: 0x9e2424, roughness: 0.5 });

// Manija roja de las llaves de paso.
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

// Llave de paso de PVC de una pieza, tipo "liso" (para pegar): cuerpo blanco con extremos
// lisos y abultamiento central, cuello corto y manija roja de mariposa (T) con estrías.
// handleRotY = 0: manija a lo largo del tubo (abierta); Math.PI / 2: cruzada (cerrada).
function addValve(pos, axis, { len = 5.0, handleRotY = 0 } = {}) {
  const half = len / 2;
  const compact = len < 4.5;
  const endR = compact ? 0.86 : 0.95;     // extremos lisos que encajan sobre el tubo
  const ballR = compact ? 1.12 : 1.3;     // abultamiento de la esfera interna
  const wingLen = compact ? 1.7 : 2.1;    // del centro a la punta de cada ala
  const wingW = compact ? 0.52 : 0.62;    // medio ancho del ala en la punta

  const group = new THREE.Group();
  group.position.copy(V(pos));
  group.quaternion.setFromUnitVectors(AXIS.z, axis.clone().normalize());

  for (const s of [-1, 1]) {
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(endR, endR, half, 30, 1, true), valveBodyMat);
    sleeve.position.z = s * (half / 2);
    sleeve.rotation.x = Math.PI / 2;
    group.add(sleeve);

    const mouth = new THREE.Mesh(new THREE.RingGeometry(PR * 1.01, endR, 30), valveBodyMat);
    mouth.position.z = s * half;
    mouth.rotation.y = s > 0 ? 0 : Math.PI;
    group.add(mouth);

    const lip = new THREE.Mesh(new THREE.TorusGeometry(endR - 0.03, 0.04, 8, 30), valveBodyMat);
    lip.position.z = s * (half - 0.02);
    group.add(lip);
  }

  const ball = new THREE.Mesh(new THREE.SphereGeometry(ballR, 32, 24), valveBodyMat);
  ball.scale.set(1, 1, 0.92);
  group.add(ball);

  const neckY = ballR * 0.85;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.7, 26), valveBodyMat);
  neck.position.y = neckY + 0.3;
  group.add(neck);

  const handle = new THREE.Group();
  handle.position.y = neckY + 0.68;
  handle.rotation.y = handleRotY;

  // Alas en forma de mariposa (vista desde arriba), extruidas hacia arriba.
  const shape = new THREE.Shape();
  shape.moveTo(0.42, -0.3);
  shape.lineTo(wingLen, -wingW);
  shape.lineTo(wingLen, wingW);
  shape.lineTo(0.42, 0.3);
  shape.lineTo(-0.42, 0.3);
  shape.lineTo(-wingLen, wingW);
  shape.lineTo(-wingLen, -wingW);
  shape.lineTo(-0.42, -0.3);
  shape.closePath();
  const wingsGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.28,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  wingsGeo.rotateX(-Math.PI / 2);  // del plano XY al plano horizontal
  wingsGeo.rotateY(Math.PI / 2);   // alas a lo largo del tubo (eje Z local)
  handle.add(new THREE.Mesh(wingsGeo, valveMat));

  for (const s of [-1, 1]) {
    // Borde grueso en la punta de cada ala y estrías para el agarre.
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(wingW * 2, 0.5, 0.18), valveMat);
    skirt.position.set(0, 0.06, s * (wingLen - 0.04));
    handle.add(skirt);
    for (let i = 0; i < 4; i++) {
      const groove = new THREE.Mesh(new THREE.BoxGeometry(wingW * 1.6, 0.05, 0.06), valveGrooveMat);
      groove.position.set(0, 0.36, s * (wingLen - 0.26 - i * 0.2));
      handle.add(groove);
    }
  }

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.6, 26), valveMat);
  hub.position.y = 0.12;
  handle.add(hub);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 26), valveGrooveMat);
  cap.position.y = 0.44;
  handle.add(cap);

  group.add(handle);

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

/* ------------------------------------------------------ datos en el modelo */
// El modelo no dibuja los sensores (sus valores están en las tarjetas del tablero): solo
// muestra el agua con los datos reales o simulados. Flujo animado en las tuberías de
// entrada y salida según los L/min (y en el rebose si el nivel llega a 31 cm), chorro de
// entrada y color del agua según la claridad.

const OVERFLOW_CM = 31;  // rebose físico

// Chorro y salpicadura van dentro del tanque: se ocultan con "Ver caseta".
const tankFx = new THREE.Group();
world.add(tankFx);

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
  flowPath([[3, 5.5, -35], [3, 5.5, -19], [3, 36, -19], [3, 36, -12], [3, 35, -12]], [1.8, 1.8, 0.45]),
  0xa78bfa,
);
const flowOut = flowLine(flowPath([[-7, 5.5, -14], [-7, 5.5, -35]]), 0xf472b6);
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
tankFx.add(jet);
const jetFlow = { mesh: jet, mat: jetMat, tex: jetTex, speed: 20 };

const splashMat = new THREE.MeshBasicMaterial({ color: 0xd9f6ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
const splash = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 32), splashMat);
splash.rotation.x = -Math.PI / 2;
splash.renderOrder = 5;
tankFx.add(splash);

// Color del agua: de celeste (100 % de claridad) a marrón (0 %).
const WATER_CLEAR = { body: new THREE.Color(0x07566e), top: new THREE.Color(0x5fd8f5), glow: new THREE.Color(0x0a4b60) };
const WATER_TURBID = { body: new THREE.Color(0x5b4426), top: new THREE.Color(0xa07f52), glow: new THREE.Color(0x2a1d0c) };
let turbidMix = 0;

// started/snap: con el primer dato (o al pasar de simulación a real) el agua toma su
// nivel y color al instante, sin animar desde el valor anterior.
const live = { data: null, started: false, snap: false, kind: null };

function renderLive(t) {
  live.data = t;
  if (!t) live.started = false;
}

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

function updateTwin(dt) {
  tankFx.visible = !soloCaseta;
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

  updateWaterColor(dt);
}

const projected = new THREE.Vector3();

function updateLabels() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
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

// Botones opcionales de la página (vistas y capas). Los datos llegan con setTelemetry().
const ui = {
  medidasBtn: document.getElementById('toggle-medidas'),
  aislarBtn: document.getElementById('toggle-aislar'),
  loading: document.getElementById('loading'),
};

let targetLevel = D.maxLevel * 0.5;
let currentLevel = targetLevel;

ui.medidasBtn?.addEventListener('click', () => {
  medidas.visible = !medidas.visible;
  ui.medidasBtn.textContent = medidas.visible ? 'Ocultar medidas' : 'Mostrar medidas';
});

ui.aislarBtn?.addEventListener('click', () => {
  soloCaseta = !soloCaseta;
  reservoir.visible = !soloCaseta;
  waterGroup.visible = !soloCaseta;
  spillLine.visible = !soloCaseta;
  caseta.visible = true;
  medidas.visible = !soloCaseta;
  if (ui.medidasBtn) ui.medidasBtn.textContent = soloCaseta ? 'Mostrar medidas' : 'Ocultar medidas';
  ui.aislarBtn.textContent = soloCaseta ? 'Ver todo' : 'Ver caseta';
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

// En pantallas angostas (celular) la cámara se aleja para que entre todo el modelo.
function fitFactor() {
  return Math.max(1, 1.1 / camera.aspect);
}

export function goToView(name) {
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

/**
 * Datos del tablero (reales o simulados, ver datos.js). null = sin datos.
 * El nivel usa la altura real del agua (levelCm), no el %, que se corta en 100 y
 * ocultaría el rebalse.
 */
export function setTelemetry(data) {
  if (!data) {
    renderLive(null);
    return;
  }
  // Al pasar de simulación a datos reales (o al revés) se muestra el nuevo estado al instante.
  const kind = data.simulated ? 'sim' : 'real';
  if (live.kind !== kind) {
    live.kind = kind;
    live.started = false;
  }
  renderLive(data);
  const cm = data.level?.levelCm;
  if (data.level?.ok && typeof cm === 'number' && Number.isFinite(cm)) {
    targetLevel = Math.min(D.inH, Math.max(0, cm));
    if (!live.started) currentLevel = targetLevel;
  }
  if (!live.started) {
    live.started = true;
    live.snap = true;
  }
}

/* ------------------------------------------------------------------ resize */

function resize() {
  // El lienzo puede no ocupar toda la ventana (en el celular va arriba de las tarjetas).
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

let portrait = camera.aspect < 1;

window.addEventListener('resize', () => {
  const wasPortrait = portrait;
  resize();
  portrait = camera.aspect < 1;
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

  if (firstFrame) {
    firstFrame = false;
    ui.loading?.classList.add('is-hidden');
  }
}

applyLevel(currentLevel);
animate();

window.reservorioModelo = { scene, camera, controls, D, goToView };
