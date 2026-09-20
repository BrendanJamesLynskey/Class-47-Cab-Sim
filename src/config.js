// config.js — every number you might want to change lives here.
// Change a value, save the file, and the game on the TV updates by itself!
//
// Physics numbers are in metres, seconds and newtons. The names say the unit:
// _M = metres, _S = seconds, _KN = kilonewtons, _T = tonnes, _MPH = miles per hour.

// ---- The game ----
export const GAME_TITLE = "Class 47 Cab Simulator"; // shown on the start screen. Give it a name!
export const LOCO_NUMBER = "47790";                 // the number on the locomotive
export const LOCO_COLOR = "#2a4f8f";                // the paint on the nose of the loco. Try "#1f6b3a" (green) or "#b3282d" (red)

// ---- Your train (try these first!) ----
export const COACHES = 8; // how many coaches behind the loco. Try 3 (quick and light) or 12 (slow and heavy!)
export const TOP_SPEED_MPH = 95; // the fastest a Class 47 can go. The engine stops pulling at this speed.
export const LOCO_MASS_T = 120;  // the weight of the locomotive, in tonnes
export const COACH_MASS_T = 35;  // the weight of each coach, in tonnes
export const COACH_LENGTH_M = 20; // how long each coach is (only used for the length of the train)

// ---- The engine ----
export const TRACTION_POWER_KW = 1700;       // engine power at the rail. Bigger = faster at high speed
export const MAX_TRACTIVE_EFFORT_KN = 275;   // the pull at a standstill. Bigger = quicker getaway
export const ADHESION_FACTOR = 0.25;         // how well the wheels grip the rail (0.25 is dry rail). Lower = wheel-slip weather

// ---- The train fighting back ----
export const ROLLING_RESISTANCE = 0.0020; // steel wheels on steel rail is very slippery. Bigger = train slows sooner when coasting
export const DRAG_LOCO_N_PER_MS2 = 8;     // air drag on the loco, newtons per (metre/second) squared
export const DRAG_PER_COACH_N_PER_MS2 = 2; // extra air drag for each coach
export const ROTATING_MASS_FACTOR = 1.06; // the wheels and motors have to spin up too, so the train "feels" 6% heavier

// ---- The brakes (air brakes are slow: brake EARLY!) ----
export const BRAKE_FORCE_N_PER_TONNE = 636; // full service brake. About 0.6 m/s squared, so about 600 m to stop from 60 mph
export const BRAKE_APPLY_LAG_S = 2.5;       // how slowly the brakes come on. Bigger = you must brake even earlier
export const BRAKE_RELEASE_LAG_S = 6;       // how slowly they let go (a long train takes ages to recharge)
export const EMERGENCY_BRAKE_FACTOR = 1.7;  // the emergency brake is this many times stronger
export const EMERGENCY_BRAKE_LAG_S = 0.8;   // and comes on much quicker
export const POWER_CUTOUT_BRAKE = 0.15;     // brake handle above this cuts the engine's power (the POWER CUT light)
export const BRAKE_PIPE_FULL_PSI = 70;      // what the brake pipe gauge reads with the brakes off
export const BRAKE_PIPE_SERVICE_DROP_PSI = 20; // how far it falls with a full service application
export const BRAKE_CYLINDER_MAX_PSI = 50;   // what the brake cylinder gauge reads at full service

// ---- Your hands on the levers (per second, at a full pull) ----
export const THROTTLE_RAISE_RATE = 0.5;  // RT raises the power handle this fast. 0.5 = full power in 2 seconds
export const THROTTLE_LOWER_RATE = 0.9;  // RB lowers it. Faster than raising, as real drivers shut off quickly
export const BRAKE_APPLY_RATE = 0.5;     // LT applies the brake handle
export const BRAKE_RELEASE_RATE = 0.9;   // LB releases it
export const REVERSER_MAX_SPEED_MPH = 0.5; // you can only change direction when nearly stopped

// ---- Speed limit ----
export const SPEEDING_MARGIN_MPH = 0.5; // how far over the limit before the HUD limit starts to flash

// ---- The gamepad (Logitech F310, switch set to X) ----
export const STICK_DEADZONE = 0.15; // ignore tiny stick wobbles (the sticks never rest at exactly 0)

// ---- Looking around the cab ----
export const LOOK_YAW_MAX_DEG = 70;    // how far you can turn your head left and right
export const LOOK_PITCH_UP_DEG = 20;   // how far you can look up
export const LOOK_PITCH_DOWN_DEG = 25; // and down (look down to read the gauges)
export const LOOK_SMOOTHING = 8;       // how quickly your head follows the stick (bigger = snappier)
export const MOUSE_LOOK_PIXELS = 300;  // dragging the mouse this far looks all the way round
export const CAB_SWAY_M = 0.003;       // how much the cab shakes as you go faster. 0 = smooth as glass

// ---- The keyboard (the names are the KeyboardEvent "code" of each key) ----
export const KEYS = {
  throttleUp:   ["ArrowUp", "KeyW"],
  throttleDown: ["ArrowDown", "KeyS"],
  brakeUp:      ["ArrowLeft", "KeyA"],
  brakeDown:    ["ArrowRight", "KeyD"],
  emergency:    ["Space"],
  hornHigh:     ["KeyH"],
  hornLow:      ["KeyJ"],
  awsAcknowledge: ["KeyQ"],
  headlights:   ["KeyL"],
  wipers:       ["KeyV"],
  reverserForward: ["KeyF"],
  reverserReverse: ["KeyR"],
  pause:        ["KeyP", "Escape"],
  start:        ["Enter", "Space"],   // start screen only
  toggleHud:    ["KeyT"],             // (H is the horn, so the HUD gets T)
  recentre:     ["KeyC"],
};
// Hold Shift and press the arrow keys to look around. Or drag with the mouse.

// ---- The picture ----
export const QUALITY = "medium"; // "low", "medium" or "high": how far you can see, how many trees, how sharp
export const QUALITY_SETTINGS = {
  // viewChunks: how many 100 m pieces of world are built ahead of you
  // fogFar_m: where the far distance fades to mist
  // propDensity: 1 = normal number of trees, posts and animals
  // resolutionScale: the starting sharpness (1 = full 720p)
  low:    { viewChunks: 5,  fogFar_m: 520,  propDensity: 0.5, resolutionScale: 0.75 },
  medium: { viewChunks: 8,  fogFar_m: 850,  propDensity: 1.0, resolutionScale: 1.0 },
  high:   { viewChunks: 11, fogFar_m: 1150, propDensity: 1.4, resolutionScale: 1.0 },
};
export const RENDER_HEIGHT_PX = 720;  // the game draws this many pixels tall; the browser stretches it to fill the TV
export const CAMERA_FOV_DEG = 65;     // how wide the view is (bigger = more fish-eye)
export const MIN_RESOLUTION_SCALE = 0.5; // the game can shrink the picture to this much to keep running smoothly
export const SHOW_HUD = true;         // the little speed/limit display at the top. Press T to hide it

// ---- The world ----
export const CHUNK_LENGTH_M = 100;    // the world is built in pieces this long, just ahead of the train
export const CHUNKS_BEHIND = 2;       // and thrown away this many pieces behind it (so looking over your shoulder isn't empty)
export const WORLD_SEED = 47;         // the same number always makes the same countryside. Try 5!
export const MAX_CHUNK_BUILDS_PER_FRAME = 1; // building bits of world is slow; only do this many per frame

// ---- Track sizes (real ones: standard gauge is 1.435 m) ----
export const TRACK_GAUGE_M = 1.435;
export const SLEEPER_SPACING_M = 0.7;

// ---- Colours ----
export const SKY_TOP_COLOR = "#3f7fcf";     // the sky straight up
export const SKY_HORIZON_COLOR = "#cfe3ee"; // the sky at the horizon (the mist matches this)
export const SUN_COLOR = "#fff3c4";
export const HILL_COLOR = "#8ea1a8";        // the hills on the horizon
export const GRASS_COLORS = ["#5f9a3c", "#6fa844", "#4f8a34", "#86ae4e"]; // the fields
export const PLOUGHED_COLOR = "#7a5a3c";
export const CESS_COLOR = "#7d7a66";        // the strip beside the track
export const BALLAST_COLOR = "#8a857b";     // the stones under the track
export const SLEEPER_COLOR = "#5b5147";     // the concrete/wood beams the rails sit on
export const RAIL_COLOR = "#a5a099";
export const HEDGE_COLOR = "#3f7a2e";
export const WALL_COLOR = "#9a968a";        // drystone walls
export const FENCE_COLOR = "#7a6a58";
export const POLE_COLOR = "#5a4a3a";
export const OAK_COLOR = "#4a7d2a";
export const CONIFER_COLOR = "#2d5a34";
export const TRUNK_COLOR = "#5a4632";

// ---- The cab colours ----
export const CAB_SHELL_COLOR = "#d9d3bd";  // the cream walls
export const CAB_FLOOR_COLOR = "#4a4d50";
export const CAB_DESK_COLOR = "#3c4044";   // the dark grey desk
export const CAB_FRAME_COLOR = "#26282b";  // window frames
