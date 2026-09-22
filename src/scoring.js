// scoring.js — how well you stop at a station. PURE: no DOM, no Three.js, so it can be
// tested with node (tools/check-scoring.js) and used the same way by main.js and the tests.
//
// The first station in the route (where the journey starts) is never scored: you begin
// there, you don't "arrive". Every station after that is a scored stop.

import * as C from "./config.js";

// Turns a distance from the marker into a label and a points value.
export function classifyStop(distance_m) {
  if (distance_m <= C.STOP_PERFECT_M) return { label: "Perfect", points: C.STOP_PERFECT_POINTS };
  if (distance_m <= C.STOP_GOOD_M) return { label: "Good", points: C.STOP_GOOD_POINTS };
  if (distance_m <= C.STOP_OK_M) return { label: "OK", points: C.STOP_OK_POINTS };
  return { label: "Missed", points: C.STOP_MISSED_POINTS };
}

// A fresh tracker for a new run: one entry per SCORED station (every station except the
// first), in the order the journey reaches them. `route` is the result of routeInMetres().
export function makeScoreTracker(route) {
  return {
    stations: route.stations.slice(1).map((s) => ({
      name: s.name, at_m: s.stopMarkerAt_m, scored: false, distance_m: null, label: null, points: 0,
    })),
  };
}

// Call this once a physics step, with the train's distance and speed. While the train is
// standing still (speed_mps === 0) close to a station that hasn't been scored yet, it scores
// that station and returns it. Otherwise returns null. A station only ever scores once.
export function updateScoreTracker(tracker, distance_m, speed_mps) {
  if (speed_mps !== 0) return null;
  for (const station of tracker.stations) {
    if (station.scored) continue;
    const distance = Math.abs(distance_m - station.at_m);
    if (distance > C.STOP_ATTEMPT_WINDOW_M) continue;
    const { label, points } = classifyStop(distance);
    station.scored = true;
    station.distance_m = distance;
    station.label = label;
    station.points = points;
    return station;
  }
  return null;
}

// The running total, and whether every scored station has now had its turn.
export function totalScore(tracker) {
  return tracker.stations.reduce((sum, s) => sum + s.points, 0);
}
export function allStationsScored(tracker) {
  return tracker.stations.every((s) => s.scored);
}
