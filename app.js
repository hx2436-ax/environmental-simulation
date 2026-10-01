import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.164.1/examples/jsm/controls/OrbitControls.js?module";
import { Line2 } from "https://unpkg.com/three@0.164.1/examples/jsm/lines/Line2.js?module";
import { LineMaterial } from "https://unpkg.com/three@0.164.1/examples/jsm/lines/LineMaterial.js?module";
import { LineGeometry } from "https://unpkg.com/three@0.164.1/examples/jsm/lines/LineGeometry.js?module";

const container = document.querySelector("#scene");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090c12);
scene.fog = new THREE.Fog(0x090c12, 34, 92);

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

scene.add(new THREE.HemisphereLight(0xb9d6ff, 0x151619, 2.5));
const sun = new THREE.DirectionalLight(0xffffff, 2.1);
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
  new THREE.MeshStandardMaterial({ color: 0x10151d, roughness: 0.97 })
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
  new THREE.MeshStandardMaterial({ color: 0x4a3028, roughness: 0.93, metalness: 0.02 }),
  new THREE.MeshStandardMaterial({ color: 0x6a5c4f, roughness: 0.90, metalness: 0.02 }),
  new THREE.MeshStandardMaterial({ color: 0x827d73, roughness: 0.88, metalness: 0.03 }),
  new THREE.MeshStandardMaterial({ color: 0x252b33, roughness: 0.48, metalness: 0.28 }),
  new THREE.MeshStandardMaterial({ color: 0x343b43, roughness: 0.58, metalness: 0.18 })
];

const roofMaterial = new THREE.MeshStandardMaterial({
  color: 0x32343a,
  roughness: 0.92,
  metalness: 0.08
});

const tankMaterial = new THREE.MeshStandardMaterial({
  color: 0x6f604f,
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
    const podiumH = Math.max(2.2, Math.min(baseHeight * 0.34, 4.4));
    addBoxMass(x, 0, z, w, podiumH, d, material);

    const setbackX = w * (0.15 + hash01(seed, 10, 61) * 0.10);
    const setbackZ = d * (0.13 + hash01(seed, 11, 62) * 0.10);
    const towerW = Math.max(0.34, w - setbackX * 2);
    const towerD = Math.max(0.34, d - setbackZ * 2);
    const towerH = Math.max(4.5, baseHeight - podiumH);
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

    if (towerH > 8 && hash01(seed, 14, 65) > 0.42) {
      const crownH = 0.7 + hash01(seed, 15, 66) * 1.4;
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

  const streetwallH = Math.max(1.4, baseHeight);
  addBoxMass(x, 0, z, w, streetwallH, d, material);

  if (streetwallH > 4.5 && hash01(seed, 18, 69) > 0.48) {
    const upperH = 1.0 + hash01(seed, 19, 70) * 2.4;
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

        let height = 1.5 + hash01(i * 7 + lot, j * 11 + row, 33) * 3.8;
        if (cornerLot) height += 1.3 + hash01(i, j + lot, 34) * 2.4;
        if (midtownBand) height += 0.8 + hash01(lot, i + j, 35) * 2.0;

        const towerChance =
          (cornerLot ? 0.23 : 0.06) +
          (midtownBand ? 0.12 : 0);

        const isTower = hash01(i * 19 + lot, j * 23 + row, 36) < towerChance;
        if (isTower) {
          height += 5.5 + hash01(i + lot, j + row, 37) * 8.5;
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

function edgeId(a, b) { return a < b ? `${a}-${b}` : `${b}-${a}`; }

function makeWideLine(points, color, width, opacity = 1) {
  const geometry = new LineGeometry();
  const positions = [];
  for (const p of points) {
    positions.push(p.x, p.y, p.z);
  }
  geometry.setPositions(positions);

  const material = new LineMaterial({
    color,
    linewidth: width,
    transparent: opacity < 1,
    opacity,
    depthTest: true,
    depthWrite: false
  });
  material.resolution.set(innerWidth, innerHeight);

  const line = new Line2(geometry, material);
  line.computeLineDistances();
  return line;
}

function addRoad(a, b) {
  const id = edgeId(a, b);
  const line = makeWideLine(
    [nodePositions[a], nodePositions[b]],
    0x536071,
    2.8,
    0.58
  );
  scene.add(line);
  roadObjects.set(id, line);

  const distance = nodePositions[a].distanceTo(nodePositions[b]) * 115;
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
  return new THREE.Color().setHSL(0.34 * (1 - t), 0.72, 0.52);
}

function trafficWidth(level) {
  const t = THREE.MathUtils.clamp((level - 1) / 2, 0, 1);
  return THREE.MathUtils.lerp(2.6, 8.5, t);
}

function updateRoadAppearance() {
  for (const [id, line] of roadObjects) {
    const level = state.roadTraffic.get(id);
    line.material.color.copy(trafficColor(level));
    line.material.linewidth = trafficWidth(level);
    line.material.opacity = 0.62;
    line.material.transparent = true;
    line.material.needsUpdate = true;
  }

  for (const id of state.route.edgeIds) {
    const line = roadObjects.get(id);
    if (line) {
      const level = state.roadTraffic.get(id);
      line.material.linewidth = trafficWidth(level) + 1.4;
      line.material.opacity = 0.92;
      line.material.needsUpdate = true;
    }
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
    routeLine.geometry.dispose();
    routeLine.material.dispose();
  }
  const points = result.path.map(index => nodePositions[index].clone().setY(0.12));
  routeLine = makeWideLine(points, routeColor(phase), 6.5, 0.96);
  routeLine.visible = state.status !== "idle";
  scene.add(routeLine);

  updateRoadAppearance();
  updateUI();
}

function makePin(color, height = 1.25) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, height, 10),
    new THREE.MeshBasicMaterial({ color })
  );
  stem.position.y = height / 2;
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 20, 20),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.32 })
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
  new THREE.SphereGeometry(0.32, 24, 24),
  new THREE.MeshStandardMaterial({ color: 0xff4f9a, emissive: 0xff4f9a, emissiveIntensity: 0.25 })
);
rider.castShadow = true;
rider.position.copy(nodePositions[state.rider.location]).add(new THREE.Vector3(0.42, 0.36, 0.35));
scene.add(rider);

const vehicle = new THREE.Group();
const carBody = new THREE.Mesh(
  new THREE.BoxGeometry(1.15, 0.42, 0.68),
  new THREE.MeshStandardMaterial({ color: 0xf0f3f8, metalness: 0.2, roughness: 0.45 })
);
carBody.position.y = 0.31;
carBody.castShadow = true;
vehicle.add(carBody);
const cabin = new THREE.Mesh(
  new THREE.BoxGeometry(0.58, 0.3, 0.58),
  new THREE.MeshStandardMaterial({ color: 0x243347, metalness: 0.15, roughness: 0.3 })
);
cabin.position.set(-0.08, 0.66, 0);
vehicle.add(cabin);

const driverMarker = new THREE.Mesh(
  new THREE.SphereGeometry(0.13, 16, 16),
  new THREE.MeshStandardMaterial({ color: 0x4cb7ff, emissive: 0x4cb7ff, emissiveIntensity: 0.55 })
);
driverMarker.position.set(0, 0.94, 0);
vehicle.add(driverMarker);
vehicle.position.copy(nodePositions[state.vehicle.location]);
scene.add(vehicle);

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

  for (const [, line] of roadObjects) {
    line.material.resolution.set(innerWidth, innerHeight);
  }
  if (routeLine) {
    routeLine.material.resolution.set(innerWidth, innerHeight);
  }
});

function animate(now) {
  requestAnimationFrame(animate);
  updateTween(now);
  controls.update();
  renderer.render(scene, camera);
}
resetSimulation();
requestAnimationFrame(animate);
