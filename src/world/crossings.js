// crossings.js — level crossings. Two kinds:
//   "footpath": just for walkers. No barriers: a gate each side, and you look and listen.
//   "road": a lane crosses the line. Gates swing shut across the road, with amber warning
//           lights, and a car or two waits while a train goes through.
// A whistle board stands beside the line before every crossing, to remind the driver to
// sound the horn (D-pad left and right, or A).

import * as C from "../config.js";
import { colour, CYLINDER } from "./mesh-builder.js";
import { addCar, carColor } from "./buildings.js";
import { hashRandom } from "./random.js";
import { frameAt } from "./frame.js";

const PATH_WIDTH_M = 1.7;
const PATH_LENGTH_M = 21;      // the footpath runs this far each side of the track, to the first hedge
const GATE_LATERAL_M = 4.5;    // the footpath gates stand this far from the middle of the track
const ROAD_WIDTH_M = 5.2;
const ROAD_LENGTH_M = 26;      // the road runs this far each side before it's built by the town/village instead
const BARRIER_LATERAL_M = 3.6; // the road barriers stand this far from the middle of the track
const WHISTLE_BOARD_BEFORE_M = 350;

function addWhistleBoard(builder, path, terrain, d) {
  const f = frameAt(path, d);
  const yaw = -f.heading;
  const ground = terrain.groundY(d, 3.6) - f.y;
  const post = colour("#e6e4dc"), white = colour("#f4f4ee"), black = colour("#141414");
  let [x, y, z] = f.at(0, 3.6, ground + 1.1);
  builder.addBox(x, y, z, 0.12, 2.2, 0.12, yaw, post);                                // the post
  [x, y, z] = f.at(0, 3.6, ground + 2.1);
  builder.addBox(x, y, z, 0.7, 0.7, 0.05, yaw, white);                                // the board, facing the approaching train
  // A big black "W", made of four slanted strokes.
  for (const [offset, lean] of [[-0.19, 0.3], [-0.065, -0.3], [0.065, 0.3], [0.19, -0.3]]) {
    [x, y, z] = f.at(-0.035, 3.6 + offset, ground + 2.1);
    builder.addBox(x, y, z, 0.075, 0.5, 0.02, yaw, black, 1, 0, lean);
  }
}

function addFootpathCrossing(builder, ctx, terrain, crossing, c) {
    const { path } = ctx;
    const f = frameAt(path, c);
    const yaw = -f.heading;
    const timber = colour("#6a5a46"), gravel = colour("#9a9382");

    // Timber boards laid between and beside the rails, so you can walk across.
    let [x, y, z] = f.at(0, 0, -0.1);
    builder.addBox(x, y, z, 1.3, 0.14, 1.9, yaw, timber, 0.95);
    for (const side of [-1, 1]) {
      [x, y, z] = f.at(0, side * 1.15, -0.1);
      builder.addBox(x, y, z, 0.8, 0.14, 1.9, yaw, timber, 1.05);
    }

    // The gravel path, running away across the fields on both sides (following the ground).
    for (const side of [-1, 1]) {
      const corner = (along, lateral, lift) => {
        const q = f.at(along, side * lateral, 0);
        const ground = lateral < 2.4 ? f.y - 0.14 : terrain.groundY(c + along, side * lateral) + lift;
        return [q[0], ground, q[2]];
      };
      const half = PATH_WIDTH_M / 2;
      const steps = [1.2, 2.4, 4.5, 8, 12, 16, PATH_LENGTH_M];
      for (let i = 0; i < steps.length - 1; i++) {
        builder.addQuad(corner(-half, steps[i], 0.05), corner(half, steps[i], 0.05), corner(half, steps[i + 1], 0.05), corner(-half, steps[i + 1], 0.05), gravel, 0.95 + 0.05 * (i % 2));
      }

      // A swing gate on each side, with signs on posts beside it.
      const groundAtGate = terrain.groundY(c, side * GATE_LATERAL_M) - f.y;
      const post = colour("#ecebe3"), gate = colour("#f0efe8");
      for (const along of [-0.95, 0.95]) {
        [x, y, z] = f.at(along, side * GATE_LATERAL_M, groundAtGate + 0.65);
        builder.addBox(x, y, z, 0.13, 1.3, 0.13, yaw, post);
      }
      for (const height of [1.0, 0.62]) {
        [x, y, z] = f.at(0, side * GATE_LATERAL_M, groundAtGate + height);
        builder.addBox(x, y, z, 0.05, 0.07, 1.75, yaw, gate);
      }
      [x, y, z] = f.at(0, side * GATE_LATERAL_M, groundAtGate + 0.81);
      builder.addBox(x, y, z, 0.04, 0.05, 1.95, yaw, gate, 1, 0.4);   // a diagonal brace

      // The warning sign: a yellow board with a black band, facing the track.
      const signAlong = 1.7;
      [x, y, z] = f.at(signAlong, side * (GATE_LATERAL_M + 0.15), groundAtGate + 0.8);
      builder.addBox(x, y, z, 0.1, 1.6, 0.1, yaw, colour("#3a3a3c"));
      [x, y, z] = f.at(signAlong, side * (GATE_LATERAL_M + 0.15 - 0.06), groundAtGate + 1.55);
      builder.addBox(x, y, z, 0.03, 0.55, 0.75, yaw, colour("#f0c218"));
      [x, y, z] = f.at(signAlong, side * (GATE_LATERAL_M + 0.15 - 0.085), groundAtGate + 1.55);
      builder.addBox(x, y, z, 0.03, 0.13, 0.75, yaw, colour("#141414"));
    }
}

// A road crossing: the road surface between and beside the rails, lifting barriers with
// warning lights, and (usually) a car or two waiting for the train to pass.
//
// Like the footpath crossing above, positions are given as frame.at(along, lateral, up):
// `along` moves a little way ALONG the track (this is the ROAD'S WIDTH direction, since the
// road crosses the rails at right angles) and `lateral` moves OUT INTO THE FIELD on one side
// of the track or the other (this is the direction the road actually runs).
function addRoadCrossing(builder, ctx, terrain, crossing, c, seed) {
  const { path } = ctx;
  const f = frameAt(path, c);
  const yaw = -f.heading;
  const timber = colour("#5a5148"), plank = colour("#463f38"), tarmac = colour("#4a4c50"), white = colour("#e8e6da");
  const half = ROAD_WIDTH_M / 2;

  // The road deck across the rails: timber boards, flush with the railheads.
  let [x, y, z] = f.at(0, 0, -0.02);
  builder.addBox(x, y, z, ROAD_WIDTH_M, 0.1, 1.9, yaw, timber, 0.95);
  for (const lateral of [-2.0, -1.3, 1.3, 2.0]) {
    [x, y, z] = f.at(0, lateral, -0.02);
    builder.addBox(x, y, z, 0.5, 0.11, 1.9, yaw, plank); // guides the wheels past each rail
  }

  // The tarmac road, running away from the crossing on both sides, following the ground.
  for (const side of [-1, 1]) {
    const corner = (along, awayFromTrack) => {
      const p = f.at(along, side * awayFromTrack, 0);
      return [p[0], terrain.groundY(c + along, side * awayFromTrack) + 0.06, p[2]];
    };
    const steps = [1.1, 4, 9, 15, 22, ROAD_LENGTH_M];
    for (let i = 0; i < steps.length - 1; i++) {
      builder.addQuad(corner(-half, steps[i]), corner(half, steps[i]), corner(half, steps[i + 1]), corner(-half, steps[i + 1]), tarmac, 0.95 + 0.05 * (i % 2));
    }
    builder.addQuad(corner(-half + 0.2, 1.6), corner(half - 0.2, 1.6), corner(half - 0.2, 1.9), corner(-half + 0.2, 1.9), white, 1.1); // a "give way" line
  }

  // The barriers: a post at one edge of the road on each approach, with a striped arm
  // swinging across the whole road (drawn down, as if a train were due), and a warning light.
  for (const side of [-1, 1]) {
    const postAlong = half + 0.35, lateral = side * BARRIER_LATERAL_M;
    [x, y, z] = f.at(postAlong, lateral, 1.0);
    builder.addBox(x, y, z, 0.16, 2.0, 0.16, yaw, colour("#e8e6da"));
    const armLength = ROAD_WIDTH_M + 0.3;
    [x, y, z] = f.at(postAlong - armLength / 2, lateral, 0.55);
    builder.addBox(x, y, z, 0.1, 0.08, armLength, yaw, colour("#f0c218"));
    [x, y, z] = f.at(postAlong, lateral, 1.85);
    builder.addShape(CYLINDER, x, y, z, 0.14, 0.14, 0.14, 0, Math.PI / 2, colour("#c62a2a"));
  }

  // One or two cars waiting on the approaches (not always: sometimes the road is empty).
  for (const side of [-1, 1]) {
    const r = hashRandom(seed + 31, Math.round(c), side + 2);
    if (r > 0.55) continue; // usually there's no traffic right at this moment
    const away = 5 + hashRandom(seed + 32, Math.round(c), side) * 3;
    const p = f.at(0, side * away, 0);
    const ground = terrain.groundY(c, side * away);
    const carYaw = yaw + (side > 0 ? Math.PI : 0); // facing the crossing, waiting
    addCar(builder, p[0], ground, p[2], carYaw, carColor(hashRandom(seed + 33, Math.round(c), side)));
  }
}

// Adds every crossing whose middle falls between d0 and d1 (each is built by one chunk),
// and the whistle boards that stand before them.
export function addCrossings(builder, ctx, terrain, d0, d1) {
  const { path, seed } = ctx;
  for (const crossing of ctx.route.levelCrossings) {
    const c = crossing.at;
    if (c - WHISTLE_BOARD_BEFORE_M >= d0 && c - WHISTLE_BOARD_BEFORE_M < d1) addWhistleBoard(builder, path, terrain, c - WHISTLE_BOARD_BEFORE_M);
    if (c < d0 || c >= d1) continue;
    if (crossing.kind === "road") addRoadCrossing(builder, ctx, terrain, crossing, c, seed);
    else addFootpathCrossing(builder, ctx, terrain, crossing, c);
  }
}
