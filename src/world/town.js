// town.js — the built-up stretch approaching the main station: rows of terraced houses along
// the main street, a mill with its chimney, a gasworks holder, warehouses, and allotments and
// back gardens right against the lineside. `route.towns` gives each stretch as `{ from, to,
// side }`, where `side` is which side of the track the main street (and the mill/gasworks) is
// on; the allotments go on the other side, in the strip right next to the fence.

import { pointBeside } from "../path.js";
import { colour, GABLE, CYLINDER, BLOB } from "./mesh-builder.js";
import { addHouse, addCar, carColor, inBuildingDirections } from "./buildings.js";
import { hashRandom } from "./random.js";

const TERRACE_UNIT_M = 5.2;      // one terraced house is this wide
const TERRACE_ROW_HOUSES = 7;    // houses in one unrolled terrace
const TERRACE_OFFSET_M = 20;     // how far the terrace fronts are from the middle of the track
const TERRACE_SPACING_M = 46;    // a new terrace row starts this often along the town
const ALLOTMENT_OFFSET_M = 12;   // allotments start this close to the line (brief: "along the lineside")
const ALLOTMENT_PLOT_M = 6;
const WALL_COLORS = ["#93594a", "#8a5142", "#9c6252"];

// One continuous terraced row: a long shared wall and roof, with a door and a window pattern
// repeated for each house, and a chimney where each pair of houses meets.
function addTerraceRow(builder, x, y, z, yaw, houses, wallColor, seed) {
  const length = houses * TERRACE_UNIT_M;
  const height = 5.6, roofHeight = 2.3;
  const place = (right, forward) => inBuildingDirections(x, z, yaw, right, forward);

  builder.addBox(x, y + height / 2, z, 3.6, height, length, yaw, colour(wallColor));
  builder.addShape(GABLE, x, y + height + roofHeight / 2, z, 4.2, roofHeight, length + 0.5, yaw, 0, colour("#3f3c38"));
  for (let i = 0; i <= houses; i += 2) {
    const forward = -length / 2 + i * TERRACE_UNIT_M;
    const [cx, cz] = place(0, forward);
    builder.addBox(cx, y + height + roofHeight + 0.4, cz, 0.55, 0.9, 0.55, yaw, colour("#5a5650"));
  }
  for (let i = 0; i < houses; i++) {
    const forward = -length / 2 + (i + 0.5) * TERRACE_UNIT_M;
    const doorAt = place(1.85, forward - 0.9), windowAt = place(1.85, forward + 0.9), upstairsAt = place(1.85, forward + 0.1);
    builder.addBox(doorAt[0], y + 1.05, doorAt[1], 0.1, 2.1, 0.9, yaw, colour(hashRandom(seed, i, 1) < 0.5 ? "#2c5a44" : "#5a2c2c"));
    builder.addBox(windowAt[0], y + 1.5, windowAt[1], 0.08, 1.3, 1.2, yaw, colour("#1d242b"));
    builder.addBox(upstairsAt[0], y + 4.0, upstairsAt[1], 0.08, 1.2, 1.2, yaw, colour("#1d242b"));
  }
}

// A mill: a tall block with small regular windows, and a very tall chimney beside it.
function addMill(builder, x, y, z, yaw) {
  const place = (right, forward) => inBuildingDirections(x, z, yaw, right, forward);
  builder.addBox(x, y + 8, z, 11, 16, 15, yaw, colour("#8a6a52"));
  builder.addBox(x, y + 16.3, z, 11.6, 0.6, 15.6, yaw, colour("#5b5148"));
  for (let row = 0; row < 3; row++) {
    for (let col = -3; col <= 3; col++) {
      const [wx, wz] = place(5.55, col * 2.0);
      builder.addBox(wx, y + 3 + row * 4.4, wz, 0.1, 1.5, 1.0, yaw, colour("#1d242b"));
    }
  }
  const [cx, cz] = place(-9, -6);
  builder.addShape(CYLINDER, cx, y + 11, cz, 2.0, 22, 2.0, 0, 0, colour("#7a4a3a"));
  builder.addShape(CYLINDER, cx, y + 22.3, cz, 2.3, 0.6, 2.3, 0, 0, colour("#5a3a2c"));
}

// A gasholder: concentric drums (a real gasometer telescopes as it fills), inside a light
// lattice guide frame suggested by four corner posts.
function addGasholder(builder, x, y, z) {
  builder.addShape(CYLINDER, x, y + 4, z, 9, 8, 9, 0, 0, colour("#7d8288"), 0.9);
  builder.addShape(CYLINDER, x, y + 8 + 3, z, 7.6, 6, 7.6, 0, 0, colour("#8f949a"), 1.0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    builder.addBox(x + Math.sin(a) * 9.6, y + 8.5, z + Math.cos(a) * 9.6, 0.35, 17, 0.35, a, colour("#4a4e54"), 1, 0.02);
  }
}

// A low, long warehouse with a gable roof and a loading door.
function addWarehouse(builder, x, y, z, yaw, wallColor) {
  const place = (right, forward) => inBuildingDirections(x, z, yaw, right, forward);
  builder.addBox(x, y + 3.6, z, 9, 7.2, 20, yaw, colour(wallColor));
  builder.addShape(GABLE, x, y + 7.2 + 1.8, z, 9.6, 3.6, 20.6, yaw, 0, colour("#4a4e54"));
  const [dx, dz] = place(4.55, 0);
  builder.addBox(dx, y + 2.6, dz, 0.1, 5.0, 5.0, yaw, colour("#2a2c2e"));
}

// A row of allotment plots: little rectangular beds, a few plants, and the odd small shed.
// Each plot is a strip [d - 2.4, d + 2.4] along the track, at two offsets out from it — the
// same corner-point idiom the fields in terrain.js use.
function addAllotments(builder, path, terrain, side, d0, d1, seed) {
  const spacing = ALLOTMENT_PLOT_M + 1.5;
  const near = side * ALLOTMENT_OFFSET_M, far = side * (ALLOTMENT_OFFSET_M + 4.5), mid = side * (ALLOTMENT_OFFSET_M + 2);
  const corner = (d, offset) => {
    const p = pointBeside(path.pathAt(d, {}), offset, {});
    return [p.x, terrain.groundY(d, offset) + 0.02, p.z];
  };
  for (let k = Math.ceil(d0 / spacing); k * spacing < d1; k++) {
    const d = k * spacing;
    const soil = hashRandom(seed + 61, k, 1) < 0.55 ? "#5a4636" : "#5f8a3c";
    builder.addQuad(corner(d - 2.4, near), corner(d - 2.4, far), corner(d + 2.4, far), corner(d + 2.4, near), colour(soil), 0.9 + 0.1 * (k % 2));
    const [px, py, pz] = corner(d, mid);
    if (hashRandom(seed + 62, k, 2) < 0.35) builder.addShape(BLOB, px, py + 0.5, pz, 0.9, 0.8, 0.9, k * 0.7, 0, colour("#4a7d2a"));
    if (hashRandom(seed + 63, k, 3) < 0.12) builder.addBox(px, py + 0.6, pz, 1.3, 1.2, 1.6, -path.pathAt(d, {}).heading, colour("#6a5a45"));
  }
}

// Adds the town furniture that falls between d0 and d1.
export function addTown(builder, ctx, terrain, d0, d1) {
  const { path, seed } = ctx;
  for (const town of ctx.route.towns ?? []) {
    if (town.to <= d0 || town.from >= d1) continue;
    const from = Math.max(town.from, d0), to = Math.min(town.to, d1);
    const s = town.side === "left" ? -1 : 1;

    // Terraced rows along the main street.
    for (let k = Math.floor(town.from / TERRACE_SPACING_M); k * TERRACE_SPACING_M < town.to; k++) {
      const rowAt = k * TERRACE_SPACING_M + TERRACE_SPACING_M / 2;
      if (rowAt < from || rowAt >= to) continue;
      const p = path.pathAt(rowAt, {});
      const beside = pointBeside(p, s * TERRACE_OFFSET_M, {});
      const groundY = terrain.groundY(rowAt, s * TERRACE_OFFSET_M);
      const yaw = -p.heading;
      addTerraceRow(builder, beside.x, groundY, beside.z, yaw, TERRACE_ROW_HOUSES, WALL_COLORS[k % WALL_COLORS.length], seed + k);
      if (hashRandom(seed + 71, k, 1) < 0.4) {
        const carAt = pointBeside(p, s * (TERRACE_OFFSET_M - 7), {});
        addCar(builder, carAt.x, terrain.groundY(rowAt, s * (TERRACE_OFFSET_M - 7)), carAt.z, yaw, carColor(hashRandom(seed + 72, k, 2)));
      }
    }

    // The mill, about a third of the way through the town.
    const millAt = town.from + (town.to - town.from) * 0.32;
    if (millAt >= from && millAt < to) {
      const p = path.pathAt(millAt, {});
      const beside = pointBeside(p, s * 42, {});
      addMill(builder, beside.x, terrain.groundY(millAt, s * 42), beside.z, -p.heading);
    }

    // The gasholder, further along.
    const gasAt = town.from + (town.to - town.from) * 0.55;
    if (gasAt >= from && gasAt < to) {
      const p = path.pathAt(gasAt, {});
      const beside = pointBeside(p, s * 55, {});
      addGasholder(builder, beside.x, terrain.groundY(gasAt, s * 55), beside.z);
    }

    // A couple of warehouses near the station end.
    for (const fraction of [0.78, 0.88]) {
      const at = town.from + (town.to - town.from) * fraction;
      if (at < from || at >= to) continue;
      const p = path.pathAt(at, {});
      const beside = pointBeside(p, s * 30, {});
      addWarehouse(builder, beside.x, terrain.groundY(at, s * 30), beside.z, -p.heading, "#8f8b7e");
    }

    // Allotments and back gardens, right against the lineside on the opposite side.
    addAllotments(builder, path, terrain, -s, from, to, seed);
  }
}
