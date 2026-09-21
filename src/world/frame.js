// frame.js — a little frame of directions at one point on the track, so things can be
// placed "so far along the track, so far to the side, so far up" instead of in world
// coordinates. Used for bridges, crossings and stations (which are all built on straight track).

// Returns { heading, y, at(along, lateral, up) }. `lateral` is metres to the right of the track
// (negative = left) and `up` is metres above the top of the rail.
export function frameAt(path, d) {
  const p = path.pathAt(d, {});
  const h = p.heading;
  return {
    heading: h, y: p.y, slope: p.slope,
    at(along, lateral, up) {
      return [p.x + Math.sin(h) * along + Math.cos(h) * lateral, p.y + up, p.z - Math.cos(h) * along + Math.sin(h) * lateral];
    },
  };
}
