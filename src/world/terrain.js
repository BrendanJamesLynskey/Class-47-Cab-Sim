// terrain.js — the ground: fields, hills, cuttings, embankments, and the hedges and
// walls between the fields.
//
// Picture the land beside the track as strips ("bands") running away from the line:
//
//   far ... | band 3 | band 2 | band 1 | bank | fence | TRACK | fence | bank | band 1 ...
//
// Band 0 is the "bank": the sloping side of a cutting or embankment, or just a grass
// verge. The others are cut along their length into fields of different sizes. Every
// field gets a "kind" (pasture, ploughed, wood, moor ...) chosen with the seeded
// random numbers, so the countryside is different every few hundred metres but is
// always the same on every run. What kind of country it is (hills, wood, cutting ...)
// comes from environment.js.

import * as THREE from "three";
import * as C from "../config.js";
import { pointBeside } from "../path.js";
import { makeRandom, hashRandom } from "./random.js";
import { colour } from "./mesh-builder.js";
import { NODE_M, paramsOf } from "./environment.js";

// How far each band starts from the middle of the track, in metres.
// (band 0 is EDGES[0]..EDGES[1], and so on.)
export const EDGES_M = [4.3, 20, 45, 80, 130, 200, 330, 620, 950];
export const BAND_COUNT = EDGES_M.length - 1;
export const SIDES = [-1, 1]; // -1 = left of the track, +1 = right

const STRIPES = [6, 6, 5, 4, 3, 2, 2, 1]; // each band is cut into this many stripes (ploughing, mowing)
const TRACKBED_DROP_M = 0.65;  // the ground beside the track is this far below the rail
const HEDGE_EDGES = [1, 2, 3, 4]; // which lines between bands get hedges (the near ones only)
const CUTTING_SLOPE = 2.2;     // a cutting's side goes out this many metres for every metre of depth
const EMBANKMENT_SLOPE = 2.0;

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const scratch = new THREE.Color();

// The rolling hills. They are flat near the track, biggest a couple of hundred metres
// out, then flatten off again far away so they join the horizon.
function hillTaper(offset_m) {
  const away = Math.abs(offset_m);
  return smoothstep(40, 300, away) * (1 - smoothstep(520, 950, away));
}
function hillShape(d, offset_m) {
  const wobble = 0.55 * Math.sin(d * 0.0185 + offset_m * 0.019) + 0.3 * Math.sin(d * 0.0455 - offset_m * 0.011 + 1.3) + 0.15 * Math.sin(d * 0.006 + offset_m * 0.004 + 4);
  return Math.pow(0.5 + 0.5 * wobble, 1.3);
}

function pickKind(random, band, length_m, params) {
  if (band === 0) return "bank";
  const r = random();
  if (band === 1 && length_m >= 110 && r < params.farm) return "farm";
  if (band <= 4 && r < params.farm + params.woods) return random() < 0.3 ? "conifer" : "wood";
  const rest = random();
  if (params.moor) return rest < 0.22 ? "heather" : "moor";
  if (rest < 0.17) return "ploughed";
  if (rest < 0.52 && band <= 3) return "pasture";
  return "grass";
}

// Works out all the fields for the whole route, once, at start-up.
function makeLayout(seed, totalLength_m, env) {
  const runs = { [-1]: [], [1]: [] }; // runs[side][band] = list of fields
  for (const side of SIDES) {
    for (let band = 0; band < BAND_COUNT; band++) {
      const random = makeRandom(seed * 1000 + (side + 1) * 100 + band);
      const list = [];
      let start = -random() * 150;
      while (start < totalLength_m) {
        const length = band === 0 ? 300 + random() * 300 : 80 + band * 15 + random() * (120 + band * 40);
        const params = paramsOf(env.typeAt(start + length / 2));
        list.push({
          start, end: start + length, side, band,
          kind: pickKind(random, band, length, params),
          moor: Boolean(params.moor),
          colorIndex: Math.floor(random() * C.GRASS_COLORS.length),
          brightness: 0.92 + random() * 0.14,
        });
        start += length;
      }
      runs[side].push(list);
    }
  }
  return runs;
}

// What sits along the line between two fields: a hedge, a drystone wall or a fence.
// `walls` is the chance of a wall (high on the hills).
export function boundaryType(seed, side, edgeOrBand, bucket, walls) {
  const r = hashRandom(seed + 7, side * 10 + edgeOrBand, bucket);
  if (r < walls) return "wall";
  if (r < walls + 0.12) return "fence";
  return "hedge";
}

export function createTerrain(ctx) {
  const { path, seed, env, route } = ctx;
  const layout = makeLayout(seed, path.totalLength_m, env);
  const here = {};
  const there = {};

  // How high is the ground at this distance along the track and this far to the side?
  function groundY(d, offset_m) {
    const trackY = path.pathAt(d, here).y;
    const k = Math.floor(d / NODE_M);
    const t = d / NODE_M - k;
    const hill = env.hillAmpNode(k) * hillShape(k * NODE_M, offset_m) * (1 - t) * hillTaper(offset_m)
      + env.hillAmpNode(k + 1) * hillShape((k + 1) * NODE_M, offset_m) * t * hillTaper(offset_m);

    // The bank: in a cutting the ground rises from the track up to the natural level; on
    // an embankment it falls away. Under a river bridge everything drops away.
    const cut = env.cutAt(d);
    const along = Math.max(0, Math.abs(offset_m) - EDGES_M[0]);
    const width = cut >= 0 ? cut * CUTTING_SLOPE : -cut * EMBANKMENT_SLOPE;
    let fraction = width < 0.01 ? (along > 0 ? 1 : 0) : Math.min(1, along / width);
    fraction = Math.max(fraction, env.bridgeAt(d));
    return trackY - TRACKBED_DROP_M + cut * fraction + hill;
  }

  // A point on the ground: [x, y, z] at distance d, offset_m to the side.
  function groundPoint(d, offset_m) {
    const p = path.pathAt(d, there);
    const side = pointBeside(p, offset_m, {});
    return [side.x, groundY(d, offset_m), side.z];
  }

  // Cuts [from, to] into pieces that don't cross a multiple of NODE_M.
  function rowsBetween(from, to) {
    const rows = [];
    let a = from;
    while (a < to - 1e-6) {
      const b = Math.min(to, (Math.floor(a / NODE_M + 1e-9) + 1) * NODE_M);
      rows.push([a, b]);
      a = b;
    }
    return rows;
  }

  function fieldColour(run, row_d) {
    if (run.kind === "ploughed") return colour(C.PLOUGHED_COLOR);
    if (run.kind === "heather") return colour(C.HEATHER_COLOR);
    if (run.kind === "moor") return colour(C.MOOR_COLORS[run.colorIndex % C.MOOR_COLORS.length]);
    return colour(C.GRASS_COLORS[run.colorIndex]);
  }

  function addFieldRow(builder, run, a, b, rowSeed) {
    const band = run.band;
    const inner = EDGES_M[band] * run.side;
    const outer = EDGES_M[band + 1] * run.side;
    const stripes = STRIPES[band];
    const middle = (a + b) / 2;
    const base = fieldColour(run, middle);
    const kindBrightness = run.kind === "wood" || run.kind === "conifer" ? 0.7 : 1;
    const rowBrightness = run.brightness * kindBrightness * (0.97 + 0.06 * hashRandom(seed, rowSeed, band));
    const stripeContrast = run.kind === "ploughed" ? 0.09 : 0.035;
    const cut = env.cutAt(middle);

    for (let s = 0; s < stripes; s++) {
      const o0 = inner + ((outer - inner) * s) / stripes;
      const o1 = inner + ((outer - inner) * (s + 1)) / stripes;
      let color = base;
      let brightness = rowBrightness * (1 + (s % 2 === 0 ? stripeContrast : -stripeContrast));
      if (band === 0) {
        // The side of a cutting is bare earth that gets greener toward the top; an embankment is grassy.
        const soil = Math.min(1, Math.max(0, cut / 3));
        const up = (s + 0.5) / stripes;
        scratch.copy(colour(C.GRASS_COLORS[run.colorIndex])).lerp(colour(C.CUTTING_COLOR), soil * (1 - 0.55 * up));
        color = scratch;
        brightness = rowBrightness * (0.85 + 0.1 * hashRandom(seed, rowSeed, s));
      }
      builder.addQuad(groundPoint(a, o0), groundPoint(a, o1), groundPoint(b, o1), groundPoint(b, o0), color, brightness);
    }
  }

  // The stony strip either side of the rails.
  function addTrackbed(builder, a, b) {
    const half = EDGES_M[0];
    builder.addQuad(groundPoint(a, -half), groundPoint(a, half), groundPoint(b, half), groundPoint(b, -half), colour(C.CESS_COLOR), 1);
  }

  // A hedge, wall or fence from point A to point B (each [x, y, z]).
  function addBoundary(builder, type, a, b, variation) {
    if (type === "hedge") {
      builder.addBeam(a[0], a[1] - 0.1, a[2], b[0], b[1] - 0.1, b[2], 1.2, 1.4 + variation * 0.5, colour(C.HEDGE_COLOR), 0.85 + variation * 0.3);
    } else if (type === "wall") {
      builder.addBeam(a[0], a[1] - 0.1, a[2], b[0], b[1] - 0.1, b[2], 0.55, 1.0, colour(C.WALL_COLOR), 0.9 + variation * 0.2);
    } else {
      // A post-and-rail fence: one rail at head height and a post at the start.
      builder.addBeam(a[0], a[1] + 0.85, a[2], b[0], b[1] + 0.85, b[2], 0.06, 0.09, colour(C.FENCE_COLOR));
      builder.addBox(a[0], a[1] + 0.5, a[2], 0.1, 1.05, 0.1, 0, colour(C.FENCE_COLOR));
    }
  }

  // The boundary along the track on the line between two bands, at distance d.
  // (Hedges here, and hedgerow trees in nature.js, both ask this so they agree.)
  function edgeType(side, edge, d) {
    return boundaryType(seed, side, 20 + edge, Math.floor(d / 180), env.paramsAt(d).walls);
  }

  // Footpaths cut through the hedges, and the station car parks are kept clear of them.
  const hedgeIsBlocked = (edge, d) =>
    route.levelCrossings.some((x) => Math.abs(d - x.at) < 4) ||
    (edge === 1 && route.stations.some((st) => Math.abs(d - st.at) < st.platformLength_m / 2 + 20));

  // Adds all the ground and field boundaries between distances d0 and d1.
  function addTerrain(builder, d0, d1) {
    for (const [a, b] of rowsBetween(d0, d1)) addTrackbed(builder, a, b);

    for (const side of SIDES) {
      for (let band = 0; band < BAND_COUNT; band++) {
        for (const run of layout[side][band]) {
          if (run.end <= d0 || run.start >= d1) continue;
          for (const [a, b] of rowsBetween(Math.max(run.start, d0), Math.min(run.end, d1))) {
            addFieldRow(builder, run, a, b, Math.floor(a));
          }
          // A hedge across the start of the field (only near ones, and not on the banks).
          if (band >= 1 && band <= 4 && run.start >= d0 && run.start < d1) {
            const type = boundaryType(seed, side, band, Math.floor(run.start), env.paramsAt(run.start).walls);
            const stripes = STRIPES[band];
            for (let s = 0; s < stripes; s++) {
              const o0 = EDGES_M[band] * side + ((EDGES_M[band + 1] - EDGES_M[band]) * side * s) / stripes;
              const o1 = EDGES_M[band] * side + ((EDGES_M[band + 1] - EDGES_M[band]) * side * (s + 1)) / stripes;
              addBoundary(builder, type, groundPoint(run.start, o0), groundPoint(run.start, o1), hashRandom(seed, Math.floor(run.start), s));
            }
          }
        }
      }
      // Hedges along the track between bands.
      for (const edge of HEDGE_EDGES) {
        for (const [a, b] of rowsBetween(d0, d1)) {
          if (hedgeIsBlocked(edge, (a + b) / 2)) continue;
          addBoundary(builder, edgeType(side, edge, (a + b) / 2), groundPoint(a, EDGES_M[edge] * side), groundPoint(b, EDGES_M[edge] * side), hashRandom(seed, Math.floor(a), edge));
        }
      }
    }
  }

  return { addTerrain, groundY, groundPoint, layout, edgeType, env };
}
