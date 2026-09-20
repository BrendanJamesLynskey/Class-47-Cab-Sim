// cab-layout.js — where everything is in the cab. All in metres.
//
// The origin is on the rail, directly under the driver's eyes. +X is to the right, +Y is
// up, and the train faces -Z (into the screen). The driver sits on the left, so his eyes
// are at x = -0.45. Real Class 47 cabs (Brush Type 4) are the model: a dark gauge board
// across the back of the desk, the train brake valve on the left, the power controller in
// a box just right of the driver, and a small horn lever at the far left.

import * as THREE from "three";

export const EYE_POSITION = new THREE.Vector3(-0.45, 2.75, 0);

export const FLOOR_Y = 1.55;
export const CEILING_Y = 3.7;
export const HALF_WIDTH = 1.3;   // the cab is 2.6 m wide inside
export const FRONT_Z = -1.3;
export const BACK_Z = 1.7;

// The flat top of the desk slopes up gently away from the driver: its near edge (toward
// the driver) to its far edge (where the gauge board starts).
export const DESK_NEAR = { y: 2.3, z: -0.45 };
export const DESK_FAR = { y: 2.4, z: -0.85 };
// The gauge board rises steeply from the far edge of the desk, facing the driver.
export const BOARD_BOTTOM = { y: 2.4, z: -0.85 };
export const BOARD_TOP = { y: 2.62, z: -1.02 };
export const SILL_Y = BOARD_TOP.y;        // the bottom of the windscreen
export const WINDSCREEN_Z = -1.15;
export const WINDSCREEN_TOP_Y = 3.5;

// How high the top of the desk is at a given z.
export const deskHeightAt = (z) => DESK_NEAR.y + ((DESK_NEAR.z - z) * (DESK_FAR.y - DESK_NEAR.y)) / (DESK_NEAR.z - DESK_FAR.z);

// The controls. (x, z) is where each stands on the desk.
export const BRAKE_VALVE = { x: -1.0, z: -0.6 };
export const POWER_CONTROLLER = { x: -0.12, z: -0.62 };
export const REVERSER = { x: 0.2, z: -0.62 };
export const HORN_LEVER = { x: -0.77, z: -0.6 };

// The dials on the gauge board (x across the cab, r = radius).
export const GAUGES = {
  mainReservoir: { x: -1.09, r: 0.062 },
  brakeCylinder: { x: -0.945, r: 0.062 },
  brakePipe: { x: -0.8, r: 0.062 },
  speedometer: { x: -0.45, r: 0.11 },
  placard: { x: -0.13, w: 0.17, h: 0.1 },
  ammeter: { x: 0.075, r: 0.085 },
  trainHeat: { x: 0.255, r: 0.062 },
};
export const LAMPS = [
  { name: "POWER CUT", x: 0.39, color: "#ffb020" },
  { name: "BRAKES", x: 0.47, color: "#ff3030" },
  { name: "HORN", x: 0.55, color: "#5ad0ff" },
];
export const LAMP_Y = 0.045; // how far up the board the lamps sit
