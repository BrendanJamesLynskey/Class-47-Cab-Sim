# Class 47 Cab Simulator

Drive a real British diesel from the driver's seat! You are in the cab of Class 47
locomotive 47790, standing at Aldbury station, ready to pull a railtour 14 miles along a
winding line to Northwick: farmland, woods, deep cuttings, open moorland, an embankment,
two river valleys with brick viaducts, a village with a little halt and a level crossing
with gates, and a town of terraced streets before the main station. Stop your train beside
the marker at each station and see how close you got. It is a game you can change yourself.

[Play it here](https://brendanjameslynskey.github.io/Class-47-Cab-Sim/)

*(Work in progress. Speed-limit and signal scoring, passenger comfort and the engine sound are coming next.)*

## Start the game

1. Open a terminal in this folder.
2. Type `./run` and press Enter.
3. It prints two addresses. On the Raspberry Pi, open Chromium and type in the
   one that says **Network** (it looks like `http://192.168.1.132:5173`).
4. Press **A** on the gamepad.

Leave `./run` going while you work. Every time you save a file, the game on the
TV changes by itself. Press `Ctrl+C` in the terminal to stop it.

## Controls

The four buttons on the front of the gamepad are your power and brake handles.
**Triggers pull a handle back, bumpers push it forward again.** A handle stays where
you leave it, just like the real thing. Watch the two big handles in the cab: they swing
round toward you in a curve as you pull them. Looking down on the desk, the **power handle
turns anticlockwise** toward full power and the **brake handle turns clockwise** toward full brake.

| Gamepad (Logitech F310) | Keyboard | Does |
|-------------------------|----------|------|
| **RT** (right trigger) | Up or W | **More power.** Squeeze gently for a gentle increase |
| **RB** (right bumper) | Down or S | **Less power** |
| **LT** (left trigger) | Left or A | **More brake** |
| **LB** (left bumper) | Right or D | **Less brake** |
| D-pad up / down | F / R | **Reverser:** Reverse, Neutral, Forward (only when stopped) |
| D-pad **left** | J | **Horn: low note** (the little horn lever tips left) |
| D-pad **right** | H | **Horn: high note** (the lever tips right) |
| **A** button | H and J together | **Horn: both notes**, the two-tone horn (the lever is pulled back) |
| **Back** | Space | **Emergency brake!** |
| X | L | Headlights: off, dipped, full (the marker light switch follows) |
| Left stick click (L3) | K | Tail light switch (the little lever on the switch panel flips) |
| Y | V | Windscreen wipers on and off |
| Left stick | Shift + arrow keys, or drag the mouse | Look around the cab (there is a door and a window on each side, and a switch panel on the right) |
| Right stick click (R3) | C | Look straight ahead again |
| Start | P or Esc | Pause |
| B | Q | AWS button (comes in a later version) |
| | T | Show or hide the speed display |
| | F1 | Show or hide the performance numbers |

The switch on the back of the gamepad must be on **X**, not D.
If it isn't, the start screen will tell you.

## How to drive a train

You start standing at the end of the platform at Aldbury. Northwick, the last station, is 14 miles away.

1. **Reverser to Forward.** Press D-pad up. The little yellow lever tips forward.
2. **Let the brake off.** LB until the brake handle (on the left) points forward again.
   (While the brake is on, the engine is cut off: watch the amber POWER CUT light.)
3. **Squeeze RT to add power.** Watch the speedometer needle climb. A heavy train
   takes a long time to get going, so be patient!
4. **Ease off with RB and coast.** Trains keep rolling for a long way.
5. **Brake early!** Trains are heavy and take a *very* long time to stop. From 60 mph
   the brakes need about **600 metres**, and the brakes are slow to come on. Start
   braking long before you need to stop. (The emergency brake is quicker, but
   it is harsh on the passengers.)

Some hills you can hardly see, but you can *feel* them. A long, gentle climb of just
1 foot in 140 slows a heavy train from 87 mph to about 68 mph, even at full power.
Try 3 coaches instead of 8 (see below) and it climbs them much faster.

**Stop at the stations.** Foxlow Halt (a small village stop) and Northwick (the end of the
line) both have a black-and-yellow **stop marker** on a post. Bring the front of the
locomotive to a stand beside it: within 5 m is **Perfect**, within 15 m is **Good**, within
30 m is **OK**, and further than that is **Missed**. A message flashes up on the HUD when
you score a stop, and the journey ends with a **results screen** once you stop at Northwick,
however close you got.

The speed limit is 75 mph, and 60 mph round the two tight bends. Go faster and the
limit sign flashes. A **whistle board** (a white sign with a black W) stands beside the line
before each footpath crossing: sound the horn as you pass it, so walkers know a train is
coming. The village has a proper **road crossing** instead, with gates and lights — you
might see a car or two waiting for you to pass.

## Your first change: a shorter train

1. Open [`src/config.js`](src/config.js).
2. Find the line `export const COACHES = 8;`
3. Change `8` to `3` and save.
4. Look at the TV, then drive. A lighter train speeds up much faster and stops much sooner!

Now try `12` coaches: a very long, slow, heavy train.

More things to try in the same file:

- `TOP_SPEED_MPH`: how fast the locomotive can go
- `HORN_LOW_HZ` and `HORN_HIGH_HZ`: change the pitch of the horn!
- `TIME_OF_DAY`: change `"day"` to `"dusk"` or `"night"`, then press **X** for headlights. (Or add `?time=night` to the web address.)
- `GRASS_COLORS`: repaint the fields! Try `"#c0508a"` for pink grass
- `WORLD_SEED`: change `47` to `5` for a different countryside
- `THROTTLE_RAISE_RATE`: how quickly the power handle moves
- `BRAKE_APPLY_LAG_S`: make the brakes slower or quicker to bite
- `CAB_SWAY_M`: set to `0` for a perfectly smooth cab, or `0.02` for a very bumpy one
- `CANT_PER_CURVATURE`: how much the train leans into bends (`0` = not at all)
- `STOP_PERFECT_M`: how close counts as a "Perfect" stop (try making it stricter!)

If you break something, change it back and save again.

## Where things live

| File | What is in it |
|------|---------------|
| [`src/config.js`](src/config.js) | All the numbers and colours you can tweak |
| [`src/main.js`](src/main.js) | Starts the game, runs the loop, connects the start, drive, pause and finished screens |
| [`src/controls.js`](src/controls.js) | Reads the gamepad, keyboard and mouse |
| [`src/physics.js`](src/physics.js) | How the train speeds up, coasts, climbs and brakes (just numbers, no pictures) |
| [`src/units.js`](src/units.js) | Changes metres and metres per second into miles, yards and mph |
| [`src/route.js`](src/route.js) | The railway line, written as a list. Add hills, bends, bridges, scenery and speed limits here |
| [`src/path.js`](src/path.js) | Turns the route into the real shape of the track: bends ease in, the track leans, slopes are smooth |
| [`src/audio.js`](src/audio.js) | Makes the horn sound (with Web Audio, no sound files) |
| [`src/scoring.js`](src/scoring.js) | Marks how close you stopped to each station's marker |
| [`src/cab.js`](src/cab.js) | Puts the cab together and moves the needles and handles |
| [`src/cab-layout.js`](src/cab-layout.js) | Where everything is in the cab, in metres (including the 4 x 2 switch panel) |
| [`src/cab-shell.js`](src/cab-shell.js) | The walls, windows, doors, blinds, desk and seats |
| [`src/cab-panels.js`](src/cab-panels.js) | Paints the gauge board and the labels on the desk |
| [`src/cab-parts.js`](src/cab-parts.js) | Needles, lamps and painting helpers |
| [`src/hud.js`](src/hud.js) | The speed display at the top and the message screens |
| [`src/debug.js`](src/debug.js) | The F1 performance numbers, and a way for the tests to look inside the game |
| [`src/adaptive.js`](src/adaptive.js) | Makes the picture a little blurrier if the computer can't keep up |
| [`src/world/chunks.js`](src/world/chunks.js) | Builds the world in 100-metre pieces just ahead of the train, and throws away old ones |
| [`src/world/environment.js`](src/world/environment.js) | What kind of country each stretch is (hills, woods, cutting...) and how it blends |
| [`src/world/terrain.js`](src/world/terrain.js) | The ground: fields, hills, cuttings, embankments, hedges, walls |
| [`src/world/track.js`](src/world/track.js) | The rails, sleepers and stones |
| [`src/world/bridges.js`](src/world/bridges.js) | River viaducts and road bridges |
| [`src/world/stations.js`](src/world/stations.js) | The termini and the halt: platforms, buildings, the stop marker |
| [`src/world/village.js`](src/world/village.js) | The village round the halt: a church, a pub, cottages on a lane |
| [`src/world/town.js`](src/world/town.js) | The town before the main station: terraces, a mill, a gasholder, warehouses, allotments |
| [`src/world/crossings.js`](src/world/crossings.js) | Footpath and road level crossings, and the whistle boards before them |
| [`src/world/signs.js`](src/world/signs.js) | Name boards and clocks with writing on them |
| [`src/world/frame.js`](src/world/frame.js) | "So far along, so far to the side, so far up": a helper for placing things beside the track |
| [`src/world/furniture.js`](src/world/furniture.js) | Fences, telegraph poles, mileposts, the buffer stop |
| [`src/world/nature.js`](src/world/nature.js) | Trees, woods, bushes, rocks, sheep, cows and farms |
| [`src/world/buildings.js`](src/world/buildings.js) | Houses and barns |
| [`src/world/sky.js`](src/world/sky.js) | The sky, sun, stars, clouds, far-away hills and the light |
| [`src/world/mesh-builder.js`](src/world/mesh-builder.js) | Glues thousands of little shapes into one to keep the game fast |
| [`src/world/random.js`](src/world/random.js) | "Random" numbers that give the same countryside every time |
| [`tools/check-physics.js`](tools/check-physics.js) | Checks the train behaves like a real one |
| [`tools/check-route.js`](tools/check-route.js) | Checks the route makes sense |
| [`tools/check-scoring.js`](tools/check-scoring.js) | Checks the stop-marker scoring works |
| [`tools/check-browser.cjs`](tools/check-browser.cjs) | Plays the game in a hidden browser with a pretend gamepad |

## Build your own route

Open [`src/route.js`](src/route.js). Every distance there is in **miles** from the start.
Each list is one kind of thing along the line. For example, to add a hill that is 1 foot up
for every 200 feet along, between mile 2 and mile 2½, add a line to `gradients`:

```js
{ from: 2.0, to: 2.5, oneIn: 200 },
```

(`oneIn: -200` makes it go downhill.) Keep hills gentle: real railways rarely go steeper
than 1 in 100, and 1 in 200 is barely visible. To add a bend:

```js
{ from: 6.0, to: 6.4, radius_m: 1500, direction: "left" },
```

A bigger radius is a gentler bend. To change the scenery, edit `environment`: the types are
`"country"`, `"wood"`, `"hills"`, `"cutting"`, `"embankment"`, `"valley"` and `"station"`. A `"river"`
bridge belongs in a `"valley"` and a `"road"` bridge in a `"cutting"`. To add a crossing, add a line
to `levelCrossings`: `{ at: 4.5, kind: "footpath" }` for walkers, or `kind: "road"` for a lane with
gates. Stations are in `stations` (each needs `"station"` scenery round it, and `kind: "halt"` for
a small unstaffed stop like Foxlow's instead of a full terminus); `startAt` says where the train
starts, and a station's optional `stopMarkerAt` moves its scored stop marker away from the
platform's middle (Northwick's is near the buffers, so the whole platform gets used). `villages`
and `towns` add the little settlements: a village is one point (`{ at, side }`), a town is a
stretch (`{ from, to, side }`). To change the speed limit half way along:

```js
speedLimits: [{ from: 0, mph: 75 }, { from: 3, mph: 40 }],
```

After you edit the route, run `node tools/check-route.js`. It tells you if
something doesn't make sense, like a bridge on a bend or a bend that is too tight.

## Save your work

When you have made something you like:

```
./save "what I changed"
```

For example: `./save "made the train shorter and the fields pink"`.
This sends your changes to GitHub, and the game on the internet updates a minute later.

## Help, something is wrong

- **The screen is blank or the game stopped**: look at the terminal where `./run` is
  going. Errors show up there, and often tell you which file and line.
- **The game is jerky**: press `F1` to see the frame rate. The game makes the picture
  blurrier by itself to keep going, and the numbers show how sharp it is. In
  `src/config.js` you can also set `QUALITY` to `"low"` or `HEADLIGHT_BEAMS` to `false`.
- **The gamepad does nothing**: press a button on it first. Browsers hide gamepads
  until you do. Check the switch on the back is on **X**.
- **There is no sound**: browsers keep quiet until a key is pressed. The game says
  "Sound off: press any key". Press one!
- **`./run` says "Port 5173 is already in use"**: another game (like the Platformer) is running.
  Press `Ctrl+C` in its terminal first.

## Notes for grown-ups

- Built with [Three.js](https://threejs.org/) and Vite in plain JavaScript. Needs Node 22+.
  Everything is drawn or made by code: no image, model or sound files.
- The Pi only shows the game: it runs Chromium pointed at the dev server on the
  Ubuntu box, or at the GitHub Pages address above. It is a display and an input device.
- **Sound:** only the two-tone horn exists so far (the engine, wheels and AWS come in
  Milestone 4). Browsers block sound until the page has had a click or key press, and a gamepad
  button may not count, so start Chromium with `--autoplay-policy=no-user-gesture-required`.
  Without it the game shows "Sound off: press any key" and starts the sound at the first key.
  The horn is made with Web Audio (two notes 340 Hz and 425 Hz, each four mistuned waves through
  a low-pass filter and a limiter). `window.__sim.auditHorn()` (dev server only) renders it offline
  and reports the peak and RMS level, so the loudness can be measured without listening.
- Pushing to `main` builds the game and publishes it to GitHub Pages
  ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).
- `npm run build` makes a `dist/` folder; `npm run preview` serves it locally.
- Checks you can run:
  - `node tools/check-physics.js`: the train model against believable ranges (60 mph in
    about 2 minutes with 8 coaches, about 600 m to stop, a 1-in-150 climb, and so on)
  - `node tools/check-route.js`: the route data and the track shape it makes
  - `NODE_PATH=<folder with puppeteer> node tools/check-browser.cjs http://localhost:5173/`:
    drives the real game in headless Chrome with a fake F310, checks the controls, horn,
    levers, headlights, banking, budget and streaming along the whole route, and takes
    screenshots. Add `--smoke` for a built copy. Headless Chrome draws in software, so its
    frame rate says nothing about the Pi.
- **The line:** each stretch of the route has an environment type. `environment.js` turns those
  into numbers every 10 m (hill height, cutting depth or embankment height, river dips) and
  blends them smoothly. The track itself (`path.js`) has eased bends, banking ("cant") and
  smoothed gradients. The world is built in 100 m chunks with seeded random numbers, one merged
  mesh (with vertex colours) per chunk, so the same seed always gives the same countryside.
  The performance budget is about 200 draw calls and 250,000 triangles; the scenery uses about
  35 to 45 draw calls and 80,000 to 140,000 triangles at medium quality.
- **Stations:** Aldbury and Northwick are terminals with buffer stops (the train can reverse back 30 m at
  the start; a hard safety stop 1.5 m short of the buffers at the end stops you running through them, but
  the real target is the stop marker — see Scoring below). Each is a modern station (concrete platform with
  a yellow tactile edge, lighting columns, glass shelters, name boards, a covered footbridge, a car park)
  that keeps its old red-brick Victorian building with a cast-iron canopy, clock and chimneys. Foxlow Halt
  is much simpler: a short, narrow, low platform, a timber shelter, one lamp and a nameboard on a post — no
  building, footbridge or car park. Signs with writing are the only textured meshes in the world (they are
  separate meshes owned by their chunk).
- **Scoring** (`src/scoring.js`, pure and unit-tested): every station after the first (so Foxlow Halt and
  Northwick) can be scored once. While the train is at rest, the first un-scored station within 60 m of it
  is scored by how far the front of the locomotive is from its stop marker: Perfect (≤5 m), Good (≤15 m),
  OK (≤30 m), or Missed. A HUD message announces it, and the journey ends with a results screen once
  Northwick is scored, however close you got. Speed-limit scoring, comfort and signals are still to come.
- **Level crossings:** footpath ones are for people only (no barriers): timber boards between the rails, a
  gravel path, a swing gate and warning sign each side, a break in the fences and hedges, and a whistle
  board 350 m before. The village has a road crossing instead: a wider timber deck, barriers that swing
  down across the road with a red warning light, and sometimes a car or two waiting.
- **Switch panel:** the 4 x 2 layout follows the numbered legend of the real Class 47 desk: bottom row,
  from the driver's left, tail light, demister, desk light, marker light; top row, compartment light, foot
  warmer, cab heat (driver) and cab heat (second man). Only the tail light and marker light switches work.
- **Headlights** are a real spotlight (`HEADLIGHT_BEAMS`) that lights the track and scenery
  ahead. In daylight they are hard to notice; try `?time=dusk` or `?time=night`. If the Pi is
  slow, `HEADLIGHT_BEAMS = false` removes the light and its per-pixel cost.
- Choices made where the brief was silent: the HUD toggle is **T** (H is the horn); the
  reverser can be moved in reverse and the train will run backwards (the camera keeps
  looking down the line); the horn works on D-pad left/right as well as the A button; the
  stop-marker thresholds and points (`STOP_PERFECT_M` and friends in `config.js`) are a
  first guess at values that feel fair, not from any official source.
- The gamepad is read directly with the browser Gamepad API, every frame, in
  [`src/controls.js`](src/controls.js): "standard" mapping, 0.15 stick deadzone, analogue
  triggers (falling back to a full pull if a browser only reports pressed).
- The cab is modelled on photographs and diagrams of real Class 47 desks: the gauge board
  across the back with the "MAX SPEED 95 M.P.H." plate, the train brake valve on the left,
  the power controller box just right of the driver, a small horn valve lever at the far left,
  cream walls with blue panels, a roller blind over each half of the windscreen, a droplight
  window and a door on each side. It is stylised, not a museum replica.
