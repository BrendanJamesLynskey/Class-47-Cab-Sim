// cab-parts.js — the little instruments that go on the driver's desk: painted gauge
// faces, needles, warning lamps and panels. cab.js puts them together.
//
// All the gauge faces and labels are painted once onto two big canvases (the gauge
// board and the desk top) and used as textures. That is much faster than making lots of
// separate shapes. Only the parts that MOVE (needles, lamps, levers) are real objects.
//
// Dials, lamps and panels use MeshBasicMaterial (they ignore the sun) so they are
// always easy to read, like backlit instruments.

import * as THREE from "three";

const clockX = (angleDeg, radius) => Math.sin((angleDeg * Math.PI) / 180) * radius;
const clockY = (angleDeg, radius) => -Math.cos((angleDeg * Math.PI) / 180) * radius;

// ---- Painting ----

export function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function canvasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// Paints a round dial: chrome ring, black face, tick marks, numbers and a title.
// (cx, cy) is the middle and `radius` the size, in canvas pixels. Angles run clockwise from straight up.
export function paintDial(g, cx, cy, radius, { title, unit, min, max, majorStep, minorStep, redFrom, startDeg = -135, sweepDeg = 270 }) {
  const angleFor = (value) => startDeg + ((value - min) / (max - min)) * sweepDeg;

  // The bezel: a chrome ring and a black surround.
  g.fillStyle = "#b9bdc2";
  g.beginPath(); g.arc(cx, cy, radius * 1.12, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#15171a";
  g.beginPath(); g.arc(cx, cy, radius * 1.04, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#0b0c0e";
  g.beginPath(); g.arc(cx, cy, radius, 0, Math.PI * 2); g.fill();

  const tick = (value, length, width, color) => {
    const a = angleFor(value);
    g.strokeStyle = color; g.lineWidth = width;
    g.beginPath();
    g.moveTo(cx + clockX(a, radius * 0.9 - length), cy + clockY(a, radius * 0.9 - length));
    g.lineTo(cx + clockX(a, radius * 0.9), cy + clockY(a, radius * 0.9));
    g.stroke();
  };
  for (let v = min; v <= max + 1e-9; v += minorStep) tick(v, radius * 0.07, radius * 0.014, "#d8d8d8");
  g.font = `bold ${Math.round(radius * 0.19)}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  for (let v = min; v <= max + 1e-9; v += majorStep) {
    const color = redFrom !== undefined && v >= redFrom ? "#ff6a4a" : "#ffffff";
    tick(v, radius * 0.14, radius * 0.03, color);
    g.fillStyle = color;
    const a = angleFor(v);
    g.fillText(String(v), cx + clockX(a, radius * 0.6), cy + clockY(a, radius * 0.6));
  }
  g.fillStyle = "#cfcfcf"; g.font = `bold ${Math.round(radius * 0.16)}px sans-serif`;
  g.fillText(title, cx, cy + radius * 0.42);
  if (unit) { g.font = `${Math.round(radius * 0.13)}px sans-serif`; g.fillStyle = "#98a0a8"; g.fillText(unit, cx, cy + radius * 0.6); }
}

// Draws a needle on the canvas (for the gauges that never move).
export function paintNeedle(g, cx, cy, radius, angleDeg, color = "#ff7a3c") {
  g.strokeStyle = color; g.lineWidth = radius * 0.035; g.lineCap = "round";
  g.beginPath();
  g.moveTo(cx - clockX(angleDeg, radius * 0.15), cy - clockY(angleDeg, radius * 0.15));
  g.lineTo(cx + clockX(angleDeg, radius * 0.82), cy + clockY(angleDeg, radius * 0.82));
  g.stroke();
}

// The hub in the middle of a dial, drawn on top of the needle's pivot.
export function paintHub(g, cx, cy, radius) {
  g.fillStyle = "#2b2d31";
  g.beginPath(); g.arc(cx, cy, radius * 0.1, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#6c7076";
  g.beginPath(); g.arc(cx, cy, radius * 0.04, 0, Math.PI * 2); g.fill();
}

// ---- Objects that move ----

// A thin tapered needle: length `radius_m`, pivoting at (0, 0), pointing up. Rotate it about Z.
export function makeNeedle(radius_m, color = "#ff7a3c") {
  const tail = radius_m * 0.16, half = radius_m * 0.028;
  const positions = new Float32Array([
    -half, -tail, 0,   half, -tail, 0,   half * 0.35, radius_m * 0.86, 0,
    -half, -tail, 0,   half * 0.35, radius_m * 0.86, 0,   -half * 0.35, radius_m * 0.86, 0,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const needle = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  const pivot = new THREE.Group();
  pivot.add(needle);
  needle.position.z = 0.0035;
  return pivot;
}

// Points a needle made by makeNeedle at a value on a dial (clockwise from startDeg over sweepDeg).
export function setNeedle(pivot, value, min, max, startDeg = -135, sweepDeg = 270) {
  const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
  pivot.rotation.z = -((startDeg + t * sweepDeg) * Math.PI) / 180; // negative: clockwise
}

// A round warning lamp. Turn it on and off with setLamp().
export function makeLamp(radius_m, onColor) {
  const lamp = new THREE.Mesh(new THREE.CircleGeometry(radius_m, 20), new THREE.MeshBasicMaterial({ color: "#2b2b2b" }));
  lamp.userData = { onColor: new THREE.Color(onColor), offColor: new THREE.Color(onColor).multiplyScalar(0.16) };
  setLamp(lamp, false);
  return lamp;
}

export function setLamp(lamp, on) {
  lamp.material.color.copy(on ? lamp.userData.onColor : lamp.userData.offColor);
}

// A flat rectangle lying on a slope, textured from a canvas. `nearEdge` and `farEdge`
// are {y, z} points of the two edges of the slope; the panel is `width_m` wide across x.
// Its local axes: x across, y up the slope (toward the far edge), z out of the surface
// toward the driver. Put dials, lamps and needles on it using local coordinates.
export function makeSlopedPanel(nearEdge, farEdge, width_m, canvas) {
  const rise = farEdge.y - nearEdge.y, run = nearEdge.z - farEdge.z;
  const tilt = Math.atan2(rise, run);
  const length = Math.hypot(rise, run);
  const group = new THREE.Group();
  group.position.set(0, (nearEdge.y + farEdge.y) / 2, (nearEdge.z + farEdge.z) / 2);
  group.rotation.x = -Math.PI / 2 + tilt;
  if (canvas) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(width_m, length), new THREE.MeshBasicMaterial({ map: canvasTexture(canvas) }));
    group.add(face);
  }
  group.userData = { length, tilt };
  return group;
}
