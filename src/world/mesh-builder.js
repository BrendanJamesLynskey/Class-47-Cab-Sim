// mesh-builder.js — collects lots of little shapes (boxes, cones, quads) into ONE
// big mesh with a colour on every corner ("vertex colours").
//
// Why? Every separate mesh the screen draws costs time. A stretch of railway has
// thousands of sleepers, posts and trees. Glued into one mesh they cost one draw.
//
// We write the corners straight into arrays instead of making a Three.js object for
// each sleeper, because thousands of throw-away objects would make the game hiccup.

import * as THREE from "three";

const colourCache = new Map();
// "#5f9a3c" -> a Three.js colour (remembered, so it is only worked out once).
export function colour(hex) {
  if (!colourCache.has(hex)) colourCache.set(hex, new THREE.Color(hex));
  return colourCache.get(hex);
}

// ---- Shape templates: flat lists of triangles for a unit-sized shape ----

function templateFrom(geometry, { dropBottom = true } = {}) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = g.attributes.position.array;
  const nor = g.attributes.normal.array;
  const keepPositions = [];
  const keepNormals = [];
  for (let tri = 0; tri < pos.length; tri += 9) {
    const facesDown = nor[tri + 1] < -0.9 && nor[tri + 4] < -0.9 && nor[tri + 7] < -0.9;
    if (dropBottom && facesDown) continue; // nobody sees the underneath of a sleeper
    for (let i = 0; i < 9; i++) {
      keepPositions.push(pos[tri + i]);
      keepNormals.push(nor[tri + i]);
    }
  }
  return { positions: keepPositions, normals: keepNormals };
}

// A roof shape: a triangular prism, 1 wide, 1 tall, 1 long, with the ridge along Z.
function gableTemplate() {
  const positions = [];
  const normals = [];
  // Adds one triangle facing the way `n` says. If the corners were given the wrong way
  // round (so it would face inwards and be invisible) they are swapped.
  const tri = (a, b, c, n) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cross = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    if (cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2] < 0) [b, c] = [c, b];
    positions.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) normals.push(...n);
  };
  const L = [-0.5, -0.5, 0], R = [0.5, -0.5, 0], T = [0, 0.5, 0];
  const slope = 1 / Math.hypot(1, 0.5);
  const at = (p, z) => [p[0], p[1], z];
  // The two sloping sides (each is two triangles) ...
  tri(at(L, -0.5), at(T, -0.5), at(T, 0.5), [-slope, 0.5 * slope, 0]);
  tri(at(L, -0.5), at(T, 0.5), at(L, 0.5), [-slope, 0.5 * slope, 0]);
  tri(at(R, -0.5), at(T, 0.5), at(T, -0.5), [slope, 0.5 * slope, 0]);
  tri(at(R, -0.5), at(R, 0.5), at(T, 0.5), [slope, 0.5 * slope, 0]);
  // ... and the two triangle ends.
  tri(at(L, 0.5), at(T, 0.5), at(R, 0.5), [0, 0, 1]);
  tri(at(R, -0.5), at(T, -0.5), at(L, -0.5), [0, 0, -1]);
  return { positions, normals };
}

export const BOX = templateFrom(new THREE.BoxGeometry(1, 1, 1));               // 1 x 1 x 1, no underside
export const BOX_FULL = templateFrom(new THREE.BoxGeometry(1, 1, 1), { dropBottom: false }); // with an underside (for ceilings)
export const CYLINDER = templateFrom(new THREE.CylinderGeometry(0.5, 0.5, 1, 12));   // width 1, height 1, no underside
export const CONE = templateFrom(new THREE.ConeGeometry(1, 1, 6));             // radius 1, height 1, 6 sides
export const BLOB = templateFrom(new THREE.IcosahedronGeometry(1, 0), { dropBottom: false }); // a rough ball: tree tops
export const GABLE = gableTemplate();                                          // a pitched roof

// ---- The builder ----

const _matrix = new THREE.Matrix4();
const _normalMatrix = new THREE.Matrix3();
const _quaternion = new THREE.Quaternion();
const _euler = new THREE.Euler(0, 0, 0, "YXZ"); // turn first (yaw), then tilt (pitch): same as the train
const _position = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();

export class MeshBuilder {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.colors = [];
  }

  get triangleCount() {
    return this.positions.length / 9;
  }

  // Adds a copy of a template shape: centred at (x, y, z), stretched to (sx, sy, sz),
  // turned by `yaw` and tilted by `pitch` (radians). Yaw is the same as the train's:
  // yaw = -heading points the shape's length along the track.
  addShape(template, x, y, z, sx, sy, sz, yaw, pitch, color, brightness = 1, roll = 0) {
    _euler.set(pitch, yaw, roll);
    _quaternion.setFromEuler(_euler);
    _position.set(x, y, z);
    _scale.set(sx, sy, sz);
    _matrix.compose(_position, _quaternion, _scale);
    _normalMatrix.getNormalMatrix(_matrix);

    const r = color.r * brightness, g = color.g * brightness, b = color.b * brightness;
    const p = template.positions;
    const n = template.normals;
    for (let i = 0; i < p.length; i += 3) {
      _v.set(p[i], p[i + 1], p[i + 2]).applyMatrix4(_matrix);
      this.positions.push(_v.x, _v.y, _v.z);
      _n.set(n[i], n[i + 1], n[i + 2]).applyMatrix3(_normalMatrix).normalize();
      this.normals.push(_n.x, _n.y, _n.z);
      this.colors.push(r, g, b);
    }
  }

  // A box centred at (x, y, z) with the given width (across), height and length (along Z).
  // `pitch` tilts it uphill/downhill and `roll` leans it sideways (positive roll raises its right side).
  addBox(x, y, z, width, height, length, yaw, color, brightness = 1, pitch = 0, roll = 0) {
    this.addShape(BOX, x, y, z, width, height, length, yaw, pitch, color, brightness, roll);
  }

  // A box with all six sides (for things you see from underneath, like a ceiling).
  addSolid(x, y, z, width, height, length, yaw, color, brightness = 1, pitch = 0, roll = 0) {
    this.addShape(BOX_FULL, x, y, z, width, height, length, yaw, pitch, color, brightness, roll);
  }

  // A long thin box from point A to point B: rails, hedges, fence rails, wires.
  // (ax, ay, az) and (bx, by, bz) are on the BOTTOM of the beam; it rises `height` above the line.
  addBeam(ax, ay, az, bx, by, bz, width, height, color, brightness = 1) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const flat = Math.hypot(dx, dz);
    const yaw = -Math.atan2(dx, -dz);
    const pitch = Math.atan2(dy, flat);
    const length = Math.hypot(flat, dy);
    this.addShape(BOX, (ax + bx) / 2, (ay + by) / 2 + height / 2, (az + bz) / 2, width, height, length, yaw, pitch, color, brightness);
  }

  // A flat-shaded triangle. If faceUp is true it is turned to face the sky, whichever way round the corners were given.
  addTriangle(a, b, c, color, brightness = 1, faceUp = true) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    let p1 = b, p2 = c;
    if (faceUp && ny < 0) { p1 = c; p2 = b; nx = -nx; ny = -ny; nz = -nz; }
    for (const p of [a, p1, p2]) {
      this.positions.push(p[0], p[1], p[2]);
      this.normals.push(nx, ny, nz);
      this.colors.push(color.r * brightness, color.g * brightness, color.b * brightness);
    }
  }

  // A flat four-cornered patch facing the way `facing` ([x, y, z]) points, whichever way round the corners were given.
  addQuadFacing(a, b, c, d, color, brightness, facing) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const flip = nx * facing[0] + ny * facing[1] + nz * facing[2] < 0;
    const corners = flip ? [a, d, c, b] : [a, b, c, d];
    this.addTriangle(corners[0], corners[1], corners[2], color, brightness, false);
    this.addTriangle(corners[0], corners[2], corners[3], color, brightness, false);
  }

  // A four-cornered flat patch (two triangles), for ground.
  addQuad(a, b, c, d, color, brightness = 1) {
    this.addTriangle(a, b, c, color, brightness);
    this.addTriangle(a, c, d, color, brightness);
  }

  // Finishes: returns one BufferGeometry (or null if nothing was added).
  build() {
    if (this.positions.length === 0) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.computeBoundingSphere();
    return geometry;
  }
}
