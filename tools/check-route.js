// check-route.js — checks that the route in src/route.js makes sense.
//
// Run it with:   node tools/check-route.js
//
// Run it after you edit route.js. It catches things like a station that overlaps
// another, a speed limit list with a gap, or a hill that is far too steep.

import { ROUTE, routeInMetres, speedLimitAt } from "../src/route.js";
import { buildPath } from "../src/path.js";
import { milesToMetres } from "../src/units.js";
import { EASEMENT_M } from "../src/config.js";

const MAX_GRADIENT = 1 / 40;      // steeper than 1 in 40 is not a main line
const MIN_CURVE_RADIUS_M = 1000;  // tighter than this makes the scenery on the inside of the bend overlap
const MAX_ELEVATION_RANGE_M = 80; // the whole line should not climb or fall more than this overall
const MIN_BRIDGE_CLEAR_M = 150;   // bridges keep this far from the bends (they are built straight)
const MIN_CROSSING_CLEAR_M = 100; // level crossings keep this far from bends, bridges and platforms
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

  // Bridges: a river bridge belongs in a "valley", a road bridge in a "cutting", and both on straight track.
  const environmentAt = (miles) => route.environment.find((e) => miles >= e.from && miles < e.to);
  route.bridges.forEach((b, i) => {
    const middle = (b.from + b.to) / 2;
    const environment = environmentAt(middle);
    if (b.kind === "river" && environment?.type !== "valley") fail(`bridges[${i}] is a river bridge, but the scenery there is "${environment?.type}" (it should be "valley")`);
    if (b.kind === "road" && environment?.type !== "cutting") fail(`bridges[${i}] is a road bridge, but the scenery there is "${environment?.type}" (it should be "cutting")`);
    if (b.kind !== "river" && b.kind !== "road") fail(`bridges[${i}]: kind must be "river" or "road"`);
    const nearBend = route.curves.find((c) => middle > c.from - MIN_BRIDGE_CLEAR_M / 1609.344 && middle < c.to + MIN_BRIDGE_CLEAR_M / 1609.344);
    if (nearBend) fail(`bridges[${i}] is too close to a bend (keep ${MIN_BRIDGE_CLEAR_M} m clear)`);
    const onHill = route.gradients.find((g) => middle > g.from - 0.05 && middle < g.to + 0.05);
    if (onHill) fail(`bridges[${i}] is on a slope: leave the track level for 0.05 miles either side`);
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
    if (s.kind && s.kind !== "terminus" && s.kind !== "halt") fail(`stations[${i}] (${s.name}): kind must be "terminus" or "halt"`);
    if (s.stopMarkerAt !== undefined && milesToMetres(Math.abs(s.stopMarkerAt - s.at)) > s.platformLength_m / 2) fail(`stations[${i}] (${s.name}): stopMarkerAt is outside the platform`);
    previousPlatformEnd = end;
  });

  // Stations sit in flat "station" scenery, and the train starts on the first platform.
  route.stations.forEach((st, i) => {
    const env = environmentAt(st.at);
    if (env?.type !== "station") fail(`stations[${i}] (${st.name}): the scenery there is "${env?.type}", it should be "station"`);
    const near = route.curves.find((c) => st.at > c.from - (st.platformLength_m / 2 + MIN_BRIDGE_CLEAR_M) / 1609.344 && st.at < c.to + (st.platformLength_m / 2 + MIN_BRIDGE_CLEAR_M) / 1609.344);
    if (near) fail(`stations[${i}] (${st.name}) is too close to a bend (platforms are built straight)`);
  });
  if (route.startAt !== undefined && route.stations.length > 0) {
    const first = route.stations[0];
    const halfMiles = first.platformLength_m / 2 / 1609.344;
    if (!(route.startAt > first.at - halfMiles + 0.01 && route.startAt < first.at + halfMiles)) fail(`startAt (${route.startAt}) is not on the first platform (${first.name})`);
  }

  // Level crossings: on straight track, away from bridges and platforms, and not in a cutting.
  const milesToM = 1609.344;
  route.levelCrossings.forEach((l, i) => {
    const env = environmentAt(l.at);
    if (env?.type === "cutting" || env?.type === "station") fail(`levelCrossings[${i}] is in a "${env.type}" (a footpath crossing needs level country)`);
    const clear = MIN_CROSSING_CLEAR_M / milesToM;
    if (route.curves.find((c) => l.at > c.from - clear && l.at < c.to + clear)) fail(`levelCrossings[${i}] is too close to a bend (keep ${MIN_CROSSING_CLEAR_M} m clear)`);
    if (route.bridges.find((b) => l.at > b.from - clear && l.at < b.to + clear)) fail(`levelCrossings[${i}] is too close to a bridge`);
    const platform = route.stations.find((st) => Math.abs(l.at - st.at) * milesToM < st.platformLength_m / 2 + MIN_CROSSING_CLEAR_M);
    if (platform) fail(`levelCrossings[${i}] is too close to the platform at ${platform.name}`);
    if (route.levelCrossings.find((other, j) => j !== i && Math.abs(other.at - l.at) * milesToM < 300)) fail(`levelCrossings[${i}] is within 300 m of another crossing`);
    if (l.kind !== "footpath" && l.kind !== "road") fail(`levelCrossings[${i}]: kind must be "footpath" or "road"`);
  });

  // Villages (a point) and towns (a stretch): must be on the line, and towns must be well formed.
  (route.villages ?? []).forEach((v, i) => {
    if (!(v.at > 0 && v.at < length)) fail(`villages[${i}] is not inside the line`);
    if (v.side !== "left" && v.side !== "right") fail(`villages[${i}]: side must be "left" or "right"`);
  });
  checkRanges("towns", route.towns ?? []);
  (route.towns ?? []).forEach((t, i) => {
    if (t.side !== "left" && t.side !== "right") fail(`towns[${i}]: side must be "left" or "right"`);
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

// ---- 1b. What does the real route do? (heights, direction, steepest hill) ----
{
  const problems = [];
  const metric = routeInMetres(ROUTE);
  const path = buildPath(metric);
  let lowest = Infinity, highest = -Infinity, steepest = 0, wander = 0;
  for (let d = 0; d <= metric.length_m; d += 25) {
    const p = path.pathAt(d);
    lowest = Math.min(lowest, p.y); highest = Math.max(highest, p.y);
    steepest = Math.max(steepest, Math.abs(p.slope));
    wander = Math.max(wander, Math.hypot(p.x, p.z));
  }
  const end = path.pathAt(metric.length_m);
  console.log(`      the line: ${(metric.length_m / 1609.344).toFixed(1)} miles, height from ${lowest.toFixed(1)} m to ${highest.toFixed(1)} m, steepest 1 in ${(1 / steepest).toFixed(0)}, ends ${Math.hypot(end.x, end.z).toFixed(0)} m from the start as the crow flies, turned ${(end.heading * 57.2958).toFixed(0)} degrees overall`);
  if (highest - lowest > MAX_ELEVATION_RANGE_M) problems.push(`the line climbs and falls ${(highest - lowest).toFixed(0)} m overall (more than ${MAX_ELEVATION_RANGE_M} m)`);
  // The route should never come back close to itself (the scenery would overlap).
  for (let a = 0; a < metric.length_m; a += 400) {
    const pa = path.pathAt(a);
    for (let b = a + 2500; b < metric.length_m; b += 400) {
      const pb = path.pathAt(b);
      if (Math.hypot(pa.x - pb.x, pa.z - pb.z) < 1000) { problems.push(`the line passes within 1 km of itself at ${(a / 1609.344).toFixed(1)} and ${(b / 1609.344).toFixed(1)} miles`); a = Infinity; break; }
    }
  }
  report("the real route's shape is sensible", problems);
}

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
expectProblem("a river bridge in the wrong scenery", (r) => (r.bridges = [{ from: 1.0, to: 1.02, kind: "river" }]));
expectProblem("a bridge on a bend", (r) => (r.bridges = [{ from: 6.99, to: 7.01, kind: "road" }]));
expectProblem("a footpath crossing on a bend", (r) => (r.levelCrossings = [{ at: 0.85, kind: "footpath" }]));
expectProblem("a footpath crossing in a cutting", (r) => (r.levelCrossings = [{ at: 2.3, kind: "footpath" }]));
expectProblem("a start position off the platform", (r) => (r.startAt = 0.5));
expectProblem("a station in the wrong scenery", (r) => (r.stations = [{ name: "X", at: 3.5, platformLength_m: 180, side: "left" }]));
expectProblem("a stop marker off the end of its platform", (r) => { r.stations = structuredClone(r.stations); r.stations[0].stopMarkerAt = r.stations[0].at + 1; });
expectProblem("a station with a bad kind", (r) => { r.stations = structuredClone(r.stations); r.stations[0].kind = "shed"; });
expectProblem("a level crossing with a bad kind", (r) => { r.levelCrossings = structuredClone(r.levelCrossings); r.levelCrossings[0].kind = "ford"; });
expectProblem("a village off the line", (r) => (r.villages = [{ at: 99, side: "left" }]));
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
  // A 1 mile curve of radius 1000 m turns through (length - easement) / radius radians: the
  // easement is the gradual tightening at each end, and it turns less than a full-tightness bend.
  const afterCurve = path.pathAt(milesToMetres(1.5) + 1);
  const expectedTurn = (milesToMetres(1) - EASEMENT_M) / 1000;
  if (Math.abs(afterCurve.heading - expectedTurn) > 0.01) problems.push(`curve turned ${afterCurve.heading.toFixed(3)} rad, expected ${expectedTurn.toFixed(3)}`);
  const afterHill = path.pathAt(milesToMetres(3) + 200);
  if (Math.abs(afterHill.y - milesToMetres(1) / 100) > 0.05) problems.push(`1-in-100 for a mile rose ${afterHill.y.toFixed(2)} m, expected ${(milesToMetres(1) / 100).toFixed(2)}`);
  const middleOfCurve = path.pathAt(milesToMetres(1.0));
  if (Math.abs(middleOfCurve.roll - 55 / 1000) > 0.002 && Math.abs(middleOfCurve.roll) < 0.04) problems.push(`the track should lean into the bend, but roll is ${middleOfCurve.roll.toFixed(3)}`);
  const beforeCurve = path.pathAt(milesToMetres(0.5) + 10);
  if (Math.abs(beforeCurve.heading) > 0.01) problems.push(`the bend should start gently (easement), but heading is already ${beforeCurve.heading.toFixed(3)} rad 10 m in`);
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
