// signs.js — flat signs with writing on them (station name boards, a clock). The writing
// is drawn on a small canvas and used as a texture. Each kind of sign is drawn once and
// shared, so lots of copies cost almost nothing.

import * as THREE from "three";

const materials = new Map(); // "style|text" -> material

function makeMaterial(key, draw, width, height, doubleSided) {
  if (!materials.has(key)) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext("2d"), width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    materials.set(key, new THREE.MeshBasicMaterial({ map: texture, side: doubleSided ? THREE.DoubleSide : THREE.FrontSide }));
  }
  return materials.get(key);
}

// Modern station name board: white writing on dark blue, with a thin white border.
function drawModernBoard(text) {
  return (g, w, h) => {
    g.fillStyle = "#0f3a70"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#ffffff"; g.lineWidth = h * 0.04; g.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h * 0.88);
    g.fillStyle = "#ffffff"; g.font = `bold ${Math.round(h * 0.52)}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, w / 2, h * 0.53);
  };
}

// Old-fashioned lettering for the building: cream capitals on dark green.
function drawOldBoard(text) {
  return (g, w, h) => {
    g.fillStyle = "#23412f"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#e8dfb8"; g.lineWidth = h * 0.05; g.strokeRect(h * 0.08, h * 0.08, w - h * 0.16, h * 0.84);
    g.fillStyle = "#efe6bd"; g.font = `bold ${Math.round(h * 0.58)}px serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text.toUpperCase().split("").join(" "), w / 2, h * 0.54);
  };
}

function drawClock(g, w, h) {
  const c = w / 2;
  g.fillStyle = "#1c1e21"; g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#f4f1e4"; g.beginPath(); g.arc(c, c, c * 0.9, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#1c1e21"; g.lineCap = "round";
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.lineWidth = i % 3 === 0 ? c * 0.07 : c * 0.03;
    g.beginPath(); g.moveTo(c + Math.sin(a) * c * 0.72, c - Math.cos(a) * c * 0.72); g.lineTo(c + Math.sin(a) * c * 0.84, c - Math.cos(a) * c * 0.84); g.stroke();
  }
  g.lineWidth = c * 0.07; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.sin(2.1) * c * 0.45, c - Math.cos(2.1) * c * 0.45); g.stroke(); // hour hand
  g.lineWidth = c * 0.045; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.sin(-0.5) * c * 0.7, c - Math.cos(-0.5) * c * 0.7); g.stroke(); // minute hand
}

// A flat sign, `width_m` by `height_m`, centred on (x, y, z), turned so it faces the way `rotationY`
// says (the direction its front points is (sin, cos) of that angle). Returns a Mesh; the chunk that
// builds it disposes its geometry when the chunk goes away (the material is shared).
export function makeSign(kind, text, width_m, height_m, x, y, z, rotationY) {
  let material;
  if (kind === "modern") material = makeMaterial(`modern|${text}`, drawModernBoard(text), 512, Math.round(512 * height_m / width_m), false);
  else if (kind === "old") material = makeMaterial(`old|${text}`, drawOldBoard(text), 1024, Math.round(1024 * height_m / width_m), false);
  else material = makeMaterial("clock", drawClock, 256, 256, true);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width_m, height_m), material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotationY;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

// The angle for a sign that should face the direction (fx, fz) on the ground.
export const facing = (fx, fz) => Math.atan2(fx, fz);
