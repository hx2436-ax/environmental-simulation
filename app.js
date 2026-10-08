import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.164.1/examples/jsm/controls/OrbitControls.js?module";

const container = document.querySelector("#scene");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9e4f7);
scene.fog = new THREE.Fog(0xe9e4f7, 34, 92);

const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 140);
camera.position.set(28, 25, 23);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.47;
controls.minDistance = 10;
controls.maxDistance = 68;

scene.add(new THREE.HemisphereLight(0xfff7ff, 0xb7aec8, 2.7));
const sun = new THREE.DirectionalLight(0xfff3dc, 2.2);
sun.position.set(9, 19, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const GRID = 6;

// Stylized Manhattan proportions.
// Typical Manhattan blocks are roughly 800 ft long x 200 ft wide.
// The scaled centerline spacing below also leaves room for wider avenues
// and narrower cross streets.
const STEP_X = 8.8;
const STEP_Z = 2.5;
const WORLD_X = STEP_X * (GRID - 1);
const WORLD_Z = STEP_Z * (GRID - 1);
const AVENUE_WIDTH = 1.0;
const STREET_WIDTH = 0.6;
const ROAD_Y = 0.055;
const NODE = (i, j) => j * GRID + i;
const PICKUP_NODE = NODE(1, 1);
const DESTINATION_NODE = NODE(4, 4);

const state = {
  status: "idle",
  tripId: null,
  rider: { location: PICKUP_NODE, destination: DESTINATION_NODE },
  driver: { location: NODE(0, 5), availability: true },
  vehicle: { location: NODE(0, 5), capacity: 4 },
  trip: { status: "idle", estimatedTime: 0, fare: 0, distance: 0 },
  pickup: { coordinates: PICKUP_NODE },
  destination: { coordinates: DESTINATION_NODE },
  route: { phase: "none", path: [], edgeIds: [], distance: 0, estimatedTravelTime: 0 },
  roadTraffic: new Map(),
  movementIndex: 0
};

const nodePositions = [];
for (let j = 0; j < GRID; j++) {
  for (let i = 0; i < GRID; i++) {
    nodePositions.push(new THREE.Vector3(
      -WORLD_X / 2 + i * STEP_X,
      ROAD_Y,
      -WORLD_Z / 2 + j * STEP_Z
    ));
  }
}

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(92, 56),
  new THREE.MeshStandardMaterial({ color: 0xc9c5d7, roughness: 0.97 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const cityGroup = new THREE.Group();
scene.add(cityGroup);

function hash01(i, j, salt = 0) {
  const x = Math.sin(i * 127.1 + j * 311.7 + salt * 74.7) * 43758.5453;
  return x - Math.floor(x);
}

const facadeMaterials = [
  new THREE.MeshStandardMaterial({ color: 0xcda6a8, roughness: 0.93, metalness: 0.02 }),
  new THREE.MeshStandardMaterial({ color: 0xd8c4ae, roughness: 0.90, metalness: 0.02 }),
  new THREE.MeshStandardMaterial({ color: 0xd9d1dc, roughness: 0.88, metalness: 0.03 }),
  new THREE.MeshStandardMaterial({ color: 0x9aa8c6, roughness: 0.48, metalness: 0.28 }),
  new THREE.MeshStandardMaterial({ color: 0xb1a7c8, roughness: 0.58, metalness: 0.18 })
];

const roofMaterial = new THREE.MeshStandardMaterial({
  color: 0xaaa6b7,
  roughness: 0.92,
  metalness: 0.08
});

const tankMaterial = new THREE.MeshStandardMaterial({
  color: 0xb49b82,
  roughness: 0.96,
  metalness: 0.02
});

function addBoxMass(x, y, z, w, h, d, material) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    material
  );
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  cityGroup.add(mesh);
  return mesh;
}

function addRooftopElement(x, z, baseY, w, d, seed) {
  const mechW = Math.max(0.16, w * (0.28 + hash01(seed, 2, 70) * 0.22));
  const mechD = Math.max(0.14, d * (0.28 + hash01(seed, 3, 71) * 0.25));
  const mechH = 0.18 + hash01(seed, 4, 72) * 0.28;

  if (hash01(seed, 5, 73) > 0.28) {
    addBoxMass(
      x + (hash01(seed, 6, 74) - 0.5) * w * 0.18,
      baseY,
      z + (hash01(seed, 7, 75) - 0.5) * d * 0.18,
      mechW,
      mechH,
      mechD,
      roofMaterial
    );
  }

  if (hash01(seed, 8, 76) > 0.78 && w > 0.55) {
    const tankRadius = Math.min(0.16, w * 0.15);
    const tankH = 0.22 + hash01(seed, 9, 77) * 0.18;
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(tankRadius, tankRadius * 0.92, tankH, 12),
      tankMaterial
    );
    tank.position.set(x, baseY + tankH / 2 + 0.08, z);
    tank.castShadow = true;
    cityGroup.add(tank);

    const legs = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.16, 6),
      roofMaterial
    );
    legs.position.set(x, baseY + 0.08, z);
    cityGroup.add(legs);
  }
}

function addNYCBuilding(x, z, w, d, baseHeight, seed, typology = "streetwall") {
  const material = facadeMaterials[Math.floor(hash01(seed, 1, 60) * facadeMaterials.length)];

  if (typology === "tower") {
    const podiumH = Math.max(1.15, Math.min(baseHeight * 0.34, 2.2));
    addBoxMass(x, 0, z, w, podiumH, d, material);

    const setbackX = w * (0.15 + hash01(seed, 10, 61) * 0.10);
    const setbackZ = d * (0.13 + hash01(seed, 11, 62) * 0.10);
    const towerW = Math.max(0.34, w - setbackX * 2);
    const towerD = Math.max(0.34, d - setbackZ * 2);
    const towerH = Math.max(2.4, baseHeight - podiumH);
    const towerOffsetX = (hash01(seed, 12, 63) - 0.5) * w * 0.08;
    const towerOffsetZ = (hash01(seed, 13, 64) - 0.5) * d * 0.06;

    addBoxMass(
      x + towerOffsetX,
      podiumH,
      z + towerOffsetZ,
      towerW,
      towerH,
      towerD,
      material
    );

    if (towerH > 4.5 && hash01(seed, 14, 65) > 0.48) {
      const crownH = 0.32 + hash01(seed, 15, 66) * 0.55;
      const crownW = towerW * (0.68 + hash01(seed, 16, 67) * 0.16);
      const crownD = towerD * (0.68 + hash01(seed, 17, 68) * 0.16);
      addBoxMass(
        x + towerOffsetX,
        podiumH + towerH,
        z + towerOffsetZ,
        crownW,
        crownH,
        crownD,
        material
      );
      addRooftopElement(x + towerOffsetX, z + towerOffsetZ, podiumH + towerH + crownH, crownW, crownD, seed);
    } else {
      addRooftopElement(x + towerOffsetX, z + towerOffsetZ, podiumH + towerH, towerW, towerD, seed);
    }
    return;
  }

  const streetwallH = Math.max(0.85, baseHeight);
  addBoxMass(x, 0, z, w, streetwallH, d, material);

  if (streetwallH > 2.7 && hash01(seed, 18, 69) > 0.56) {
    const upperH = 0.45 + hash01(seed, 19, 70) * 1.0;
    const upperW = w * (0.72 + hash01(seed, 20, 71) * 0.12);
    const upperD = d * (0.72 + hash01(seed, 21, 72) * 0.12);
    addBoxMass(x, streetwallH, z, upperW, upperH, upperD, material);
    addRooftopElement(x, z, streetwallH + upperH, upperW, upperD, seed);
  } else {
    addRooftopElement(x, z, streetwallH, w, d, seed);
  }
}

const BLOCK_X = STEP_X - AVENUE_WIDTH;
const BLOCK_Z = STEP_Z - STREET_WIDTH;

for (let j = 0; j < GRID - 1; j++) {
  for (let i = 0; i < GRID - 1; i++) {
    const cx = -WORLD_X / 2 + (i + 0.5) * STEP_X;
    const cz = -WORLD_Z / 2 + (j + 0.5) * STEP_Z;

    const rows = [-1, 1];
    for (const row of rows) {
      const rowDepth = BLOCK_Z * (0.36 + hash01(i, j, 20 + row) * 0.08);
      const rowZ = cz + row * BLOCK_Z * 0.26;
      let cursor = cx - BLOCK_X / 2 + 0.18;
      const rightEdge = cx + BLOCK_X / 2 - 0.18;
      let lot = 0;

      while (cursor < rightEdge - 0.35 && lot < 9) {
        const lotWidth = Math.min(
          0.62 + hash01(i * 13 + lot, j * 17 + row, 30) * 0.72,
          rightEdge - cursor
        );
        if (lotWidth < 0.28) break;

        const gap = 0.06 + hash01(i, j + lot, 31) * 0.07;
        const buildingWidth = Math.max(0.36, lotWidth - gap);
        const buildingDepth = rowDepth * (0.82 + hash01(i + lot, j, 32) * 0.16);
        const x = cursor + lotWidth / 2;

        const nearWestAvenue = x < cx - BLOCK_X * 0.34;
        const nearEastAvenue = x > cx + BLOCK_X * 0.34;
        const cornerLot = nearWestAvenue || nearEastAvenue;
        const midtownBand = j === 2 || j === 3;

        let height = 0.85 + hash01(i * 7 + lot, j * 11 + row, 33) * 1.65;
        if (cornerLot) height += 0.35 + hash01(i, j + lot, 34) * 0.75;
        if (midtownBand) height += 0.25 + hash01(lot, i + j, 35) * 0.65;

        const towerChance =
          (cornerLot ? 0.14 : 0.025) +
          (midtownBand ? 0.06 : 0);

        const isTower = hash01(i * 19 + lot, j * 23 + row, 36) < towerChance;
        if (isTower) {
          height += 2.3 + hash01(i + lot, j + row, 37) * 2.8;
        }

        addNYCBuilding(
          x,
          rowZ,
          buildingWidth,
          buildingDepth,
          height,
          i * 1000 + j * 100 + (row + 1) * 20 + lot,
          isTower ? "tower" : "streetwall"
        );

        cursor += lotWidth;
        lot += 1;
      }
    }
  }
}

const roadObjects = new Map();
const edges = [];
const adjacency = Array.from({ length: GRID * GRID }, () => []);

const roadSurfaceMaterial = new THREE.MeshStandardMaterial({
  color: 0x8f8a9d,
  roughness: 0.96,
  metalness: 0.0
});

function edgeId(a, b) { return a < b ? `${a}-${b}` : `${b}-${a}`; }

function makeStrip(start, end, width, color, y = 0.07, opacity = 1) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz);

  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthTest: true,
    depthWrite: true
  });

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.035, width),
    material
  );

  mesh.position.set(
    (start.x + end.x) / 2,
    y,
    (start.z + end.z) / 2
  );
  mesh.rotation.y = -Math.atan2(dz, dx);
  return mesh;
}

function makeOffsetStrip(start, end, width, color, y = 0.07, opacity = 1, offset = 0) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz) || 1;
  const nx = -dz / length;
  const nz = dx / length;

  const shiftedStart = start.clone();
  const shiftedEnd = end.clone();
  shiftedStart.x += nx * offset;
  shiftedStart.z += nz * offset;
  shiftedEnd.x += nx * offset;
  shiftedEnd.z += nz * offset;

  return makeStrip(shiftedStart, shiftedEnd, width, color, y, opacity);
}

const locationGridGroup = new THREE.Group();
scene.add(locationGridGroup);

function addLocationGridUnderlayer() {
  const gridMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.72,
    depthTest: true,
    depthWrite: false
  });

  const minI = -1;
  const maxI = GRID;
  const minJ = -1;
  const maxJ = GRID;
  const minX = -WORLD_X / 2 + minI * STEP_X;
  const maxX = -WORLD_X / 2 + maxI * STEP_X;
  const minZ = -WORLD_Z / 2 + minJ * STEP_Z;
  const maxZ = -WORLD_Z / 2 + maxJ * STEP_Z;

  for (let i = minI; i <= maxI; i++) {
    const x = -WORLD_X / 2 + i * STEP_X;
    const start = new THREE.Vector3(x, 0.024, minZ);
    const end = new THREE.Vector3(x, 0.024, maxZ);
    const strip = makeStrip(start, end, AVENUE_WIDTH + 0.18, 0xffffff, 0.024, 0.72);
    strip.material.dispose();
    strip.material = gridMaterial.clone();
    strip.renderOrder = 1;
    locationGridGroup.add(strip);
  }

  for (let j = minJ; j <= maxJ; j++) {
    const z = -WORLD_Z / 2 + j * STEP_Z;
    const start = new THREE.Vector3(minX, 0.026, z);
    const end = new THREE.Vector3(maxX, 0.026, z);
    const strip = makeStrip(start, end, STREET_WIDTH + 0.18, 0xffffff, 0.026, 0.72);
    strip.material.dispose();
    strip.material = gridMaterial.clone();
    strip.renderOrder = 1;
    locationGridGroup.add(strip);
  }

  const nodeGeometry = new THREE.RingGeometry(0.12, 0.19, 24);
  for (let j = minJ; j <= maxJ; j++) {
    for (let i = minI; i <= maxI; i++) {
      const marker = new THREE.Mesh(nodeGeometry, gridMaterial.clone());
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(
        -WORLD_X / 2 + i * STEP_X,
        0.105,
        -WORLD_Z / 2 + j * STEP_Z
      );
      marker.renderOrder = 8;
      locationGridGroup.add(marker);
    }
  }
}

addLocationGridUnderlayer();

function addRoad(a, b) {
  const id = edgeId(a, b);
  const start = nodePositions[a];
  const end = nodePositions[b];
  const isAvenue = Math.abs(end.z - start.z) > Math.abs(end.x - start.x);
  const surfaceWidth = isAvenue ? AVENUE_WIDTH : STREET_WIDTH;

  const surface = makeStrip(start, end, surfaceWidth, 0x8f8a9d, 0.045, 0.92);
  surface.material = roadSurfaceMaterial.clone();
  scene.add(surface);

  const traffic = makeStrip(start, end, 0.13, 0x69c98b, 0.085, 0.98);
  scene.add(traffic);

  roadObjects.set(id, { surface, traffic, isAvenue });

  const distance = start.distanceTo(end) * 115;
  const edge = { id, a, b, distance };
  edges.push(edge);
  adjacency[a].push(edge);
  adjacency[b].push(edge);
  state.roadTraffic.set(id, 1 + Math.random() * 2);
}

for (let j = 0; j < GRID; j++) {
  for (let i = 0; i < GRID; i++) {
    if (i < GRID - 1) addRoad(NODE(i, j), NODE(i + 1, j));
    if (j < GRID - 1) addRoad(NODE(i, j), NODE(i, j + 1));
  }
}

function trafficColor(level) {
  const t = THREE.MathUtils.clamp((level - 1) / 2, 0, 1);
  return new THREE.Color().setHSL(0.34 * (1 - t), 0.78, 0.47);
}

function trafficWidth(level) {
  const t = THREE.MathUtils.clamp((level - 1) / 2, 0, 1);
  return THREE.MathUtils.lerp(0.10, 0.34, t);
}

function setStripWidth(mesh, width) {
  const box = mesh.geometry.parameters;
  mesh.scale.z = width / box.depth;
}

function updateRoadAppearance() {
  for (const [id, road] of roadObjects) {
    const level = state.roadTraffic.get(id);
    road.traffic.material.color.copy(trafficColor(level));
    setStripWidth(road.traffic, trafficWidth(level));
    road.traffic.material.opacity = 0.98;
  }
}

function dijkstra(start, goal) {
  const n = nodePositions.length;
  const dist = Array(n).fill(Infinity);
  const prev = Array(n).fill(null);
  const prevEdge = Array(n).fill(null);
  const visited = Array(n).fill(false);
  dist[start] = 0;

  for (let k = 0; k < n; k++) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      if (!visited[i] && dist[i] < best) {
        best = dist[i];
        u = i;
      }
    }
    if (u === -1 || u === goal) break;
    visited[u] = true;

    for (const e of adjacency[u]) {
      const v = e.a === u ? e.b : e.a;
      const traffic = state.roadTraffic.get(e.id);
      const weight = e.distance * traffic;
      const alt = dist[u] + weight;
      if (alt < dist[v]) {
        dist[v] = alt;
        prev[v] = u;
        prevEdge[v] = e.id;
      }
    }
  }

  const path = [];
  const edgeIds = [];
  let cur = goal;
  if (prev[cur] === null && cur !== start) return { path: [start, goal], edgeIds: [] };
  while (cur !== null) {
    path.unshift(cur);
    if (prevEdge[cur]) edgeIds.unshift(prevEdge[cur]);
    cur = prev[cur];
  }
  return { path, edgeIds };
}

let routeLine = null;

function routeColor(phase) {
  if (phase === "to_pickup") return 0x4cb7ff;
  if (phase === "to_destination") return 0x59e391;
  return 0x7bf6ff;
}

function buildActiveRoute(start, goal, phase, updateTripEstimate = false) {
  const result = dijkstra(start, goal);
  state.route.phase = phase;
  state.route.path = result.path;
  state.route.edgeIds = result.edgeIds;
  state.movementIndex = 0;

  let distance = 0;
  let weighted = 0;
  for (const id of result.edgeIds) {
    const edge = edges.find(e => e.id === id);
    distance += edge.distance;
    weighted += edge.distance * state.roadTraffic.get(id);
  }

  state.route.distance = Math.round(distance);
  state.route.estimatedTravelTime = Math.max(1, Math.round(weighted / 240));

  if (updateTripEstimate) {
    state.trip.distance = state.route.distance;
    state.trip.estimatedTime = state.route.estimatedTravelTime;
    state.trip.fare = +(4.2 + distance * 0.0029 + state.trip.estimatedTime * 0.48).toFixed(2);
  }

  if (routeLine) {
    scene.remove(routeLine);
    routeLine.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  }

  routeLine = new THREE.Group();
  const routePoints = result.path.map(index => nodePositions[index]);
  for (let i = 0; i < routePoints.length - 1; i++) {
    const halo = makeOffsetStrip(
      routePoints[i],
      routePoints[i + 1],
      0.115,
      0xfffbff,
      0.15,
      0.96,
      0.22
    );
    halo.material.depthTest = false;
    halo.renderOrder = 20;

    const segment = makeOffsetStrip(
      routePoints[i],
      routePoints[i + 1],
      0.055,
      routeColor(phase),
      0.16,
      1,
      0.22
    );
    segment.material.depthTest = false;
    segment.renderOrder = 21;
    routeLine.add(halo, segment);
  }
  routeLine.visible = state.status !== "idle";
  scene.add(routeLine);

  updateRoadAppearance();
  updateUI();
}

function makePin(color, height = 1.55) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.052, height, 12),
    new THREE.MeshBasicMaterial({ color })
  );
  stem.position.y = height / 2;
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.30, 24, 24),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.58 })
  );
  orb.position.y = height;
  g.add(stem, orb);
  return g;
}

const pickupPin = makePin(0x59e391);
const destinationPin = makePin(0xffb84d);
pickupPin.position.copy(nodePositions[state.pickup.coordinates]);
destinationPin.position.copy(nodePositions[state.destination.coordinates]);
scene.add(pickupPin, destinationPin);

const rider = new THREE.Mesh(
  new THREE.SphereGeometry(0.40, 28, 28),
  new THREE.MeshStandardMaterial({ color: 0xff4f9a, emissive: 0xff4f9a, emissiveIntensity: 0.52 })
);
rider.castShadow = true;
rider.position.copy(nodePositions[state.rider.location]).add(new THREE.Vector3(0.42, 0.36, 0.35));
scene.add(rider);

const vehicle = new THREE.Group();
const carBody = new THREE.Mesh(
  new THREE.BoxGeometry(1.15, 0.42, 0.68),
  new THREE.MeshStandardMaterial({ color: 0xfff8fb, metalness: 0.16, roughness: 0.38 })
);
carBody.position.y = 0.31;
carBody.castShadow = true;
vehicle.add(carBody);
const cabin = new THREE.Mesh(
  new THREE.BoxGeometry(0.58, 0.3, 0.58),
  new THREE.MeshStandardMaterial({ color: 0xb9a7ff, metalness: 0.12, roughness: 0.34 })
);
cabin.position.set(-0.08, 0.66, 0);
vehicle.add(cabin);

const driverMarker = new THREE.Mesh(
  new THREE.SphereGeometry(0.20, 20, 20),
  new THREE.MeshStandardMaterial({ color: 0x4cb7ff, emissive: 0x4cb7ff, emissiveIntensity: 0.95 })
);
driverMarker.position.set(0, 0.94, 0);
vehicle.add(driverMarker);
vehicle.position.copy(nodePositions[state.vehicle.location]);
scene.add(vehicle);

const ghostTargets = [];

function addGhostOverlay(root, opacity = 0.20, scale = 1.035) {
  const sourceMeshes = [];
  const ghosts = [];
  root.traverse(obj => {
    if (obj.isMesh && !obj.userData.isGhostOverlay) sourceMeshes.push(obj);
  });

  for (const source of sourceMeshes) {
    const sourceColor = source.material?.color?.getHex?.() ?? 0xffffff;
    const ghost = new THREE.Mesh(
      source.geometry,
      new THREE.MeshBasicMaterial({
        color: sourceColor,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    ghost.scale.setScalar(scale);
    ghost.renderOrder = 60;
    ghost.userData.isGhostOverlay = true;
    ghost.userData.ghostOpacity = opacity;
    source.add(ghost);
    ghosts.push(ghost);
  }

  ghostTargets.push({ root, ghosts, opacity });
}

const ghostRaycaster = new THREE.Raycaster();
const ghostDirection = new THREE.Vector3();
const ghostWorldPosition = new THREE.Vector3();

function updateGhostVisibility() {
  for (const target of ghostTargets) {
    target.root.getWorldPosition(ghostWorldPosition);
    ghostDirection.subVectors(ghostWorldPosition, camera.position);
    const distance = ghostDirection.length();

    if (distance < 0.2 || !target.root.visible) {
      for (const ghost of target.ghosts) ghost.material.opacity = 0;
      continue;
    }

    ghostDirection.normalize();
    ghostRaycaster.set(camera.position, ghostDirection);
    ghostRaycaster.near = 0.05;
    ghostRaycaster.far = Math.max(0.05, distance - 0.12);

    const occluded = ghostRaycaster.intersectObjects(cityGroup.children, true).length > 0;
    for (const ghost of target.ghosts) {
      ghost.material.opacity = occluded ? target.opacity : 0;
    }
  }
}

function addVisibilityHalo(root, color, radius, y = 0.08) {
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.72, radius, 36),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = y;
  halo.renderOrder = 62;
  halo.userData.isVisibilityHalo = true;
  root.add(halo);
  return halo;
}

addVisibilityHalo(rider, 0xff4f9a, 0.68, -0.22);
addVisibilityHalo(driverMarker, 0x4cb7ff, 0.48, -0.62);
addVisibilityHalo(pickupPin, 0x59e391, 0.56, 0.08);
addVisibilityHalo(destinationPin, 0xffb84d, 0.56, 0.08);

addGhostOverlay(rider, 0.30, 1.12);
addGhostOverlay(driverMarker, 0.38, 1.24);
addGhostOverlay(pickupPin, 0.28, 1.10);
addGhostOverlay(destinationPin, 0.28, 1.10);

function orientVehicle(from, to) {
  if (!from || !to) return;
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  vehicle.rotation.y = Math.atan2(dx, dz);
}

function setVehicleAtNode(index, nextIndex = null) {
  state.vehicle.location = index;
  state.driver.location = index;
  const p = nodePositions[index];
  vehicle.position.set(p.x, 0.06, p.z);
  if (nextIndex !== null) orientVehicle(p, nodePositions[nextIndex]);
}

function gridDistance(a, b) {
  const ax = a % GRID;
  const ay = Math.floor(a / GRID);
  const bx = b % GRID;
  const by = Math.floor(b / GRID);
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function randomPickupNode(previousNode = null) {
  const candidates = nodePositions
    .map((_, index) => index)
    .filter(index =>
      index !== state.destination.coordinates &&
      index !== previousNode &&
      gridDistance(index, state.destination.coordinates) >= 3
    );
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function randomDriverNode() {
  const candidates = nodePositions
    .map((_, index) => index)
    .filter(index =>
      index !== state.pickup.coordinates &&
      index !== state.destination.coordinates &&
      gridDistance(index, state.pickup.coordinates) >= 2
    );
  return candidates[Math.floor(Math.random() * candidates.length)];
}

const ui = {
  status: document.querySelector("#trip-status"),
  tripId: document.querySelector("#trip-id"),
  eta: document.querySelector("#eta"),
  fare: document.querySelector("#fare"),
  distance: document.querySelector("#distance"),
  availability: document.querySelector("#availability"),
  roadCount: document.querySelector("#road-count"),
  traffic: document.querySelector("#traffic"),
  routeMap: document.querySelector("#route-map"),
  routeMapPhase: document.querySelector("#route-map-phase"),
  locationSelected: document.querySelector("#location-selected"),
  locNode: document.querySelector("#loc-node"),
  locGrid: document.querySelector("#loc-grid"),
  locWorld: document.querySelector("#loc-world"),
  locScreen: document.querySelector("#loc-screen"),
  locHuman: document.querySelector("#loc-human"),
  locRelative: document.querySelector("#loc-relative"),
  locOccupants: document.querySelector("#loc-occupants"),
  referenceFrame: document.querySelector("#reference-frame"),
  locationQueryForm: document.querySelector("#location-query-form"),
  locationQuery: document.querySelector("#location-query"),
  locationQueryResult: document.querySelector("#location-query-result"),
  compassRose: document.querySelector("#compass-rose"),
  compassHeading: document.querySelector("#compass-heading"),
  compassBearing: document.querySelector("#compass-bearing"),
  hoverTooltip: document.querySelector("#hover-tooltip"),
  message: document.querySelector("#message"),
  request: document.querySelector("#request-btn"),
  accept: document.querySelector("#accept-btn"),
  reject: document.querySelector("#reject-btn"),
  cancel: document.querySelector("#cancel-btn"),
  start: document.querySelector("#start-btn"),
  move: document.querySelector("#move-btn"),
  trafficBtn: document.querySelector("#traffic-btn"),
  reroute: document.querySelector("#reroute-btn"),
  reset: document.querySelector("#reset-btn")
};

const AVENUE_NAMES = Array.from({ length: GRID }, (_, i) => `Avenue ${i + 1}`);
const STREET_NAMES = Array.from({ length: GRID }, (_, j) => `Street ${20 + j}`);

const roadLabelGroup = new THREE.Group();
scene.add(roadLabelGroup);

function makeRoadLabel(text, x, z, angle = 0, width = 2.8) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255, 252, 255, .88)";
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(8, 18, 496, 92, 24);
  } else {
    ctx.rect(8, 18, 496, 92);
  }
  ctx.fill();

  ctx.strokeStyle = "rgba(118, 93, 150, .20)";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = "#54445f";
  ctx.font = "800 42px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width * 0.25),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  mesh.position.set(x, 0.18, z);
  mesh.rotation.set(-Math.PI / 2, 0, angle);
  mesh.renderOrder = 35;
  mesh.userData.hoverName = text;
  mesh.userData.isRoadLabel = true;
  roadLabelGroup.add(mesh);
  return mesh;
}

function makeCoordinateLabel(text, x, z, angle = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255, 255, 255, .92)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(20, 18, 152, 92, 24);
  else ctx.rect(20, 18, 152, 92);
  ctx.fill();

  ctx.fillStyle = "#594a67";
  ctx.font = "900 50px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 96, 65);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.60),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  mesh.position.set(x, 0.20, z);
  mesh.rotation.set(-Math.PI / 2, 0, angle);
  mesh.renderOrder = 36;
  roadLabelGroup.add(mesh);
  return mesh;
}

const extendedMinX = -WORLD_X / 2 - STEP_X;
const extendedMinZ = -WORLD_Z / 2 - STEP_Z;
const extendedMaxX = WORLD_X / 2 + STEP_X;
const extendedMaxZ = WORLD_Z / 2 + STEP_Z;

for (let i = -1; i <= GRID; i++) {
  const x = -WORLD_X / 2 + i * STEP_X;
  makeCoordinateLabel(String(i), x, extendedMinZ - 0.72, 0);
}

for (let j = -1; j <= GRID; j++) {
  const z = -WORLD_Z / 2 + j * STEP_Z;
  makeCoordinateLabel(String(j), extendedMinX - 0.72, z, Math.PI / 2);
}

makeRoadLabel("X", extendedMaxX + 1.05, extendedMinZ - 0.72, 0, 1.0);
makeRoadLabel("Y", extendedMinX - 0.72, extendedMaxZ + 0.75, Math.PI / 2, 1.0);

for (let i = 0; i < GRID; i++) {
  const x = nodePositions[NODE(i, 0)].x;
  makeRoadLabel(
    AVENUE_NAMES[i],
    x,
    WORLD_Z / 2 + 1.15,
    Math.PI / 2,
    2.55
  );
}

for (let j = 0; j < GRID; j++) {
  const z = nodePositions[NODE(0, j)].z;
  makeRoadLabel(
    STREET_NAMES[j],
    -WORLD_X / 2 - 1.8,
    z,
    0,
    2.55
  );
}

function compassBearing(heading) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(heading / 45) % 8];
}

function updateCompass() {
  if (!ui.compassRose) return;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.y = 0;

  if (dir.lengthSq() < 0.0001) return;
  dir.normalize();

  let heading = THREE.MathUtils.radToDeg(Math.atan2(dir.x, dir.z));
  heading = (heading + 360) % 360;

  ui.compassRose.style.setProperty("--heading", `${-heading}deg`);
  ui.compassHeading.textContent = `${String(Math.round(heading)).padStart(3, "0")}°`;
  ui.compassBearing.textContent = compassBearing(heading);
}

let selectedLocation = { kind: "rider", nodeIndex: state.rider.location, label: "Rider" };

const selectionRing = new THREE.Mesh(
  new THREE.RingGeometry(0.30, 0.46, 32),
  new THREE.MeshBasicMaterial({
    color: 0xff79b5,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
    depthTest: false
  })
);
selectionRing.rotation.x = -Math.PI / 2;
selectionRing.position.y = 0.19;
selectionRing.renderOrder = 40;
scene.add(selectionRing);

function effectiveRiderNode() {
  if (state.status === "in_progress" || state.status === "completed") {
    return state.vehicle.location;
  }
  return state.rider.location;
}

function nodeForKind(kind) {
  if (kind === "rider") return effectiveRiderNode();
  if (kind === "driver" || kind === "vehicle") return state.vehicle.location;
  if (kind === "pickup") return state.pickup.coordinates;
  if (kind === "destination") return state.destination.coordinates;
  return selectedLocation.nodeIndex;
}

function labelForKind(kind) {
  if (kind === "rider") return "Rider";
  if (kind === "driver") return "Driver / Vehicle";
  if (kind === "pickup") return "Pickup";
  if (kind === "destination") return "Destination";
  return selectedLocation.label || "Location";
}

function worldPositionForSelection() {
  const nodeIndex = nodeForKind(selectedLocation.kind);
  if (selectedLocation.kind === "driver" || selectedLocation.kind === "vehicle") {
    return vehicle.position.clone();
  }
  if (selectedLocation.kind === "rider" && rider.visible) {
    return rider.position.clone();
  }
  if (selectedLocation.kind === "pickup") return pickupPin.position.clone();
  if (selectedLocation.kind === "destination") return destinationPin.position.clone();
  return nodePositions[nodeIndex].clone();
}

function nodeGrid(index) {
  return {
    i: index % GRID,
    j: Math.floor(index / GRID)
  };
}

function nodeHumanName(index) {
  const { i, j } = nodeGrid(index);
  return `${AVENUE_NAMES[i]} & ${STREET_NAMES[j]}`;
}

function relativeDescription(targetNode, referenceNode, referenceLabel) {
  const target = nodeGrid(targetNode);
  const reference = nodeGrid(referenceNode);
  const dx = target.i - reference.i;
  const dy = target.j - reference.j;

  if (dx === 0 && dy === 0) {
    return `At the same location as ${referenceLabel}.`;
  }

  const parts = [];
  if (dx !== 0) {
    parts.push(`${Math.abs(dx)} block${Math.abs(dx) === 1 ? "" : "s"} ${dx > 0 ? "east" : "west"}`);
  }
  if (dy !== 0) {
    parts.push(`${Math.abs(dy)} block${Math.abs(dy) === 1 ? "" : "s"} ${dy > 0 ? "north" : "south"}`);
  }

  return `${parts.join(" and ")} of ${referenceLabel}.`;
}

function occupantsAtNode(nodeIndex) {
  const occupants = [];

  if (effectiveRiderNode() === nodeIndex) {
    occupants.push(state.status === "in_progress" ? "Rider · onboard" : "Rider");
  }
  if (state.vehicle.location === nodeIndex) {
    occupants.push("Driver", "Vehicle");
  }
  if (state.pickup.coordinates === nodeIndex) occupants.push("Pickup marker");
  if (state.destination.coordinates === nodeIndex) occupants.push("Destination marker");
  if (state.route.path.includes(nodeIndex)) occupants.push("Active route");

  return occupants;
}

function screenCoordinates(worldPosition) {
  const p = worldPosition.clone().project(camera);
  return {
    x: Math.round((p.x * 0.5 + 0.5) * innerWidth),
    y: Math.round((-p.y * 0.5 + 0.5) * innerHeight)
  };
}

function referenceNodeAndLabel() {
  const kind = ui.referenceFrame?.value || "rider";
  return {
    node: nodeForKind(kind),
    label: labelForKind(kind)
  };
}

function updateLocationInspector() {
  if (!ui.locationSelected) return;

  const nodeIndex = nodeForKind(selectedLocation.kind);
  selectedLocation.nodeIndex = nodeIndex;

  const { i, j } = nodeGrid(nodeIndex);
  const p = nodePositions[nodeIndex];
  const screen = screenCoordinates(worldPositionForSelection());
  const reference = referenceNodeAndLabel();
  const occupants = occupantsAtNode(nodeIndex);

  ui.locationSelected.textContent = labelForKind(selectedLocation.kind);
  ui.locNode.textContent = `N${nodeIndex}`;
  ui.locGrid.textContent = `(${i}, ${j})`;
  ui.locWorld.textContent = `x ${p.x.toFixed(1)} · z ${p.z.toFixed(1)}`;
  ui.locScreen.textContent = `${screen.x}px · ${screen.y}px`;
  ui.locHuman.textContent =
    `At ${nodeHumanName(nodeIndex)} on the stylized NYC grid. ` +
    relativeDescription(nodeIndex, state.destination.coordinates, "Destination");
  ui.locRelative.textContent = relativeDescription(nodeIndex, reference.node, reference.label);

  ui.locOccupants.innerHTML = "";
  const shown = occupants.length ? occupants : ["Empty"];
  for (const item of shown) {
    const chip = document.createElement("span");
    chip.textContent = item;
    ui.locOccupants.appendChild(chip);
  }

  selectionRing.position.x = p.x;
  selectionRing.position.z = p.z;
}

function selectLocation(kind, nodeIndex = null, label = null) {
  selectedLocation = {
    kind,
    nodeIndex: nodeIndex ?? nodeForKind(kind),
    label: label ?? labelForKind(kind)
  };
  updateLocationInspector();
}

function resolveNamedLocation(name) {
  const normalized = name.toLowerCase();
  if (["rider", "passenger"].includes(normalized)) return { kind: "rider", node: effectiveRiderNode(), label: "Rider" };
  if (["driver", "vehicle", "car"].includes(normalized)) return { kind: "driver", node: state.vehicle.location, label: "Driver / Vehicle" };
  if (normalized === "pickup") return { kind: "pickup", node: state.pickup.coordinates, label: "Pickup" };
  if (normalized === "destination") return { kind: "destination", node: state.destination.coordinates, label: "Destination" };
  return null;
}

const numberWords = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5
};

function parseDistanceToken(token) {
  if (/^\d+$/.test(token)) return Number(token);
  return numberWords[token] ?? null;
}

function resolveLocationDescription(raw) {
  const query = raw.trim().toLowerCase().replace(/[.,!?]/g, "");
  if (!query) return { error: "Type a location description first." };

  const nearest = query.match(/^nearest intersection to (rider|passenger|driver|vehicle|car|pickup|destination)$/);
  if (nearest) {
    const base = resolveNamedLocation(nearest[1]);
    return {
      node: base.node,
      label: `Nearest intersection to ${base.label}`,
      explanation: `${nodeHumanName(base.node)} · Node N${base.node}`
    };
  }

  const relative = query.match(/^(\d+|one|two|three|four|five) blocks? (north|south|east|west) of (rider|passenger|driver|vehicle|car|pickup|destination)$/);
  if (relative) {
    const distance = parseDistanceToken(relative[1]);
    const direction = relative[2];
    const base = resolveNamedLocation(relative[3]);
    const g = nodeGrid(base.node);
    let i = g.i;
    let j = g.j;

    if (direction === "east") i += distance;
    if (direction === "west") i -= distance;
    if (direction === "north") j += distance;
    if (direction === "south") j -= distance;

    if (i < 0 || i >= GRID || j < 0 || j >= GRID) {
      return { error: "That description resolves outside the simulated grid." };
    }

    const node = NODE(i, j);
    return {
      node,
      label: "Resolved location",
      explanation: `${nodeHumanName(node)} · Node N${node}`
    };
  }

  const direct = query.match(/^(at )?(rider|passenger|driver|vehicle|car|pickup|destination)$/);
  if (direct) {
    const base = resolveNamedLocation(direct[2]);
    return {
      node: base.node,
      label: base.label,
      kind: base.kind,
      explanation: `${nodeHumanName(base.node)} · Node N${base.node}`
    };
  }

  return {
    error: "Try “one block east of rider”, “2 blocks north of pickup”, or “nearest intersection to driver”."
  };
}

const selectableTargets = [];
const semanticHoverTargets = [];
const nodeHoverTargets = [];

function markSelectable(object, kind, nodeIndex = null) {
  object.traverse(child => {
    child.userData.locationKind = kind;
    if (nodeIndex !== null) child.userData.nodeIndex = nodeIndex;
  });
  selectableTargets.push(object);
  semanticHoverTargets.push(object);
}

markSelectable(rider, "rider");
markSelectable(vehicle, "driver");
markSelectable(pickupPin, "pickup");
markSelectable(destinationPin, "destination");

for (let index = 0; index < nodePositions.length; index++) {
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 8, 8),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false
    })
  );
  hit.position.copy(nodePositions[index]);
  hit.position.y = 0.28;
  hit.userData.locationKind = "node";
  hit.userData.nodeIndex = index;
  scene.add(hit);
  selectableTargets.push(hit);
  nodeHoverTargets.push(hit);
}

const locationRaycaster = new THREE.Raycaster();
const locationPointer = new THREE.Vector2();
let pointerStart = null;

renderer.domElement.addEventListener("pointerdown", event => {
  pointerStart = { x: event.clientX, y: event.clientY };
});

renderer.domElement.addEventListener("pointerup", event => {
  if (!pointerStart) return;

  const movement = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
  pointerStart = null;
  if (movement > 6) return;

  const rect = renderer.domElement.getBoundingClientRect();
  locationPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  locationPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  locationRaycaster.setFromCamera(locationPointer, camera);

  const hits = locationRaycaster.intersectObjects(selectableTargets, true);
  if (!hits.length) return;

  const object = hits[0].object;
  const kind = object.userData.locationKind;
  const nodeIndex = object.userData.nodeIndex;

  if (kind === "node") {
    selectLocation("node", nodeIndex, nodeHumanName(nodeIndex));
  } else {
    selectLocation(kind);
  }
});

function metadataObject(object) {
  let current = object;
  while (current) {
    if (current.userData?.locationKind || current.userData?.hoverName) return current;
    current = current.parent;
  }
  return object;
}

function hoverInfoFromHit(hit) {
  const object = metadataObject(hit.object);
  const kind = object.userData?.locationKind;

  if (kind) {
    const nodeIndex = kind === "node"
      ? object.userData.nodeIndex
      : nodeForKind(kind);
    const grid = nodeGrid(nodeIndex);
    const p = nodePositions[nodeIndex];
    const name = kind === "node"
      ? nodeHumanName(nodeIndex)
      : labelForKind(kind);

    return {
      name,
      detail: `Node N${nodeIndex} · Grid (${grid.i}, ${grid.j}) · x ${p.x.toFixed(1)}, z ${p.z.toFixed(1)}`
    };
  }

  if (object.userData?.isRoadLabel && object.userData?.hoverName) {
    const p = hit.point;
    return {
      name: object.userData.hoverName,
      detail: `Road label · x ${p.x.toFixed(1)}, z ${p.z.toFixed(1)}`
    };
  }

  return null;
}

function setHoverPointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  locationPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  locationPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  locationRaycaster.setFromCamera(locationPointer, camera);
}

function isInsideGroup(object, group) {
  let current = object;
  while (current) {
    if (current === group) return true;
    current = current.parent;
  }
  return false;
}

renderer.domElement.addEventListener("pointermove", event => {
  if (!ui.hoverTooltip) return;
  setHoverPointer(event);

  // Critical semantic objects are tested first, independent of building occlusion.
  // This lets Rider / Driver / Pickup / Destination remain hoverable through buildings.
  const semanticHit = locationRaycaster.intersectObjects(semanticHoverTargets, true)[0];
  if (semanticHit) {
    const info = hoverInfoFromHit(semanticHit);
    if (info) {
      ui.hoverTooltip.innerHTML = `<strong>${info.name}</strong><span>${info.detail}</span>`;
      ui.hoverTooltip.style.left = `${event.clientX}px`;
      ui.hoverTooltip.style.top = `${event.clientY}px`;
      ui.hoverTooltip.style.display = "block";
      renderer.domElement.style.cursor = "pointer";
      return;
    }
  }

  // For non-critical metadata, buildings still block hover information.
  const secondaryTargets = [
    ...cityGroup.children,
    ...roadLabelGroup.children,
    ...nodeHoverTargets
  ];
  const hits = locationRaycaster.intersectObjects(secondaryTargets, true);

  if (!hits.length) {
    ui.hoverTooltip.style.display = "none";
    renderer.domElement.style.cursor = "";
    return;
  }

  const hit = hits[0];

  if (isInsideGroup(hit.object, cityGroup)) {
    ui.hoverTooltip.style.display = "none";
    renderer.domElement.style.cursor = "";
    return;
  }

  const info = hoverInfoFromHit(hit);
  if (!info) {
    ui.hoverTooltip.style.display = "none";
    renderer.domElement.style.cursor = "";
    return;
  }

  ui.hoverTooltip.innerHTML = `<strong>${info.name}</strong><span>${info.detail}</span>`;
  ui.hoverTooltip.style.left = `${event.clientX}px`;
  ui.hoverTooltip.style.top = `${event.clientY}px`;
  ui.hoverTooltip.style.display = "block";
  renderer.domElement.style.cursor = "pointer";
});

renderer.domElement.addEventListener("pointerleave", () => {
  if (ui.hoverTooltip) ui.hoverTooltip.style.display = "none";
  renderer.domElement.style.cursor = "";
});

if (ui.referenceFrame) {
  ui.referenceFrame.addEventListener("change", updateLocationInspector);
}

if (ui.locationQueryForm) {
  ui.locationQueryForm.addEventListener("submit", event => {
    event.preventDefault();
    const resolved = resolveLocationDescription(ui.locationQuery.value);

    if (resolved.error) {
      ui.locationQueryResult.textContent = resolved.error;
      return;
    }

    if (resolved.kind) {
      selectLocation(resolved.kind, resolved.node, resolved.label);
    } else {
      selectLocation("node", resolved.node, resolved.label);
    }

    ui.locationQueryResult.textContent = resolved.explanation;
  });
}

controls.addEventListener("change", () => {
  updateLocationInspector();
  updateCompass();
});

function routeMapTrafficColor(level) {
  if (level < 1.65) return "#59c982";
  if (level < 2.35) return "#e9b949";
  return "#e56b75";
}

function routeMapPhaseLabel() {
  if (state.route.phase === "to_pickup") return "To pickup";
  if (state.route.phase === "to_destination") return "To destination";
  if (state.route.phase === "trip_preview") return "Trip preview";
  return "No route";
}

function drawRouteMap() {
  if (!ui.routeMap) return;

  const canvas = ui.routeMap;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const pad = 28;
  const scale = Math.min(
    (w - pad * 2) / WORLD_X,
    (h - pad * 2) / WORLD_Z
  );

  const toCanvas = (p) => ({
    x: w / 2 + p.x * scale,
    y: h / 2 + p.z * scale
  });

  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Full street network in the background.
  for (const edge of edges) {
    const a = toCanvas(nodePositions[edge.a]);
    const b = toCanvas(nodePositions[edge.b]);
    const road = roadObjects.get(edge.id);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = "rgba(151, 143, 164, .34)";
    ctx.lineWidth = road?.isAvenue ? 7 : 4;
    ctx.stroke();
  }

  // The selected route is colored segment-by-segment by traffic condition.
  if (state.route.edgeIds.length) {
    for (const id of state.route.edgeIds) {
      const edge = edges.find(e => e.id === id);
      if (!edge) continue;
      const a = toCanvas(nodePositions[edge.a]);
      const b = toCanvas(nodePositions[edge.b]);

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = "rgba(255,255,255,.92)";
      ctx.lineWidth = 17;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = routeMapTrafficColor(state.roadTraffic.get(id));
      ctx.lineWidth = 10;
      ctx.stroke();
    }

    const start = toCanvas(nodePositions[state.route.path[0]]);
    const end = toCanvas(nodePositions[state.route.path[state.route.path.length - 1]]);

    const marker = (point, label, fill) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 11, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
      ctx.fillStyle = "#4d405c";
      ctx.font = "800 10px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, point.x, point.y + .5);
    };

    marker(start, "A", "#d9cdfd");
    marker(end, "B", "#ffd2b1");

    if (state.route.path.includes(state.vehicle.location)) {
      const vehiclePoint = toCanvas(nodePositions[state.vehicle.location]);
      ctx.beginPath();
      ctx.arc(vehiclePoint.x, vehiclePoint.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#ff79b5";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "#8f829c";
    ctx.font = "700 18px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Request a ride to see route traffic", w / 2, h / 2);
  }

  if (ui.routeMapPhase) ui.routeMapPhase.textContent = routeMapPhaseLabel();
}

function meanTraffic() {
  if (!state.route.edgeIds.length) return 0;
  return state.route.edgeIds.reduce((sum, id) => sum + state.roadTraffic.get(id), 0) / state.route.edgeIds.length;
}

function setMessage(text) { ui.message.textContent = text; }

function updateUI() {
  state.trip.status = state.status;
  ui.status.textContent = state.status === "pickup_arrived"
    ? "DRIVER ARRIVED"
    : state.status === "in_progress"
      ? "TO DESTINATION"
      : state.status.replaceAll("_", " ").toUpperCase();
  ui.status.dataset.status = state.status;
  ui.tripId.textContent = state.tripId ?? "—";
  ui.eta.textContent = state.status === "idle" ? "—" : `${state.route.estimatedTravelTime} min`;
  ui.fare.textContent = state.status === "idle" ? "—" : `$${state.trip.fare.toFixed(2)}`;
  ui.distance.textContent = state.status === "idle" ? "—" : `${state.route.distance} m`;
  ui.availability.textContent = state.driver.availability ? "Yes" : "No";
  ui.roadCount.textContent = state.status === "idle" ? "—" : state.route.edgeIds.length;
  ui.traffic.textContent = state.status === "idle" ? "—" : `${meanTraffic().toFixed(1)}×`;

  ui.request.disabled = state.status !== "idle" || !state.driver.availability;
  ui.accept.disabled = state.status !== "requested";
  ui.reject.disabled = state.status !== "requested";
  ui.cancel.disabled = !["requested", "to_pickup", "pickup_arrived"].includes(state.status);
  ui.start.disabled = state.status !== "pickup_arrived";
  ui.move.disabled = !["to_pickup", "in_progress"].includes(state.status) || Boolean(tween);
  ui.reroute.disabled = !["requested", "to_pickup", "pickup_arrived", "in_progress"].includes(state.status) || Boolean(tween);

  if (routeLine) routeLine.visible = state.status !== "idle";
  drawRouteMap();
  updateLocationInspector();
}

function requestTrip() {
  if (state.status !== "idle" || !state.driver.availability) return;
  state.status = "requested";
  state.tripId = `UBR-${Math.floor(1000 + Math.random() * 9000)}`;
  state.driver.availability = false;
  buildActiveRoute(state.pickup.coordinates, state.destination.coordinates, "trip_preview", true);
  setMessage("Trip requested. The route shown is the rider's trip preview. The driver may accept or reject.");
  updateUI();
}

function acceptTrip() {
  if (state.status !== "requested") return;
  state.status = "to_pickup";
  buildActiveRoute(state.vehicle.location, state.pickup.coordinates, "to_pickup", false);
  setVehicleAtNode(state.vehicle.location, state.route.path[1] ?? null);
  setMessage("Driver accepted. Move the vehicle along the blue route to pick up the rider.");
  updateUI();
}

function rejectTrip() {
  if (state.status !== "requested") return;
  state.status = "rejected";
  state.driver.availability = true;
  setMessage("Driver rejected the trip. Reset to demonstrate another request.");
  updateUI();
}

function cancelTrip() {
  if (!["requested", "to_pickup", "pickup_arrived"].includes(state.status)) return;
  state.status = "cancelled";
  state.driver.availability = true;
  setMessage("The rider cancelled the trip before departure.");
  updateUI();
}

function arriveAtPickup() {
  state.status = "pickup_arrived";
  setVehicleAtNode(state.pickup.coordinates);
  buildActiveRoute(state.pickup.coordinates, state.destination.coordinates, "to_destination", true);
  setMessage("Driver reached the pickup location. Start Trip is now available.");
  updateUI();
}

function startTrip() {
  if (state.status !== "pickup_arrived") return;
  state.status = "in_progress";
  state.movementIndex = 0;
  setVehicleAtNode(state.route.path[0], state.route.path[1] ?? null);
  rider.visible = false;
  setMessage("Passenger is onboard. Move the vehicle along the green route to the destination.");
  updateUI();
}

let tween = null;

function moveVehicle() {
  if (!["to_pickup", "in_progress"].includes(state.status) || tween) return;

  if (state.movementIndex >= state.route.path.length - 1) {
    if (state.status === "to_pickup") arriveAtPickup();
    else completeTrip();
    return;
  }

  const fromIndex = state.route.path[state.movementIndex];
  const toIndex = state.route.path[state.movementIndex + 1];
  const from = nodePositions[fromIndex].clone();
  const to = nodePositions[toIndex].clone();
  orientVehicle(from, to);

  const start = performance.now();
  const duration = 470;
  tween = { from, to, start, duration, toIndex };
  updateUI();
}

function updateTween(now) {
  if (!tween) return;
  const t = Math.min(1, (now - tween.start) / tween.duration);
  const eased = t * t * (3 - 2 * t);
  vehicle.position.lerpVectors(tween.from, tween.to, eased);
  vehicle.position.y = 0.06;

  if (t >= 1) {
    state.movementIndex += 1;
    state.vehicle.location = tween.toIndex;
    state.driver.location = tween.toIndex;
    tween = null;

    if (state.movementIndex >= state.route.path.length - 1) {
      if (state.status === "to_pickup") arriveAtPickup();
      else completeTrip();
    } else {
      const next = state.route.path[state.movementIndex + 1];
      orientVehicle(nodePositions[state.vehicle.location], nodePositions[next]);
      const leg = state.status === "to_pickup" ? "pickup" : "destination";
      setMessage(`Vehicle moved toward the ${leg}: road node ${state.movementIndex + 1} of ${state.route.path.length}.`);
      updateUI();
    }
  }
}

function completeTrip() {
  state.status = "completed";
  state.driver.availability = true;
  state.vehicle.location = state.destination.coordinates;
  state.driver.location = state.destination.coordinates;
  setVehicleAtNode(state.destination.coordinates);
  setMessage("Vehicle reached the destination. Trip completed.");
  updateUI();
}

function randomizeTraffic() {
  for (const edge of edges) {
    state.roadTraffic.set(edge.id, 1 + Math.random() * 2);
  }
  updateRoadAppearance();
  if (state.status !== "idle") {
    setMessage("Road traffic changed. Recalculate the route to respond to traffic conditions.");
  } else {
    setMessage("Traffic conditions changed across the road network.");
  }
  updateUI();
}

function recalculateRoute() {
  if (!["requested", "to_pickup", "pickup_arrived", "in_progress"].includes(state.status)) return;

  if (state.status === "requested") {
    buildActiveRoute(state.pickup.coordinates, state.destination.coordinates, "trip_preview", true);
  } else if (state.status === "to_pickup") {
    buildActiveRoute(state.vehicle.location, state.pickup.coordinates, "to_pickup", false);
  } else {
    buildActiveRoute(state.vehicle.location, state.destination.coordinates, "to_destination", true);
  }

  setVehicleAtNode(state.vehicle.location, state.route.path[1] ?? null);
  setMessage("Route recalculated from the vehicle's current position using current traffic levels.");
  updateUI();
}

function resetSimulation() {
  tween = null;
  state.status = "idle";
  state.tripId = null;
  state.driver.availability = true;
  state.trip = { status: "idle", estimatedTime: 0, fare: 0, distance: 0 };
  const previousPickup = state.pickup.coordinates;
  state.destination.coordinates = DESTINATION_NODE;
  state.pickup.coordinates = randomPickupNode(previousPickup);
  state.rider.location = state.pickup.coordinates;
  state.rider.destination = state.destination.coordinates;
  state.route = { phase: "none", path: [], edgeIds: [], distance: 0, estimatedTravelTime: 0 };
  state.movementIndex = 0;
  selectedLocation = { kind: "rider", nodeIndex: state.rider.location, label: "Rider" };

  const newDriverNode = randomDriverNode();
  state.driver.location = newDriverNode;
  state.vehicle.location = newDriverNode;

  rider.visible = true;
  rider.position.copy(nodePositions[state.rider.location]).add(new THREE.Vector3(0.42, 0.36, 0.35));
  pickupPin.position.copy(nodePositions[state.pickup.coordinates]);
  destinationPin.position.copy(nodePositions[state.destination.coordinates]);
  setVehicleAtNode(newDriverNode);

  if (routeLine) routeLine.visible = false;
  updateRoadAppearance();
  setMessage("Rider pickup and driver starting positions have both been randomized. Request a trip to begin.");
  updateUI();
}

ui.request.addEventListener("click", requestTrip);
ui.accept.addEventListener("click", acceptTrip);
ui.reject.addEventListener("click", rejectTrip);
ui.cancel.addEventListener("click", cancelTrip);
ui.start.addEventListener("click", startTrip);
ui.move.addEventListener("click", moveVehicle);
ui.trafficBtn.addEventListener("click", randomizeTraffic);
ui.reroute.addEventListener("click", recalculateRoute);
ui.reset.addEventListener("click", resetSimulation);

window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  updateLocationInspector();
});

function animate(now) {
  requestAnimationFrame(animate);
  updateTween(now);
  controls.update();
  updateCompass();
  updateGhostVisibility();
  renderer.render(scene, camera);
}
resetSimulation();
updateCompass();
requestAnimationFrame(animate);
