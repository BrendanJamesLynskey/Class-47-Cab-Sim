// check-physics.js — checks that the train behaves like a real Class 47.
//
// Run it with:   node tools/check-physics.js
//
// It "drives" the train inside the computer, with no screen, and checks the
// results are in believable ranges. If you change the numbers in src/config.js
// (say COACHES or BRAKE_FORCE_N_PER_TONNE) and something stops being believable,
// this tells you which thing.
//
// The ranges are wide on purpose: they check the train FEELS right, not that it
// matches a data sheet. Run it after changing any physics number.

import { makeTrainParams, makeTrain, updateHandles, stepTrain, FIXED_STEP_S } from "../src/physics.js";
import { mphToMps, mpsToMph } from "../src/units.js";

const NO_INPUT = { throttleUp: 0, throttleDown: 0, brakeUp: 0, brakeDown: 0, emergencyPressed: false, reverserStep: 0 };

// Makes a train, optionally already moving, with the levers where we want them.
function setUp({ coaches = 8, startMph = 0, throttle = 0, brake = 0 } = {}) {
  const train = makeTrain(makeTrainParams({ COACHES: coaches }));
  train.reverser = 1;
  train.speed_mps = mphToMps(startMph);
  train.throttle = throttle;
  train.brakeHandle = brake;
  return train;
}

// Runs the train until stopWhen(train, seconds) says stop, or maxSeconds passes.
function run(train, { slope = 0, maxSeconds = 2000, stopWhen = () => false, emergency = false } = {}) {
  let seconds = 0;
  if (emergency) updateHandles(train, { ...NO_INPUT, emergencyPressed: true }, FIXED_STEP_S);
  while (seconds < maxSeconds && !stopWhen(train, seconds)) {
    stepTrain(train, slope, FIXED_STEP_S);
    seconds += FIXED_STEP_S;
  }
  return seconds;
}

let allGood = true;
function check(name, value, low, high, unit) {
  const ok = value >= low && value <= high;
  if (!ok) allGood = false;
  const shown = Number.isInteger(value) ? value : value.toFixed(1);
  console.log(`${ok ? "ok   " : "FAIL "} ${name}: ${shown} ${unit}   (should be ${low} to ${high})`);
}
function checkTrue(name, ok, detail = "") {
  if (!ok) allGood = false;
  console.log(`${ok ? "ok   " : "FAIL "} ${name}${detail ? ": " + detail : ""}`);
}

// ---- Acceleration on level track, full power ----
function accelerationTests(coaches, [t60Low, t60High], [topLow, topHigh]) {
  const train = setUp({ coaches, throttle: 1 });
  const t60 = run(train, { maxSeconds: 400, stopWhen: (t) => mpsToMph(t.speed_mps) >= 60 });
  if (mpsToMph(train.speed_mps) >= 60) check(`${coaches} coaches: time to reach 60 mph`, t60, t60Low, t60High, "s");
  else checkTrue(`${coaches} coaches: time to reach 60 mph`, false, "never got there in 400 s");
  run(train, { maxSeconds: 1500 });
  check(`${coaches} coaches: top speed on the level`, mpsToMph(train.speed_mps), topLow, topHigh, "mph");
}
accelerationTests(8, [90, 180], [80, 92]);
accelerationTests(3, [40, 90], [94, 95]);   // reaches the 95 mph limit
accelerationTests(0, [15, 50], [94, 95]);   // light engine: 95 mph limit too
accelerationTests(12, [130, 260], [72, 85]);

// ---- Uphill ----
{
  const train = setUp({ coaches: 8, throttle: 1 });
  run(train, { slope: 1 / 50, maxSeconds: 2000 });
  check("8 coaches up a 1-in-50 climb", mpsToMph(train.speed_mps), 35, 45, "mph");
}

// ---- Coasting: it should slow only gently ----
{
  const train = setUp({ coaches: 8, startMph: 60 });
  run(train, { maxSeconds: 60 });
  check("coasting for 60 s from 60 mph, speed after", mpsToMph(train.speed_mps), 50, 59.9, "mph");
}

// ---- Braking ----
function stoppingDistance(train, options = {}) {
  const startDistance = train.distance_m;
  run(train, { maxSeconds: 400, stopWhen: (t) => t.speed_mps === 0, ...options });
  return train.distance_m - startDistance;
}
check("full service brake from 60 mph: stopping distance",
  stoppingDistance(setUp({ startMph: 60, brake: 1 })), 500, 750, "m");
check("emergency brake from 60 mph: stopping distance",
  stoppingDistance(setUp({ startMph: 60, throttle: 1 }), { emergency: true }), 300, 450, "m");
check("light brake (0.3) from 60 mph: stops much later than a full brake",
  stoppingDistance(setUp({ startMph: 60, brake: 0.3 })), 1500, 4500, "m");

// ---- The brakes are slow: the delay must be real ----
{
  const train = setUp({ startMph: 60, brake: 1 });
  run(train, { maxSeconds: 1 });
  checkTrue("brake cylinder is still low 1 s after applying", train.brakeCylinder < 0.4,
    `cylinder = ${train.brakeCylinder.toFixed(2)}`);
}

// ---- The power cut-out and the reverser ----
{
  const train = setUp({ throttle: 1, brake: 0.5 });
  run(train, { maxSeconds: 5 });
  checkTrue("power cut-out: brake handle on + full throttle gives no pull", train.traction_N === 0 && train.powerCutOut);
}
{
  const train = setUp({ throttle: 1 });
  train.reverser = 0;
  run(train, { maxSeconds: 5 });
  checkTrue("reverser in Neutral: full throttle goes nowhere", train.speed_mps === 0);
}

// ---- The levers (what the four gamepad buttons do) ----
{
  const t = () => makeTrain(makeTrainParams());
  let train = t();
  const hold = (input, seconds) => { for (let s = 0; s < seconds; s += FIXED_STEP_S) updateHandles(train, { ...NO_INPUT, ...input }, FIXED_STEP_S); };

  hold({ throttleUp: 1 }, 1);
  check("RT held 1 s: power handle", train.throttle, 0.45, 0.55, "(0..1)");
  hold({}, 2);
  check("let go of RT: the handle stays put", train.throttle, 0.45, 0.55, "(0..1)");
  hold({ throttleDown: 1 }, 0.3);
  checkTrue("RB lowers the power handle", train.throttle < 0.3, `handle = ${train.throttle.toFixed(2)}`);

  train = t();
  hold({ throttleUp: 0.5 }, 1);
  check("RT half-pulled 1 s: power handle (half as fast)", train.throttle, 0.2, 0.3, "(0..1)");

  train = t();
  hold({ brakeUp: 1 }, 1);
  check("LT held 1 s: brake handle", train.brakeHandle, 0.45, 0.55, "(0..1)");
  hold({ brakeDown: 1 }, 5);
  check("LB held: brake handle releases to", train.brakeHandle, 0, 0, "(0..1)");

  train = t();
  hold({ throttleUp: 1 }, 5);
  hold({ emergencyPressed: true }, 0.01);
  checkTrue("Back (emergency): power handle to 0, brake handle fully on", train.throttle === 0 && train.brakeHandle === 1 && train.emergency);

  train = t();
  updateHandles(train, { ...NO_INPUT, reverserStep: 1 }, FIXED_STEP_S);
  updateHandles(train, { ...NO_INPUT, reverserStep: 1 }, FIXED_STEP_S);
  checkTrue("reverser: Neutral, then Forward, and it stops at Forward", train.reverser === 1);
  train.speed_mps = 10;
  updateHandles(train, { ...NO_INPUT, reverserStep: -1 }, FIXED_STEP_S);
  checkTrue("reverser will not move while the train is moving", train.reverser === 1);
}

console.log(allGood ? "\nAll physics checks passed." : "\nSome physics checks FAILED.");
process.exit(allGood ? 0 : 1);
