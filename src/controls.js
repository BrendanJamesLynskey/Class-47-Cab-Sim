// controls.js — turns the gamepad, keyboard and mouse into simple answers like
// "how hard is RT pulled?" and "did he just press the horn?".
//
// The browser has no "button pressed" events for gamepads. Instead we LOOK at
// the gamepad once every frame (this is called polling). controls.update()
// does the looking, and it runs at the start of every frame (see main.js).
//
// Four buttons drive the train, and they work like real levers:
//   RT (right trigger)  = more power         RB (right bumper) = less power
//   LT (left trigger)   = more brake         LB (left bumper)  = less brake
// D-pad up/down changes the reverser; D-pad left/right blows the low/high horn.

import { STICK_DEADZONE, KEYS, MOUSE_LOOK_PIXELS } from "./config.js";

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

// Sticks never rest at exactly 0, so ignore tiny movements.
function applyDeadzone(value) {
  return Math.abs(value) < STICK_DEADZONE ? 0 : value;
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
// no in-between amount), we treat a press as a full pull.
function triggerAmount(button) {
  if (!button) return 0;
  const amount = button.value > 0 ? button.value : button.pressed ? 1 : 0;
  return amount < TRIGGER_DEADZONE ? 0 : amount;
}

export function createControls() {
  // ---- Keyboard and mouse: remember which keys are down ----
  const keysDown = new Set();
  const keyTaps = new Set(); // keys that went down since the last frame (so a very quick tap is never missed)
  const mouseLook = { x: 0, y: 0 };
  let dragStart = null;

  window.addEventListener("keydown", (event) => {
    if (!keysDown.has(event.code)) keyTaps.add(event.code);
    keysDown.add(event.code);
    // Stop the arrow keys and Space from scrolling the page.
    if (event.code.startsWith("Arrow") || event.code === "Space") event.preventDefault();
  });
  window.addEventListener("keyup", (event) => keysDown.delete(event.code));
  window.addEventListener("blur", () => keysDown.clear()); // don't get stuck if the window loses focus

  window.addEventListener("mousedown", (event) => { dragStart = { x: event.clientX, y: event.clientY }; });
  window.addEventListener("mouseup", () => { dragStart = null; mouseLook.x = mouseLook.y = 0; });
  window.addEventListener("mousemove", (event) => {
    if (!dragStart) return;
    mouseLook.x = Math.max(-1, Math.min(1, (event.clientX - dragStart.x) / MOUSE_LOOK_PIXELS));
    mouseLook.y = Math.max(-1, Math.min(1, (event.clientY - dragStart.y) / MOUSE_LOOK_PIXELS));
  });

  const keyDown = (action) => KEYS[action].some((code) => keysDown.has(code));
  const shiftHeld = () => keysDown.has("ShiftLeft") || keysDown.has("ShiftRight");

  const tapped = (action) => KEYS[action].some((code) => keyTaps.has(code));

  // "Pressed this frame" needs to remember what was down last frame. (A key tap that
  // came and went between two frames still counts, thanks to keyTaps.)
  const wasDown = {};
  function justPressed(name, isDownNow, keyTapped = false) {
    const pressed = (isDownNow && !wasDown[name]) || keyTapped;
    wasDown[name] = isDownNow;
    return pressed;
  }

  const controls = {
    // Held right now (analog: 0 to 1)
    throttleUp: 0,    // RT
    throttleDown: 0,  // RB
    brakeUp: 0,       // LT
    brakeDown: 0,     // LB
    hornHigh: false,  // D-pad right, A (both notes) and H
    hornLow: false,   // D-pad left, A (both notes) and J
    look: { x: 0, y: 0 }, // left stick / Shift+arrows / mouse drag: -1..1, x right, y down

    // Pressed for ONE frame only
    emergencyPressed: false,    // Back / Space
    reverserStep: 0,            // +1 = toward Forward (D-pad up / F), -1 = toward Reverse (D-pad down / R)
    awsPressed: false,          // B / Q
    headlightsPressed: false,   // X / L
    wipersPressed: false,       // Y / V
    pausePressed: false,        // Start / P / Esc
    recentrePressed: false,     // R3 / C
    toggleHudPressed: false,    // T
    startPressed: false,        // A / Enter / Space: used on the start and results screens

    padStatus: "none", // "none" | "wrong-mode" | "ready"

    update() {
      const pad = findGamepad();
      const buttons = pad && pad.mapping === "standard" ? pad.buttons : null;
      const down = (index) => Boolean(buttons && buttons[index] && buttons[index].pressed);

      if (!pad) controls.padStatus = "none";
      else if (pad.mapping !== "standard") controls.padStatus = "wrong-mode"; // the switch on the back is probably on D
      else controls.padStatus = "ready";

      // Shift + arrow keys look around instead of driving.
      const lookKeys = shiftHeld();
      const arrow = (code) => lookKeys && keysDown.has(code);
      const driveKey = (action) => KEYS[action].some((code) => keysDown.has(code) && !(lookKeys && code.startsWith("Arrow")));

      controls.throttleUp = Math.max(triggerAmount(buttons && buttons[BUTTON.RT]), driveKey("throttleUp") ? 1 : 0);
      controls.throttleDown = Math.max(down(BUTTON.RB) ? 1 : 0, driveKey("throttleDown") ? 1 : 0);
      controls.brakeUp = Math.max(triggerAmount(buttons && buttons[BUTTON.LT]), driveKey("brakeUp") ? 1 : 0);
      controls.brakeDown = Math.max(down(BUTTON.LB) ? 1 : 0, driveKey("brakeDown") ? 1 : 0);

      // D-pad right sounds the high note, D-pad left the low note, and A (or both together) the two-tone horn.
      controls.hornHigh = down(BUTTON.A) || down(BUTTON.DPAD_RIGHT) || keyDown("hornHigh");
      controls.hornLow = down(BUTTON.A) || down(BUTTON.DPAD_LEFT) || keyDown("hornLow");

      let lookX = pad && buttons ? applyDeadzone(pad.axes[LEFT_STICK_X]) : 0;
      let lookY = pad && buttons ? applyDeadzone(pad.axes[LEFT_STICK_Y]) : 0;
      lookX += (arrow("ArrowRight") ? 1 : 0) - (arrow("ArrowLeft") ? 1 : 0) + mouseLook.x;
      lookY += (arrow("ArrowDown") ? 1 : 0) - (arrow("ArrowUp") ? 1 : 0) + mouseLook.y;
      controls.look.x = Math.max(-1, Math.min(1, lookX));
      controls.look.y = Math.max(-1, Math.min(1, lookY));

      controls.emergencyPressed = justPressed("emergency", down(BUTTON.BACK) || keyDown("emergency"), tapped("emergency"));
      controls.awsPressed = justPressed("aws", down(BUTTON.B) || keyDown("awsAcknowledge"), tapped("awsAcknowledge"));
      controls.headlightsPressed = justPressed("headlights", down(BUTTON.X) || keyDown("headlights"), tapped("headlights"));
      controls.wipersPressed = justPressed("wipers", down(BUTTON.Y) || keyDown("wipers"), tapped("wipers"));
      controls.pausePressed = justPressed("pause", down(BUTTON.START) || keyDown("pause"), tapped("pause"));
      controls.recentrePressed = justPressed("recentre", down(BUTTON.R3) || keyDown("recentre"), tapped("recentre"));
      controls.toggleHudPressed = justPressed("toggleHud", keyDown("toggleHud"), tapped("toggleHud"));
      controls.startPressed = justPressed("start", down(BUTTON.A) || keyDown("start"), tapped("start"));

      const forward = justPressed("reverserForward", down(BUTTON.DPAD_UP) || keyDown("reverserForward"), tapped("reverserForward"));
      const reverse = justPressed("reverserReverse", down(BUTTON.DPAD_DOWN) || keyDown("reverserReverse"), tapped("reverserReverse"));
      controls.reverserStep = (forward ? 1 : 0) - (reverse ? 1 : 0);

      keyTaps.clear(); // this frame has used them all up
    },
  };

  return controls;
}
