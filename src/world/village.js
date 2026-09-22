// village.js — the little village round Foxlow Halt: a church with a square tower, a pub,
// and a dozen stone cottages along a lane. `route.villages` gives one marker per village:
// `{ at, side }`, where `side` is which side of the track the village mostly stands on (the
// level crossing, from crossings.js, is what connects the platform side to the village side).
//
// Buildings are placed directly in world space (like the farms in nature.js): work out a
// point on the ground with pointBeside() and terrain.groundY(), then hand it to a building
// helper. `yaw` for a building here is "face the lane", i.e. face back toward the track.

import { pointBeside } from "../path.js";
import { colour, GABLE, CONE } from "./mesh-builder.js";
import { addHouse, addCar, carColor, inBuildingDirections } from "./buildings.js";
import { makeRandom, hashRandom } from "./random.js";

const LANE_OFFSET_M = 34;        // how far out the cottage lane runs, from the middle of the track
const COTTAGE_COUNT = 12;
const COTTAGE_SPACING_M = 12;
const STONE_COLORS = ["#c9c2ac", "#b3ab90", "#d1cab5"];
const ROOF_COLORS = ["#5b5148", "#4a4640", "#655a4e"];

// A church: a tall square tower with a pyramid cap and a clock, and a long stone nave with a
// steep slate roof behind it. `right`/`forward` in `place()` are the church's OWN directions
// (forward = further from the tower), turned into world x/z by inBuildingDirections().
function buildChurch(builder, x, y, z, yaw) {
  const stone = "#a8a290", roofColor = "#4b525b", towerStone = "#948e7c";
  const place = (right, forward) => inBuildingDirections(x, z, yaw, right, forward);

  // The tower, at the near end (toward the lane), with a pyramid cap and a clock face.
  builder.addBox(x, y + 4.5, z, 4.2, 9, 4.2, yaw, colour(towerStone));
  builder.addBox(x, y + 9.15, z, 4.5, 0.3, 4.5, yaw, colour("#6d675a"));
  builder.addShape(CONE, x, y + 9.3 + 2.0, z, 3.4, 4.0, 3.4, yaw, 0, colour(roofColor));
  {
    const [fx, fz] = place(0, -2.15); // just proud of the tower's front face, toward the lane
    builder.addBox(fx, y + 6.8, fz, 1.5, 1.5, 0.08, yaw, colour("#e8e4d6"));
  }

  // The nave: a long stone hall with a steep slate roof, set back behind the tower.
  {
    const [nx, nz] = place(0, 9);
    builder.addBox(nx, y + 3.2, nz, 8, 6.4, 15.5, yaw, colour(stone));
    builder.addShape(GABLE, nx, y + 6.4 + 2.6, nz, 8.8, 5.2, 16, yaw, 0, colour(roofColor));
  }
}

// A pub: a house with a bigger footprint, a hanging sign on a bracket, and a bench outside.
function addPub(builder, x, y, z, yaw, random) {
  addHouse(builder, x, y, z, yaw, 10, 5.4, 8, "#d8d0ba", "#4a4640", 2.8);
  const place = (right, forward) => inBuildingDirections(x, z, yaw, right, forward);
  const [bx, bz] = place(4.6, -1);
  builder.addBox(bx, y + 3.6, bz, 0.08, 0.9, 0.08, yaw, colour("#2a2622"));  // the bracket post
  builder.addBox(bx, y + 3.9, bz, 0.5, 0.5, 0.03, yaw, colour("#7a3a2c"));   // the sign board
  const [sx, sz] = place(3, -6);
  builder.addBox(sx, y + 0.25, sz, 1.6, 0.06, 0.6, yaw, colour("#8a6a45")); // a bench outside
  if (random() < 0.5) {
    const [cx, cz] = place(0, -9);
    addCar(builder, cx, y, cz, yaw + Math.PI / 2, carColor(random()));
  }
}

// route.villages is the list from route.js; `terrain`/`path`/`seed` come from the chunk context.
// Only draws a village whose marker falls in [d0, d1) — like the other structures, one chunk owns it.
export function addVillage(builder, ctx, terrain, d0, d1) {
  const { path, seed } = ctx;
  for (const village of ctx.route.villages ?? []) {
    if (village.at < d0 || village.at >= d1) continue;
    const s = village.side === "left" ? -1 : 1;
    const random = makeRandom(seed * 53 + Math.round(village.at));

    const at = (along, lateral) => {
      const p = path.pathAt(village.at + along, {});
      const beside = pointBeside(p, s * lateral, {});
      return { x: beside.x, y: terrain.groundY(village.at + along, s * lateral), z: beside.z, heading: p.heading };
    };
    // yaw so the building faces back toward the track (down the lane, roughly).
    const faceTrack = (heading) => -heading + Math.PI / 2 * -s;

    // The church, set back a little further than the cottages, near the crossing.
    {
      const p = at(-24, LANE_OFFSET_M + 10);
      buildChurch(builder, p.x, p.y, p.z, faceTrack(p.heading));
    }
    // The pub, the other side of the crossing.
    {
      const p = at(20, LANE_OFFSET_M);
      addPub(builder, p.x, p.y, p.z, faceTrack(p.heading), random);
    }
    // A dozen stone cottages in a row along the lane.
    const start = -((COTTAGE_COUNT - 1) * COTTAGE_SPACING_M) / 2;
    for (let i = 0; i < COTTAGE_COUNT; i++) {
      const along = start + i * COTTAGE_SPACING_M + (hashRandom(seed, i, 1) - 0.5) * 2.5;
      if (Math.abs(along - -24) < 8 || Math.abs(along - 20) < 8) continue; // leave room for the church and pub
      const p = at(along, LANE_OFFSET_M - 6 + hashRandom(seed, i, 2) * 3);
      const wall = STONE_COLORS[Math.floor(hashRandom(seed, i, 3) * STONE_COLORS.length)];
      const roofColor = ROOF_COLORS[Math.floor(hashRandom(seed, i, 4) * ROOF_COLORS.length)];
      const width = 5.5 + hashRandom(seed, i, 5) * 1.5, length = 6 + hashRandom(seed, i, 6) * 2;
      addHouse(builder, p.x, p.y, p.z, faceTrack(p.heading) + (hashRandom(seed, i, 7) - 0.5) * 0.3, width, 4.6, length, wall, roofColor, 2.2);
      if (hashRandom(seed, i, 8) < 0.3) addCar(builder, p.x - Math.sin(p.heading) * 5, p.y, p.z - Math.cos(p.heading) * 5, faceTrack(p.heading), carColor(hashRandom(seed, i, 9)));
    }
  }
}
