// cab-panels.js — paints the gauge board and the desk top. Everything that doesn't move
// is drawn here once, on canvases: the gauge faces, the "MAX SPEED" plate, labels,
// rows of switches. cab.js lays the finished pictures on the desk.

import { makeCanvas, paintDial, paintNeedle, paintHub } from "./cab-parts.js";
import * as L from "./cab-layout.js";

export const BOARD_WIDTH_M = 2 * L.HALF_WIDTH;
export const BOARD_LENGTH_M = Math.hypot(L.BOARD_TOP.y - L.BOARD_BOTTOM.y, L.BOARD_BOTTOM.z - L.BOARD_TOP.z);
export const DESK_LENGTH_M = Math.hypot(L.DESK_FAR.y - L.DESK_NEAR.y, L.DESK_NEAR.z - L.DESK_FAR.z);

const BOARD_PX_PER_M = 790;
const DESK_PX_PER_M = 600;

// Every dial that has a needle that moves (their needles are separate objects).
export const DIAL_SPECS = {
  speedometer: { title: "SPEED", unit: "MPH", min: 0, max: 100, majorStep: 10, minorStep: 5, redFrom: 90 },
  brakeCylinder: { title: "BRAKE CYL", unit: "PSI", min: 0, max: 100, majorStep: 20, minorStep: 10 },
  brakePipe: { title: "BRAKE PIPE", unit: "PSI", min: 0, max: 100, majorStep: 20, minorStep: 10 },
  ammeter: { title: "AMPS", unit: "x100", min: 0, max: 10, majorStep: 2, minorStep: 1 },
};
const STATIC_DIALS = {
  mainReservoir: { title: "MAIN RES", unit: "PSI", min: 0, max: 160, majorStep: 40, minorStep: 20, needleAt: 135 },
  trainHeat: { title: "HEAT", unit: "PSI", min: 0, max: 100, majorStep: 20, minorStep: 10, needleAt: 45 },
};

// The dark board across the back of the desk with all the gauges on it.
export function paintGaugeBoard() {
  const W = Math.round(BOARD_WIDTH_M * BOARD_PX_PER_M), H = Math.round(BOARD_LENGTH_M * BOARD_PX_PER_M);
  const canvas = makeCanvas(W, H);
  const g = canvas.getContext("2d");
  const px = (metres) => metres * BOARD_PX_PER_M;
  const cx = (x) => (x + L.HALF_WIDTH) * BOARD_PX_PER_M;

  g.fillStyle = "#1a1c1f"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#24272b"; g.fillRect(0, 0, W, px(0.012)); // a lighter lip along the top edge
  g.fillStyle = "#101113"; g.fillRect(0, H - px(0.01), W, px(0.01));
  // Screws along the board.
  g.fillStyle = "#4a4e54";
  for (let x = -1.2; x < 1.3; x += 0.1) { g.beginPath(); g.arc(cx(x), px(0.014), px(0.004), 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(cx(x), H - px(0.016), px(0.004), 0, Math.PI * 2); g.fill(); }

  // Gauges that never move, then the dials whose needles we add as objects.
  for (const [name, spec] of Object.entries(STATIC_DIALS)) {
    const { x, r } = L.GAUGES[name];
    paintDial(g, cx(x), H / 2, px(r), spec);
    paintNeedle(g, cx(x), H / 2, px(r), -135 + (spec.needleAt / spec.max) * 270);
    paintHub(g, cx(x), H / 2, px(r));
  }
  for (const [name, spec] of Object.entries(DIAL_SPECS)) {
    const { x, r } = L.GAUGES[name];
    paintDial(g, cx(x), H / 2, px(r), spec);
    paintHub(g, cx(x), H / 2, px(r));
  }

  // The speed plate between the speedometer and the ammeter.
  const p = L.GAUGES.placard;
  g.fillStyle = "#e8e6da"; g.fillRect(cx(p.x - p.w / 2), H / 2 - px(p.h / 2), px(p.w), px(p.h));
  g.strokeStyle = "#2a2a2a"; g.lineWidth = 3; g.strokeRect(cx(p.x - p.w / 2), H / 2 - px(p.h / 2), px(p.w), px(p.h));
  g.fillStyle = "#111"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `bold ${px(0.026)}px sans-serif`;
  g.fillText("MAX. SPEED", cx(p.x), H / 2 - px(0.017));
  g.fillText("95 M.P.H.", cx(p.x), H / 2 + px(0.017));

  // Names under the warning lamps.
  g.fillStyle = "#c8ccd0"; g.font = `bold ${px(0.014)}px sans-serif`;
  for (const lamp of L.LAMPS) g.fillText(lamp.name, cx(lamp.x), H / 2 - px(L.LAMP_Y) + px(0.04));
  // Small switches, a plate and a hole or two on the far right of the board.
  g.fillStyle = "#2e3136";
  g.fillRect(cx(0.68), px(0.05), px(0.5), H - px(0.1));
  for (let i = 0; i < 6; i++) {
    g.fillStyle = "#0d0e10"; g.fillRect(cx(0.72 + i * 0.075), px(0.06), px(0.04), px(0.05));
    g.fillStyle = i % 2 ? "#aeb3b8" : "#7d8288"; g.fillRect(cx(0.725 + i * 0.075), px(0.07), px(0.03), px(0.025));
  }
  return canvas;
}

// The top of the desk: dark, with plates, slots and labels for the controls.
export function paintDeskTop() {
  const W = Math.round(BOARD_WIDTH_M * DESK_PX_PER_M), H = Math.round(DESK_LENGTH_M * DESK_PX_PER_M);
  const canvas = makeCanvas(W, H);
  const g = canvas.getContext("2d");
  const px = (metres) => metres * DESK_PX_PER_M;
  const cx = (x) => (x + L.HALF_WIDTH) * DESK_PX_PER_M;
  // Along the desk: y = 0 is the FAR edge at the top of the canvas, so canvas y = (distance from far edge).
  const py = (fromFarEdge) => fromFarEdge * DESK_PX_PER_M;

  g.fillStyle = "#22252a"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#2b2f34"; g.fillRect(0, H - px(0.02), W, px(0.02)); // the front lip

  const label = (text, x, fromFar, size = 0.024) => {
    g.fillStyle = "#d0d4d8"; g.font = `bold ${px(size)}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, cx(x), py(fromFar));
  };

  // Brake valve: a round plate under the drum.
  g.fillStyle = "#33373c"; g.beginPath(); g.arc(cx(L.BRAKE_VALVE.x), py(0.215), px(0.11), 0, Math.PI * 2); g.fill();
  label("TRAIN BRAKE", L.BRAKE_VALVE.x, 0.375, 0.02);
  // Power controller.
  g.fillStyle = "#33373c"; g.fillRect(cx(L.POWER_CONTROLLER.x - 0.2), py(0.08), px(0.4), px(0.29));
  label("POWER", L.POWER_CONTROLLER.x, 0.375);
  // Reverser.
  g.fillStyle = "#33373c"; g.fillRect(cx(L.REVERSER.x - 0.07), py(0.13), px(0.14), px(0.19));
  label("REVERSER", L.REVERSER.x, 0.375, 0.02);
  g.font = `bold ${px(0.018)}px sans-serif`; g.fillStyle = "#e8c22a";
  g.fillText("R", cx(L.REVERSER.x - 0.05), py(0.17)); g.fillText("N", cx(L.REVERSER.x), py(0.145)); g.fillText("F", cx(L.REVERSER.x + 0.05), py(0.17));
  // Horn valve: a slot plate. The lever moves left (low note) and right (high note).
  g.fillStyle = "#33373c"; g.fillRect(cx(L.HORN_LEVER.x - 0.085), py(0.14), px(0.17), px(0.16));
  g.fillStyle = "#08090a"; g.fillRect(cx(L.HORN_LEVER.x - 0.05), py(0.205), px(0.1), px(0.02));
  label("HORN", L.HORN_LEVER.x, 0.345, 0.02);
  g.font = `bold ${px(0.014)}px sans-serif`; g.fillStyle = "#98a0a8";
  g.fillText("LOW", cx(L.HORN_LEVER.x - 0.05), py(0.17)); g.fillText("HIGH", cx(L.HORN_LEVER.x + 0.05), py(0.17));

  // Rows of switches on the right, for the second man.
  g.fillStyle = "#2c3036"; g.fillRect(cx(0.4), py(0.08), px(0.86), px(0.3));
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 9; i++) {
      const x = 0.46 + i * 0.09, y = 0.14 + row * 0.12;
      g.fillStyle = "#101113"; g.fillRect(cx(x), py(y), px(0.035), px(0.05));
      g.fillStyle = (i + row) % 3 ? "#b4b8bd" : "#e8c22a"; g.fillRect(cx(x + 0.004), py(y + 0.006), px(0.027), px(0.02));
    }
  }
  return canvas;
}
