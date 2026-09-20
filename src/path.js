// path.js — turns the route (curves and hills) into the actual shape of the track
// in 3D: for every metre along the line, where it is, which way it points and how
// steep it is. Everything else in the world (rails, poles, trees) is placed
// relative to this, using pathAt(distance).
//
// The world's directions: at the start the train faces -Z (into the screen), +X is
// to its right and +Y is up. heading = 0 means "facing -Z"; a positive heading
// turns the train to its right.

const STEP_M = 1;                // the centre-line is worked out every metre
const EXTRA_STRAIGHT_M = 1500;   // the line carries on straight past the end so the far view isn't empty

function overlapping(list, distance_m) {
  return list.find((item) => distance_m >= item.from && distance_m < item.to);
}

// route = the result of routeInMetres()
export function buildPath(route) {
  const count = Math.ceil(route.length_m + EXTRA_STRAIGHT_M) + 1;
  const xs = new Float32Array(count);
  const ys = new Float32Array(count);
  const zs = new Float32Array(count);
  const headings = new Float32Array(count);
  const slopes = new Float32Array(count);

  let x = 0, y = 0, z = 0, heading = 0;
  for (let i = 0; i < count; i++) {
    xs[i] = x; ys[i] = y; zs[i] = z; headings[i] = heading;

    const inRoute = i <= route.length_m;
    const curve = inRoute ? overlapping(route.curves, i) : null;
    const gradient = inRoute ? overlapping(route.gradients, i) : null;
    slopes[i] = gradient ? gradient.slope : 0;

    // Take one step along the line, turning a little if we're in a curve.
    heading += curve ? curve.curvature_per_m * STEP_M : 0;
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
    out.slope = slopes[i];
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
