// check-route.js — checks that the route in src/route.js makes sense.
//
// Run it with:   node tools/check-route.js
//
// Run it after you edit route.js. It catches things like a station that overlaps
// another, a speed limit list with a gap, or a hill that is far too steep.

import { ROUTE, routeInMetres, speedLimitAt } from "../src/route.js";
import { buildPath } from "../src/path.js";
import { milesToMetres } from "../src/units.js";

const MAX_GRADIENT = 1 / 40;      // steeper than 1 in 40 is not a main line
const MIN_CURVE_RADIUS_M = 800;   // tighter than this makes the scenery on the inside of the bend overlap
const MIN_TUNNEL_M = 50;

// Returns a list of problems (an empty list means the route is fine).
export function findProblems(route) {
  const problems = [];
  const length = route.lengthMiles;
  const fail = (text) => problems.push(text);

  if (!(length > 0.5 && length < 30)) fail(`lengthMiles is ${length}: expected between 0.5 and 30`);

  // Lists of { from, to }: must be in order, not overlap, and stay inside the line.
  const checkRanges = (name, list, { mustCoverAll = false } = {}) => {
    let previousEnd = 0;
    list.forEach((item, i) => {
      const label = `${name}[${i}]`;
      if (!(item.from >= 0 && item.to <= length + 1e-9)) fail(`${label} goes outside the line (0 to ${length} miles)`);
      if (!(item.to > item.from)) fail(`${label}: "to" must be bigger than "from"`);
      if (item.from < previousEnd - 1e-9) fail(`${label} starts before the one above it ends (they overlap, or are out of order)`);
      if (mustCoverAll && i > 0 && Math.abs(item.from - previousEnd) > 1e-9) fail(`${label} leaves a gap after the one above it`);
      previousEnd = item.to;
    });
    if (mustCoverAll) {
      if (list.length === 0 || list[0].from !== 0) fail(`${name} must start at 0`);
      else if (Math.abs(previousEnd - length) > 1e-9) fail(`${name} must reach the end of the line (${length} miles), but ends at ${previousEnd}`);
    }
  };

  checkRanges("environment", route.environment, { mustCoverAll: true });
  checkRanges("gradients", route.gradients);
  checkRanges("curves", route.curves);
  checkRanges("bridges", route.bridges);
  checkRanges("tunnels", route.tunnels);

  // Speed limits: a list of "from" points that start at 0 and go up.
  if (route.speedLimits.length === 0 || route.speedLimits[0].from !== 0) fail("speedLimits must start with one that has from: 0, so the whole line has a limit");
  route.speedLimits.forEach((s, i) => {
    if (i > 0 && !(s.from > route.speedLimits[i - 1].from)) fail(`speedLimits[${i}] is not further along than the one above it`);
    if (!(s.mph >= 5 && s.mph <= 125)) fail(`speedLimits[${i}] is ${s.mph} mph: expected 5 to 125`);
    if (s.from >= length) fail(`speedLimits[${i}] starts past the end of the line`);
  });

  route.gradients.forEach((g, i) => {
    if (!g.oneIn || Math.abs(1 / g.oneIn) > MAX_GRADIENT) fail(`gradients[${i}]: 1 in ${g.oneIn} is too steep (steepest allowed is 1 in ${1 / MAX_GRADIENT})`);
  });
  route.curves.forEach((c, i) => {
    if (!(c.radius_m >= MIN_CURVE_RADIUS_M)) fail(`curves[${i}]: radius ${c.radius_m} m is too tight (minimum ${MIN_CURVE_RADIUS_M} m)`);
    if (c.direction !== "left" && c.direction !== "right") fail(`curves[${i}]: direction must be "left" or "right"`);
  });
  route.tunnels.forEach((t, i) => {
    if (milesToMetres(t.to - t.from) < MIN_TUNNEL_M) fail(`tunnels[${i}] is shorter than ${MIN_TUNNEL_M} m`);
  });

  // Stations: in order, inside the line, platforms not overlapping.
  let previousPlatformEnd = -Infinity;
  route.stations.forEach((s, i) => {
    const half = s.platformLength_m / 2;
    const start = milesToMetres(s.at) - half;
    const end = milesToMetres(s.at) + half;
    if (!(s.at > 0 && s.at < length)) fail(`stations[${i}] (${s.name}) is not inside the line`);
    if (start < previousPlatformEnd) fail(`stations[${i}] (${s.name}) overlaps the station before it`);
    if (s.side !== "left" && s.side !== "right") fail(`stations[${i}] (${s.name}): side must be "left" or "right"`);
    previousPlatformEnd = end;
  });

  // Signals and level crossings must not be inside a platform.
  const insidePlatform = (miles) =>
    route.stations.find((s) => Math.abs(milesToMetres(miles - s.at)) < s.platformLength_m / 2);
  route.signals.forEach((s, i) => {
    if (!(s.at > 0 && s.at < length)) fail(`signals[${i}] is not inside the line`);
    const station = insidePlatform(s.at);
    if (station) fail(`signals[${i}] is inside the platform at ${station.name}`);
  });
  route.levelCrossings.forEach((l, i) => {
    if (!(l.at > 0 && l.at < length)) fail(`levelCrossings[${i}] is not inside the line`);
    const station = insidePlatform(l.at);
    if (station) fail(`levelCrossings[${i}] is inside the platform at ${station.name}`);
  });

  return problems;
}

let allGood = true;
function report(name, problems) {
  if (problems.length === 0) console.log(`ok    ${name}`);
  else {
    allGood = false;
    console.log(`FAIL  ${name}`);
    problems.forEach((p) => console.log(`        - ${p}`));
  }
}

// ---- 1. The real route ----
report(`route "${ROUTE.name}" (${ROUTE.lengthMiles} miles)`, findProblems(ROUTE));

// ---- 2. Does the checker itself catch mistakes? Try some deliberately bad routes. ----
function expectProblem(name, change) {
  const bad = structuredClone(ROUTE);
  change(bad);
  const found = findProblems(bad).length > 0;
  if (!found) allGood = false;
  console.log(`${found ? "ok   " : "FAIL "} checker spots: ${name}`);
}
expectProblem("a gap in the speed limits", (r) => (r.speedLimits = [{ from: 1, mph: 60 }]));
expectProblem("an absurd hill", (r) => (r.gradients = [{ from: 1, to: 2, oneIn: 8 }]));
expectProblem("overlapping stations", (r) => (r.stations = [
  { name: "A", at: 1, platformLength_m: 200, side: "left" }, { name: "B", at: 1.05, platformLength_m: 200, side: "left" }]));
expectProblem("a signal inside a platform", (r) => {
  r.stations = [{ name: "A", at: 1, platformLength_m: 200, side: "left" }];
  r.signals = [{ at: 1.01, aspect: "green" }];
});
expectProblem("scenery that stops before the end", (r) => (r.environment = [{ from: 0, to: 3, type: "country" }]));
expectProblem("a curve that is too tight", (r) => (r.curves = [{ from: 1, to: 1.2, radius_m: 200, direction: "left" }]));

// ---- 3. Does the track shape come out right? (checked against known geometry) ----
{
  const problems = [];
  const testRoute = structuredClone(ROUTE);
  testRoute.curves = [{ from: 0.5, to: 1.5, radius_m: 1000, direction: "right" }];
  testRoute.gradients = [{ from: 2, to: 3, oneIn: 100 }];
  const path = buildPath(routeInMetres(testRoute));
  const start = path.pathAt(0);
  if (start.x !== 0 || start.z !== 0 || start.heading !== 0) problems.push("the line should start at the origin, facing -Z");
  const straight = path.pathAt(400);
  if (Math.abs(straight.z + 400) > 0.01 || Math.abs(straight.x) > 0.01) problems.push("straight track should run along -Z");
  // A 1 mile curve of radius 1000 m turns through (1609.344 / 1000) radians, to the right (positive heading).
  const afterCurve = path.pathAt(milesToMetres(1.5) + 1);
  const expectedTurn = milesToMetres(1) / 1000;
  if (Math.abs(afterCurve.heading - expectedTurn) > 0.01) problems.push(`curve turned ${afterCurve.heading.toFixed(3)} rad, expected ${expectedTurn.toFixed(3)}`);
  const afterHill = path.pathAt(milesToMetres(3) + 1);
  if (Math.abs(afterHill.y - milesToMetres(1) / 100) > 0.05) problems.push(`1-in-100 for a mile rose ${afterHill.y.toFixed(2)} m, expected ${(milesToMetres(1) / 100).toFixed(2)}`);
  report("path.js turns curves and hills into the right 3D shape", problems);
}

// ---- 4. Does the speed limit lookup use the right limit for each stretch? ----
{
  const problems = [];
  const testRoute = structuredClone(ROUTE);
  testRoute.speedLimits = [{ from: 0, mph: 75 }, { from: 3, mph: 40 }, { from: 4, mph: 60 }];
  const metric = routeInMetres(testRoute);
  const expect = (miles, mph) => {
    const got = speedLimitAt(metric, milesToMetres(miles));
    if (got !== mph) problems.push(`at ${miles} miles the limit should be ${mph}, but it is ${got}`);
  };
  expect(0, 75); expect(2.99, 75); expect(3, 40); expect(3.5, 40); expect(4.2, 60); expect(5.4, 60);
  report("speedLimitAt picks the right limit for each stretch", problems);
}

console.log(allGood ? "\nAll route checks passed." : "\nSome route checks FAILED.");
process.exit(allGood ? 0 : 1);
