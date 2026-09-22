# Feature: light an LED on a Raspberry Pi Pico when the horn is sounded

Directions for a Claude Code session (written for Sonnet). Read **all** of this before you
write any code. This is a feature added to the **existing** Class 47 Cab Simulator, not a new
project — you are working in `~/Claude_sandbox/Class-47-Cab-Sim`, the same repo, and everything
in its own `README.md` / `CLAUDE.md` rules still applies.

## 0. How to work (read this first)

- The design decisions are **already made** in this file. Do not re-ask them. If something is
  genuinely unspecified, choose a sensible default, write the choice down in the README and your
  report, and carry on. Only stop to ask Brendan when you are truly blocked.
- This feature touches **real hardware** you cannot see. Say plainly, at every step, what you
  actually tested versus what you are assuming. Never claim the LED lights up unless you (or
  Brendan) watched it happen.
- Work through the milestones in section 6, in order. **Milestone 1 ends with a request to
  Brendan** (section 8): he needs to plug the Pico into the Raspberry Pi 5 and confirm the light
  works with a real horn press on the real F310. Don't start Milestone 2 until he says so.
- Keep to `~/Claude_sandbox/CLAUDE.md`: match the style of the rest of this repo, update the
  README, commit and push after each milestone.
- The game must work exactly as well as it does today for anyone **without** a Pico plugged
  in. This is a bonus extra, never a requirement to play.

## 1. The setup

- **Raspberry Pi 5**, in its case, running Chromium, exactly as the rest of this project already
  assumes (see the game's own README, "Notes for grown-ups").
- **Logitech F310** gamepad, plugged into the Pi 5, driving the game as usual.
- **Raspberry Pi Pico**, on a breadboard, connected to the Pi 5 by its own micro-USB cable (this
  gives it both power and a USB-serial link — you do not need anything else for this feature).
- There is also a **Raspberry Pi Debug Probe** (the small official probe, translucent case with
  the raspberry logo, marked U and D) wired to the breadboard with two 3-pin cables (SWD and
  UART). **You do not need it for this feature.** It is there for low-level debugging with a
  toolchain; the plan below uses the Pico's own USB port and the browser's Web Serial API
  instead, which is simpler and needs no extra tools. Leave it connected; ignore it.
- Brendan can move the Pico's USB cable to **this Ubuntu box** temporarily so you can flash it
  and test the serial link directly, with the tools you already have here. Ask him to do this at
  the start of Milestone 0; he moves it back to the Pi for Milestone 1's real test.

## 2. What is decided

| Topic | Decision |
|-------|----------|
| Firmware language | **MicroPython.** No toolchain, no compiler — copy one `.py` file onto the board. Readable by an 11-year-old. |
| How the game talks to the Pico | **The Web Serial API**, directly from the browser, over the Pico's own USB. No backend process, no Python companion script on the Pi — this keeps the whole project's "everything lives in the browser" shape. |
| Wire protocol | One byte at a time, plain ASCII: `H` = horn on (LED on), `h` = horn off (LED off). Simple enough to extend later (a different letter per light). |
| What triggers it | The **same** horn state the game already computes for the audio horn (`controls.hornLow \|\| controls.hornHigh` in `src/main.js`) — do not re-derive it from raw gamepad buttons a second time. |
| Which pin | `machine.Pin("LED", Pin.OUT)` in MicroPython. This string form works on the original Pico, Pico W, Pico 2 and Pico 2 W without you needing to know which board it is (confirmed: the LED lives on GP25 on the plain Pico, but on the wireless chip on the W variants; `"LED"` is a board-independent alias that MicroPython resolves correctly on all of them). |
| Connecting from the browser | A **one-time manual step**: the first time the game runs with the Pico plugged in, pressing any key (reusing the existing "Sound off: press any key" gesture in `src/audio.js` — the same click/keypress can unlock both) opens the browser's device picker, and the son picks the Pico once. After that, `navigator.serial.getPorts()` remembers it and reconnects automatically, no picker, every time. |
| If there is no Pico, or the browser refuses | The game **must carry on exactly as normal**, silently. No error dialogs, no console spam beyond one quiet log line. |
| Where the code lives | `pico/main.py` (the firmware) and `pico/README.md` (a short flashing guide) at the repo root; `src/pico.js` (the browser side, styled like `src/audio.js`) inside the game. `PICO_LED_ENABLED` and `PICO_BAUD_RATE` in `src/config.js`. |

## 3. Why Web Serial, not a companion script

You might reach for a separate Python process on the Pi that watches the gamepad directly
(via `evdev`) and writes to the Pico's serial port, bypassing the browser entirely. **Don't.**
It works, but it adds a second codebase, a second thing to keep running (a systemd service or a
forgotten terminal window), and a second copy of the horn-button logic that can drift out of sync
with `src/controls.js`. The browser already knows the horn state precisely, every frame; Web
Serial lets it say so directly. Simpler is better here, same as everywhere else in this project.

**The catch, and how to handle it:**

- Web Serial needs a "secure context". `https://` is secure; so is `http://localhost` or
  `http://127.0.0.1`; a plain LAN address like `http://192.168.1.132:5173` (this project's dev
  server) is **not**. So:
  - Against the **deployed Pages URL** (`https://brendanjameslynskey.github.io/Class-47-Cab-Sim/`)
    it works with no special setup. Prefer this for the final test with Brendan.
  - Against the **local dev server** during your own work, launch Chromium with
    `--unsafely-treat-insecure-origin-as-secure=http://<dev-server-address>:5173
    --user-data-dir=/tmp/chrome-pico-test` (a throwaway profile — the flag needs one). Document
    this in the README's "Notes for grown-ups", next to the existing audio-flag note.
- `requestPort()` (the one-time device picker) needs a **real keyboard/mouse/touch gesture**. A
  gamepad button press does not reliably count (the same caveat already written down for audio
  autoplay in this project's memory notes and brief — check, it applies here too). Trigger it
  from the same keydown/mousedown/pointerdown/touchstart listener `src/audio.js` already uses to
  unlock sound.
- Once granted, reconnect silently on load with `navigator.serial.getPorts()` — never show a
  picker again unless the device list is empty.
- A real F310 has more than one way to sound the horn (D-pad left/right, or A). All of them must
  light the LED, because you are reusing the same `horn` state the audio already reacts to.

## 4. The firmware (`pico/main.py`)

Something close to this — keep it this simple, it's meant to be read by an 11-year-old:

```python
# main.py — runs automatically when the Pico powers up.
# Waits for a letter down the USB serial link and lights the onboard LED accordingly.
#   H = horn on (the driver is sounding the horn): light up
#   h = horn off: turn off
from machine import Pin
import sys

led = Pin("LED", Pin.OUT)

while True:
    byte = sys.stdin.buffer.read(1)
    if byte == b"H":
        led.value(1)
    elif byte == b"h":
        led.value(0)
```

Flashing it (standard MicroPython route, needs nothing beyond a USB cable):

1. Hold the **BOOTSEL** button on the Pico, plug it into USB (or press the reset/BOOTSEL combo
   if it's already plugged in), let go. It appears as a USB drive called `RPI-RP2`.
2. Drag the official MicroPython UF2 firmware onto it (download it once from
   micropython.org's Pico downloads page — check the installed tooling / network access you
   have here first). It reboots as a MicroPython board.
3. Copy `pico/main.py` onto the board as `main.py` (over its USB-serial / mass-storage, with
   `mpremote cp pico/main.py :main.py` if you install `mpremote`, or with Thonny if a GUI is
   easier — your call, whichever you can actually drive from this session).
4. Reset it. `main.py` runs automatically from then on.

Write `pico/README.md` with these steps in plain language, screenshots not required, for
whoever needs to reflash it later (including the son).

## 5. The browser side (`src/pico.js`)

Modelled on `src/audio.js`'s shape (a `create...()` factory, graceful failure, no exceptions
escaping to the caller):

```js
export function createPico() {
  // returns an object with:
  //   .available   — true once a port is open and ready to write to
  //   .connect()   — call from a user gesture; requests/opens a port, does nothing if
  //                  navigator.serial doesn't exist, already have a port, or the user cancels
  //   .setHorn(on) — call every frame with the current horn state; only writes when it changes
}
```

- Guard every entry point: `if (!("serial" in navigator)) return` — older/non-Chromium browsers
  must not throw.
- On `connect()`, try `navigator.serial.getPorts()` first (silent, no picker) and use the first
  one if there's exactly one already granted; only call `requestPort()` (the picker) if none was
  found.
- Open at `PICO_BAUD_RATE` (`config.js`, default `115200` — the value barely matters for USB
  CDC, but pick one and be consistent).
- `setHorn(on)` writes a single byte (`'H'` or `'h'`) only when the state actually changes from
  the last call — don't spam the link every frame.
- Wrap every serial operation in `try/catch`; on a write failure (Pico unplugged mid-game),
  quietly mark `.available = false` and stop writing until reconnected. Listen for the
  `navigator.serial` `connect`/`disconnect` events if that's cleaner than polling.
- Wire it into `src/main.js` right next to the existing `audio.setHorn(horn.low, horn.high)`
  call, and into the same keyboard/mouse "unlock" listener `audio.js` already installs (one
  gesture unlocks both sound and the Pico).
- Add `PICO_LED_ENABLED` to `config.js` (default `true`) and check it before doing anything, so
  the feature can be switched off in one line if it ever misbehaves.

## 6. Milestones

**Milestone 0: prove the link, away from the game.** Ask Brendan to move the Pico's USB cable
to this Ubuntu box. Flash `pico/main.py`. Write a tiny standalone test page (`pico/test.html` is
fine — a "Connect" button and "LED on" / "LED off" buttons, no game code involved) and use it,
from this box, to genuinely watch the LED turn on and off. This is the one part of this feature
you personally *can* fully verify, so do it properly before writing a line of game code.

**Milestone 1: wire it into the real game, then STOP for Brendan.** `src/pico.js`, the
`config.js` flags, the `main.js` wiring, the combined unlock gesture, the README update. Verify
with headless Chrome that the game behaves identically with no Pico and no `navigator.serial`
at all (stub it out, confirm zero console errors — see section 7). Then hand over to Brendan
(section 8) for the real test: Pico back on the Pi, F310 in hand, watch the LED with your own
eyes. Don't start anything past this until he confirms it works (or reports what doesn't).

## 7. How to verify

**What you can check yourself, on this box:**
- `pico/test.html` against the physically-attached Pico (Milestone 0) — the one place you get to
  see it actually happen.
- Headless Chrome, exactly as the rest of this project's `tools/check-browser.cjs` already does,
  with `navigator.serial` **stubbed out or deleted** on the page (`Object.defineProperty` it away,
  or just don't inject it — headless Chrome for Testing may not implement Web Serial at all,
  which is itself a useful thing to confirm): the game must start, run, and show zero
  `pageerror`s and zero console errors. Add this as a check in `tools/check-browser.cjs` (a new
  `if (!smoke) {...}` block is the existing pattern) rather than a separate script.
- Read `src/pico.js` back over once you're done and make sure nothing there can throw outside a
  `try/catch` if `navigator.serial` is missing, permission is denied, or a write fails.

**What only Brendan can check:** whether the LED actually lights when he presses the horn on
the real Pi, with the real F310, with the real Pico wired up as in the photo. Say so plainly.

## 8. Milestone 1 handover (what to tell Brendan)

1. Move the Pico's USB cable back to the Raspberry Pi 5 (breadboard wiring can stay as it is —
   only the Pico's own micro-USB matters for this feature).
2. On the Pi, open the deployed Pages URL in Chromium (simplest: no special flags needed there).
3. Press any key once — this should trigger a device picker; choose the Pico. (If it doesn't
   appear, say so — the picker only lists devices with no *other* program already holding the
   port open.)
4. Sound the horn (A, or D-pad left/right) on the F310 and watch the Pico's onboard LED.
5. Report: did the picker appear as expected, did the LED light up, and did it track the horn
   accurately (on when held, off when released, including a two-tone A press)?
6. If he wants it working against the local dev server too (for faster iteration later), give
   him the Chromium flag from section 3 to add to his usual launch command.

Then say honestly what you verified yourself (Milestone 0's direct test, the headless
no-Pico regression check) and what you did not (anything on the real Pi).

## 9. Done means

- The game plays exactly as before when no Pico is attached — verified by the headless
  no-`navigator.serial` check.
- `pico/main.py` is flashed, documented, and was genuinely watched turning an LED on and off
  from this Ubuntu box.
- `src/pico.js` reuses the existing horn state, degrades silently, and is wired into the
  existing sound-unlock gesture.
- The README documents the feature, the one-time device-picker step, and the Chromium flag for
  local-dev testing.
- Committed and pushed, with the Co-Authored-By line your session's attribution instructions
  give you.
- You have reported plainly what you verified yourself and what is still only Brendan's to
  confirm on the real hardware.
