# Priming prompt: Pico horn LED

How to start the session, then the prompt to paste as your first message.

## Before you start

Move the Raspberry Pi Pico's own micro-USB cable from the Raspberry Pi 5 to **this Ubuntu
box**. (Leave the rest of the breadboard wiring, including the Debug Probe, exactly as it is —
only the Pico's own USB cable needs to move, and only for now.) The new session will flash it
and test the LED directly from here before touching any game code, and will ask you to move it
back to the Pi once it's ready for the real test.

## Start it

```bash
cd ~/Claude_sandbox
claude --model sonnet
```

(`~/Claude_sandbox` is where `CLAUDE.md` lives, so its repo rules load automatically.)

## Paste this

```
You are adding a small feature to an existing project in ~/Claude_sandbox/Class-47-Cab-Sim: a
physical LED on a Raspberry Pi Pico that lights up whenever the horn is sounded in the game.
This is a feature on the existing game, not a new project.

The full brief is here. Read all of it before doing anything else:

@~/Claude_sandbox/Class-47-Cab-Sim/docs/directions_pico_horn_led.md

Then read, in this order:
1. ~/Claude_sandbox/CLAUDE.md (repo rules)
2. ~/Claude_sandbox/Class-47-Cab-Sim: README.md, src/audio.js, src/main.js, src/config.js,
   tools/check-browser.cjs. audio.js is the closest existing pattern to what you're building
   (a small subsystem that degrades gracefully with no hardware, unlocked by the same user
   gesture) — follow its shape.
3. Your memory notes on the Class 47 Cab Simulator project.

I've moved the Pico's own USB cable to this Ubuntu box already, as the brief's Milestone 0 asks
for — the rest of the breadboard wiring (including the Debug Probe) is untouched. You have a
real Pico attached to this machine right now.

How I want you to work:
- The brief has already made the design decisions (MicroPython, Web Serial, no backend
  process). Don't re-ask them. Choose sensible defaults for anything unspecified, record the
  choice, and carry on. Ask me only if you are truly blocked.
- Work through the milestones in section 6, in order. Do Milestone 0 and Milestone 1, then
  STOP. Milestone 1 ends with a handover for me to test on the real Pi (section 8) — don't
  start anything past that until I say so.
- Milestone 0 is the one part of this you can fully verify yourself: actually watch the LED
  turn on and off from this box before writing any game code.
- Be precise about what you personally verified versus what only I can confirm on the real
  Raspberry Pi 5 with the real F310 — this feature touches hardware you can't see.
- Commit and push after each milestone, with the Co-Authored-By line from your attribution
  instructions.
- Report plainly: what you verified, what you didn't, and exactly what I need to do next.

Start by telling me, in a few lines, your plan for Milestone 0, then begin.
```

## Notes for Brendan

- The brief is at `~/Claude_sandbox/Class-47-Cab-Sim/docs/directions_pico_horn_led.md` — it
  lives in this repo, not `~/Downloads`, since it's a feature of this project rather than a
  brief for a new one.
- You don't need the Debug Probe for this: the plan uses the Pico's own USB port and the
  browser's Web Serial API, so a plain MicroPython flash (hold BOOTSEL, drag a file on) is all
  the new session needs.
- The one manual step in the finished feature: the very first time, pressing any key on the Pi's
  keyboard brings up a one-off browser device picker so the son can choose the Pico. After that
  it reconnects on its own, silently, every time.
- Milestone 1 ends with you plugging the Pico back into the Pi 5 and pressing the horn on the
  real F310 to watch the LED yourself.
