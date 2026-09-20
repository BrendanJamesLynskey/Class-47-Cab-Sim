// environment.js — what kind of country the line is running through, at every point.
//
// route.js says things like "from mile 3.0 to 5.2 it is hills". This turns that into
// numbers the ground builder can use: how big the hills are, whether the track is in a
// cutting or on an embankment, and where a river dips the land under a bridge.
// The numbers are worked out every 10 m and smoothed, so one kind of country blends
// gently into the next instead of changing with a bump.

export const NODE_M = 10; // the ground is built in rows this long, and these numbers are kept for each row

// The look of each kind of country. Change these numbers to change the scenery!
//   hillAmp:  how high the rolling hills get, in metres
//   cut:      how far the track sits BELOW the ground (a cutting); negative = ABOVE it (an embankment)
//   woods:    the chance that a field is a wood
//   walls:    the chance a field boundary is a drystone wall (otherwise mostly hedges)
//   sheep:    how many animals graze (1 = normal)
//   farm:     the chance a field has a farm in it
//   moor:     true for open hill country with rough grass and heather
export const ENVIRONMENTS = {
  country:    { hillAmp: 16, cut: 0,    woods: 0.12, walls: 0.15, sheep: 1.0, farm: 0.07 },
  wood:       { hillAmp: 14, cut: 0,    woods: 0.72, walls: 0.10, sheep: 0.3, farm: 0.02 },
  hills:      { hillAmp: 52, cut: 0,    woods: 0.04, walls: 0.80, sheep: 1.7, farm: 0.02, moor: true },
  cutting:    { hillAmp: 20, cut: 7,    woods: 0.30, walls: 0.10, sheep: 0.3, farm: 0.00 },
  embankment: { hillAmp: 14, cut: -5.5, woods: 0.10, walls: 0.15, sheep: 0.6, farm: 0.03 },
  valley:     { hillAmp: 2.5, cut: -1,  woods: 0.08, walls: 0.05, sheep: 0.8, farm: 0.04 },
};
export function paramsOf(type) {
  return ENVIRONMENTS[type] || ENVIRONMENTS.country;
}

const RIVER_DIP_M = 6.5;         // how deep the valley is where a river runs
const RIVER_DIP_HALF_WIDTH_M = 65;
const BRIDGE_PLATEAU_M = 20;     // ground right under a bridge is fully lowered out to here ...
const BRIDGE_FADE_M = 40;        // ... and back to normal by here

// Averages a list over +/- halfWidth entries (the edges repeat their end values).
function blur(values, halfWidth) {
  const n = values.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = -halfWidth; j <= halfWidth; j++) sum += values[Math.min(n - 1, Math.max(0, i + j))];
    out[i] = sum / (2 * halfWidth + 1);
  }
  return out;
}

// route = the result of routeInMetres()
export function createEnvironment(route, totalLength_m) {
  const count = Math.ceil(totalLength_m / NODE_M) + 4;
  const listed = route.environment;
  const typeAt = (d) => {
    const found = listed.find((e) => d >= e.from && d < e.to);
    if (found) return found.type;
    return d < 0 ? listed[0].type : listed[listed.length - 1].type;
  };

  const rawHill = new Float32Array(count);
  const rawCut = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const p = paramsOf(typeAt(i * NODE_M));
    rawHill[i] = p.hillAmp;
    rawCut[i] = p.cut;
  }
  // Smooth twice: about 240 m to blend from one kind of country to the next.
  const hillAmp = blur(blur(rawHill, 12), 12);
  const cut = blur(blur(rawCut, 12), 12);

  // Rivers: the whole valley dips where a river bridge is, and the ground right under
  // the bridge drops away completely (bridgeFactor is 1 there).
  const bridgeFactor = new Float32Array(count);
  const rivers = route.bridges.filter((b) => b.kind === "river").map((b) => (b.from + b.to) / 2);
  for (let i = 0; i < count; i++) {
    const d = i * NODE_M;
    for (const centre of rivers) {
      const t = (d - centre) / RIVER_DIP_HALF_WIDTH_M;
      if (Math.abs(t) < 1) cut[i] -= (RIVER_DIP_M * (1 + Math.cos(Math.PI * t))) / 2;
      const away = Math.abs(d - centre);
      const factor = away <= BRIDGE_PLATEAU_M ? 1 : away >= BRIDGE_FADE_M ? 0 : 1 - (away - BRIDGE_PLATEAU_M) / (BRIDGE_FADE_M - BRIDGE_PLATEAU_M);
      bridgeFactor[i] = Math.max(bridgeFactor[i], factor);
    }
  }

  const lerpNodes = (array, d) => {
    const k = Math.max(0, Math.min(count - 2, Math.floor(d / NODE_M)));
    const t = Math.min(1, Math.max(0, d / NODE_M - k));
    return array[k] * (1 - t) + array[k + 1] * t;
  };

  return {
    NODE_M,
    typeAt,
    paramsAt: (d) => paramsOf(typeAt(d)),
    hillAmpNode: (k) => hillAmp[Math.max(0, Math.min(count - 1, k))],
    cutAt: (d) => lerpNodes(cut, d),           // + = cutting depth, - = embankment height (or valley dip)
    bridgeAt: (d) => lerpNodes(bridgeFactor, d), // 1 right under a river bridge, 0 away from it
    rivers,
  };
}
