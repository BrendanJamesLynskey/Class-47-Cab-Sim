// adaptive.js — keeps the game smooth by trading sharpness for speed.
//
// If frames are taking too long (the Raspberry Pi is struggling) it draws the picture
// with fewer pixels; the browser stretches it back up to fill the TV. If there is
// plenty of time to spare, it slowly sharpens the picture again.
// (Same idea as the RC Flight Line game.)

import { MIN_RESOLUTION_SCALE } from "./config.js";

const WINDOW_FRAMES = 45;       // look at the average of this many frames
const TOO_SLOW_MS = 20.7;       // slower than this (under ~48 fps): shrink the picture
const COMFORTABLE_MS = 17.9;    // faster than this (a full 60 fps, with a little room): allowed to sharpen
const SHRINK_STEP = 0.06;
const SHARPEN_STEP = 0.05;
const MIN_SECONDS_BETWEEN_SHARPENS = 6;
const SHARPEN_BACKOFF_SECONDS = 45; // if sharpening made it slow again, don't try again for this long

export function createAdaptiveResolution(startScale, maxScale = 1) {
  const times = [];
  const state = { scale: startScale, averageMs: 0, enabled: true };
  let clock = 0;
  let lastChange = 0;
  let lastSharpen = -Infinity;
  let blockedUntil = 0;

  // Tell it how long the last frame took (in seconds). Returns the new scale if it changed.
  state.frame = function frame(seconds) {
    clock += seconds;
    times.push(seconds * 1000);
    if (times.length < WINDOW_FRAMES) return null;
    if (times.length > WINDOW_FRAMES) times.shift();
    state.averageMs = times.reduce((a, b) => a + b, 0) / times.length;
    if (!state.enabled) return null;

    if (state.averageMs > TOO_SLOW_MS && state.scale > MIN_RESOLUTION_SCALE) {
      if (clock - lastSharpen < 5) blockedUntil = clock + SHARPEN_BACKOFF_SECONDS; // we sharpened, and it got slow
      state.scale = Math.max(MIN_RESOLUTION_SCALE, state.scale - SHRINK_STEP);
      return reset();
    }
    if (state.averageMs < COMFORTABLE_MS && state.scale < maxScale && clock - lastChange > MIN_SECONDS_BETWEEN_SHARPENS && clock > blockedUntil) {
      state.scale = Math.min(maxScale, state.scale + SHARPEN_STEP);
      lastSharpen = clock;
      return reset();
    }
    return null;
  };

  function reset() {
    times.length = 0;
    lastChange = clock;
    return state.scale;
  }

  return state;
}
