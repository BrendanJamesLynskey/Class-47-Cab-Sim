// buildings.js — simple buildings made from boxes and pitched roofs.
// Right now that is just a farm; the village and town come in a later version.

import { BOX, GABLE, colour } from "./mesh-builder.js";

// Turns "so far to the right and so far forward, in a building's own directions" into
// world x and z. Three.js turns a shape about the up axis by `yaw` like this:
function inBuildingDirections(x, z, yaw, right, forward) {
  return [x + Math.cos(yaw) * right + Math.sin(yaw) * forward, z - Math.sin(yaw) * right + Math.cos(yaw) * forward];
}

// A house: walls (a box) and a pitched roof on top. (x, y, z) is the middle of the
// ground under the house. `yaw` turns it, `width` is the gable-end width.
export function addHouse(builder, x, y, z, yaw, width, height, length, wallColor, roofColor, roofHeight = 2.4) {
  builder.addShape(BOX, x, y + height / 2, z, width, height, length, yaw, 0, colour(wallColor));
  // The roof overhangs the walls a little.
  builder.addShape(GABLE, x, y + height + roofHeight / 2, z, width + 0.6, roofHeight, length + 0.6, yaw, 0, colour(roofColor));
  // A chimney at one end.
  const [cx, cz] = inBuildingDirections(x, z, yaw, width * 0.25, length * 0.35);
  builder.addBox(cx, y + height + roofHeight * 0.8, cz, 0.6, roofHeight * 1.1, 0.6, yaw, colour("#8a4a3a"));
}

// A farm: a farmhouse, a big barn and a yard. (x, y, z) is the middle of the yard.
// `yaw` decides which way the buildings face.
export function addFarm(builder, x, y, z, yaw, random) {
  // `right` is along the farm's width, `forward` along its length.
  const place = (right, forward) => inBuildingDirections(x, z, yaw, right, forward);

  builder.addBox(x, y + 0.04, z, 30, 0.08, 26, yaw, colour("#8c7f68")); // the muddy yard

  const [hx, hz] = place(-9, 0);
  addHouse(builder, hx, y, hz, yaw, 8, 5, 6.5, random() < 0.5 ? "#d9cfb6" : "#b9a88a", "#6a4a40", 2.6);

  const [bx, bz] = place(7, -2);
  addHouse(builder, bx, y, bz, yaw, 10, 6, 15, "#8a6a4a", "#5b5d61", 3.4);

  const [sx, sz] = place(11, 9);
  builder.addShape(BOX, sx, y + 3.5, sz, 3, 7, 3, yaw, 0, colour("#bfc4c6")); // a grain silo
}
