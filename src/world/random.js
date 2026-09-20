// random.js — random numbers that are not really random.
// Give them the same seed and they give the same answers every time, so the same
// countryside is built every run and a bug can be found again.

// A small, fast random number maker. Call it to get a number from 0 up to 1.
export function makeRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Turns a few whole numbers into one random-looking number from 0 to 1.
// Handy for "should there be a tree at spot (12, 7)?" without remembering anything.
export function hashRandom(seed, a = 0, b = 0, c = 0) {
  let h = (seed * 374761393 + a * 668265263 + b * 2147483647 + c * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
