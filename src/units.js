// units.js — the game's physics is all metres and seconds, but a British railway
// uses miles and yards. These little helpers convert at the edge (on the display).

const METRES_PER_MILE = 1609.344;
const METRES_PER_YARD = 0.9144;
const MPS_PER_MPH = 0.44704; // 1 mile per hour = 0.44704 metres per second

export const mphToMps = (mph) => mph * MPS_PER_MPH;
export const mpsToMph = (mps) => mps / MPS_PER_MPH;

export const milesToMetres = (miles) => miles * METRES_PER_MILE;
export const metresToMiles = (metres) => metres / METRES_PER_MILE;
export const metresToYards = (metres) => metres / METRES_PER_YARD;

// Short names for reading speeds and distances: speed_mps -> mph number, etc.
export const mph = mpsToMph;
export const miles = metresToMiles;
export const yards = metresToYards;
