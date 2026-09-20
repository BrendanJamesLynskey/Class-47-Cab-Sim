// track.js — the railway itself: stones (ballast), sleepers and two rails.
//
// Everything is placed using pathAt(distance), which says where the line is.
// The rail's top is at the track height y; the sleepers are just below it.

import * as C from "../config.js";
import { pointBeside } from "../path.js";
import { colour } from "./mesh-builder.js";

const RAIL_WIDTH_M = 0.07;
const RAIL_HEIGHT_M = 0.17;
const SLEEPER_WIDTH_M = 2.5;   // sleepers are long, poking out past the rails
const SLEEPER_HEIGHT_M = 0.13;
const SLEEPER_LENGTH_M = 0.25;
const BALLAST_WIDTH_M = 3.4;
const BALLAST_SHOULDER_WIDTH_M = 4.6;
const RAIL_PIECE_M = 2;        // rails and ballast are built in short straight pieces
const BALLAST_PIECE_M = 5;

export function addTrack(builder, ctx, d0, d1) {
  const { path } = ctx;
  const end = Math.min(d1, ctx.route.length_m + 6); // the track stops at the buffers
  if (d0 >= end) return;

  const rail = colour(C.RAIL_COLOR);
  const ballast = colour(C.BALLAST_COLOR);
  const sleeper = colour(C.SLEEPER_COLOR);
  const a = {}, b = {};

  // Sleepers, every 0.7 m, lined up with the track's direction and slope.
  const first = Math.ceil(d0 / C.SLEEPER_SPACING_M);
  for (let k = first; k * C.SLEEPER_SPACING_M < end; k++) {
    const p = path.pathAt(k * C.SLEEPER_SPACING_M, a);
    builder.addBox(p.x, p.y - RAIL_HEIGHT_M - SLEEPER_HEIGHT_M / 2, p.z, SLEEPER_WIDTH_M, SLEEPER_HEIGHT_M, SLEEPER_LENGTH_M,
      -p.heading, sleeper, 1, Math.atan(p.slope));
  }

  // Ballast: a wide low bank of stones, with a wider, lower "shoulder" under it.
  const firstPiece = Math.floor(d0 / BALLAST_PIECE_M);
  for (let k = firstPiece; k * BALLAST_PIECE_M < end; k++) {
    const from = Math.max(k * BALLAST_PIECE_M, d0), to = Math.min((k + 1) * BALLAST_PIECE_M, end);
    const pa = path.pathAt(from, a), pb = path.pathAt(to, b);
    builder.addBeam(pa.x, pa.y - 0.6, pa.z, pb.x, pb.y - 0.6, pb.z, BALLAST_WIDTH_M, 0.4, ballast, 1);
    builder.addBeam(pa.x, pa.y - 0.65, pa.z, pb.x, pb.y - 0.65, pb.z, BALLAST_SHOULDER_WIDTH_M, 0.25, ballast, 0.9);
  }

  // Two rails, each in short straight pieces that follow the curve.
  const firstRail = Math.floor(d0 / RAIL_PIECE_M);
  const half = C.TRACK_GAUGE_M / 2;
  const pointA = {}, pointB = {};
  for (let k = firstRail; k * RAIL_PIECE_M < end; k++) {
    const from = Math.max(k * RAIL_PIECE_M, d0), to = Math.min((k + 1) * RAIL_PIECE_M, end);
    const pa = path.pathAt(from, a), pb = path.pathAt(to, b);
    for (const side of [-1, 1]) {
      pointBeside(pa, side * half, pointA);
      pointBeside(pb, side * half, pointB);
      builder.addBeam(pointA.x, pa.y - RAIL_HEIGHT_M, pointA.z, pointB.x, pb.y - RAIL_HEIGHT_M, pointB.z, RAIL_WIDTH_M, RAIL_HEIGHT_M, rail, 1);
    }
  }
}
