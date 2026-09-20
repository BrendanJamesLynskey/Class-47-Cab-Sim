// path.js — turns the route (curves and hills) into the actual shape of the track
// in 3D: for every metre along the line, where it is, which way it points, how
// steep it is and how far it leans. Everything else in the world (rails, poles,
// trees) is placed relative to this, using pathAt(distance).
//
// The world's directions: at the start the train faces -Z (into the screen), +X is
// to its right and +Y is up. heading = 0 means "facing -Z"; a positive heading
// turns the train to its right.
//
// Real railways never go from straight to curved in one step. A curve tightens
// gradually over a stretch called an "easement", and the track leans ("cant") into
// the bend. Hills are the same: the slope changes gradually. That all happens here.

import { EASEMENT_M, CANT_PER_CURVATURE, GRADIENT_SMOOTHING_M } from "./config.js";

const STEP_M = 1;                // the centre-line is worked out every metre
const EXTRA_STRAIGHT_M = 1500;   // the line carries on straight past the end so the far view isn't empty

// Averages a list of numbers over a window of +/- halfWidth entries (outside the list counts as 0).
function smoothed(values, halfWidth) {
  const n = values.length;
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + values[i];
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const lo = i - halfWidth, hi = i + halfWidth;
    const sum = prefix[Math.min(n, hi + 1)] - prefix[Math.max(0, lo)];
    out[i] = sum / (2 * halfWidth + 1);
  }
  return out;
}

// How much of a curve's full tightness applies at distance d: 0 outside it, ramping up
// over the easement at each end, 1 in the middle.
function easedAmount(curve, d) {
  if (d < curve.from || d >= curve.to) return 0;
  const easement = Math.min(EASEMENT_M, (curve.to - curve.from) / 2);
  return Math.min(1, (d - curve.from) / easement, (curve.to - d) / easement);
}

// route = the result of routeInMetres()
export function buildPath(route) {
  const count = Math.ceil(route.length_m + EXTRA_STRAIGHT_M) + 1;
  const xs = new Float32Array(count);
  const ys = new Float32Array(count);
  const zs = new Float32Array(count);
  const headings = new Float32Array(count);
  const rolls = new Float32Array(count);

  // Slope: gradients as a list of numbers, then smoothed so the pitch changes gently.
  const rawSlope = new Float32Array(count);
  for (const g of route.gradients) {
    for (let i = Math.max(0, Math.ceil(g.from)); i < Math.min(count, g.to); i++) rawSlope[i] = g.slope;
  }
  const slopes = smoothed(rawSlope, Math.round(GRADIENT_SMOOTHING_M / STEP_M));

  let x = 0, y = 0, z = 0, heading = 0;
  for (let i = 0; i < count; i++) {
    let curvature = 0;
    for (const curve of route.curves) curvature += curve.curvature_per_m * easedAmount(curve, i);

    xs[i] = x; ys[i] = y; zs[i] = z; headings[i] = heading;
    rolls[i] = curvature * CANT_PER_CURVATURE; // positive = leaning to the right, into a right-hand bend

    heading += curvature * STEP_M;
    x += Math.sin(heading) * STEP_M;
    z -= Math.cos(heading) * STEP_M;
    y += slopes[i] * STEP_M;
  }

  const last = count - 1;
  const lerp = (a, b, t) => a + (b - a) * t;

  // Where is the track at this distance? Fills in `out` (or a new object).
  function pathAt(distance_m, out = {}) {
    const d = Math.min(Math.max(distance_m, 0), last);
    const i = Math.min(Math.floor(d), last - 1);
    const t = d - i;
    out.x = lerp(xs[i], xs[i + 1], t);
    out.y = lerp(ys[i], ys[i + 1], t);
    out.z = lerp(zs[i], zs[i + 1], t);
    out.heading = lerp(headings[i], headings[i + 1], t);
    out.slope = lerp(slopes[i], slopes[i + 1], t);
    out.roll = lerp(rolls[i], rolls[i + 1], t);
    return out;
  }

  return { pathAt, length_m: route.length_m, totalLength_m: last };
}

// A point to the side of the track: offset_m is metres to the right (negative = left).
export function pointBeside(p, offset_m, out = {}) {
  out.x = p.x + Math.cos(p.heading) * offset_m;
  out.z = p.z + Math.sin(p.heading) * offset_m;
  out.y = p.y;
  return out;
}
