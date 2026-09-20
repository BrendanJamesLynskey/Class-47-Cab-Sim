// cab.js — the inside of the locomotive's cab, built from simple boxes: the cream
// walls, the windscreen frame, the dark desk and everything on it.
//
// The cab is one group of shapes. main.js puts it on the track and the camera inside
// it. Every frame, update() moves the needles and levers to match the train.
//
// Measurements are in metres. The origin is on the rail, directly under the driver's
// eyes. +X is to the right, +Y is up, and the train faces -Z (into the screen).

import * as THREE from "three";
import * as C from "./config.js";
import { makeDial, setDial, makeLever, makeLamp, setLamp, makeLabel } from "./cab-parts.js";

export const EYE_POSITION = new THREE.Vector3(-0.45, 2.75, 0); // the driver sits on the left

const lambertCache = new Map();
const lambert = (hex) => {
  if (!lambertCache.has(hex)) lambertCache.set(hex, new THREE.MeshLambertMaterial({ color: hex }));
  return lambertCache.get(hex);
};

// A box from (x0, y0, z0) to (x1, y1, z1), added to `parent`.
function box(parent, x0, y0, z0, x1, y1, z1, hex) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), lambert(hex));
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  parent.add(mesh);
  return mesh;
}

// Where the desk's top surface starts (near the driver) and ends (far, by the windscreen).
const DESK_NEAR = { z: -0.5, y: 2.3 };
const DESK_FAR = { z: -0.95, y: 2.55 };
const DESK_TILT = Math.atan2(DESK_FAR.y - DESK_NEAR.y, DESK_NEAR.z - DESK_FAR.z);
const DESK_LENGTH = Math.hypot(DESK_FAR.y - DESK_NEAR.y, DESK_NEAR.z - DESK_FAR.z);

// A point on the desk's surface: x across, `along` metres from its middle toward the windscreen.
function deskPoint(x, along) {
  return new THREE.Vector3(
    x,
    (DESK_NEAR.y + DESK_FAR.y) / 2 + along * Math.sin(DESK_TILT),
    (DESK_NEAR.z + DESK_FAR.z) / 2 - along * Math.cos(DESK_TILT)
  );
}

// The dash: everything under the desk and in front of the driver, as one solid shape.
function buildDash(cab) {
  const shape = new THREE.Shape();
  // Drawn side-on: x is "how far forward" (-z), y is height.
  shape.moveTo(-DESK_NEAR.z, 1.5);
  shape.lineTo(1.3, 1.5);
  shape.lineTo(1.3, DESK_FAR.y + 0.02);
  shape.lineTo(-DESK_FAR.z, DESK_FAR.y);
  shape.lineTo(-DESK_NEAR.z, DESK_NEAR.y);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 2.6, bevelEnabled: false });
  geometry.translate(0, 0, -1.3);
  geometry.rotateY(Math.PI / 2); // extrude along X, and shape-x becomes -Z
  cab.add(new THREE.Mesh(geometry, lambert(C.CAB_DESK_COLOR)));
}

function buildShell(cab) {
  const cream = C.CAB_SHELL_COLOR, dark = C.CAB_FRAME_COLOR;
  box(cab, -1.3, 1.45, -1.3, 1.3, 1.55, 1.7, C.CAB_FLOOR_COLOR);   // floor
  box(cab, -1.4, 3.7, -1.35, 1.4, 3.8, 1.75, cream);               // roof
  box(cab, -1.3, 1.55, 1.6, 1.3, 3.7, 1.7, cream);                 // back wall

  // Right wall, plain.
  box(cab, 1.3, 1.55, -1.3, 1.4, 3.7, 1.7, cream);
  // Left wall, with a side window (the opening is z -0.7 to 0.3, height 2.4 to 3.2).
  box(cab, -1.4, 1.55, -1.3, -1.3, 3.7, -0.7, cream);
  box(cab, -1.4, 1.55, 0.3, -1.3, 3.7, 1.7, cream);
  box(cab, -1.4, 1.55, -0.7, -1.3, 2.4, 0.3, cream);
  box(cab, -1.4, 3.2, -0.7, -1.3, 3.7, 0.3, cream);
  // Its frame.
  box(cab, -1.33, 2.37, -0.73, -1.28, 2.43, 0.33, dark);
  box(cab, -1.33, 3.17, -0.73, -1.28, 3.23, 0.33, dark);
  box(cab, -1.33, 2.4, -0.73, -1.28, 3.2, -0.67, dark);
  box(cab, -1.33, 2.4, 0.27, -1.28, 3.2, 0.33, dark);

  // Above the windscreen, a roof lip, a sun visor over the driver's half and a lamp.
  box(cab, -1.4, 3.5, -1.35, 1.4, 3.75, -1.15, cream);
  box(cab, -1.25, 3.36, -1.15, 0.1, 3.5, -0.98, "#33363a");
  box(cab, -0.1, 3.66, 0.1, 0.1, 3.7, 0.3, "#fff4c8");
  // The windscreen frame: two side pillars and a centre pillar (the glass is simply not drawn).
  box(cab, -1.3, 2.5, -1.22, -1.22, 3.52, -1.14, dark);
  box(cab, 1.22, 2.5, -1.22, 1.3, 3.52, -1.14, dark);
  box(cab, 0.14, 2.5, -1.22, 0.23, 3.52, -1.14, dark);
}

// The front of the locomotive, just visible beyond the windscreen, with its two headlamps.
function buildNose(cab) {
  box(cab, -0.95, 2.0, -2.5, 0.95, 2.52, -1.15, C.LOCO_COLOR);
  box(cab, -0.95, 2.4, -2.52, 0.95, 2.55, -2.35, "#e2c531"); // a yellow warning panel at the very front
  const lamps = [-0.6, 0.6].map((x) => {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: "#555555" }));
    lamp.position.set(x, 2.58, -2.3);
    cab.add(lamp);
    return lamp;
  });
  return lamps;
}

function buildWipers(cab) {
  const wipers = [-0.8, 0.55].map((x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 2.545, -1.1); // just below the sill, so parked wipers are hidden
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.014, 0.01), lambert("#101010"));
    arm.position.x = 0.31; // hangs off the pivot toward the right
    pivot.add(arm);
    cab.add(pivot);
    return pivot;
  });
  return wipers;
}

export function createCab() {
  const cab = new THREE.Group();
  buildShell(cab);
  buildDash(cab);
  const headlamps = buildNose(cab);
  const wipers = buildWipers(cab);

  // ---- The desk: instruments are laid out on a panel lying on the desk's surface ----
  const panel = new THREE.Group();
  panel.position.copy(deskPoint(0, 0));
  panel.rotation.x = -Math.PI / 2 + DESK_TILT; // so its Z axis points up out of the desk toward the driver
  cab.add(panel);
  const place = (object, x, along, z = 0) => { object.position.set(x, along, z); panel.add(object); return object; };

  // What you can see of the desk from the driver's seat is only about 0.8 m either side
  // of his eyes (x = -0.45), so everything is packed into that.
  const speedometer = place(makeDial({ radius_m: 0.11, title: "SPEED", unit: "MPH", min: 0, max: 100, majorStep: 10, minorStep: 5, redFrom: 90 }), -0.45, 0.14);
  const brakePipe = place(makeDial({ radius_m: 0.05, title: "PIPE", unit: "PSI", min: 0, max: 100, majorStep: 20, minorStep: 10 }), -0.83, 0.18);
  const brakeCylinder = place(makeDial({ radius_m: 0.05, title: "CYL", unit: "PSI", min: 0, max: 100, majorStep: 20, minorStep: 10 }), -0.71, 0.18);
  const ammeter = place(makeDial({ radius_m: 0.06, title: "AMPS", unit: "x100", min: 0, max: 10, majorStep: 2, minorStep: 1 }), -0.2, 0.18);

  // The warning lamps, in a row at the far left.
  const powerCutLamp = place(makeLamp(0.022, "#ffb020"), -1.15, 0.27);
  const brakeLamp = place(makeLamp(0.022, "#ff3030"), -1.05, 0.27);
  const hornLamp = place(makeLamp(0.022, "#5ad0ff"), -0.95, 0.27);
  place(makeLabel("POWER CUT", 0.095, 0.024), -1.15, 0.235);
  place(makeLabel("BRAKES", 0.095, 0.024), -1.05, 0.235);
  place(makeLabel("HORN", 0.095, 0.024), -0.95, 0.235);

  // ---- The levers stand upright on the desk (not tilted with it) ----
  const leverAt = (x, along, knobColor, label) => {
    const holder = new THREE.Group();
    holder.position.copy(deskPoint(x, along));
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.02, 14), lambert("#1a1c1e"));
    base.position.y = 0.01;
    const lever = makeLever(knobColor);
    holder.add(base, lever);
    cab.add(holder);
    place(makeLabel(label, 0.16, 0.03), x, along - 0.06);
    return lever;
  };
  const brakeLever = leverAt(-1.02, -0.07, "#d22a2a", "BRAKE");
  const powerLever = leverAt(-0.05, -0.05, "#e8e8e8", "POWER");
  const reverserLever = leverAt(0.13, -0.05, "#e8c22a", "R  N  F");

  // ---- Every frame: make the instruments say what the train is doing ----
  let wiperPhase = 0, wiperAngle = 0, reverserShown = 0;

  function update(view, dt) {
    setDial(speedometer, view.speed_mph);
    setDial(brakePipe, view.brakePipe_psi);
    setDial(brakeCylinder, view.brakeCylinder_psi);
    setDial(ammeter, view.tractionFraction * 10);

    // The levers tilt as they move: power forward = pushed away from you.
    powerLever.rotation.x = 0.5 - view.throttle * 1.0;
    brakeLever.rotation.x = -0.5 + view.brakeHandle * 1.0;
    reverserShown += (view.reverser - reverserShown) * Math.min(1, dt * 12);
    reverserLever.rotation.x = -0.5 * reverserShown;

    setLamp(powerCutLamp, view.powerCut);
    setLamp(brakeLamp, view.brakeCylinder_psi > 4);
    setLamp(hornLamp, view.horn);

    // Wipers sweep up and back while on, and settle flat when off.
    if (view.wipers) wiperPhase += dt * 2.2;
    const target = view.wipers ? 0.5 - 0.5 * Math.cos(wiperPhase * Math.PI * 2) : 0;
    wiperAngle += (target * 1.7 - wiperAngle) * Math.min(1, dt * 14);
    for (const wiper of wipers) wiper.rotation.z = wiperAngle;

    // Headlamps: 0 = off, 1 = dipped, 2 = full beam.
    const glow = ["#555555", "#ffe9a0", "#ffffff"][view.headlights];
    for (const lamp of headlamps) lamp.material.color.set(glow);
  }

  return { group: cab, update };
}
