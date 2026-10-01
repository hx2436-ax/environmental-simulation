import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.164.1/examples/jsm/controls/OrbitControls.js?module";

const container = document.querySelector("#scene");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090c12);
scene.fog = new THREE.Fog(0x090c12, 26, 70);

const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 120);
camera.position.set(15, 19, 19);

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
controls.maxDistance = 48;

scene.add(new THREE.HemisphereLight(0xb9d6ff, 0x151619, 2.5));
const sun = new THREE.DirectionalLight(0xffffff, 2.1);
sun.position.set(9, 19, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const WORLD = 24;
const GRID = 6;
const STEP = WORLD / (GRID - 1);
const ROAD_Y = 0.055;
const NODE = (i, j) => j * GRID + i;

const state = {
  status: "idle",
  tripId: null,
  rider: { location: NODE(1, 1), destination: NODE(4, 4) },
  driver: { location: NODE(0, 5), availability: true },
  vehicle: { location: NODE(0, 5), capacity: 4 },
  trip: { status: "idle", estimatedTime: 0, fare: 0 },
  pickup: { coordinates: NODE(1, 1) },
  destination: { coordinates: NODE(4, 4) },
  route: { path: [], edgeIds: [], distance: 0, estimatedTravelTime: 0 },
  roadTraffic: new Map(),
  movementIndex: 0
};

const nodePositions = [];
for (let j = 0; j < GRID; j++) {
  for (let i = 0; i < GRID; i++) {
    nodePositions.push(new THREE.Vector3(
      -WORLD / 2 + i * STEP,
      ROAD_Y,
      -WORLD / 2 + j * STEP
    ));
  }
}

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({ color: 0x10151d, roughness: 0.97 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const cityGroup = new THREE.Group();
scene.add(cityGroup);

function addBuilding(x, z, w, d, h) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: 0x171e29, roughness: 0.88, metalness: 0.05 })
  );
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  cityGroup.add(mesh);
}

for (let j = 0; j < GRID - 1; j++) {
  for (let i = 0; i < GRID - 1; i++) {
    const cx = -WORLD / 2 + (i + 0.5) * STEP;
    const cz = -WORLD / 2 + (j + 0.5) * STEP;
    const h = 0.8 + ((i * 13 + j * 7) % 7) * 0.7;
    addBuilding(cx, cz, STEP * 0.56, STEP * 0.56, h);
  }
}

const roadMaterial = new THREE.LineBasicMaterial({ color: 0x536071, transparent: true, opacity: 0.9 });
const roadObjects = new Map();
const edges = [];
const adjacency = Array.from({ length: GRID * GRID }, () => []);

function edgeId(a, b) { return a < b ? `${a}-${b}` : `${b}-${a}`; }

function addRoad(a, b) {
  const id = edgeId(a, b);
  const geometry = new THREE.BufferGeometry().setFromPoints([nodePositions[a], nodePositions[b]]);
  const line = new THREE.Line(geometry, roadMaterial.clone());
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

function updateRoadAppearance() {
  for (const [id, line] of roadObjects) {
    line.material.color.copy(trafficColor(state.roadTraffic.get(id)));
    line.material.opacity = 0.55;
  }
  for (const id of state.route.edgeIds) {
    const line = roadObjects.get(id);
    if (line) line.material.opacity = 0.9;
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

function rebuildRoute() {
  const result = dijkstra(state.pickup.coordinates, state.destination.coordinates);
  state.route.path = result.path;
  state.route.edgeIds = result.edgeIds;

  let distance = 0;
  let weighted = 0;
  for (const id of result.edgeIds) {
    const edge = edges.find(e => e.id === id);
    distance += edge.distance;
    weighted += edge.distance * state.roadTraffic.get(id);
  }
  state.route.distance = Math.round(distance);
  state.route.estimatedTravelTime = Math.max(2, Math.round(weighted / 240));
  state.trip.estimatedTime = state.route.estimatedTravelTime;
  state.trip.fare = +(4.2 + distance * 0.0029 + state.trip.estimatedTime * 0.48).toFixed(2);

  if (routeLine) scene.remove(routeLine);
  const points = result.path.map(index => nodePositions[index].clone().setY(0.12));
  routeLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: 0x7bf6ff })
  );
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
  ui.status.textContent = state.status.replace("_", " ").toUpperCase();
  ui.status.dataset.status = state.status;
  ui.tripId.textContent = state.tripId ?? "—";
  ui.eta.textContent = state.status === "idle" ? "—" : `${state.trip.estimatedTime} min`;
  ui.fare.textContent = state.status === "idle" ? "—" : `$${state.trip.fare.toFixed(2)}`;
  ui.distance.textContent = state.status === "idle" ? "—" : `${state.route.distance} m`;
  ui.availability.textContent = state.driver.availability ? "Yes" : "No";
  ui.roadCount.textContent = state.status === "idle" ? "—" : state.route.edgeIds.length;
  ui.traffic.textContent = state.status === "idle" ? "—" : `${meanTraffic().toFixed(1)}×`;

  ui.request.disabled = state.status !== "idle" || !state.driver.availability;
  ui.accept.disabled = state.status !== "requested";
  ui.reject.disabled = state.status !== "requested";
  ui.cancel.disabled = !["requested", "accepted"].includes(state.status);
  ui.start.disabled = state.status !== "accepted";
  ui.move.disabled = state.status !== "in_progress";
  ui.reroute.disabled = !["requested", "accepted", "in_progress"].includes(state.status);

  if (routeLine) routeLine.visible = state.status !== "idle";
}

function requestTrip() {
  if (state.status !== "idle" || !state.driver.availability) return;
  state.status = "requested";
  state.tripId = `UBR-${Math.floor(1000 + Math.random() * 9000)}`;
  state.driver.availability = false;
  rebuildRoute();
  setMessage("Trip requested. The rider is waiting for a driver response.");
  updateUI();
}

function acceptTrip() {
  if (state.status !== "requested") return;
  state.status = "accepted";
  state.movementIndex = 0;
  setVehicleAtNode(state.pickup.coordinates, state.route.path[1] ?? null);
  setMessage("Driver accepted the trip and is at the pickup location.");
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
  if (!["requested", "accepted"].includes(state.status)) return;
  state.status = "cancelled";
  state.driver.availability = true;
  setMessage("The rider cancelled the trip before it started.");
  updateUI();
}

function startTrip() {
  if (state.status !== "accepted") return;
  state.status = "in_progress";
  state.movementIndex = 0;
  setVehicleAtNode(state.route.path[0], state.route.path[1] ?? null);
  rider.visible = false;
  setMessage("Trip started. Move the vehicle along the active route.");
  updateUI();
}

let tween = null;

function moveVehicle() {
  if (state.status !== "in_progress" || tween) return;

  if (state.movementIndex >= state.route.path.length - 1) {
    completeTrip();
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
  ui.move.disabled = true;
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
      completeTrip();
    } else {
      const next = state.route.path[state.movementIndex + 1];
      orientVehicle(nodePositions[state.vehicle.location], nodePositions[next]);
      updateUI();
      setMessage(`Vehicle moved to road node ${state.movementIndex + 1} of ${state.route.path.length}.`);
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
  if (!["requested", "accepted", "in_progress"].includes(state.status)) return;

  const start = state.status === "in_progress" ? state.vehicle.location : state.pickup.coordinates;
  const originalPickup = state.pickup.coordinates;
  state.pickup.coordinates = start;
  rebuildRoute();
  state.pickup.coordinates = originalPickup;
  state.movementIndex = 0;

  if (state.status === "in_progress") {
    state.route.path[0] = state.vehicle.location;
  }
  setMessage("Route recalculated using current traffic levels.");
  updateUI();
}

function resetSimulation() {
  tween = null;
  state.status = "idle";
  state.tripId = null;
  state.driver.location = NODE(0, 5);
  state.driver.availability = true;
  state.vehicle.location = NODE(0, 5);
  state.trip = { status: "idle", estimatedTime: 0, fare: 0 };
  state.pickup.coordinates = NODE(1, 1);
  state.destination.coordinates = NODE(4, 4);
  state.rider.location = state.pickup.coordinates;
  state.rider.destination = state.destination.coordinates;
  state.route = { path: [], edgeIds: [], distance: 0, estimatedTravelTime: 0 };
  state.movementIndex = 0;
  rider.visible = true;
  rider.position.copy(nodePositions[state.rider.location]).add(new THREE.Vector3(0.42, 0.36, 0.35));
  setVehicleAtNode(state.vehicle.location);
  if (routeLine) routeLine.visible = false;
  updateRoadAppearance();
  setMessage("Rider and driver are ready. Request a trip to begin.");
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
});

function animate(now) {
  requestAnimationFrame(animate);
  updateTween(now);
  controls.update();
  renderer.render(scene, camera);
}
rebuildRoute();
resetSimulation();
requestAnimationFrame(animate);
