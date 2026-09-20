// physics.js — how the train moves. This file is "pure": it knows nothing about
// the screen, the gamepad or Three.js, just numbers. That means we can test it
// on its own (node tools/check-physics.js) without opening a browser.
//
// It is one-dimensional: the whole train has ONE number for its speed along the
// track. The 3D world just draws whatever this says.
//
// The recipe for each tiny time step:
//   push   = how hard the engine pulls            (traction)
//   drag   = rails, wheels and air fighting back  (resistance)
//   hill   = gravity if the track goes uphill     (gradient)
//   brake  = the brake shoes gripping the wheels  (braking)
//   acceleration = (push - drag - hill - brake) / how heavy the train is

import * as C from "./config.js";
import { mphToMps } from "./units.js";

const GRAVITY_MS2 = 9.81;
const TONNE_KG = 1000;

// The physics always runs in steps this small, whatever the frame rate is.
export const FIXED_STEP_S = 1 / 120;

// Turns the numbers in config.js into the train's properties. A test can pass
// overrides, like { COACHES: 3 }, to try a different train.
export function makeTrainParams(overrides = {}) {
  const v = { ...C, ...overrides };
  const locoMass_kg = v.LOCO_MASS_T * TONNE_KG;
  const mass_kg = locoMass_kg + v.COACHES * v.COACH_MASS_T * TONNE_KG;
  return {
    coaches: v.COACHES,
    locoMass_kg,
    mass_kg,
    length_m: 20 + v.COACHES * v.COACH_LENGTH_M, // the loco is about 20 m long
    topSpeed_mps: mphToMps(v.TOP_SPEED_MPH),
    maxTractiveEffort_N: v.MAX_TRACTIVE_EFFORT_KN * 1000,
    tractionPower_W: v.TRACTION_POWER_KW * 1000,
    adhesionLimit_N: v.ADHESION_FACTOR * locoMass_kg * GRAVITY_MS2, // the wheels can't pull harder than they grip
    rollingResistance: v.ROLLING_RESISTANCE,
    drag_N_per_ms2: v.DRAG_LOCO_N_PER_MS2 + v.COACHES * v.DRAG_PER_COACH_N_PER_MS2,
    rotatingMassFactor: v.ROTATING_MASS_FACTOR,
    brakeForce_N_per_tonne: v.BRAKE_FORCE_N_PER_TONNE,
    brakeApplyLag_s: v.BRAKE_APPLY_LAG_S,
    brakeReleaseLag_s: v.BRAKE_RELEASE_LAG_S,
    emergencyFactor: v.EMERGENCY_BRAKE_FACTOR,
    emergencyLag_s: v.EMERGENCY_BRAKE_LAG_S,
    powerCutoutBrake: v.POWER_CUTOUT_BRAKE,
    throttleRaiseRate: v.THROTTLE_RAISE_RATE,
    throttleLowerRate: v.THROTTLE_LOWER_RATE,
    brakeApplyRate: v.BRAKE_APPLY_RATE,
    brakeReleaseRate: v.BRAKE_RELEASE_RATE,
    reverserMaxSpeed_mps: mphToMps(v.REVERSER_MAX_SPEED_MPH),
    brakePipeFull_psi: v.BRAKE_PIPE_FULL_PSI,
    brakePipeServiceDrop_psi: v.BRAKE_PIPE_SERVICE_DROP_PSI,
    brakeCylinderMax_psi: v.BRAKE_CYLINDER_MAX_PSI,
  };
}

// A train standing still at the start, reverser in Neutral, brakes off.
export function makeTrain(params) {
  return {
    params,
    speed_mps: 0,        // never negative: the direction is kept separately
    distance_m: 0,       // where the front of the loco is along the route
    direction: 1,        // +1 = travelling forward along the route, -1 = backwards
    reverser: 0,         // -1 = Reverse, 0 = Neutral, +1 = Forward
    throttle: 0,         // the power handle, 0 (off) to 1 (full)
    brakeHandle: 0,      // the brake handle, 0 (off) to 1 (full service)
    brakeCylinder: 0,    // how hard the brakes are ACTUALLY on: it chases the handle slowly
    emergency: false,    // the emergency brake, stays on until the train has stopped
    powerCutOut: false,  // true while the brake handle is on: the engine stops pulling
    traction_N: 0,       // how hard the engine is pulling right now (for the ammeter)
    accel_mps2: 0,
  };
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));

// Moves the levers according to what the driver is pressing. The levers STAY
// where you leave them: RT/LT push them up, RB/LB pull them back down.
//
// input = {
//   throttleUp, brakeUp,          0..1: how hard the trigger is pulled
//   throttleDown, brakeDown,      0 or 1: bumpers
//   emergencyPressed,             true for the moment the button goes down
//   reverserStep,                 +1 (forward), -1 (reverse) or 0, for one moment
// }
export function updateHandles(train, input, dt) {
  const p = train.params;

  if (input.emergencyPressed) train.emergency = true;
  if (train.emergency) {
    // In an emergency the power is cut and the brake handle goes fully on.
    train.throttle = 0;
    train.brakeHandle = 1;
    return;
  }

  train.throttle = clamp01(
    train.throttle + (input.throttleUp * p.throttleRaiseRate - input.throttleDown * p.throttleLowerRate) * dt
  );
  train.brakeHandle = clamp01(
    train.brakeHandle + (input.brakeUp * p.brakeApplyRate - input.brakeDown * p.brakeReleaseRate) * dt
  );

  // The reverser only moves when the train is (nearly) stopped, like the real interlock.
  if (input.reverserStep && train.speed_mps <= p.reverserMaxSpeed_mps) {
    train.reverser = Math.max(-1, Math.min(1, train.reverser + input.reverserStep));
    if (train.reverser !== 0) train.direction = train.reverser;
  }
}

// How hard the engine pulls, in newtons.
// At low speed the pull is limited by the engine's strength (tractive effort).
// At high speed it is limited by its power: power = force x speed, so force = power / speed.
export function tractionForce(train) {
  const p = train.params;
  const engineCanPull =
    train.reverser !== 0 && !train.powerCutOut && !train.emergency && train.speed_mps < p.topSpeed_mps;
  if (!engineCanPull) return 0;
  const speedForPower_mps = Math.max(train.speed_mps, 1); // stops "divide by zero" at a standstill
  return Math.min(
    p.maxTractiveEffort_N * train.throttle,
    (p.tractionPower_W * train.throttle) / speedForPower_mps,
    p.adhesionLimit_N
  );
}

// Advances the train by dt seconds. slope = rise/run of the track here
// (1 in 100 uphill is 0.01, downhill is negative).
export function stepTrain(train, slope, dt) {
  const p = train.params;

  train.powerCutOut = train.brakeHandle > p.powerCutoutBrake;

  // The brake cylinder chases the handle, slowly. This delay is why you must brake early!
  const cylinderTarget = train.emergency ? 1 : train.brakeHandle;
  let lag_s = cylinderTarget > train.brakeCylinder ? p.brakeApplyLag_s : p.brakeReleaseLag_s;
  if (train.emergency) lag_s = p.emergencyLag_s;
  train.brakeCylinder += ((cylinderTarget - train.brakeCylinder) * dt) / lag_s;

  const traction_N = tractionForce(train);
  const resistance_N =
    train.speed_mps > 0
      ? p.rollingResistance * p.mass_kg * GRAVITY_MS2 + p.drag_N_per_ms2 * train.speed_mps * train.speed_mps
      : 0;
  // Uphill pulls back on a train going forward, and pushes a train going backwards.
  const gradient_N = p.mass_kg * GRAVITY_MS2 * slope * train.direction;
  const brakeForce_N =
    train.brakeCylinder * p.brakeForce_N_per_tonne * (p.mass_kg / TONNE_KG) * (train.emergency ? p.emergencyFactor : 1);

  train.traction_N = traction_N;
  train.accel_mps2 = (traction_N - resistance_N - gradient_N - brakeForce_N) / (p.mass_kg * p.rotatingMassFactor);

  train.speed_mps += train.accel_mps2 * dt;
  train.speed_mps = Math.min(Math.max(train.speed_mps, 0), p.topSpeed_mps); // never backwards, never above the limit
  train.distance_m += train.direction * train.speed_mps * dt;

  // Once the train has stopped after an emergency, it lets go. The brake handle
  // stays fully on, so the driver has to release it before setting off again.
  if (train.emergency && train.speed_mps === 0) train.emergency = false;
}

// What the dials in the cab should read.
export function gaugeReadings(train) {
  const p = train.params;
  const pipeDrop_psi = train.emergency ? p.brakePipeFull_psi : p.brakePipeServiceDrop_psi;
  return {
    brakePipe_psi: p.brakePipeFull_psi - pipeDrop_psi * train.brakeCylinder,
    brakeCylinder_psi: p.brakeCylinderMax_psi * train.brakeCylinder,
    tractionFraction: train.traction_N / p.maxTractiveEffort_N, // the ammeter follows the engine's pull
  };
}
