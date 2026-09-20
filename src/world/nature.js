// nature.js — trees, woods, bushes, rocks and animals. All placed with seeded random
// numbers, so the same tree is always in the same spot.

import * as C from "../config.js";
import { pointBeside } from "../path.js";
import { CONE, BLOB, colour } from "./mesh-builder.js";
import { hashRandom, makeRandom } from "./random.js";
import { EDGES_M, SIDES } from "./terrain.js";
import { addFarm } from "./buildings.js";

const WOOD_SPACING_M = 11;          // trees in a wood are about this far apart
const HEDGEROW_TREE_SPACING_M = 25; // a chance of a big tree beside the hedge this often
const BUSH_SPACING_M = 8;           // scrub on the sides of cuttings and embankments
const CUTTING_SLOPE = 2.2;
const EMBANKMENT_SLOPE = 2.0;

// A broad-leaved tree: a trunk with a rough ball of leaves on top.
function addOak(builder, x, y, z, size, tint) {
  const trunkHeight = 2.2 * size;
  builder.addBox(x, y + trunkHeight / 2, z, 0.4 * size, trunkHeight, 0.4 * size, 0, colour(C.TRUNK_COLOR));
  builder.addShape(BLOB, x, y + trunkHeight + 1.6 * size, z, 2.6 * size, 2.3 * size, 2.6 * size, tint * 6, 0, colour(C.OAK_COLOR), 0.8 + tint * 0.4);
}

// A fir tree: a trunk with a tall green cone.
function addConifer(builder, x, y, z, size, tint) {
  builder.addBox(x, y + 0.6 * size, z, 0.3 * size, 1.2 * size, 0.3 * size, 0, colour(C.TRUNK_COLOR));
  builder.addShape(CONE, x, y + 1.2 * size + 3.2 * size, z, 3.4 * size, 6.4 * size, 3.4 * size, 0, 0, colour(C.CONIFER_COLOR), 0.85 + tint * 0.35);
}

// A low bush (scrub, gorse, hawthorn).
function addBush(builder, x, y, z, size, tint) {
  builder.addShape(BLOB, x, y + 0.5 * size, z, 1.5 * size, 1.0 * size, 1.5 * size, tint * 6, 0, colour(C.HEDGE_COLOR), 0.65 + tint * 0.45);
}

function addRock(builder, x, y, z, size, tint) {
  builder.addShape(BLOB, x, y + 0.25 * size, z, 1.7 * size, 0.9 * size, 1.3 * size, tint * 6, 0, colour("#8d8a80"), 0.8 + tint * 0.3);
}

function addSheep(builder, x, y, z, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  builder.addBox(x, y + 0.5, z, 0.6, 0.6, 1.0, yaw, colour("#e6e2d4"));
  builder.addBox(x + s * 0.6, y + 0.6, z + c * 0.6, 0.25, 0.3, 0.3, yaw, colour("#3a3632"));
}

function addCow(builder, x, y, z, yaw, black) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  builder.addBox(x, y + 0.85, z, 0.9, 0.95, 1.9, yaw, colour(black ? "#25252a" : "#ece8e0"));
  builder.addBox(x + s * 1.1, y + 1.0, z + c * 1.1, 0.4, 0.5, 0.5, yaw, colour(black ? "#25252a" : "#8a6a52"));
  builder.addBox(x, y + 1.0, z, 0.92, 0.5, 0.9, yaw, colour(black ? "#ece8e0" : "#3a2f28")); // a patch
}

export function addNature(builder, ctx, terrain, d0, d1) {
  const { path, seed, quality } = ctx;
  const env = terrain.env;
  const density = quality.propDensity;
  const p = {};

  // A spot on the ground: [x, y, z] at distance d and offset_m to the side.
  const at = (d, offset_m) => {
    const point = path.pathAt(d, p);
    const beside = pointBeside(point, offset_m, {});
    return [beside.x, terrain.groundY(d, offset_m), beside.z];
  };

  // ---- Scrub on the sides of cuttings and embankments, and trees along the top ----
  for (let k = Math.ceil(d0 / BUSH_SPACING_M); k * BUSH_SPACING_M < d1; k++) {
    const d = k * BUSH_SPACING_M;
    const cut = env.cutAt(d);
    if (Math.abs(cut) < 1.2 || env.bridgeAt(d) > 0.05) continue;
    const bankWidth = Math.abs(cut) * (cut > 0 ? CUTTING_SLOPE : EMBANKMENT_SLOPE);
    for (const side of SIDES) {
      const r = [hashRandom(seed + 11, k, side + 2), hashRandom(seed + 12, k, side + 2), hashRandom(seed + 13, k, side + 2)];
      const chance = Math.min(0.9, Math.abs(cut) / 6) * density;
      if (r[0] < chance) {
        const [x, y, z] = at(d + (r[2] - 0.5) * 5, side * (EDGES_M[0] + 2 + r[1] * (bankWidth - 1)));
        addBush(builder, x, y, z, 0.8 + r[2] * 0.7, r[1]);
      }
      // Trees standing along the top edge of a cutting.
      if (cut > 3 && r[0] > 0.55 && r[1] < 0.7 * density) {
        const [x, y, z] = at(d, side * (EDGES_M[0] + bankWidth + 2.5 + r[2] * 8));
        if (r[2] < 0.35) addConifer(builder, x, y, z, 0.9 + r[1] * 0.4, r[2]);
        else addOak(builder, x, y, z, 1.0 + r[1] * 0.5, r[2]);
      }
    }
  }

  for (const side of SIDES) {
    // ---- Woods and fir plantations ----
    for (let band = 1; band <= 4; band++) {
      for (const run of terrain.layout[side][band]) {
        if (run.end <= d0 || run.start >= d1) continue;
        if (run.kind !== "wood" && run.kind !== "conifer") continue;
        const spacing = (env.typeAt((run.start + run.end) / 2) === "wood" ? WOOD_SPACING_M * 0.88 : WOOD_SPACING_M) / Math.sqrt(density);
        const from = Math.max(run.start + 4, d0), to = Math.min(run.end - 4, d1);
        for (let i = Math.ceil(from / spacing); i * spacing < to; i++) {
          for (let j = 0; EDGES_M[band] + 4 + j * spacing < EDGES_M[band + 1] - 4; j++) {
            const r = [hashRandom(seed, i, j, side * 10 + band), hashRandom(seed + 1, i, j, band), hashRandom(seed + 2, i, j, band)];
            if (r[0] < 0.15) continue; // a gap in the wood
            const d = i * spacing + (r[1] - 0.5) * spacing * 0.7;
            const offset = side * (EDGES_M[band] + 4 + j * spacing + (r[2] - 0.5) * spacing * 0.7);
            const [x, y, z] = at(d, offset);
            const conifer = run.kind === "conifer" || r[0] > 0.8;
            const size = 0.9 + r[1] * 0.7;
            if (conifer) addConifer(builder, x, y, z, size, r[2]);
            else addOak(builder, x, y, z, size, r[2]);
          }
        }
      }
    }

    // ---- Big trees growing in the hedges (fewer on the moor, where there are walls) ----
    for (const edge of [1, 2, 3]) {
      for (let k = Math.ceil(d0 / HEDGEROW_TREE_SPACING_M); k * HEDGEROW_TREE_SPACING_M < d1; k++) {
        const d = k * HEDGEROW_TREE_SPACING_M;
        const moor = env.paramsAt(d).moor;
        if (hashRandom(seed + 3, k, edge, side + 2) > (moor ? 0.05 : 0.22) * density) continue;
        if (terrain.edgeType(side, edge, d) !== "hedge") continue;
        const [x, y, z] = at(d, side * EDGES_M[edge]);
        addOak(builder, x, y, z, 1.3 + hashRandom(seed + 4, k, edge) * 0.6, hashRandom(seed + 5, k, edge));
      }
    }

    // ---- Animals, rocks, hawthorn and farms in the fields ----
    for (let band = 1; band <= 3; band++) {
      for (const run of terrain.layout[side][band]) {
        if (run.end <= d0 || run.start >= d1) continue;
        const runId = Math.floor(run.start) * 8 + band * 2 + (side + 1) / 2;
        const params = env.paramsAt((run.start + run.end) / 2);

        if (run.kind === "pasture" || run.kind === "moor") {
          const random = makeRandom(seed * 31 + runId);
          const cows = run.kind === "pasture" && random() < 0.4;
          const count = Math.round((5 + random() * 9) * density * (run.kind === "moor" ? params.sheep : 1));
          const centreD = run.start + 25 + random() * (run.end - run.start - 50);
          const centreOffset = side * (EDGES_M[band] + 8 + random() * (EDGES_M[band + 1] - EDGES_M[band] - 16));
          for (let i = 0; i < count; i++) {
            const d = centreD + (random() - 0.5) * 34;
            const offset = centreOffset + side * (random() - 0.5) * 20;
            const yaw = random() * Math.PI * 2;
            const black = random() < 0.5;
            if (d < d0 || d >= d1) continue;
            const [x, y, z] = at(d, offset);
            if (cows) addCow(builder, x, y, z, yaw, black);
            else addSheep(builder, x, y, z, yaw);
          }
        }

        // On the moor: scattered rocks and hawthorn bushes.
        if (run.kind === "moor" || run.kind === "heather") {
          const random = makeRandom(seed * 43 + runId);
          const count = Math.round(9 * density);
          for (let i = 0; i < count; i++) {
            const d = run.start + 6 + random() * (run.end - run.start - 12);
            const offset = side * (EDGES_M[band] + 5 + random() * (EDGES_M[band + 1] - EDGES_M[band] - 10));
            const isRock = random() < 0.55, size = 0.7 + random() * 1.1, tint = random();
            if (d < d0 || d >= d1) continue;
            const [x, y, z] = at(d, offset);
            if (isRock) addRock(builder, x, y, z, size, tint);
            else addBush(builder, x, y, z, size, tint);
          }
        }

        if (run.kind === "farm") {
          const d = (run.start + run.end) / 2;
          if (d < d0 || d >= d1) continue;
          const [x, y, z] = at(d, side * (EDGES_M[1] + EDGES_M[2]) / 2);
          addFarm(builder, x, y, z, -path.pathAt(d, p).heading, makeRandom(seed * 17 + runId));
        }
      }
    }
  }
}
