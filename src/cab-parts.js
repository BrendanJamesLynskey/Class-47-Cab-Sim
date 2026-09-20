// cab-parts.js — the little instruments that go on the driver's desk: round dials
// with needles, levers, warning lamps and text labels. cab.js puts them together.
//
// Dials, lamps and labels use MeshBasicMaterial (they ignore the sun) so they are
// always easy to read, like backlit instruments.

import * as THREE from "three";

const clockX = (angleDeg, radius) => Math.sin((angleDeg * Math.PI) / 180) * radius;
const clockY = (angleDeg, radius) => -Math.cos((angleDeg * Math.PI) / 180) * radius;

function canvasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Draws the face of a dial on a canvas: numbers, tick marks and a title.
// Angles are in degrees clockwise from straight up.
function drawDialFace({ title, unit, min, max, majorStep, minorStep, startDeg, sweepDeg, redFrom }) {
  const size = 256, centre = size / 2, radius = 120;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  const angleFor = (value) => startDeg + ((value - min) / (max - min)) * sweepDeg;

  g.fillStyle = "#101214";
  g.beginPath(); g.arc(centre, centre, radius + 6, 0, Math.PI * 2); g.fill();

  const tick = (value, length, width, color) => {
    const a = angleFor(value);
    g.strokeStyle = color; g.lineWidth = width;
    g.beginPath();
    g.moveTo(centre + clockX(a, radius - length), centre + clockY(a, radius - length));
    g.lineTo(centre + clockX(a, radius), centre + clockY(a, radius));
    g.stroke();
  };
  for (let v = min; v <= max + 1e-9; v += minorStep) tick(v, 10, 2, "#d8d8d8");
  g.font = "bold 26px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  for (let v = min; v <= max + 1e-9; v += majorStep) {
    const color = redFrom !== undefined && v >= redFrom ? "#ff6a4a" : "#ffffff";
    tick(v, 20, 4, color);
    g.fillStyle = color;
    const a = angleFor(v);
    g.fillText(String(v), centre + clockX(a, radius - 42), centre + clockY(a, radius - 42));
  }
  g.fillStyle = "#c8c8c8"; g.font = "bold 20px sans-serif";
  g.fillText(title, centre, centre + 62);
  g.font = "16px sans-serif"; g.fillStyle = "#9aa0a6";
  g.fillText(unit, centre, centre + 84);
  return canvas;
}

// A round dial. radius_m is its size on the desk. It sits in the XY plane facing +Z
// (the desk group turns it to face the driver). Call setDial(dial, value) to move the needle.
export function makeDial({ radius_m, title, unit, min, max, majorStep, minorStep, redFrom }) {
  const startDeg = -135, sweepDeg = 270;
  const group = new THREE.Group();

  const bezel = new THREE.Mesh(new THREE.CircleGeometry(radius_m * 1.12, 40), new THREE.MeshBasicMaterial({ color: "#1b1d20" }));
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(radius_m, 40),
    new THREE.MeshBasicMaterial({ map: canvasTexture(drawDialFace({ title, unit, min, max, majorStep, minorStep, startDeg, sweepDeg, redFrom })) })
  );
  face.position.z = 0.0015;

  // The needle: a thin bar hanging off a pivot at the middle of the dial.
  const pivot = new THREE.Group();
  pivot.position.z = 0.003;
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(radius_m * 0.045, radius_m * 0.92), new THREE.MeshBasicMaterial({ color: "#ff7a3c" }));
  bar.position.y = radius_m * 0.34;
  const hub = new THREE.Mesh(new THREE.CircleGeometry(radius_m * 0.09, 16), new THREE.MeshBasicMaterial({ color: "#2a2c30" }));
  hub.position.z = 0.0015;
  pivot.add(bar, hub);

  group.add(bezel, face, pivot);
  group.userData = { pivot, min, max, startDeg, sweepDeg };
  return group;
}

// Points the needle at a value (it stops at the ends of the dial).
export function setDial(dial, value) {
  const { pivot, min, max, startDeg, sweepDeg } = dial.userData;
  const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
  pivot.rotation.z = -((startDeg + t * sweepDeg) * Math.PI) / 180; // negative: clockwise
}

// A lever with a knob on top, standing up from the desk. Its pivot is at the bottom.
// Tilt it by changing group.rotation.x (positive tilts it toward the driver).
export function makeLever(knobColor) {
  const group = new THREE.Group();
  const metal = new THREE.MeshLambertMaterial({ color: "#a9aeb4" });
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.17, 0.02), metal);
  shaft.position.y = 0.085;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), new THREE.MeshLambertMaterial({ color: knobColor }));
  knob.position.y = 0.19;
  group.add(shaft, knob);
  return group;
}

// A round warning lamp. Turn it on and off with setLamp().
export function makeLamp(radius_m, onColor) {
  const lamp = new THREE.Mesh(new THREE.CircleGeometry(radius_m, 20), new THREE.MeshBasicMaterial({ color: "#2b2b2b" }));
  lamp.userData = { onColor: new THREE.Color(onColor), offColor: new THREE.Color(onColor).multiplyScalar(0.18) };
  setLamp(lamp, false);
  return lamp;
}

export function setLamp(lamp, on) {
  lamp.material.color.copy(on ? lamp.userData.onColor : lamp.userData.offColor);
}

// A flat label with some text, for naming the controls.
export function makeLabel(text, width_m, height_m, color = "#d8d8d8") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = Math.max(16, Math.round((256 * height_m) / width_m));
  const g = canvas.getContext("2d");
  g.fillStyle = color;
  g.font = `bold ${Math.round(canvas.height * 0.7)}px sans-serif`;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, canvas.width / 2, canvas.height / 2);
  return new THREE.Mesh(
    new THREE.PlaneGeometry(width_m, height_m),
    new THREE.MeshBasicMaterial({ map: canvasTexture(canvas), transparent: true })
  );
}
