// main.js — starts the game and runs it. Every frame it:
//   1. reads the gamepad and keyboard,
//   2. moves the train forward in small fixed steps (src/physics.js),
//   3. puts the cab and camera where the train is,
//   4. builds new bits of world ahead and drops old bits behind,
//   5. draws the picture and the little display on top.
//
// There are four "screens": start, drive, paused and finished.

import * as THREE from "three";
import * as C from "./config.js";
import { ROUTE, routeInMetres, speedLimitAt } from "./route.js";
import { buildPath } from "./path.js";
import { makeTrainParams, makeTrain, updateHandles, stepTrain, gaugeReadings, FIXED_STEP_S } from "./physics.js";
import { mpsToMph, metresToMiles } from "./units.js";
import { createControls } from "./controls.js";
import { createCab, EYE_POSITION } from "./cab.js";
import { createWorld } from "./world/chunks.js";
import { createSky } from "./world/sky.js";
import { createHud } from "./hud.js";
import { createDebugReadout } from "./debug.js";
import { createAdaptiveResolution } from "./adaptive.js";
import { createAudio, auditHorn } from "./audio.js";
import { createPico } from "./pico.js";
import { makeScoreTracker, updateScoreTracker, totalScore } from "./scoring.js";

const quality = C.QUALITY_SETTINGS[C.QUALITY] || C.QUALITY_SETTINGS.medium;
const MAX_FRAME_S = 0.25;      // a long pause (like switching tabs) must not make the train jump
const MAX_STEPS_PER_FRAME = 30;
const BUFFER_STOP_GAP_M = 1.5; // a hard safety stop just short of the buffers, so you can't run
                                // through them — but the REAL stopping point is the marker
                                // (src/scoring.js): brake early and this should barely matter.
const REVERSE_LIMIT_M = 30;    // and can only reverse back this far along the line (the buffers at the start station)
const HINT_SECONDS = 3;
const degrees = (d) => (d * Math.PI) / 180;

// ---- The 3D world ----
const canvas = document.getElementById("game");
// antialias is off on purpose: the Raspberry Pi has to work hard enough already.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(C.CAMERA_FOV_DEG, 16 / 9, 0.05, 2400);
camera.rotation.order = "YXZ"; // turn your head left/right first, then up/down

const route = routeInMetres(ROUTE);
const path = buildPath(route);
const sky = createSky(scene, quality);
const world = createWorld(scene, path, route, quality);

// The cab sits on the track; the camera sits in the driver's seat inside it.
const cab = createCab();
const cabRoot = new THREE.Group();
cabRoot.rotation.order = "YXZ";
cabRoot.add(cab.group, camera);
camera.position.copy(EYE_POSITION);
scene.add(cabRoot);

// ---- The screen size (and how sharp the picture is) ----
const params = new URLSearchParams(location.search);
const adaptive = createAdaptiveResolution(quality.resolutionScale);
if (params.has("fixed")) adaptive.enabled = false; // ?fixed turns off the automatic sharpness (used by tests)
let pictureWidth = 0, pictureHeight = 0;

function applyPictureSize() {
  const aspect = window.innerWidth / window.innerHeight;
  pictureHeight = Math.round(C.RENDER_HEIGHT_PX * adaptive.scale);
  pictureWidth = Math.round(pictureHeight * aspect);
  renderer.setSize(pictureWidth, pictureHeight, false); // false: the page stretches it, we don't
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", applyPictureSize);
applyPictureSize();

// ---- Controls, display, and the state of the game ----
const controls = createControls();
const audio = createAudio();
const pico = createPico(); // the horn light, if a Pico is plugged in (src/pico.js)
const hud = createHud();
const debug = createDebugReadout();
hud.setEnabled(C.SHOW_HUD);

let screen = "start"; // "start" | "drive" | "paused" | "finished"
let train = makeTrain(makeTrainParams());
train.distance_m = route.start_m;
let leftoverSeconds = 0;  // time not yet used up by whole physics steps
let runSeconds = 0;
let physicsSeconds = 0;   // how much time the physics has really simulated (the tests use this)
let hintText = "";
let hintTimer = 0;
let headlights = 0;       // 0 off, 1 dipped, 2 full
let wipersOn = false;
let tailLights = false;   // the tail light switch (nothing you can see from the cab, but the switch moves)
let look = { yaw: 0, pitch: 0 };
let swayClock = 0;
let scoreTracker = makeScoreTracker(route); // one entry per station after the first (see src/scoring.js)

function startRun() {
  train = makeTrain(makeTrainParams());
  train.distance_m = route.start_m; // standing at the first platform
  leftoverSeconds = 0;
  runSeconds = 0;
  hintText = "";
  hintTimer = 0;
  scoreTracker = makeScoreTracker(route);
  world.prime(route.start_m);
  screen = "drive";
}

// ---- What each screen says ----
function startScreen() {
  const pad = {
    none: { padMessage: "No gamepad found. Press any button on it. (Or use the keyboard.)", padClass: "bad" },
    "wrong-mode": { padMessage: "Gamepad found, but it's in the wrong mode. Flip the switch on the back to X.", padClass: "bad" },
    ready: { padMessage: "Gamepad ready!", padClass: "" },
  }[controls.padStatus];
  return {
    title: C.GAME_TITLE,
    lines: [
      `Railtour, locomotive ${C.LOCO_NUMBER}`,
      "RT more power  ·  RB less power  ·  LT more brake  ·  LB less brake",
      "D-pad up/down: reverser  ·  D-pad left/right or A: horn  ·  Back: emergency brake",
    ],
    ...pad,
    prompt: controls.padStatus === "ready" ? "Press A to start" : "Press A (or Enter) to start",
  };
}
const pausedScreen = { title: "Paused", lines: [], prompt: "Press Start to carry on" };
function finishedScreen() {
  const minutes = Math.floor(runSeconds / 60), seconds = Math.floor(runSeconds % 60);
  const lines = [`You drove ${ROUTE.lengthMiles} miles in ${minutes} min ${seconds} s.`];
  for (const station of scoreTracker.stations) {
    lines.push(
      station.scored
        ? `${station.name}: ${station.label} — ${station.distance_m.toFixed(1)} m from the marker (${station.points} pts)`
        : `${station.name}: you didn't stop there`
    );
  }
  lines.push(`Total: ${totalScore(scoreTracker)} points`);
  return { title: "Results", lines, prompt: "Press A to drive again" };
}

// ---- Each frame while driving ----
function driveFrame(seconds) {
  if (controls.headlightsPressed) headlights = (headlights + 1) % 3;
  if (controls.wipersPressed) wipersOn = !wipersOn;
  if (controls.tailLightsPressed) tailLights = !tailLights;

  // Buttons that go down for one moment are used straight away (a fast display might skip the physics step).
  updateHandles(train, { throttleUp: 0, throttleDown: 0, brakeUp: 0, brakeDown: 0, emergencyPressed: controls.emergencyPressed, reverserStep: controls.reverserStep }, 0);

  // Held buttons move the levers in small fixed steps, so the game feels the same at any frame rate.
  const held = {
    throttleUp: controls.throttleUp, throttleDown: controls.throttleDown,
    brakeUp: controls.brakeUp, brakeDown: controls.brakeDown,
    emergencyPressed: false, reverserStep: 0,
  };
  leftoverSeconds += Math.min(seconds, MAX_FRAME_S);
  let steps = 0;
  while (leftoverSeconds >= FIXED_STEP_S && steps < MAX_STEPS_PER_FRAME) {
    updateHandles(train, held, FIXED_STEP_S);
    stepTrain(train, path.pathAt(train.distance_m).slope, FIXED_STEP_S);
    leftoverSeconds -= FIXED_STEP_S;
    physicsSeconds += FIXED_STEP_S;
    steps++;
  }
  if (steps === MAX_STEPS_PER_FRAME) leftoverSeconds = 0; // we fell behind: drop the extra time
  runSeconds += seconds;

  // The ends of the line: the start (backwards) and a hard safety stop just short of the
  // buffers, so a driver who forgets to brake can't run through them.
  if (train.distance_m < REVERSE_LIMIT_M) { train.distance_m = REVERSE_LIMIT_M; train.speed_mps = 0; }
  if (train.distance_m >= route.length_m - BUFFER_STOP_GAP_M) {
    train.distance_m = route.length_m - BUFFER_STOP_GAP_M;
    train.speed_mps = 0;
  }

  // Stopping (speed exactly 0) near an un-scored station's marker scores it (src/scoring.js).
  // The journey ends once the LAST station on the route has been scored — however the driver
  // got there, careful braking or the safety stop above.
  const scored = updateScoreTracker(scoreTracker, train.distance_m, train.speed_mps);
  if (scored) {
    hintText = `${scored.label} stop at ${scored.name}! (${scored.points} pts)`;
    hintTimer = HINT_SECONDS;
    if (scored === scoreTracker.stations[scoreTracker.stations.length - 1]) screen = "finished";
  }

  // Friendly hints when the driver tries to add power but nothing will happen.
  if (controls.throttleUp > 0 && train.reverser === 0) { hintText = "Reverser to Forward (D-pad up)"; hintTimer = HINT_SECONDS; }
  else if (controls.throttleUp > 0 && train.powerCutOut) { hintText = "Power is cut while the brake is on. Let it off with LB"; hintTimer = HINT_SECONDS; }
  hintTimer -= seconds;
  if (hintTimer <= 0) hintText = "";
}

// ---- Putting the cab and camera where the train is ----
const pose = {};
const cameraWorld = new THREE.Vector3();

function updateView(seconds) {
  const p = path.pathAt(train.distance_m, pose);
  swayClock += seconds;
  const sway = C.CAB_SWAY_M * Math.min(1, train.speed_mps / 20);
  cabRoot.position.set(p.x, p.y + Math.sin(swayClock * 21) * sway, p.z);
  // The track leans into bends (p.roll), so the whole cab leans with it.
  cabRoot.rotation.set(Math.atan(p.slope), -p.heading, -p.roll + Math.sin(swayClock * 6.3) * sway * 0.6);

  // Looking around: the head follows the stick smoothly and springs back to the middle.
  if (controls.recentrePressed) look = { yaw: 0, pitch: 0 };
  const stick = controls.look;
  const targetYaw = -stick.x * degrees(C.LOOK_YAW_MAX_DEG);
  const targetPitch = -stick.y * degrees(stick.y > 0 ? C.LOOK_PITCH_DOWN_DEG : C.LOOK_PITCH_UP_DEG);
  const follow = 1 - Math.exp(-C.LOOK_SMOOTHING * seconds);
  look.yaw += (targetYaw - look.yaw) * follow;
  look.pitch += (targetPitch - look.pitch) * follow;
  camera.rotation.set(look.pitch + degrees(C.CAMERA_DEFAULT_PITCH_DEG), look.yaw, 0);

  const gauges = gaugeReadings(train);
  // The horn only sounds while you are driving (not on the start screen or when paused).
  const horn = { low: screen === "drive" && controls.hornLow, high: screen === "drive" && controls.hornHigh };
  audio.setHorn(horn.low, horn.high);
  pico.setHorn(horn.low || horn.high);
  cab.update({
    speed_mph: mpsToMph(train.speed_mps),
    brakePipe_psi: gauges.brakePipe_psi,
    brakeCylinder_psi: gauges.brakeCylinder_psi,
    tractionFraction: gauges.tractionFraction,
    throttle: train.throttle,
    brakeHandle: train.brakeHandle,
    reverser: train.reverser,
    powerCut: train.powerCutOut,
    horn,
    wipers: wipersOn,
    tailLights,
    headlights,
  }, seconds);

  camera.getWorldPosition(cameraWorld);
  sky.update(cameraWorld, p.y);
}

// "At Aldbury" while the train is beside a platform, otherwise how far to the next station.
function nextStationText() {
  const d = train.distance_m;
  for (const st of route.stations) {
    if (Math.abs(d - st.at) < st.platformLength_m / 2) return `At ${st.name}`;
  }
  const next = route.stations.find((st) => st.at - st.platformLength_m / 2 > d);
  return next ? `Next: ${next.name}, ${metresToMiles(next.at - d).toFixed(1)} miles` : "";
}

function updateHud() {
  const speed_mph = mpsToMph(train.speed_mps);
  const limit_mph = speedLimitAt(route, train.distance_m);
  hud.update({
    speed_mph, limit_mph,
    speeding: speed_mph > limit_mph + C.SPEEDING_MARGIN_MPH,
    throttle: train.throttle, brakeHandle: train.brakeHandle, reverser: train.reverser,
    distance_miles: metresToMiles(train.distance_m), length_miles: ROUTE.lengthMiles,
    next: nextStationText(),
    hint: hintText,
    status: train.emergency ? "EMERGENCY BRAKE" : "",
  });
}

// ---- The main loop ----
let lastTime = performance.now();
function frame(now) {
  const seconds = Math.min((now - lastTime) / 1000, MAX_FRAME_S);
  lastTime = now;

  controls.update();
  if (controls.toggleHudPressed) hud.toggle();

  // Which screen are we on, and does a button change it?
  let justChanged = false;
  if (screen === "start" || screen === "finished") {
    if (controls.startPressed) { startRun(); justChanged = true; }
  } else if (screen === "drive" && controls.pausePressed) {
    screen = "paused";
  } else if (screen === "paused" && (controls.pausePressed || controls.startPressed)) {
    screen = "drive";
    justChanged = true;
  }

  if (screen === "drive" && !justChanged) driveFrame(seconds);
  else if (screen === "drive") leftoverSeconds = 0;

  updateView(seconds);
  world.update(train.distance_m);
  updateHud();
  hud.setBehindOverlay(screen === "start");
  hud.setSoundHint(audio.needsUnlock);
  hud.showOverlay(
    screen === "start" ? startScreen() : screen === "paused" ? pausedScreen : screen === "finished" ? finishedScreen() : null
  );

  const newScale = adaptive.frame(seconds);
  if (newScale !== null) applyPictureSize();

  renderer.render(scene, camera);

  debug.update(seconds, {
    averageMs: adaptive.averageMs,
    calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
    width: pictureWidth, height: pictureHeight, scale: adaptive.scale, baseHeight: C.RENDER_HEIGHT_PX,
    chunks: world.chunkCount, quality: C.QUALITY, distance_m: train.distance_m,
    pad: `pad: ${controls.padStatus}`,
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Pause if you switch to another tab.
document.addEventListener("visibilitychange", () => {
  if (document.hidden && screen === "drive") screen = "paused";
});

// Only in "npm run dev": lets the automatic tests look inside the game.
if (import.meta.env.DEV) {
  window.__sim = {
    THREE, renderer, scene, camera, world, cab, controls, path, route,
    get train() { return train; },
    get screen() { return screen; },
    get physicsSeconds() { return physicsSeconds; },
    get look() { return look; },
    get adaptive() { return adaptive; },
    get headlights() { return headlights; },
    get wipersOn() { return wipersOn; },
    get scoreTracker() { return scoreTracker; },
    get totalScore() { return totalScore(scoreTracker); },
    audio, auditHorn, pico,
    setHeadlights(mode) { headlights = mode; },
    // Jump to a spot on the line (and build the world around it).
    teleport(distance_m) { train.distance_m = distance_m; world.prime(distance_m); },
    setReverser(value) { train.reverser = value; if (value) train.direction = value; },
    setSpeedMph(mph) { train.speed_mps = mph * 0.44704; },
    start() { startRun(); },
  };
}
