// pico.js — the horn light: a Raspberry Pi Pico, plugged into the Pi by USB, whose little
// green light comes on while the horn sounds. The game sends it one letter whenever the horn
// changes: "H" for on, "h" for off. The Pico's own program is in pico/main.py.
//
// It talks to the Pico with the browser's Web Serial. The browser must be told once which
// USB device is the Pico: open the game with ?pico on the end of the address and press any
// key, and a list of devices pops up. Choose the Pico. After that the browser remembers it,
// and the game finds it by itself every time, with no list. Without ?pico the list never
// appears, so people with no Pico never see it.
//
// No Pico, no Web Serial (not Chrome/Chromium, or not https:// or localhost), or the Pico
// pulled out mid-game: the light just doesn't work. The game carries on exactly the same.

import * as C from "./config.js";

// MicroPython on a Pico shows up with these USB numbers (the Debug Probe has a different product number).
const PICO_USB = { usbVendorId: 0x2e8a, usbProductId: 0x0005 };
const isPico = (port) => {
  const info = port.getInfo();
  return info.usbVendorId === PICO_USB.usbVendorId && info.usbProductId === PICO_USB.usbProductId;
};

export function createPico() {
  const serial = C.PICO_LED_ENABLED && typeof navigator !== "undefined" ? navigator.serial : undefined;
  let port = null;     // the Pico, once it is open
  let writer = null;
  let opening = false;
  let asked = false;   // only show the device list once per visit
  let lastOn = null;   // what we last told the Pico (null = nothing yet)
  let wantOn = false;  // what the horn is doing now
  let sending = Promise.resolve();

  // Send one letter. Letters go out one after another; if one fails, the Pico has gone.
  function send(on) {
    lastOn = on;
    const letter = new TextEncoder().encode(on ? "H" : "h");
    sending = sending.then(() => writer && writer.write(letter)).catch(() => forget());
  }

  function forget() {
    const old = port;
    port = null;
    if (writer) { try { writer.releaseLock(); } catch (error) { /* already gone */ } }
    writer = null;
    lastOn = null;
    if (old) old.close().catch(() => {});
  }

  async function open(candidate) {
    if (port || opening) return true; // already connected, or connecting
    opening = true;
    try {
      await candidate.open({ baudRate: C.PICO_BAUD_RATE });
      port = candidate;
      writer = port.writable.getWriter();
      console.info("Horn light: Pico connected");
      send(wantOn); // start the light in step with the horn
      return true;
    } catch (error) {
      forget(); // busy (another program has it), or it vanished: carry on without it
      return false;
    } finally {
      opening = false;
    }
  }

  // Look for a Pico the browser already knows about. Never shows anything. If it is busy
  // (say the browser was restarted and the old one hasn't quite let go), try again a few times.
  async function reconnect(triesLeft = 5) {
    try {
      const known = (await serial.getPorts()).find(isPico);
      if (known && !(await open(known)) && !port && triesLeft > 1) setTimeout(() => reconnect(triesLeft - 1), 2000);
    } catch (error) { /* no permission, no Web Serial: never mind */ }
  }

  // Must run inside a key press or click: the browser only shows its device list then.
  async function ask() {
    asked = true;
    try {
      await open(await serial.requestPort({ filters: [PICO_USB] }));
    } catch (error) {
      // Nothing chosen: don't ask again. But a touch that doesn't count as a "real" press
      // (SecurityError) hasn't shown the list yet, so the next press can try again.
      if (error && error.name === "SecurityError") asked = false;
    }
  }

  if (serial) {
    reconnect();
    // A Pico plugged in (or back in) while the game runs, and one pulled out.
    serial.addEventListener("connect", (event) => { if (isPico(event.target)) open(event.target); });
    serial.addEventListener("disconnect", (event) => { if (event.target === port) forget(); });

    // The same key, click or touch that turns the sound on (src/audio.js) can ask for the Pico.
    const wantsList = new URLSearchParams(location.search).has("pico");
    const unlock = () => { if (wantsList && !asked && !port && !opening) ask(); };
    for (const eventName of ["keydown", "mousedown", "pointerdown", "touchstart", "touchend", "click"]) window.addEventListener(eventName, unlock);
  }

  return {
    // True once the Pico is connected and the light can be switched.
    get available() { return Boolean(writer); },
    // Call every frame with whether the horn is sounding. Only sends when it changes.
    setHorn(on) {
      wantOn = Boolean(on);
      if (writer && wantOn !== lastOn) send(wantOn);
    },
  };
}
