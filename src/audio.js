// audio.js — all the game's sound is made with the browser's Web Audio (no sound files).
// Right now that is the two-tone horn. (Engine, wheels and the AWS bell come later.)
//
// Browsers stay silent until the page has had a click or a key press, and a gamepad
// button might not count. So if the sound is "suspended" the game shows "Sound off:
// press any key", and starts the sound at the first key, click or touch. Starting
// Chromium with --autoplay-policy=no-user-gesture-required avoids all of that.

import * as C from "./config.js";

// A horn note: a few slightly different buzzing waves added together and softened,
// which sounds much like a real diesel horn. `ctx` can be the live sound or an offline one.
function makeNote(ctx, frequency_hz, destination) {
  const out = ctx.createGain();
  out.gain.value = 0; // silent until the horn is pressed
  const soften = ctx.createBiquadFilter();
  soften.type = "lowpass";
  soften.frequency.value = 2400;
  soften.Q.value = 0.6;
  soften.connect(out);
  out.connect(destination);

  // [wave, multiple of the note, loudness]: the slight mistuning gives the horn its rough "buzz".
  for (const [type, ratio, level] of [["sawtooth", 1, 0.22], ["sawtooth", 1.004, 0.18], ["square", 2.003, 0.05], ["triangle", 3, 0.04]]) {
    const oscillator = ctx.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = frequency_hz * ratio;
    const loudness = ctx.createGain();
    loudness.gain.value = level;
    oscillator.connect(loudness).connect(soften);
    oscillator.start();
  }
  return out.gain;
}

// The whole horn: two notes into a limiter (so it can never clip) and a volume control.
function makeHorn(ctx, destination) {
  const volume = ctx.createGain();
  volume.gain.value = C.HORN_VOLUME * C.MASTER_VOLUME;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.1;
  volume.connect(limiter).connect(destination);
  const notes = { low: makeNote(ctx, C.HORN_LOW_HZ, volume), high: makeNote(ctx, C.HORN_HIGH_HZ, volume) };
  return {
    // Turn each note on or off. Brief fades stop clicks.
    set(low, high, time) {
      notes.low.setTargetAtTime(low ? 1 : 0, time, low ? 0.025 : 0.07);
      notes.high.setTargetAtTime(high ? 1 : 0, time, high ? 0.025 : 0.07);
    },
  };
}

export function createAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  let horn = null;
  let lastLow = false, lastHigh = false;

  try {
    ctx = new AudioContextClass();
    horn = makeHorn(ctx, ctx.destination);
  } catch (error) {
    ctx = null; // no sound available: the game still works without it
  }

  // The first key, click or touch lets the browser start the sound.
  const unlock = () => { if (ctx && ctx.state !== "running") ctx.resume(); };
  for (const eventName of ["keydown", "mousedown", "pointerdown", "touchstart"]) window.addEventListener(eventName, unlock);

  return {
    // True while the browser is blocking sound (so the game can say "Sound off: press any key").
    get needsUnlock() { return Boolean(ctx) && ctx.state !== "running"; },
    get available() { return Boolean(ctx); },
    // Call every frame with whether each horn note is being sounded.
    setHorn(low, high) {
      if (!horn || (low === lastLow && high === lastHigh)) return;
      lastLow = low; lastHigh = high;
      horn.set(low, high, ctx.currentTime);
    },
  };
}

// Plays the horn for a couple of seconds through an offline sound engine and measures it,
// so we can check the loudness without listening. Returns { peak, rms } (1.0 would be the
// loudest possible; anything over about 0.9 risks crackling).
export async function auditHorn({ low = true, high = true, seconds = 2 } = {}) {
  const sampleRate = 44100;
  const offline = new OfflineAudioContext(1, Math.round(seconds * sampleRate), sampleRate);
  const horn = makeHorn(offline, offline.destination);
  horn.set(low, high, 0);
  const buffer = await offline.startRendering();
  const samples = buffer.getChannelData(0);
  let peak = 0, sumSquares = 0;
  const from = Math.round(sampleRate * 0.5); // skip the first half second while it starts up
  for (let i = from; i < samples.length; i++) {
    peak = Math.max(peak, Math.abs(samples[i]));
    sumSquares += samples[i] * samples[i];
  }
  return { peak, rms: Math.sqrt(sumSquares / (samples.length - from)) };
}
