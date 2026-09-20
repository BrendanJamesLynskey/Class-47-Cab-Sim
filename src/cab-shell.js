// cab-shell.js — the parts of the cab that never move: walls with windows and doors,
// the roof, the windscreen frame and sun blinds, the desk, the housings the levers
// stand in, and the seats. All glued into one mesh (see world/mesh-builder.js).

import * as THREE from "three";
import * as C from "./config.js";
import { MeshBuilder, colour, CYLINDER, CONE } from "./world/mesh-builder.js";
import * as L from "./cab-layout.js";

const CREAM = C.CAB_SHELL_COLOR;
const DADO = C.CAB_DADO_COLOR;
const DARK = C.CAB_FRAME_COLOR;
const METAL = "#b8bcc2";
const DADO_TOP_Y = 2.3;       // the blue panels reach this high on the walls
const WALL_THICKNESS = 0.1;

// The wall of the cab is cut into columns so windows can be holes. `open` is a hole in that column.
const WALL_COLUMNS = [
  { z0: L.FRONT_Z, z1: -0.7 },
  { z0: -0.7, z1: 0.3, open: { y0: 2.4, y1: 3.25 } },     // the side window, beside the driver
  { z0: 0.3, z1: 0.55 },
  { z0: 0.55, z1: 1.25, open: { y0: 2.6, y1: 3.3 } },     // the little window in the door
  { z0: 1.25, z1: L.BACK_Z },
];
const DOOR = { z0: 0.42, z1: 1.44, y0: 1.6, y1: 3.5 };    // the cab door, behind the side window

export function buildCabShell() {
  const B = new MeshBuilder();
  const solid = (x0, y0, z0, x1, y1, z1, hex, brightness = 1) =>
    B.addSolid((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 0, colour(hex), brightness);
  // A slab on the inside face of a side wall: `depth` metres thick, proud of the wall.
  const slab = (side, depth, y0, y1, z0, z1, hex, brightness = 1) => {
    const face = side * L.HALF_WIDTH;
    solid(face, y0, z0, face - side * depth, y1, z1, hex, brightness);
  };

  // ---- Floor, roof, back wall ----
  solid(-L.HALF_WIDTH, L.FLOOR_Y - 0.1, L.FRONT_Z, L.HALF_WIDTH, L.FLOOR_Y, L.BACK_Z, C.CAB_FLOOR_COLOR);
  for (const x of [-0.9, -0.3, 0.3, 0.9]) solid(x - 0.01, L.FLOOR_Y, -1.0, x + 0.01, L.FLOOR_Y + 0.004, 1.5, "#565a5e"); // grooves in the floor plate
  solid(-1.4, L.CEILING_Y, L.FRONT_Z - 0.05, 1.4, L.CEILING_Y + 0.1, L.BACK_Z + 0.05, CREAM, 0.95);
  solid(-L.HALF_WIDTH, L.FLOOR_Y, L.BACK_Z - 0.1, L.HALF_WIDTH, L.CEILING_Y, L.BACK_Z, CREAM, 0.92);
  solid(-0.1, L.CEILING_Y - 0.03, 0.1, 0.1, L.CEILING_Y, 0.3, "#fff4c8", 1.6);              // the cab light
  solid(-0.6, L.CEILING_Y - 0.05, -0.5, 0.6, L.CEILING_Y, -0.35, "#c9c5b3");                // a ventilation grille

  // ---- The two side walls ----
  for (const side of [-1, 1]) {
    const outer = side * (L.HALF_WIDTH + WALL_THICKNESS), inner = side * L.HALF_WIDTH;
    for (const col of WALL_COLUMNS) {
      solid(outer, L.FLOOR_Y, col.z0, inner, DADO_TOP_Y, col.z1, DADO, 0.95);
      if (!col.open) {
        solid(outer, DADO_TOP_Y, col.z0, inner, L.CEILING_Y, col.z1, CREAM);
      } else {
        solid(outer, DADO_TOP_Y, col.z0, inner, col.open.y0, col.z1, CREAM);
        solid(outer, col.open.y1, col.z0, inner, L.CEILING_Y, col.z1, CREAM);
        // A dark frame around the hole.
        const f = 0.045;
        slab(side, 0.02, col.open.y0 - f, col.open.y0, col.z0 - f, col.z1 + f, DARK);
        slab(side, 0.02, col.open.y1, col.open.y1 + f, col.z0 - f, col.z1 + f, DARK);
        slab(side, 0.02, col.open.y0, col.open.y1, col.z0 - f, col.z0, DARK);
        slab(side, 0.02, col.open.y0, col.open.y1, col.z1, col.z1 + f, DARK);
      }
    }
    // A shelf under the side window, and its sliding catch.
    slab(side, 0.06, 2.4, 2.43, -0.7, 0.3, "#c9c5b3");
    slab(side, 0.05, 2.75, 2.8, 0.25, 0.3, METAL);
    slab(side, 0.05, 2.62, 2.8, -0.72, -0.7, METAL);

    // ---- The cab door: seams round its edge, a handle, a lock and hinges ----
    const s = 0.028;
    slab(side, 0.015, DOOR.y0, DOOR.y1, DOOR.z0, DOOR.z0 + s, DARK);
    slab(side, 0.015, DOOR.y0, DOOR.y1, DOOR.z1 - s, DOOR.z1, DARK);
    slab(side, 0.015, DOOR.y0, DOOR.y0 + s, DOOR.z0, DOOR.z1, DARK);
    slab(side, 0.015, DOOR.y1 - s, DOOR.y1, DOOR.z0, DOOR.z1, DARK);
    slab(side, 0.012, DADO_TOP_Y, DADO_TOP_Y + 0.025, DOOR.z0, DOOR.z1, "#2b4a5e"); // a strip where the blue meets the cream
    slab(side, 0.07, 2.42, 2.46, 1.14, 1.36, METAL);       // the door handle
    slab(side, 0.05, 2.38, 2.50, 1.34, 1.38, METAL);
    slab(side, 0.05, 2.38, 2.50, 1.14, 1.18, METAL);
    slab(side, 0.03, 2.28, 2.36, 1.3, 1.38, "#20262a");    // the lock
    slab(side, 0.03, 3.0, 3.06, 0.44, 0.58, "#8e939a");     // hinge straps
    slab(side, 0.03, 2.0, 2.06, 0.44, 0.58, "#8e939a");
    slab(side, 0.03, 1.72, 2.2, 0.44, 0.47, "#3a3e44");
    // Grab handle on the wall beside the door.
    slab(side, 0.09, 1.7, 3.2, 1.5, 1.53, METAL, 0.9);
    slab(side, 0.09, 1.7, 1.74, 1.47, 1.53, METAL);
    slab(side, 0.09, 3.16, 3.2, 1.47, 1.53, METAL);
  }

  // ---- The windscreen: frame, pillars, header and sun blinds ----
  const top = L.WINDSCREEN_TOP_Y;
  solid(-1.4, top, L.FRONT_Z - 0.05, 1.4, L.CEILING_Y + 0.05, L.WINDSCREEN_Z + 0.02, CREAM);                     // the header
  solid(-1.3, L.SILL_Y - 0.05, L.WINDSCREEN_Z - 0.1, -1.2, top, L.WINDSCREEN_Z + 0.02, DARK);                    // left pillar
  solid(1.2, L.SILL_Y - 0.05, L.WINDSCREEN_Z - 0.1, 1.3, top, L.WINDSCREEN_Z + 0.02, DARK);                      // right pillar
  solid(0.12, L.SILL_Y - 0.05, L.WINDSCREEN_Z - 0.1, 0.26, top, L.WINDSCREEN_Z + 0.03, DARK);                    // the pillar in the middle
  solid(-1.3, top - 0.05, L.WINDSCREEN_Z - 0.1, 1.3, top, L.WINDSCREEN_Z + 0.02, DARK);                          // a dark strip under the header
  // Each windscreen has a roller blind, half pulled down: a tube, the cloth and a bar along its bottom edge.
  for (const [x0, x1] of [[-1.2, 0.12], [0.26, 1.2]]) {
    solid(x0, top - 0.07, L.WINDSCREEN_Z + 0.0, x1, top, L.WINDSCREEN_Z + 0.09, "#202225");   // the roller
    solid(x0 + 0.01, top - 0.2, L.WINDSCREEN_Z + 0.03, x1 - 0.01, top - 0.07, L.WINDSCREEN_Z + 0.05, "#5b5648"); // the cloth
    solid(x0 + 0.01, top - 0.23, L.WINDSCREEN_Z + 0.02, x1 - 0.01, top - 0.2, L.WINDSCREEN_Z + 0.06, "#1d1f22");  // the bar at the bottom
  }
  // The heater fan, in the corner of the roof on the left.
  solid(-1.28, 3.2, -1.0, -1.2, 3.46, -0.75, "#2b2e33");
  solid(-1.22, 3.24, -0.97, -1.19, 3.42, -0.78, "#7d8288");

  // ---- The desk: blue panels below, a dark top, a lip of cream ----
  const desk = colour(C.CAB_DESK_COLOR), blue = colour(DADO), cream = colour(CREAM), dark = colour(DARK);
  const P = (x, y, z) => [x, y, z];
  const W = L.HALF_WIDTH;
  B.addQuadFacing(P(-W, L.DESK_NEAR.y, L.DESK_NEAR.z), P(W, L.DESK_NEAR.y, L.DESK_NEAR.z), P(W, L.DESK_FAR.y, L.DESK_FAR.z), P(-W, L.DESK_FAR.y, L.DESK_FAR.z), desk, 1, [0, 1, 0]);
  B.addQuadFacing(P(-W, L.FLOOR_Y, L.DESK_NEAR.z), P(W, L.FLOOR_Y, L.DESK_NEAR.z), P(W, L.DESK_NEAR.y, L.DESK_NEAR.z), P(-W, L.DESK_NEAR.y, L.DESK_NEAR.z), blue, 0.9, [0, 0, 1]);
  solid(-W, L.DESK_NEAR.y - 0.035, L.DESK_NEAR.z - 0.03, W, L.DESK_NEAR.y, L.DESK_NEAR.z + 0.01, CREAM, 0.95);         // the cream edge along the front
  for (const x of [-0.65, 0.0, 0.65]) solid(x - 0.006, L.FLOOR_Y + 0.05, L.DESK_NEAR.z + 0.0, x + 0.006, L.DESK_NEAR.y - 0.05, L.DESK_NEAR.z + 0.012, "#2b4a5e"); // panel seams
  solid(-0.45 - 0.22, L.FLOOR_Y, L.DESK_NEAR.z, -0.45 + 0.22, L.FLOOR_Y + 0.12, L.DESK_NEAR.z + 0.16, "#2f3338");  // a foot rest under the desk
  // The board's back edge, its top (a dark ledge under the windscreen) and the dash in front of the glass.
  B.addQuadFacing(P(-W, L.BOARD_TOP.y, L.BOARD_TOP.z), P(W, L.BOARD_TOP.y, L.BOARD_TOP.z), P(W, L.SILL_Y, L.WINDSCREEN_Z), P(-W, L.SILL_Y, L.WINDSCREEN_Z), desk, 1, [0, 1, 0]);
  B.addQuadFacing(P(-W, L.SILL_Y - 0.4, L.WINDSCREEN_Z), P(W, L.SILL_Y - 0.4, L.WINDSCREEN_Z), P(W, L.SILL_Y, L.WINDSCREEN_Z), P(-W, L.SILL_Y, L.WINDSCREEN_Z), dark, 1, [0, 0, 1]);
  B.addQuadFacing(P(-W, L.BOARD_BOTTOM.y, L.BOARD_BOTTOM.z), P(-W, L.BOARD_TOP.y, L.BOARD_TOP.z), P(-W, L.SILL_Y, L.WINDSCREEN_Z), P(-W, L.BOARD_BOTTOM.y, L.WINDSCREEN_Z), desk, 0.8, [1, 0, 0]);
  B.addQuadFacing(P(W, L.BOARD_BOTTOM.y, L.BOARD_BOTTOM.z), P(W, L.BOARD_TOP.y, L.BOARD_TOP.z), P(W, L.SILL_Y, L.WINDSCREEN_Z), P(W, L.BOARD_BOTTOM.y, L.WINDSCREEN_Z), desk, 0.8, [-1, 0, 0]);

  // ---- Housings the levers stand in ----
  const deskY = L.deskHeightAt;
  // The train brake valve: a round drum with a collar on top.
  B.addShape(CYLINDER, L.BRAKE_VALVE.x, deskY(L.BRAKE_VALVE.z) + 0.045, L.BRAKE_VALVE.z, 0.13, 0.1, 0.13, 0, 0, colour("#8f9b93"));
  B.addShape(CYLINDER, L.BRAKE_VALVE.x, deskY(L.BRAKE_VALVE.z) + 0.105, L.BRAKE_VALVE.z, 0.08, 0.025, 0.08, 0, 0, colour("#4f5552"));
  // The power controller: a box, with a dark plate on top.
  solid(L.POWER_CONTROLLER.x - 0.13, deskY(-0.5) - 0.05, L.POWER_CONTROLLER.z - 0.1, L.POWER_CONTROLLER.x + 0.13, deskY(-0.5) + 0.1, L.POWER_CONTROLLER.z + 0.1, "#b9b7a7");
  solid(L.POWER_CONTROLLER.x - 0.115, deskY(-0.5) + 0.1, L.POWER_CONTROLLER.z - 0.085, L.POWER_CONTROLLER.x + 0.115, deskY(-0.5) + 0.107, L.POWER_CONTROLLER.z + 0.085, "#1e2125");
  // The reverser's small box.
  solid(L.REVERSER.x - 0.05, deskY(-0.56) - 0.03, L.REVERSER.z - 0.05, L.REVERSER.x + 0.05, deskY(-0.56) + 0.07, L.REVERSER.z + 0.05, "#a9a898");
  // The horn lever's rubber boot.
  B.addShape(CONE, L.HORN_LEVER.x, deskY(L.HORN_LEVER.z) + 0.028, L.HORN_LEVER.z, 0.06, 0.055, 0.06, 0, 0, colour("#17181a"));

  // ---- Second man's side: a radio handset, a fire extinguisher ----
  solid(0.75, deskY(-0.55) + 0.0, -0.66, 0.95, deskY(-0.55) + 0.05, -0.5, "#e6e3d6");
  solid(0.78, deskY(-0.55) + 0.05, -0.64, 0.92, deskY(-0.55) + 0.075, -0.52, "#efece0");
  solid(-W, 1.7, -0.95, -W + 0.1, 2.15, -0.8, "#a83228");    // a red extinguisher, on the left wall in front of the driver
  solid(-W + 0.05, 2.15, -0.9, -W + 0.09, 2.2, -0.85, "#222");

  // ---- Seats ----
  const seat = C.CAB_SEAT_COLOR;
  for (const cx of [-0.45, 0.75]) {
    solid(cx - 0.26, 1.55, 0.18, cx + 0.26, 1.98, 0.42, "#2c2f33");                 // the pedestal
    solid(cx - 0.3, 1.98, 0.05, cx + 0.3, 2.08, 0.6, seat);                         // the cushion
    B.addSolid(cx, 2.55, 0.66, 0.6, 0.95, 0.12, 0, colour(seat), 1, 0.12);           // the back, leaning back a little
    solid(cx - 0.3, 2.2, 0.63, cx - 0.24, 2.42, 0.6, "#2c2f33");                      // arm rests
    solid(cx + 0.24, 2.2, 0.63, cx + 0.3, 2.42, 0.6, "#2c2f33");
  }

  return B.build();
}

// The cab is lit a little from inside after dark, so the desk and levers can still be seen.
export const shellMaterial = (glow = 0) => new THREE.MeshLambertMaterial({ vertexColors: true, emissive: "#23262b", emissiveIntensity: glow });
