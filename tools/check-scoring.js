// check-scoring.js — checks that stop scoring classifies distances correctly and that the
// tracker only scores each station once, at the right moment.
//
// Run it with:   node tools/check-scoring.js

import { classifyStop, makeScoreTracker, updateScoreTracker, totalScore, allStationsScored } from "../src/scoring.js";
import { ROUTE, routeInMetres } from "../src/route.js";
import * as C from "../src/config.js";

let allGood = true;
function check(name, ok, detail = "") {
  if (!ok) allGood = false;
  console.log(`${ok ? "ok   " : "FAIL "} ${name}${detail ? "   " + detail : ""}`);
}

// ---- classifyStop ----
check("0 m is Perfect", classifyStop(0).label === "Perfect");
check(`${C.STOP_PERFECT_M} m is still Perfect`, classifyStop(C.STOP_PERFECT_M).label === "Perfect");
check(`just over ${C.STOP_PERFECT_M} m is Good`, classifyStop(C.STOP_PERFECT_M + 0.01).label === "Good");
check(`${C.STOP_GOOD_M} m is still Good`, classifyStop(C.STOP_GOOD_M).label === "Good");
check(`just over ${C.STOP_GOOD_M} m is OK`, classifyStop(C.STOP_GOOD_M + 0.01).label === "OK");
check(`${C.STOP_OK_M} m is still OK`, classifyStop(C.STOP_OK_M).label === "OK");
check(`just over ${C.STOP_OK_M} m is Missed`, classifyStop(C.STOP_OK_M + 0.01).label === "Missed");
check("Missed scores 0 points", classifyStop(1000).points === 0);
check("Perfect scores more than Good, which scores more than OK", classifyStop(0).points > classifyStop(10).points && classifyStop(10).points > classifyStop(25).points);

// ---- makeScoreTracker ----
const route = routeInMetres(ROUTE);
{
  const tracker = makeScoreTracker(route);
  check("the first station (where you start) is not tracked", tracker.stations.length === route.stations.length - 1);
  check("the tracked stations are the second one onward, in order", tracker.stations[0].name === route.stations[1].name);
}

// ---- updateScoreTracker ----
{
  const tracker = makeScoreTracker(route);
  const halt = tracker.stations[0];
  check("nothing is scored while the train is still moving", updateScoreTracker(tracker, halt.at_m, 5) === null);
  check("nothing is scored a long way from any station", updateScoreTracker(tracker, halt.at_m + 5000, 0) === null);
  check("still nothing scored: it wasn't really the train stopping, just checking", !halt.scored);

  const scored = updateScoreTracker(tracker, halt.at_m + 2, 0);
  check("stopping 2 m from the marker scores that station", scored === halt && halt.scored && halt.label === "Perfect", halt.label);
  check("a second stop at the same spot doesn't score it again", updateScoreTracker(tracker, halt.at_m + 2, 0) === null);

  const next = tracker.stations[1];
  check("stopping badly (25 m out) at the next station scores OK, not Perfect", updateScoreTracker(tracker, next.at_m + 25, 0).label === "OK");
  check("all stations are now scored", allStationsScored(tracker));
  check("the total is the sum of both stations' points", totalScore(tracker) === halt.points + next.points);
}
{
  // A stop exactly halfway between two stations, further than the attempt window from either,
  // should not be claimed by the wrong one.
  const tracker = makeScoreTracker(route);
  const [a, b] = tracker.stations;
  const midpoint = (a.at_m + b.at_m) / 2;
  if (midpoint - a.at_m > C.STOP_ATTEMPT_WINDOW_M) {
    check("stopping halfway between two stations scores neither", updateScoreTracker(tracker, midpoint, 0) === null);
  } else {
    console.log("skip  (the halt and Northwick are closer together than the attempt window — nothing to check here)");
  }
}

console.log(allGood ? "\nAll scoring checks passed." : "\nSome scoring checks FAILED.");
process.exit(allGood ? 0 : 1);
