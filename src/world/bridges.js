// bridges.js — the bridges along the line.
//   "river": the track crosses a river valley on a brick viaduct (piers under a deck),
//            with the river flowing underneath.
//   "road":  a road crosses over the top of a cutting on a brick bridge.
// Bridges are placed from the route data (route.js), so adding one is one line there.

import * as C from "../config.js";
import { colour } from "./mesh-builder.js";
import { frameAt } from "./frame.js";

const TRACKBED_DROP_M = 0.65;
const RIVER_BRIDGE_LENGTH_M = 40;
const RIVER_BRIDGE_ZONE_M = 45;   // nothing else (poles, fences) is built this close to the middle of a river bridge
const ROAD_BRIDGE_WIDTH_M = 8;    // how wide a road bridge is, along the track
const ROAD_HALF_SPAN_MARGIN_M = 2.5;
const ROAD_LENGTH_M = 90;         // the road carries on this far each side of the line
const RIVER_WIDTH_M = 14;
const WATER_ABOVE_FLOOR_M = 0.9;

// Is this distance too close to a bridge, a station or a level crossing for a fence post,
// a telegraph pole or a milepost? (`route` is the result of routeInMetres().)
export function nearStructure(route, d) {
  const bridge = route.bridges.some((b) => {
    const middle = (b.from + b.to) / 2;
    return Math.abs(d - middle) < (b.kind === "river" ? RIVER_BRIDGE_ZONE_M : ROAD_BRIDGE_WIDTH_M / 2 + 1);
  });
  const station = route.stations.some((st) => Math.abs(d - st.at) < st.platformLength_m / 2 + 35);
  const crossing = route.levelCrossings.some((c) => Math.abs(d - c.at) < 4);
  return bridge || station || crossing;
}

function addRiverBridge(builder, path, terrain, middle) {
  const f = frameAt(path, middle);
  const yaw = -f.heading;
  const brick = colour(C.BRICK_COLOR), stone = colour(C.STONE_COLOR);
  const half = RIVER_BRIDGE_LENGTH_M / 2;

  // The deck under the track, and a parapet wall along each side.
  const deckTop = -0.6, deckThickness = 1.1;
  let [x, y, z] = f.at(0, 0, deckTop - deckThickness / 2);
  builder.addBox(x, y, z, 5.8, deckThickness, RIVER_BRIDGE_LENGTH_M, yaw, brick, 0.95);
  for (const side of [-1, 1]) {
    [x, y, z] = f.at(0, side * 2.75, deckTop + 0.6);
    builder.addBox(x, y, z, 0.5, 1.2, RIVER_BRIDGE_LENGTH_M + 1.2, yaw, stone);
    [x, y, z] = f.at(0, side * 2.75, deckTop + 1.25);
    builder.addBox(x, y, z, 0.7, 0.14, RIVER_BRIDGE_LENGTH_M + 1.4, yaw, colour("#bdb9ad")); // coping stones on top
  }

  // Piers down to the river bed, and a thicker abutment at each end.
  for (const along of [-half + 1.5, -half / 2, 0, half / 2, half - 1.5]) {
    const groundY = terrain.groundY(middle + along, 0);
    const bottom = groundY - 0.3, top = f.y + deckTop - deckThickness;
    if (top - bottom < 0.6) continue;
    [x, y, z] = f.at(along, 0, (top + bottom) / 2 - f.y);
    builder.addBox(x, y, z, 4.6, top - bottom, 2.4, yaw, brick, 0.9 + 0.1 * Math.abs(along) / half);
    [x, y, z] = f.at(along, 0, top - f.y + 0.1);
    builder.addBox(x, y, z, 5.2, 0.35, 3.0, yaw, stone); // the top of the pier sticks out a little
  }

  // The river, flowing across (at right angles to the track), a little above the valley floor.
  const floor = terrain.groundY(middle, 0);
  const waterY = floor + WATER_ABOVE_FLOOR_M;
  const water = colour(C.WATER_COLOR);
  const a = f.at(-RIVER_WIDTH_M / 2, -420, waterY - f.y), b = f.at(-RIVER_WIDTH_M / 2, 420, waterY - f.y);
  const c = f.at(RIVER_WIDTH_M / 2, 420, waterY - f.y), d = f.at(RIVER_WIDTH_M / 2, -420, waterY - f.y);
  builder.addQuad(a, d, c, b, water, 1.15);
}

function addRoadBridge(builder, path, terrain, env, middle) {
  const cut = env.cutAt(middle);
  if (cut < 4) return; // a road bridge needs a proper cutting to cross
  const f = frameAt(path, middle);
  const yaw = -f.heading;
  const brick = colour(C.BRICK_COLOR), stone = colour(C.STONE_COLOR);
  const span = 4.3 + cut * 2.2 + ROAD_HALF_SPAN_MARGIN_M;     // reaches from the top of one bank to the top of the other
  const deckTop = cut - TRACKBED_DROP_M - 0.05;                // level with the fields either side
  const deckThickness = 1.1;

  let [x, y, z] = f.at(0, 0, deckTop - deckThickness / 2);
  builder.addBox(x, y, z, span * 2, deckThickness, ROAD_BRIDGE_WIDTH_M, yaw, brick, 0.95);
  [x, y, z] = f.at(0, 0, deckTop + 0.025);
  builder.addBox(x, y, z, span * 2, 0.06, ROAD_BRIDGE_WIDTH_M - 1.4, yaw, colour("#46474b")); // the road
  for (const along of [-ROAD_BRIDGE_WIDTH_M / 2 + 0.2, ROAD_BRIDGE_WIDTH_M / 2 - 0.2]) {
    [x, y, z] = f.at(along, 0, deckTop + 0.5);
    builder.addBox(x, y, z, span * 2, 1.0, 0.4, yaw, stone); // parapet walls
  }

  // Abutments: brick walls holding the bridge up on each side of the track.
  for (const side of [-1, 1]) {
    const wallHeight = deckTop - deckThickness + TRACKBED_DROP_M;
    [x, y, z] = f.at(0, side * 6.8, wallHeight / 2 - TRACKBED_DROP_M);
    builder.addBox(x, y, z, 1.6, wallHeight, ROAD_BRIDGE_WIDTH_M, yaw, brick, 0.85);
  }

  // The road itself, running away across the fields on both sides.
  const road = colour("#5a5b5e");
  for (const side of [-1, 1]) {
    for (let lateral = span - 1; lateral < ROAD_LENGTH_M; lateral += 10) {
      const corner = (along, l) => {
        const q = f.at(along, side * l, 0);
        return [q[0], terrain.groundY(middle + along, side * l) + 0.08, q[2]];
      };
      const w = ROAD_BRIDGE_WIDTH_M / 2 - 0.9;
      builder.addQuad(corner(-w, lateral), corner(w, lateral), corner(w, lateral + 10), corner(-w, lateral + 10), road, 1);
    }
  }
}

// Adds every bridge whose middle falls between d0 and d1 (so each is built once, by one chunk).
export function addBridges(builder, ctx, terrain, d0, d1) {
  for (const bridge of ctx.route.bridges) {
    const middle = (bridge.from + bridge.to) / 2;
    if (middle < d0 || middle >= d1) continue;
    if (bridge.kind === "river") addRiverBridge(builder, ctx.path, terrain, middle);
    else if (bridge.kind === "road") addRoadBridge(builder, ctx.path, terrain, terrain.env, middle);
  }
}
