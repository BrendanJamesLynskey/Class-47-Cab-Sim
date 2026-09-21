// cab.js — the inside of the locomotive's cab, modelled on a real Class 47: cream walls
// with blue panels low down, a windscreen with a sun blind over each half, a side window
// and a door on each side, and the driver's desk with its gauge board and levers.
//
// The cab is one group of shapes. main.js puts it on the track and the camera inside it.
// Every frame, update() moves the needles and levers to match the train.
//
// The two big handles (the train brake and the power controller) swing round on the desk
// like the real ones: you PULL them BACK toward you in a curve to apply brake or power.
//
// Measurements are in metres. See cab-layout.js for where everything is.

import * as THREE from "three";
import * as C from "./config.js";
import { MeshBuilder, colour, BLOB, CYLINDER } from "./world/mesh-builder.js";
import { buildCabShell, shellMaterial } from "./cab-shell.js";
import { paintGaugeBoard, paintDeskTop, BOARD_WIDTH_M, DIAL_SPECS } from "./cab-panels.js";
import { makeNeedle, setNeedle, makeLamp, setLamp, makeSlopedPanel } from "./cab-parts.js";
import * as L from "./cab-layout.js";
import { PRESET } from "./world/sky.js";

export { EYE_POSITION } from "./cab-layout.js";

const degrees = (d) => (d * Math.PI) / 180;

// How far each handle swings. The angle is measured round the handle's pivot, from "pointing
// straight ahead" (positive = anticlockwise seen from above), so bigger angles pull the handle
// round and back toward the driver.
// Looking down on the desk: the brake handle turns CLOCKWISE as you pull it toward full brake,
// and the power handle turns ANTICLOCKWISE as you pull it toward full power. Both end up
// pulled back toward the driver, the brake on his left and the power on his right.
const BRAKE_ARC = { released: degrees(-20), full: degrees(-150) };
const POWER_ARC = { off: degrees(20), full: degrees(132) };

// A lever arm: a metal bar with a black ball on the end, pivoting at its base, pointing
// along -Z (forward) and rising a little. Turn it with rotation.y to swing it round.
function makeHandle(length_m, knobRadius_m) {
  const B = new MeshBuilder();
  const lift = 0.2;
  const dy = Math.sin(lift) * length_m, dz = -Math.cos(lift) * length_m;
  B.addShape(CYLINDER, 0, 0.012, 0, 0.055, 0.03, 0.055, 0, 0, colour("#5c6166"));
  B.addBox(0, 0.03 + dy / 2, dz / 2, 0.022, 0.022, length_m, 0, colour("#aeb3b9"), 1, lift);
  B.addShape(BLOB, 0, 0.03 + dy, dz, knobRadius_m, knobRadius_m * 0.95, knobRadius_m, 0.3, 0, colour("#17181a"));
  B.addBox(0, 0.03 + dy * 0.62, dz * 0.62, 0.04, 0.03, 0.03, 0, colour("#d8b024"), 1, lift); // a coloured grip band so you can tell them apart
  return new THREE.Mesh(B.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
}

// A short upright lever with a ball on top (the reverser and the horn lever).
function makeStick(length_m, knobRadius_m, knobColor) {
  const B = new MeshBuilder();
  B.addBox(0, length_m / 2, 0, 0.016, length_m, 0.016, 0, colour("#aeb3b9"));
  B.addShape(BLOB, 0, length_m + knobRadius_m * 0.5, 0, knobRadius_m, knobRadius_m, knobRadius_m, 0.2, 0, colour(knobColor));
  return new THREE.Mesh(B.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
}

const at = (object, x, y, z) => { object.position.set(x, y, z); return object; };

export function createCab() {
  const cab = new THREE.Group();

  // ---- The parts that never move ----
  cab.add(new THREE.Mesh(buildCabShell(), shellMaterial(PRESET.cabGlow)));

  // The desk top (painted plates and labels) and the gauge board, each lying on its slope.
  const deskTop = makeSlopedPanel(L.DESK_NEAR, L.DESK_FAR, BOARD_WIDTH_M, paintDeskTop());
  deskTop.position.y += 0.002; deskTop.position.z += 0.001;
  cab.add(deskTop);
  const board = makeSlopedPanel(L.BOARD_BOTTOM, L.BOARD_TOP, BOARD_WIDTH_M, paintGaugeBoard());
  board.translateZ(0.002);
  cab.add(board);

  // ---- Needles and lamps, on the board (local x is across the cab, y is up the board) ----
  const needles = {};
  for (const name of Object.keys(DIAL_SPECS)) {
    needles[name] = makeNeedle(L.GAUGES[name].r);
    at(needles[name], L.GAUGES[name].x, 0, 0);
    board.add(needles[name]);
  }
  const lamps = {};
  for (const lamp of L.LAMPS) {
    lamps[lamp.name] = at(makeLamp(0.017, lamp.color), lamp.x, L.LAMP_Y, 0.003);
    board.add(lamps[lamp.name]);
  }

  // ---- Levers ----
  const brakeHandle = makeHandle(0.19, 0.03);
  at(brakeHandle, L.BRAKE_VALVE.x, L.deskHeightAt(L.BRAKE_VALVE.z) + 0.118, L.BRAKE_VALVE.z);
  const powerHandle = makeHandle(0.22, 0.032);
  at(powerHandle, L.POWER_CONTROLLER.x, L.deskHeightAt(-0.5) + 0.107, L.POWER_CONTROLLER.z);
  const reverser = makeStick(0.085, 0.02, "#e8c22a");
  at(reverser, L.REVERSER.x, L.deskHeightAt(-0.56) + 0.07, L.REVERSER.z);
  const hornLever = makeStick(0.12, 0.024, "#17181a");
  at(hornLever, L.HORN_LEVER.x, L.deskHeightAt(L.HORN_LEVER.z) + 0.06, L.HORN_LEVER.z);
  cab.add(brakeHandle, powerHandle, reverser, hornLever);

  // The two switches that really work: TAIL LIGHT and MARKER LIGHT. Lever forward = on.
  const switches = {};
  for (const sw of L.SWITCHES.filter((item) => item.state)) {
    const { x, z } = L.switchPosition(sw);
    const B = new MeshBuilder();
    B.addShape(CYLINDER, 0, 0.006, 0, 0.024, 0.012, 0.024, 0, 0, colour("#6a6f76"));
    B.addBox(0, 0.03, 0, 0.008, 0.036, 0.008, 0, colour("#e8eaee"));
    const lever = new THREE.Mesh(B.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    lever.position.set(x, L.deskHeightAt(z), z);
    cab.add(lever);
    switches[sw.state] = lever;
  }

  // ---- Windscreen wipers: they hang from the top of the screen and swing side to side ----
  const wipers = [{ x: -0.7, park: 1.15, sign: -1 }, { x: 0.72, park: -1.15, sign: 1 }].map((spec) => {
    const pivot = new THREE.Group();
    pivot.position.set(spec.x, L.WINDSCREEN_TOP_Y - 0.03, L.WINDSCREEN_Z + 0.04);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.66, 0.01), new THREE.MeshLambertMaterial({ color: "#101112" }));
    arm.position.y = -0.33;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.42, 0.012), new THREE.MeshLambertMaterial({ color: "#050505" }));
    blade.position.y = -0.44;
    pivot.add(arm, blade);
    pivot.rotation.z = spec.park;
    cab.add(pivot);
    return { pivot, ...spec };
  });

  // ---- Headlight beams: a spotlight shining down the track from the front of the loco ----
  let headlamp = null;
  if (C.HEADLIGHT_BEAMS) {
    headlamp = new THREE.SpotLight("#fff2d0", 0, C.HEADLIGHT_RANGE_M, 0.3, 0.6, 1);
    headlamp.position.set(0, 2.5, -3.0);
    headlamp.target.position.set(0, -0.5, -70);
    cab.add(headlamp, headlamp.target);
  }

  // ---- Every frame: make the instruments say what the train is doing ----
  let wiperPhase = 0, wiperAmount = 0;
  const shown = { reverser: 0, hornRoll: 0, hornPitch: 0, headlights: 0 };

  function update(view, dt) {
    const blend = (rate) => Math.min(1, dt * rate);

    setNeedle(needles.speedometer, view.speed_mph, 0, 100);
    setNeedle(needles.brakePipe, view.brakePipe_psi, 0, 100);
    setNeedle(needles.brakeCylinder, view.brakeCylinder_psi, 0, 100);
    setNeedle(needles.ammeter, view.tractionFraction * 10, 0, 10);

    // The big handles swing round (a curve) toward the driver as you pull them.
    brakeHandle.rotation.y = BRAKE_ARC.released + view.brakeHandle * (BRAKE_ARC.full - BRAKE_ARC.released);
    powerHandle.rotation.y = POWER_ARC.off + view.throttle * (POWER_ARC.full - POWER_ARC.off);
    shown.reverser += (view.reverser - shown.reverser) * blend(12);
    reverser.rotation.x = -0.6 * shown.reverser; // forward tips it away from you

    // The horn lever springs: left = low note, right = high note, both together = pulled toward you.
    const rollTarget = (view.horn.high && !view.horn.low ? -0.5 : 0) + (view.horn.low && !view.horn.high ? 0.5 : 0);
    const pitchTarget = view.horn.high && view.horn.low ? 0.5 : 0;
    shown.hornRoll += (rollTarget - shown.hornRoll) * blend(30);
    shown.hornPitch += (pitchTarget - shown.hornPitch) * blend(30);
    hornLever.rotation.z = shown.hornRoll;
    hornLever.rotation.x = shown.hornPitch;

    // The working switches: lever forward when on.
    switches.tailLights.rotation.x = view.tailLights ? -0.55 : 0.55;
    switches.markerLights.rotation.x = view.headlights > 0 ? -0.55 : 0.55;

    setLamp(lamps["POWER CUT"], view.powerCut);
    setLamp(lamps["BRAKES"], view.brakeCylinder_psi > 4);
    setLamp(lamps["HORN"], view.horn.high || view.horn.low);

    // Wipers sweep across and back while on, and settle to their parked spot when off.
    if (view.wipers) wiperPhase += dt * 2.0;
    wiperAmount += ((view.wipers ? 0.5 - 0.5 * Math.cos(wiperPhase * Math.PI * 2) : 0) - wiperAmount) * blend(14);
    for (const w of wipers) w.pivot.rotation.z = w.park + w.sign * 1.4 * wiperAmount; // swings from its parked spot, across the glass

    // Headlights: 0 = off, 1 = dipped, 2 = full beam. The beam eases up and down a little.
    if (headlamp) {
      const target = view.headlights === 2 ? C.HEADLIGHT_FULL : view.headlights === 1 ? C.HEADLIGHT_DIPPED : 0;
      shown.headlights += (target - shown.headlights) * blend(10);
      headlamp.intensity = shown.headlights;
      const full = view.headlights === 2;
      headlamp.angle += ((full ? 0.24 : 0.34) - headlamp.angle) * blend(6);
      headlamp.target.position.z += ((full ? -110 : -45) - headlamp.target.position.z) * blend(6);
    }
  }

  // (for the tests) how the switch panel is laid out
  const cols = new Set(L.SWITCHES.map((sw) => sw.col)).size, rows = new Set(L.SWITCHES.map((sw) => sw.row)).size;
  const bottomLeft = L.SWITCHES.find((sw) => sw.row === "near" && sw.col === 0).name;

  return { group: cab, update, layout: { cols, rows, bottomLeft }, parts: { brakeHandle, powerHandle, reverser, hornLever, wipers, headlamp, needles, switches } };
}
