// route.js — the railway line, written as plain data. Change it, save, and the
// train runs along your new line!
//
// Every distance in this file is in MILES from the start of the line.
// (The game turns them into metres for you, in routeInMetres() at the bottom.)
//
// The line runs between two stations, through farmland, woods, cuttings and open moorland, with two
// river valleys. Later versions add a village halt and a town station using the
// empty lists at the bottom. To change the line, edit the lists. For example, to
// add a 1-in-100 hill: { from: 2.0, to: 2.5, oneIn: 100 } in `gradients`.

import { milesToMetres } from "./units.js";

export const ROUTE = {
  name: "Country line",
  lengthMiles: 14,

  // What the scenery around the line is like along each stretch.
  // Types: "country" (farmland), "wood", "hills" (open moorland), "cutting" (the track
  // sinks into the ground), "embankment" (the track is raised up), "valley" (a flat
  // river valley), "station" (flat land round a platform). "village" and "town" are for a later version.
  environment: [
    { from: 0.0,  to: 0.32, type: "station" },
    { from: 0.32, to: 1.2,  type: "country" },
    { from: 1.2,  to: 2.0,  type: "wood" },
    { from: 2.0,  to: 2.6,  type: "cutting" },
    { from: 2.6,  to: 3.0,  type: "country" },
    { from: 3.0,  to: 5.2,  type: "hills" },
    { from: 5.2,  to: 5.6,  type: "embankment" },
    { from: 5.6,  to: 6.6,  type: "valley" },
    { from: 6.6,  to: 6.72, type: "country" },
    { from: 6.72, to: 6.78, type: "station" },   // Foxlow Halt
    { from: 6.78, to: 8.4,  type: "country" },
    { from: 8.4,  to: 9.4,  type: "wood" },
    { from: 9.4,  to: 10.0, type: "country" },
    { from: 10.0, to: 11.6, type: "hills" },
    { from: 11.6, to: 12.1, type: "embankment" },
    { from: 12.1, to: 12.9, type: "valley" },
    { from: 12.9, to: 13.75, type: "country" },
    { from: 13.75, to: 14.0, type: "station" },
  ],

  // The speed limit that applies from each point until the next one.
  speedLimits: [
    { from: 0,     mph: 75 },
    { from: 4.65,  mph: 60 },   // the tight bend on the moor
    { from: 5.35,  mph: 75 },
    { from: 10.25, mph: 60 },
    { from: 10.95, mph: 75 },
  ],

  // Hills the TRACK climbs. oneIn: 150 means 1 metre up for every 150 metres along:
  // real main lines are this gentle, so you barely see it, but a heavy train feels it!
  // Positive = uphill, negative = downhill.
  gradients: [
    { from: 0.3,  to: 0.9,  oneIn: 250 },
    { from: 1.0,  to: 1.6,  oneIn: -300 },
    { from: 2.6,  to: 3.0,  oneIn: 200 },
    { from: 3.1,  to: 4.7,  oneIn: 140 },    // the long climb onto the moor
    { from: 4.7,  to: 5.3,  oneIn: -180 },
    { from: 5.3,  to: 5.85, oneIn: -250 },
    { from: 6.15, to: 6.9,  oneIn: 300 },
    { from: 7.0,  to: 8.6,  oneIn: 200 },
    { from: 8.6,  to: 9.4,  oneIn: -220 },
    { from: 10.0, to: 11.0, oneIn: 160 },
    { from: 11.0, to: 11.7, oneIn: -150 },
    { from: 11.7, to: 12.3, oneIn: -200 },
    { from: 12.5, to: 13.4, oneIn: 250 },
  ],

  // Bends. radius_m is how tight (bigger = gentler). The rest of the line is straight.
  curves: [
    { from: 0.6,  to: 1.1,  radius_m: 2000, direction: "right" },
    { from: 1.5,  to: 1.9,  radius_m: 1600, direction: "left" },
    { from: 2.9,  to: 3.5,  radius_m: 1200, direction: "right" },
    { from: 4.0,  to: 4.4,  radius_m: 1800, direction: "left" },
    { from: 4.7,  to: 5.3,  radius_m: 1000, direction: "right" },
    { from: 6.9,  to: 7.6,  radius_m: 2200, direction: "left" },
    { from: 8.0,  to: 8.5,  radius_m: 1400, direction: "right" },
    { from: 9.0,  to: 9.6,  radius_m: 2500, direction: "left" },
    { from: 10.3, to: 10.9, radius_m: 1100, direction: "right" },
    { from: 11.2, to: 11.7, radius_m: 1300, direction: "left" },
    { from: 13.0, to: 13.6, radius_m: 1800, direction: "right" },
  ],

  // Bridges. kind "river": the track crosses a river on a stone viaduct (put it in a "valley").
  // kind "road": a road crosses over the line (put it in a "cutting"). Footpaths that cross
  // the line at track level are in `levelCrossings` below instead.
  bridges: [
    { from: 2.297, to: 2.303,  kind: "road" },
    { from: 5.988, to: 6.012,  kind: "river" },
    { from: 12.388, to: 12.412, kind: "river" },
  ],

  // Where the train starts (in miles). It stands at the far end of the first platform.
  startAt: 0.168,

  // Stations: the line starts and ends at one. `at` is the middle of the platform; `side` says
  // which side of the track the platform is on. Each has a modern platform with old brick buildings.
  stations: [
    { name: "Aldbury", at: 0.12, platformLength_m: 180, side: "left", footbridgeBeyond: true, kind: "terminus" },
    { name: "Foxlow Halt", at: 6.75, platformLength_m: 40, side: "left", kind: "halt" },
    { name: "Northwick", at: 13.9385, platformLength_m: 180, side: "right", footbridgeBeyond: false, kind: "terminus",
      stopMarkerAt: 13.9907 },   // termini differ from through stations: the target is close to
                                  // the buffers, not the platform's middle, so the whole platform is used
  ],

  // The village round the halt: `at` is roughly its centre, `side` says which side of the
  // track the church, pub and cottages mostly stand on (the OTHER side from the platform,
  // so the level crossing has somewhere to lead to).
  villages: [{ at: 6.7, side: "right" }],

  // The stretch of line dressed as a town, approaching the main station: terraced houses,
  // a mill, a gasworks and warehouses. `side` is which side the main street is on.
  towns: [{ from: 12.9, to: 13.7, side: "left" }],

  // Footpaths that cross the line at track level, just for people (there are no barriers:
  // walkers open a little gate, look and listen). A whistle board a little way before each
  // one reminds the driver to sound the horn.
  // "footpath" crossings are for walkers only (a gate each side, no barriers). "road" is a
  // proper road crossing with gates that swing shut, warning lights and a cattle grid either
  // side (for the village, where a lane meets the line).
  levelCrossings: [
    { at: 1.32, kind: "footpath" },
    { at: 6.65, kind: "road" },       // the village level crossing
    { at: 9.7,  kind: "footpath" },   // this one used to be a road bridge over a cutting
    { at: 12.75, kind: "footpath" },
  ],

  // Later milestones fill these in:
  signals: [],        // { at, aspect: "green" | "double-yellow" | "yellow" | "red" }
  tunnels: [],        // { from, to }
};

// Copies the route with every distance turned from miles into metres.
export function routeInMetres(route = ROUTE) {
  const m = milesToMetres;
  const range = (item) => ({ ...item, from: m(item.from), to: m(item.to) });
  return {
    name: route.name,
    length_m: m(route.lengthMiles),
    start_m: m(route.startAt ?? 0),
    environment: route.environment.map(range),
    speedLimits: route.speedLimits.map((s) => ({ ...s, from: m(s.from) })),
    stations: route.stations.map((s) => ({ ...s, at: m(s.at), stopMarkerAt_m: m(s.stopMarkerAt ?? s.at) })),
    villages: (route.villages ?? []).map((v) => ({ ...v, at: m(v.at) })),
    towns: (route.towns ?? []).map((t) => ({ ...t, from: m(t.from), to: m(t.to) })),
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
