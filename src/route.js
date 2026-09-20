// route.js — the railway line, written as plain data. Change it, save, and the
// train runs along your new line!
//
// Every distance in this file is in MILES from the start of the line.
// (The game turns them into metres for you, in routeInMetres() at the bottom.)
//
// For now the line is straight, flat, open country. Later versions add a village
// halt, a town station, curves and hills, using the empty lists below. To add
// something, add a line to the right list. For example, a 1-in-100 hill:
//     gradients: [{ from: 2.0, to: 2.5, oneIn: 100 }],   // oneIn: 100 = up, -100 = down

import { milesToMetres } from "./units.js";

export const ROUTE = {
  name: "Country test line",
  lengthMiles: 5.5,

  // What the scenery around the line is like along each stretch.
  // Types: "country", "village", "town", "cutting", "embankment"
  environment: [{ from: 0, to: 5.5, type: "country" }],

  // The speed limit that applies from each point until the next one.
  speedLimits: [{ from: 0, mph: 75 }],

  // Later milestones fill these in:
  stations: [],       // { name, at, platformLength_m, side: "left" or "right" }
  signals: [],        // { at, aspect: "green" | "double-yellow" | "yellow" | "red" }
  gradients: [],      // { from, to, oneIn }  positive = uphill, negative = downhill
  curves: [],         // { from, to, radius_m, direction: "left" or "right" }
  levelCrossings: [], // { at }
  bridges: [],        // { from, to, kind }
  tunnels: [],        // { from, to }
};

// Copies the route with every distance turned from miles into metres.
export function routeInMetres(route = ROUTE) {
  const m = milesToMetres;
  const range = (item) => ({ ...item, from: m(item.from), to: m(item.to) });
  return {
    name: route.name,
    length_m: m(route.lengthMiles),
    environment: route.environment.map(range),
    speedLimits: route.speedLimits.map((s) => ({ ...s, from: m(s.from) })),
    stations: route.stations.map((s) => ({ ...s, at: m(s.at) })),
    signals: route.signals.map((s) => ({ ...s, at: m(s.at) })),
    gradients: route.gradients.map((g) => ({ ...range(g), slope: 1 / g.oneIn })),
    curves: route.curves.map((c) => ({ ...range(c), curvature_per_m: (c.direction === "left" ? -1 : 1) / c.radius_m })),
    levelCrossings: route.levelCrossings.map((l) => ({ ...l, at: m(l.at) })),
    bridges: route.bridges.map(range),
    tunnels: route.tunnels.map(range),
  };
}

// The speed limit (in mph) at a distance along the line, in metres.
// `route` is the result of routeInMetres().
export function speedLimitAt(route, distance_m) {
  let limit = route.speedLimits[0].mph;
  for (const s of route.speedLimits) if (distance_m >= s.from) limit = s.mph;
  return limit;
}
