// controls.js — turns the gamepad, the MINI_KEYBOARD, the keyboard and the mouse into
// simple answers like "how hard is RT pulled?" and "did he just press the horn?".
//
// Which button does which job is written down in config.js (F310 and MINI_KEYBOARD), so
// you can change it there. Only the controller chosen on the start screen is used.
//
// The browser has no "button pressed" events for gamepads. Instead we LOOK at
// the gamepad once every frame (this is called polling). controls.update()
// does the looking, and it runs at the start of every frame (see main.js).
//
// The MINI_KEYBOARD is different: to the browser it is just another keyboard, so each
// button and each click of a knob arrives as a key press.

import * as C from "./config.js";

// Button numbers on a pad that reports the "standard" layout.
// (The F310 does this when the switch on the back is set to X.)
const BUTTON = {
  A: 0, B: 1, X: 2, Y: 3,
  LB: 4, RB: 5, LT: 6, RT: 7,
  BACK: 8, START: 9, L3: 10, R3: 11,
  DPAD_UP: 12, DPAD_DOWN: 13, DPAD_LEFT: 14, DPAD_RIGHT: 15,
};
const LEFT_STICK_X = 0; // axis numbers: -1 = full left, +1 = full right
const LEFT_STICK_Y = 1; // -1 = full up, +1 = full down
const TRIGGER_DEADZONE = 0.05;

const CONTROLLERS = ["F310", "MINI_KEYBOARD"];
const SAVED_CHOICE = "class47.controller"; // where the browser remembers the chosen controller

// Sticks never rest at exactly 0, so ignore tiny movements.
function applyDeadzone(value) {
  return Math.abs(value) < C.STICK_DEADZONE ? 0 : value;
}

// Browsers only show a gamepad after a button has been pressed on it once.
// getGamepads() gives a fresh snapshot every time, so we call it every frame.
function findGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const pad of pads) {
    if (pad && pad.connected) return pad;
  }
  return null;
}

// How far a trigger is pulled, 0 to 1. If the browser only says "pressed" (and gives
// no in-between amount), we treat a press as a full pull. Ordinary buttons give 0 or 1.
function triggerAmount(button) {
  if (!button) return 0;
  const amount = button.value > 0 ? button.value : button.pressed ? 1 : 0;
  return amount < TRIGGER_DEADZONE ? 0 : amount;
}

// The browser's memory can be switched off (or full), so never let it stop the game.
function loadChoice() {
  try {
    const saved = localStorage.getItem(SAVED_CHOICE);
    if (CONTROLLERS.includes(saved)) return saved;
  } catch (error) { /* no memory: use the default */ }
  return CONTROLLERS.includes(C.CONTROLLER) ? C.CONTROLLER : "F310";
}
function saveChoice(name) {
  try { localStorage.setItem(SAVED_CHOICE, name); } catch (error) { /* it just won't be remembered */ }
}

const clamp = (x) => Math.max(-1, Math.min(1, x));

export function createControls() {
  const MINI = C.MINI_KEYBOARD;
  // Every key the MINI_KEYBOARD sends. While it is the chosen controller, the ordinary
  // keyboard ignores these keys (otherwise its "a" button would also mean "more brake").
  const miniKeys = new Set([
    ...Object.keys(MINI.buttons), ...Object.keys(MINI.shiftButtons || {}),
    ...MINI.knobs.flatMap((knob) => [knob.clockwise, knob.anticlockwise, knob.press]),
  ]);

  // ---- Keyboard and mouse: remember which keys are down ----
  const keysDown = new Set();
  const keyTaps = new Set(); // keys that went down since the last frame (so a very quick tap is never missed)
  const mouseLook = { x: 0, y: 0 };
  let dragStart = null;
  let switchTapped = false;

  // ---- The MINI_KEYBOARD's knobs ----
  // A knob click is over in a few thousandths of a second, so every click is written down
  // the moment it happens (with whatever "shift" or knob-press was held then) and used up
  // in the next frame.
  const knobState = MINI.knobs.map(() => ({ pressed: false, turnedWhilePressed: false }));
  let knobTurns = [];            // [{ job, direction }] since the last frame: +1 clockwise, -1 anticlockwise
  let knobTaps = [];             // tap jobs since the last frame
  const knobLook = { x: 0, y: 0 }; // where the knobs have turned your head (it stays there until "recentre")

  const miniActions = (code) => {
    if (miniShiftHeld() && MINI.shiftButtons && MINI.shiftButtons[code]) return MINI.shiftButtons[code];
    return MINI.buttons[code] || [];
  };
  const miniShiftHeld = () => Object.keys(MINI.buttons).some((code) => MINI.buttons[code].includes("shift") && keysDown.has(code));

  function miniKnobKeyDown(code) {
    MINI.knobs.forEach((knob, i) => {
      const state = knobState[i];
      if (code === knob.press) {
        state.pressed = true;
        state.turnedWhilePressed = false;
      } else if (code === knob.clockwise || code === knob.anticlockwise) {
        const job = state.pressed ? knob.turnPressed : miniShiftHeld() ? knob.turnShifted : knob.turn;
        if (state.pressed) state.turnedWhilePressed = true;
        knobTurns.push({ job, direction: code === knob.clockwise ? 1 : -1 });
      }
    });
  }
  function miniKnobKeyUp(code) {
    MINI.knobs.forEach((knob, i) => {
      const state = knobState[i];
      // A press only counts as a "tap" if the knob wasn't turned while it was held in.
      if (code === knob.press && state.pressed && !state.turnedWhilePressed) knobTaps.push(knob.tap);
      if (code === knob.press) state.pressed = false;
    });
  }

  window.addEventListener("keydown", (event) => {
    const repeat = keysDown.has(event.code); // a held key repeats; only the first press counts
    if (!repeat) keyTaps.add(event.code);
    keysDown.add(event.code);
    if (event.code === C.CONTROLLER_SWITCH_KEY) {
      event.preventDefault(); // Tab would otherwise move the browser's focus around
      if (!repeat) switchTapped = true;
    }
    if (controls.controller === "MINI_KEYBOARD" && !repeat) miniKnobKeyDown(event.code);
    // Stop the arrow keys and Space from scrolling the page.
    if (event.code.startsWith("Arrow") || event.code === "Space") event.preventDefault();
  });
  window.addEventListener("keyup", (event) => {
    keysDown.delete(event.code);
    if (controls.controller === "MINI_KEYBOARD") miniKnobKeyUp(event.code);
  });
  window.addEventListener("blur", () => { // don't get stuck if the window loses focus
    keysDown.clear();
    for (const state of knobState) state.pressed = false;
  });

  window.addEventListener("mousedown", (event) => { dragStart = { x: event.clientX, y: event.clientY }; });
  window.addEventListener("mouseup", () => { dragStart = null; mouseLook.x = mouseLook.y = 0; });
  window.addEventListener("mousemove", (event) => {
    if (!dragStart) return;
    mouseLook.x = clamp((event.clientX - dragStart.x) / C.MOUSE_LOOK_PIXELS);
    mouseLook.y = clamp((event.clientY - dragStart.y) / C.MOUSE_LOOK_PIXELS);
  });

  // The ordinary keyboard's keys for a job (minus any the MINI_KEYBOARD is using).
  const keyboardKeys = (action) => (C.KEYS[action] || []).filter((code) => !(controls.controller === "MINI_KEYBOARD" && miniKeys.has(code)));
  const keyDown = (action) => keyboardKeys(action).some((code) => keysDown.has(code));
  const shiftHeld = () => keysDown.has("ShiftLeft") || keysDown.has("ShiftRight");
  const tapped = (action) => keyboardKeys(action).some((code) => keyTaps.has(code));

  // "Pressed this frame" needs to remember what was down last frame. (A key tap that
  // came and went between two frames still counts, thanks to keyTaps.)
  const wasDown = {};
  function justPressed(name, isDownNow, keyTapped = false) {
    const pressed = (isDownNow && !wasDown[name]) || keyTapped;
    wasDown[name] = isDownNow;
    return pressed;
  }

  const controls = {
    controller: loadChoice(), // "F310" or "MINI_KEYBOARD"

    // Held right now (analog: 0 to 1)
    throttleUp: 0,    // RT
    throttleDown: 0,  // RB
    brakeUp: 0,       // LT
    brakeDown: 0,     // LB
    hornHigh: false,  // D-pad right, A (both notes) and H
    hornLow: false,   // D-pad left, A (both notes) and J
    look: { x: 0, y: 0 }, // left stick / knobs / Shift+arrows / mouse drag: -1..1, x right, y down

    // Knob clicks and knob taps since the last frame
    throttleNudge: 0, // how far to jump the power handle (-1..1)
    brakeNudge: 0,    // how far to jump the brake handle
    throttleOff: false,
    brakeOff: false,

    // Pressed for ONE frame only
    emergencyPressed: false,    // Back / Space
    reverserStep: 0,            // +1 = toward Forward (D-pad up / F), -1 = toward Reverse (D-pad down / R)
    awsPressed: false,          // B / Q
    headlightsPressed: false,   // X / L
    tailLightsPressed: false,   // L3 (stick click) / K
    wipersPressed: false,       // Y / V
    pausePressed: false,        // Start / P / Esc
    recentrePressed: false,     // R3 / C
    toggleHudPressed: false,    // T
    startPressed: false,        // A / Enter / Space: used on the start and results screens
    switchPressed: false,       // Tab: swap controllers (main.js only allows it on the start screen)

    padStatus: "none", // "none" | "wrong-mode" | "ready"

    // Swap to the other controller, and remember it.
    switchController() {
      controls.controller = CONTROLLERS[(CONTROLLERS.indexOf(controls.controller) + 1) % CONTROLLERS.length];
      saveChoice(controls.controller);
      knobTurns = []; knobTaps = [];
      knobLook.x = knobLook.y = 0;
    },

    update() {
      const pad = findGamepad();
      const buttons = pad && pad.mapping === "standard" ? pad.buttons : null;

      if (!pad) controls.padStatus = "none";
      else if (pad.mapping !== "standard") controls.padStatus = "wrong-mode"; // the switch on the back is probably on D
      else controls.padStatus = "ready";

      // The F310's buttons only count while it is the chosen controller.
      const usePad = controls.controller === "F310" && buttons;
      const padAmount = (action) => {
        if (!usePad) return 0;
        let amount = 0;
        for (const name in C.F310) {
          if (C.F310[name].includes(action)) amount = Math.max(amount, triggerAmount(buttons[BUTTON[name]]));
        }
        return amount;
      };
      const useMini = controls.controller === "MINI_KEYBOARD";
      const miniDown = (action) => useMini && [...keysDown].some((code) => miniActions(code).includes(action));
      const miniTapped = (action) => useMini && [...keyTaps].some((code) => miniActions(code).includes(action));

      // Knob taps that do an ordinary button job (like "recentre") act as a quick press of it.
      const tapJobs = new Set(knobTaps);
      const isDown = (action) => padAmount(action) > 0 || keyDown(action) || miniDown(action);
      const wasTapped = (action) => tapped(action) || miniTapped(action) || tapJobs.has(action);

      // Shift + arrow keys look around instead of driving.
      const lookKeys = shiftHeld();
      const arrow = (code) => lookKeys && keysDown.has(code);
      const driveKey = (action) => keyboardKeys(action).some((code) => keysDown.has(code) && !(lookKeys && code.startsWith("Arrow")));
      const held = (action) => Math.max(padAmount(action), driveKey(action) || miniDown(action) ? 1 : 0);

      controls.throttleUp = held("throttleUp");
      controls.throttleDown = held("throttleDown");
      controls.brakeUp = held("brakeUp");
      controls.brakeDown = held("brakeDown");

      // The low and high horn notes (A, or both buttons together, sounds the two-tone horn).
      controls.hornHigh = isDown("hornHigh");
      controls.hornLow = isDown("hornLow");

      // Knob clicks: small steps, big steps with "shift", or turning your head.
      controls.throttleNudge = 0;
      controls.brakeNudge = 0;
      for (const { job, direction } of knobTurns) {
        if (job === "power") controls.throttleNudge += direction * C.KNOB_STEP;
        else if (job === "powerBig") controls.throttleNudge += direction * C.KNOB_BIG_STEP;
        else if (job === "brake") controls.brakeNudge += direction * C.KNOB_STEP;
        else if (job === "brakeBig") controls.brakeNudge += direction * C.KNOB_BIG_STEP;
        else if (job === "lookSideways") knobLook.x = clamp(knobLook.x + direction * C.KNOB_LOOK_STEP);
        else if (job === "lookUpDown") knobLook.y = clamp(knobLook.y - direction * C.KNOB_LOOK_STEP); // clockwise looks up
      }
      controls.throttleOff = tapJobs.has("powerOff");
      controls.brakeOff = tapJobs.has("brakeOff");

      controls.emergencyPressed = justPressed("emergency", isDown("emergency"), wasTapped("emergency"));
      controls.awsPressed = justPressed("aws", isDown("awsAcknowledge"), wasTapped("awsAcknowledge"));
      controls.headlightsPressed = justPressed("headlights", isDown("headlights"), wasTapped("headlights"));
      controls.tailLightsPressed = justPressed("tailLights", isDown("tailLights"), wasTapped("tailLights"));
      controls.wipersPressed = justPressed("wipers", isDown("wipers"), wasTapped("wipers"));
      controls.pausePressed = justPressed("pause", isDown("pause"), wasTapped("pause"));
      controls.recentrePressed = justPressed("recentre", isDown("recentre"), wasTapped("recentre"));
      controls.toggleHudPressed = justPressed("toggleHud", isDown("toggleHud"), wasTapped("toggleHud"));
      controls.startPressed = justPressed("start", isDown("start"), wasTapped("start"));
      controls.switchPressed = switchTapped;

      const forward = justPressed("reverserForward", isDown("reverserForward"), wasTapped("reverserForward"));
      const reverse = justPressed("reverserReverse", isDown("reverserReverse"), wasTapped("reverserReverse"));
      controls.reverserStep = (forward ? 1 : 0) - (reverse ? 1 : 0);

      if (controls.recentrePressed) knobLook.x = knobLook.y = 0;
      let lookX = usePad ? applyDeadzone(pad.axes[LEFT_STICK_X]) : 0;
      let lookY = usePad ? applyDeadzone(pad.axes[LEFT_STICK_Y]) : 0;
      lookX += (arrow("ArrowRight") ? 1 : 0) - (arrow("ArrowLeft") ? 1 : 0) + mouseLook.x + knobLook.x;
      lookY += (arrow("ArrowDown") ? 1 : 0) - (arrow("ArrowUp") ? 1 : 0) + mouseLook.y + knobLook.y;
      controls.look.x = clamp(lookX);
      controls.look.y = clamp(lookY);

      keyTaps.clear(); // this frame has used them all up
      knobTurns = [];
      knobTaps = [];
      switchTapped = false;
    },
  };

  return controls;
}
