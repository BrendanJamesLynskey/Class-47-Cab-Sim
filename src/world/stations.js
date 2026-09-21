// stations.js — the two stations at the ends of the line. Each is a MODERN station (a
// long concrete platform with a yellow safety edge, lighting columns, glass shelters,
// name boards, a covered footbridge and a car park) that still uses its OLD Victorian
// station building: red brick, slate roof, chimneys, tall windows and a cast-iron canopy.
//
// Everything is placed "so far along the track, so far to the side, so far up" using
// frameAt (see frame.js). `side` says which side of the track the platform is on.
// Each part is built by the chunk that its middle falls in.

import { colour, GABLE, CYLINDER } from "./mesh-builder.js";
import { hashRandom } from "./random.js";
import { frameAt } from "./frame.js";
import { makeSign } from "./signs.js";

const EDGE_M = 1.75;            // the platform edge is this far from the middle of the track
const WIDTH_M = 11;             // how wide the platform is
const HEIGHT_M = 0.9;           // its top is this high above the rails
const SECTION_M = 10;           // the platform is built in sections this long
const RAMP_M = 14;              // it slopes down to the ground at each end over this length
const GROUND_M = -0.65;         // the ground beside the track, relative to the rails

const BRICK = "#93594a", STONE = "#cdc6b0", SLATE = "#4b525b", GREEN = "#2a4a3a";
const CAR_COLORS = ["#a02a2a", "#2a4f8f", "#d8d8d8", "#2b2b2b", "#587a3a", "#c7a13a", "#7a7f86"];

// Builds one station. d0..d1 is the chunk being built; new textured signs are pushed onto `extras`.
function addStation(builder, ctx, terrain, station, d0, d1, extras) {
  const { path, seed } = ctx;
  const c = station.at;
  const half = station.platformLength_m / 2;
  const s = station.side === "left" ? -1 : 1;
  const fc = frameAt(path, c);
  const yaw = -fc.heading;
  const has = (along) => c + along >= d0 && c + along < d1;

  // ---- Helpers: boxes placed by "along, lateral (away from the track, on the platform side), up" ----
  const box = (frame, along, away, up, w, h, l, hex, brightness = 1, pitch = 0, roll = 0) => {
    const [x, y, z] = frame.at(along, s * away, up);
    builder.addBox(x, y, z, w, h, l, -frame.heading, colour(hex), brightness, pitch, roll);
  };
  const quad = (frame, p1, p2, p3, p4, hex, brightness, facing) => {
    const P = ([along, away, up]) => frame.at(along, s * away, up);
    builder.addQuadFacing(P(p1), P(p2), P(p3), P(p4), colour(hex), brightness, facing);
  };
  // The direction that points from the platform toward the track, and along the track, in world x/z.
  const towardTrack = [-s * Math.cos(fc.heading), -s * Math.sin(fc.heading)];
  const signAngle = Math.atan2(towardTrack[0], towardTrack[1]);
  const sign = (kind, text, w, h, along, away, up) => {
    const [x, y, z] = fc.at(along, s * away, up);
    extras.push(makeSign(kind, text, w, h, x, y, z, kind === "clock" ? Math.atan2(Math.sin(fc.heading), -Math.cos(fc.heading)) : signAngle));
  };

  // ---- The platform, in sections, with a slope down at each end ----
  for (let along = -half + SECTION_M / 2; along < half; along += SECTION_M) {
    if (!has(along)) continue;
    const fs = frameAt(path, c + along);
    const pitch = Math.atan(fs.slope);
    const shade = 0.93 + 0.07 * hashRandom(seed, Math.round(c), Math.round(along / SECTION_M));
    box(fs, 0, EDGE_M + WIDTH_M / 2, -0.25, WIDTH_M, 2.1, SECTION_M + 0.04, "#8f9089", shade, pitch);              // the concrete body
    box(fs, 0, EDGE_M + 0.175, HEIGHT_M - 0.05, 0.35, 0.1, SECTION_M + 0.04, "#bdbdb4", 1, pitch);                    // the edge stones
    box(fs, 0, EDGE_M + 0.35 + (WIDTH_M - 0.35) / 2, HEIGHT_M - 0.05, WIDTH_M - 0.35, 0.1, SECTION_M + 0.04, "#4a4c50", shade, pitch); // the surface
    box(fs, 0, EDGE_M + 0.6, HEIGHT_M + 0.003, 0.5, 0.02, SECTION_M + 0.04, "#e6c020", 1, pitch);                     // yellow safety strip
  }
  for (const end of [-1, 1]) {
    const edgeAlong = end * half;
    if (!has(edgeAlong + (end * RAMP_M) / 2)) continue;
    const fe = frameAt(path, c + edgeAlong);
    const foot = edgeAlong + end * RAMP_M;
    quad(fe, [edgeAlong, EDGE_M, HEIGHT_M], [edgeAlong, EDGE_M + WIDTH_M, HEIGHT_M], [foot, EDGE_M + WIDTH_M, GROUND_M + 0.05], [foot, EDGE_M, GROUND_M + 0.05], "#4a4c50", 0.95, [0, 1, 0]);
    // The two sloping sides, in concrete: triangles facing away from the platform.
    for (const [lateral, direction] of [[EDGE_M, 1], [EDGE_M + WIDTH_M, -1]]) {
      const P = (along, up) => fe.at(along, s * lateral, up);
      builder.addQuadFacing(P(edgeAlong, HEIGHT_M), P(edgeAlong, GROUND_M), P(foot, GROUND_M + 0.05), P(foot, GROUND_M + 0.05), colour("#8f9089"), 0.9, [direction * -s * Math.cos(fe.heading), 0, direction * -s * Math.sin(fe.heading)]);
    }
  }

  // ---- The old station building (red brick, slate roof), on the platform's back edge ----
  const building = { along: -12, length: 34, front: 6.9, back: 12.6, wall: 4.6 };
  if (has(building.along)) {
    const depth = building.back - building.front, middle = (building.front + building.back) / 2;
    const top = HEIGHT_M + building.wall;
    box(fc, building.along, middle, HEIGHT_M + building.wall / 2, depth, building.wall, building.length, BRICK);
    box(fc, building.along, building.front - 0.04, HEIGHT_M + 0.25, 0.1, 0.5, building.length + 0.2, "#6f3f34");     // a darker plinth at the bottom
    box(fc, building.along, building.front - 0.05, HEIGHT_M + 3.05, 0.1, 0.22, building.length + 0.2, STONE);         // a stone band across the front
    box(fc, building.along, building.front - 0.05, top - 0.12, 0.16, 0.24, building.length + 0.5, STONE);             // the eaves
    // The slate roof: a long pitched shape along the building.
    {
      const [x, y, z] = fc.at(building.along, s * middle, top + 1.2);
      builder.addShape(GABLE, x, y, z, depth + 1.2, 2.4, building.length + 1.0, yaw, 0, colour(SLATE));
    }
    // Chimney stacks with pots.
    for (const offset of [-11, 0, 11]) {
      box(fc, building.along + offset, middle, top + 2.05, 0.95, 2.6, 0.95, "#8a4f3f");
      box(fc, building.along + offset, middle, top + 3.4, 1.15, 0.16, 1.15, STONE);
      for (const pot of [-0.22, 0.22]) box(fc, building.along + offset + pot, middle, top + 3.75, 0.24, 0.6, 0.24, "#b36a3a");
    }
    // Tall windows and two doors along the front, each with a stone lintel and sill.
    for (let k = 0; k < 7; k++) {
      const along = building.along - building.length / 2 + 2.5 + k * 4.5;
      const isDoor = k === 1 || k === 5;
      if (isDoor) {
        box(fc, along, building.front - 0.05, HEIGHT_M + 1.4, 0.1, 2.8, 1.9, STONE);
        box(fc, along, building.front - 0.08, HEIGHT_M + 1.3, 0.1, 2.6, 1.5, "#2c5a44");
        box(fc, along, building.front - 0.09, HEIGHT_M + 2.75, 0.1, 0.45, 1.5, "#1d242b");    // the glass above the door
      } else {
        box(fc, along, building.front - 0.04, HEIGHT_M + 1.75, 0.08, 2.35, 1.4, "#e8e4d6");   // white frame
        box(fc, along, building.front - 0.07, HEIGHT_M + 1.75, 0.08, 2.15, 1.15, "#1d242b");  // the glass
        box(fc, along, building.front - 0.08, HEIGHT_M + 1.75, 0.08, 2.15, 0.06, "#e8e4d6");  // a bar down the middle
        box(fc, along, building.front - 0.08, HEIGHT_M + 2.2, 0.08, 0.06, 1.15, "#e8e4d6");   // and across
        box(fc, along, building.front - 0.08, HEIGHT_M + 3.0, 0.14, 0.3, 1.7, STONE);         // the lintel
        box(fc, along, building.front - 0.1, HEIGHT_M + 0.55, 0.16, 0.12, 1.6, STONE);        // the sill
      }
    }
    // The canopy over the platform: cast-iron columns, a sloping roof and a decorated edge.
    const canopyStart = building.along - building.length / 2 - 1, canopyLength = building.length + 2;
    for (let k = 0; k < 7; k++) {
      const along = canopyStart + 1.2 + k * ((canopyLength - 2.4) / 6);
      box(fc, along, 3.0, HEIGHT_M + 1.7, 0.18, 3.4, 0.18, GREEN);
      box(fc, along, 3.0, HEIGHT_M + 0.12, 0.34, 0.24, 0.34, "#213a2f");
      box(fc, along, 3.0, HEIGHT_M + 3.35, 0.3, 0.16, 0.3, "#213a2f");
    }
    box(fc, canopyStart + canopyLength / 2, 4.9, HEIGHT_M + 4.4, 4.4, 0.18, canopyLength, "#4d5760", 1, 0, s * 0.15);   // the roof, sloping down toward the track
    box(fc, canopyStart + canopyLength / 2, 2.72, HEIGHT_M + 3.95, 0.05, 0.55, canopyLength, "#e8e2c8");                // the decorated edge (valance)
    box(fc, canopyStart + canopyLength / 2, 2.72, HEIGHT_M + 4.28, 0.08, 0.08, canopyLength, GREEN);
    box(fc, canopyStart + canopyLength / 2, 2.72, HEIGHT_M + 3.68, 0.08, 0.06, canopyLength, GREEN);
    sign("old", station.name, 9, 0.44, building.along, 2.68, HEIGHT_M + 3.96);
    sign("clock", "", 0.95, 0.95, building.along + 8, 3.6, HEIGHT_M + 2.95);                                            // a clock hanging from the canopy
    box(fc, building.along + 8, 3.3, HEIGHT_M + 3.35, 0.05, 0.07, 0.6, "#213a2f");
  }

  // ---- Modern platform furniture: lighting columns, name boards, benches, bins ----
  for (let along = -half + 13; along < half - 6; along += 26) {
    if (!has(along) || Math.abs(along - building.along) < building.length / 2 + 6) continue;
    const fs = frameAt(path, c + along);
    box(fs, 0, 3.7, HEIGHT_M + 2.6, 0.16, 5.2, 0.16, "#6a7078");
    box(fs, 0, 3.15, HEIGHT_M + 5.25, 1.0, 0.1, 0.4, "#e9f0f6", 1.5, 0, s * 0.12);       // the lamp head
    box(fs, 0, 3.7, HEIGHT_M + 0.35, 0.3, 0.7, 0.3, "#5a6068");                          // base
  }
  for (const along of [-72, 25, 72]) {
    if (!has(along)) continue;
    box(fc, along, 3.6, HEIGHT_M + 1.4, 0.12, 2.8, 0.12, "#3b4148");
    sign("modern", station.name, 2.6, 0.62, along, 3.5, HEIGHT_M + 2.45);
  }
  for (const along of [-65, -50, 20, 55, 84]) {
    if (!has(along)) continue;
    box(fc, along, 5.0, HEIGHT_M + 0.45, 0.5, 0.06, 2.0, "#8a6a45");                       // the seat
    box(fc, along, 5.25, HEIGHT_M + 0.8, 0.06, 0.6, 2.0, "#8a6a45");                       // the back
    for (const end of [-0.85, 0.85]) box(fc, along + end, 5.0, HEIGHT_M + 0.22, 0.4, 0.44, 0.08, "#3b4148");
  }
  for (const along of [-45, 32, 75]) {
    if (!has(along)) continue;
    const [x, y, z] = fc.at(along, s * 6.2, HEIGHT_M + 0.45);
    builder.addShape(CYLINDER, x, y, z, 0.55, 0.9, 0.55, 0, 0, colour("#2c4a3a"));
  }

  // ---- Modern glass shelters near the far end ----
  for (const along of [40, 66]) {
    if (!has(along)) continue;
    for (const post of [[-3, 10.4], [3, 10.4], [-3, 12.6], [3, 12.6]]) box(fc, along + post[0], post[1], HEIGHT_M + 1.3, 0.1, 2.6, 0.1, "#3b4148");
    box(fc, along, 11.5, HEIGHT_M + 2.65, 2.9, 0.14, 6.8, "#343a40", 1, 0, s * 0.06);
    box(fc, along, 12.6, HEIGHT_M + 1.25, 0.04, 2.3, 6.0, "#8fb7cc", 1.1);
    for (const end of [-3, 3]) box(fc, along + end, 11.5, HEIGHT_M + 1.25, 2.0, 2.3, 0.04, "#8fb7cc", 1.1);
    box(fc, along, 12.0, HEIGHT_M + 0.5, 0.6, 0.06, 3.6, "#8a6a45");
    box(fc, along - 1.0, 12.55, HEIGHT_M + 1.4, 0.03, 0.9, 1.2, "#e8e8e0");             // a timetable poster
  }

  // ---- The covered footbridge over the track: a glass-sided corridor and a tower each end ----
  const bridgeAlong = station.footbridgeBeyond ? half + RAMP_M + 6 : -half + 42;
  if (has(bridgeAlong)) {
    const fb = frameAt(path, c + bridgeAlong);
    const onPlatform = !station.footbridgeBeyond;
    const nearAway = EDGE_M + 8.2, farAway = -6.4;            // where the two towers stand: platform side, and the other side
    const floorUp = 5.1, topUp = 7.8;
    const sideBox = (away, hex, w, h, l, up, brightness = 1) => box(fb, 0, away, up, w, h, l, hex, brightness);
    // The deck: a solid floor, a roof, and glass on both sides.
    const span = nearAway - farAway;
    box(fb, 0, (nearAway + farAway) / 2, (floorUp + topUp) / 2, span + 3, topUp - floorUp, 3.0, "#b7bdc3");
    for (const along of [-1.52, 1.52]) box(fb, along, (nearAway + farAway) / 2, 6.55, span - 0.4, 1.2, 0.05, "#86aec4", 1.15);
    box(fb, 0, (nearAway + farAway) / 2, topUp + 0.1, span + 3.4, 0.2, 3.4, "#3b4148");
    // The two towers (stairs and lifts), also glass-sided.
    for (const away of [nearAway, farAway]) {
      const baseUp = away === nearAway && onPlatform ? HEIGHT_M : GROUND_M;   // the far tower always stands on the ground
      sideBox(away, "#c2c8ce", 3.2, topUp - baseUp, 3.4, (baseUp + topUp) / 2);
      for (const along of [-1.72, 1.72]) box(fb, along, away, (baseUp + topUp) / 2 + 0.3, 2.4, topUp - baseUp - 1.4, 0.05, "#86aec4", 1.15);
      sideBox(away, "#3b4148", 3.5, 0.2, 3.7, topUp + 0.1);
    }
  }

  // ---- The car park behind the platform ----
  for (let along = -half; along < half; along += SECTION_M) {
    const a = along + SECTION_M / 2;
    if (!has(a)) continue;
    const p1 = [terrain.groundPoint(c + along, s * 13.1), terrain.groundPoint(c + along, s * 19.4), terrain.groundPoint(c + along + SECTION_M, s * 19.4), terrain.groundPoint(c + along + SECTION_M, s * 13.1)];
    for (const q of p1) q[1] += 0.04;
    builder.addQuad(p1[0], p1[1], p1[2], p1[3], colour("#54565a"), 1);
  }
  for (let k = -25; k <= 25; k++) {
    const along = k * 3.2;
    if (!has(along) || Math.abs(along) > half - 15) continue;
    const fs = frameAt(path, c + along);
    box(fs, 0, 16.2, GROUND_M + 0.09, 4.6, 0.02, 0.09, "#e8e8e0");                  // a white line between spaces
    if (hashRandom(seed, Math.round(c), k + 100) < 0.55) {
      const color = CAR_COLORS[Math.floor(hashRandom(seed + 1, Math.round(c), k) * CAR_COLORS.length)];
      const shift = (hashRandom(seed + 2, Math.round(c), k) - 0.5) * 0.4;
      box(fs, shift - 1.6, 16.2 + 0.0, GROUND_M + 0.55, 4.2, 0.62, 1.75, color);      // the body (its length runs away from the platform)
      box(fs, shift - 1.6, 16.0, GROUND_M + 1.05, 2.1, 0.5, 1.5, color, 0.85);        // the cabin
      box(fs, shift - 1.6, 16.0, GROUND_M + 1.05, 2.12, 0.34, 1.52, "#20262e");       // its windows
    }
  }
}

// Adds every station's parts that fall in d0..d1. `extras` collects textured signs for the chunk to own.
export function addStations(builder, ctx, terrain, d0, d1, extras) {
  for (const station of ctx.route.stations) {
    if (d1 < station.at - station.platformLength_m / 2 - 40 || d0 > station.at + station.platformLength_m / 2 + 60) continue;
    addStation(builder, ctx, terrain, station, d0, d1, extras);
  }
}
