// furniture.js — the things railways have beside the line: fences, telegraph poles,
// mileposts and the buffer stop at the end of the track.
// (Speed signs and signals arrive in a later version.)

import * as C from "../config.js";
import { pointBeside } from "../path.js";
import { colour } from "./mesh-builder.js";
import { milesToMetres } from "../units.js";
import { nearBridge } from "./bridges.js";

const FENCE_OFFSET_M = 4.3;       // how far the fence is from the middle of the track
const FENCE_SPACING_M = 4;        // one post every 4 m
const POLE_SPACING_M = 50;        // a telegraph pole every 50 m
const POLE_OFFSET_M = -5.6;       // on the left side, just beyond the fence
const POLE_HEIGHT_M = 7.4;
const MILEPOST_SPACING_M = milesToMetres(0.25); // a milepost every quarter mile
const MILEPOST_OFFSET_M = 3.6;
const GROUND_DROP_M = 0.65;       // same as the terrain: ground beside the track is this far below the rails

export function addFurniture(builder, ctx, terrain, d0, d1) {
  const { path, route } = ctx;
  const p = {}, q = {};
  const post = colour(C.FENCE_COLOR);
  const wood = colour(C.POLE_COLOR);
  const fenceEnd = Math.min(d1, route.length_m + 6);

  // Fence posts and two rails, on both sides of the line.
  const spacing = FENCE_SPACING_M / Math.max(0.6, Math.sqrt(ctx.quality.propDensity));
  const firstPost = Math.ceil(d0 / spacing);
  for (let k = firstPost; k * spacing < fenceEnd; k++) {
    const d = k * spacing, dNext = Math.min((k + 1) * spacing, fenceEnd);
    if (nearBridge(route, d) || nearBridge(route, dNext)) continue;
    for (const side of [-1, 1]) {
      const a = path.pathAt(d, p);
      const base = { x: pointBeside(a, side * FENCE_OFFSET_M, {}).x, z: pointBeside(a, side * FENCE_OFFSET_M, {}).z, y: a.y - GROUND_DROP_M };
      builder.addBox(base.x, base.y + 0.55, base.z, 0.12, 1.15, 0.12, -a.heading, post);
      const b = path.pathAt(dNext, q);
      const nextX = pointBeside(b, side * FENCE_OFFSET_M, {});
      builder.addBeam(base.x, base.y + 0.45, base.z, nextX.x, b.y - GROUND_DROP_M + 0.45, nextX.z, 0.03, 0.09, post, 0.9);
      builder.addBeam(base.x, base.y + 0.9, base.z, nextX.x, b.y - GROUND_DROP_M + 0.9, nextX.z, 0.03, 0.09, post, 0.9);
    }
  }

  // Telegraph poles down the left side, joined by wires to the next pole.
  const firstPole = Math.ceil(d0 / POLE_SPACING_M);
  for (let k = firstPole; k * POLE_SPACING_M < fenceEnd; k++) {
    const a = path.pathAt(k * POLE_SPACING_M, p);
    if (nearBridge(route, k * POLE_SPACING_M) || nearBridge(route, (k + 1) * POLE_SPACING_M)) continue;
    const top = { ...pointBeside(a, POLE_OFFSET_M, {}) };
    const groundY = terrain.groundY(k * POLE_SPACING_M, POLE_OFFSET_M);
    builder.addBox(top.x, groundY + POLE_HEIGHT_M / 2, top.z, 0.22, POLE_HEIGHT_M, 0.22, -a.heading, wood);
    // The crossarm points across the track.
    builder.addBox(top.x, groundY + POLE_HEIGHT_M - 0.35, top.z, 1.7, 0.12, 0.12, -a.heading, wood);

    const nextD = Math.min((k + 1) * POLE_SPACING_M, route.length_m + 6);
    const b = path.pathAt(nextD, q);
    for (const wireOffset of [-0.7, 0, 0.7]) {
      const from = pointBeside(a, POLE_OFFSET_M + wireOffset, {});
      const to = pointBeside(b, POLE_OFFSET_M + wireOffset, {});
      builder.addBeam(from.x, groundY + POLE_HEIGHT_M - 0.3, from.z, to.x, terrain.groundY(nextD, POLE_OFFSET_M) + POLE_HEIGHT_M - 0.3, to.z, 0.025, 0.025, colour("#222222"));
    }
  }

  // Mileposts on the right: a white post with a black top.
  const firstMilepost = Math.ceil(d0 / MILEPOST_SPACING_M);
  for (let k = firstMilepost; k * MILEPOST_SPACING_M < fenceEnd; k++) {
    if (k === 0) continue;
    const a = path.pathAt(k * MILEPOST_SPACING_M, p);
    if (nearBridge(route, k * MILEPOST_SPACING_M)) continue;
    const at = pointBeside(a, MILEPOST_OFFSET_M, {});
    const groundY = terrain.groundY(k * MILEPOST_SPACING_M, MILEPOST_OFFSET_M);
    builder.addBox(at.x, groundY + 0.5, at.z, 0.28, 1.0, 0.14, -a.heading, colour("#f2f0e6"));
    builder.addBox(at.x, groundY + 1.03, at.z, 0.29, 0.14, 0.15, -a.heading, colour("#1c1c1c"));
  }

  // The buffer stop at the very end of the line.
  const endD = route.length_m;
  if (endD >= d0 && endD < d1) {
    const a = path.pathAt(endD, p);
    const y = a.y - 0.17;
    builder.addBox(a.x, y + 0.7, a.z, 2.6, 0.5, 0.5, -a.heading, colour("#b3282d"));   // the red beam
    builder.addBox(a.x, y + 0.35, a.z, 0.25, 0.9, 0.25, -a.heading, colour("#444444")); // the post under it
  }
}
