# Class 47 Cab Simulator

Drive a real British diesel from the driver's seat! You are in the cab of Class 47
locomotive 47790, pulling a railtour through the countryside. It is a game you can
change yourself.

[Play it here](https://brendanjameslynskey.github.io/Class-47-Cab-Sim/)

*(Work in progress. Right now there are 5½ miles of open country to drive along.
The village, the town and their stations are coming next.)*

## Start the game

1. Open a terminal in this folder.
2. Type `./run` and press Enter.
3. It prints two addresses. On the Raspberry Pi, open Chromium and type in the
   one that says **Network** (it looks like `http://192.168.1.132:5173`).
4. Press **A** on the gamepad.

Leave `./run` going while you work. Every time you save a file, the game on the
TV changes by itself. Press `Ctrl+C` in the terminal to stop it.

## Controls

The four buttons on the front of the gamepad are your power and brake levers.
**Triggers push a lever up, bumpers pull it back down.** A lever stays where you
leave it, just like the real thing.

| Gamepad (Logitech F310) | Keyboard | Does |
|-------------------------|----------|------|
| **RT** (right trigger) | Up or W | **More power.** Squeeze gently for a gentle increase |
| **RB** (right bumper) | Down or S | **Less power** |
| **LT** (left trigger) | Left or A | **More brake** |
| **LB** (left bumper) | Right or D | **Less brake** |
| D-pad up / down | F / R | **Reverser:** Reverse, Neutral, Forward (only when stopped) |
| **A** button | H and J | Horn (the sound comes in a later version) |
| **Back** | Space | **Emergency brake!** |
| X | L | Headlights: off, dipped, full |
| Y | V | Windscreen wipers on and off |
| Left stick | Shift + arrow keys, or drag the mouse | Look around the cab |
| Right stick click (R3) | C | Look straight ahead again |
| Start | P or Esc | Pause |
| B | Q | AWS button (comes in a later version) |
| | T | Show or hide the speed display |
| | F1 | Show or hide the performance numbers |

The switch on the back of the gamepad must be on **X**, not D.
If it isn't, the start screen will tell you.

## How to drive a train

1. **Reverser to Forward.** Press D-pad up. The little yellow lever tips forward.
2. **Let the brake off.** LB until the brake lever is all the way forward. (While the
   brake is on, the engine is cut off: watch the amber POWER CUT light.)
3. **Squeeze RT to add power.** Watch the speedometer needle climb. A heavy train
   takes a long time to get going, so be patient!
4. **Ease off with RB and coast.** Trains keep rolling for a long way.
5. **Brake early!** Trains are heavy and take a *very* long time to stop. From 60 mph
   the brakes need about **600 metres**, and the brakes are slow to come on. Start
   braking long before you need to stop. (The emergency brake is quicker, but
   it is harsh on the passengers.)

The line speed limit is 75 mph. Go faster and the limit sign flashes.

## Your first change: a shorter train

1. Open [`src/config.js`](src/config.js).
2. Find the line `export const COACHES = 8;`
3. Change `8` to `3` and save.
4. Look at the TV, then drive. A lighter train speeds up much faster and stops much sooner!

Now try `12` coaches: a very long, slow, heavy train.

More things to try in the same file:

- `TOP_SPEED_MPH`: how fast the locomotive can go
- `GRASS_COLORS`: repaint the fields! Try `"#c0508a"` for pink grass
- `SKY_TOP_COLOR` and `SKY_HORIZON_COLOR`: a sunset sky
- `WORLD_SEED`: change `47` to `5` for a different countryside
- `THROTTLE_RAISE_RATE`: how quickly the power lever moves
- `BRAKE_APPLY_LAG_S`: make the brakes slower or quicker to bite
- `LOCO_COLOR`: repaint the nose of the locomotive
- `CAB_SWAY_M`: set to `0` for a perfectly smooth cab, or `0.02` for a very bumpy one

If you break something, change it back and save again.

## Where things live

| File | What is in it |
|------|---------------|
| [`src/config.js`](src/config.js) | All the numbers and colours you can tweak |
| [`src/main.js`](src/main.js) | Starts the game, runs the loop, connects the start, drive, pause and finished screens |
| [`src/controls.js`](src/controls.js) | Reads the gamepad, keyboard and mouse |
| [`src/physics.js`](src/physics.js) | How the train speeds up, coasts and brakes (just numbers, no pictures) |
| [`src/units.js`](src/units.js) | Changes metres and metres per second into miles, yards and mph |
| [`src/route.js`](src/route.js) | The railway line, written as a list. Add hills, curves, stations and speed limits here |
| [`src/path.js`](src/path.js) | Turns the route into the real shape of the track |
| [`src/cab.js`](src/cab.js) | The inside of the cab: walls, windscreen, desk and levers |
| [`src/cab-parts.js`](src/cab-parts.js) | The dials, levers and warning lamps on the desk |
| [`src/hud.js`](src/hud.js) | The speed display at the top and the message screens |
| [`src/debug.js`](src/debug.js) | The F1 performance numbers, and a way for the tests to look inside the game |
| [`src/adaptive.js`](src/adaptive.js) | Makes the picture a little blurrier if the computer can't keep up |
| [`src/world/chunks.js`](src/world/chunks.js) | Builds the world in 100-metre pieces just ahead of the train, and throws away old ones |
| [`src/world/terrain.js`](src/world/terrain.js) | The ground: fields, hills, hedges, walls |
| [`src/world/track.js`](src/world/track.js) | The rails, sleepers and stones |
| [`src/world/furniture.js`](src/world/furniture.js) | Fences, telegraph poles, mileposts, the buffer stop |
| [`src/world/nature.js`](src/world/nature.js) | Trees, woods, sheep, cows and farms |
| [`src/world/buildings.js`](src/world/buildings.js) | Houses and barns |
| [`src/world/sky.js`](src/world/sky.js) | The sky, sun, clouds, far-away hills and the light |
| [`src/world/mesh-builder.js`](src/world/mesh-builder.js) | Glues thousands of little shapes into one to keep the game fast |
| [`src/world/random.js`](src/world/random.js) | "Random" numbers that give the same countryside every time |
| [`tools/check-physics.js`](tools/check-physics.js) | Checks the train behaves like a real one |
| [`tools/check-route.js`](tools/check-route.js) | Checks the route makes sense |
| [`tools/check-browser.cjs`](tools/check-browser.cjs) | Plays the game in a hidden browser with a pretend gamepad |

## Build your own route

Open [`src/route.js`](src/route.js). Every distance there is in **miles** from the start.
For example, to add a hill that is 1 foot up for every 60 feet along, between mile 2
and mile 2½, change `gradients: [],` to:

```js
gradients: [{ from: 2.0, to: 2.5, oneIn: 60 }],
```

(`oneIn: -60` makes it go downhill.) To change the speed limit half way along:

```js
speedLimits: [{ from: 0, mph: 75 }, { from: 3, mph: 40 }],
```

Curves, stations, signals and bridges have their own lists too. Some of them are
not drawn yet (they arrive in later versions), but curves and hills already work.
After you edit the route, run `node tools/check-route.js`. It tells you if
something doesn't make sense, like two stations on top of each other.

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
  blurrier by itself to keep going, and the numbers show how sharp it is.
- **The gamepad does nothing**: press a button on it first. Browsers hide gamepads
  until you do. Check the switch on the back is on **X**.
- **`./run` says "Port 5173 is already in use"**: another game (like the Platformer) is running.
  Press `Ctrl+C` in its terminal first.

## Notes for grown-ups

- Built with [Three.js](https://threejs.org/) and Vite in plain JavaScript. Needs Node 22+.
  Everything is drawn by code: no image, model or sound files.
- The Pi only shows the game: it runs Chromium pointed at the dev server on the
  Ubuntu box, or at the GitHub Pages address above. It is a display and an input device.
- **Sound** (Milestone 4) is not built yet. When it is, start Chromium with
  `--autoplay-policy=no-user-gesture-required`, because browsers block sound until the page
  has had a click or key press, and a gamepad button may not count.
- Pushing to `main` builds the game and publishes it to GitHub Pages
  ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).
- `npm run build` makes a `dist/` folder; `npm run preview` serves it locally.
- Checks you can run:
  - `node tools/check-physics.js`: the train model against believable ranges (60 mph in
    about 2 minutes with 8 coaches, about 600 m to stop, and so on)
  - `node tools/check-route.js`: the route data
  - `NODE_PATH=<folder with puppeteer> node tools/check-browser.cjs http://localhost:5173/`:
    drives the real game in headless Chrome with a fake F310 and takes screenshots.
    Add `--smoke` for a built copy. Headless Chrome draws in software, so its frame rate
    says nothing about the Pi.
- The world is built from the route in 100 m chunks with seeded random numbers, one
  merged mesh (with vertex colours) per chunk, so the same seed always gives the same
  countryside. The performance budget is about 200 draw calls and 250,000 triangles.
- Choices made where the brief was silent: the HUD toggle is **T** (H is the horn); the
  train stops automatically 4.5 m before the buffers at the end of the line; the
  reverser can be moved in reverse and the train will run backwards (the camera keeps
  looking down the line).
- The gamepad is read directly with the browser Gamepad API, every frame, in
  [`src/controls.js`](src/controls.js): "standard" mapping, 0.15 stick deadzone, analogue
  triggers (falling back to a full pull if a browser only reports pressed).
