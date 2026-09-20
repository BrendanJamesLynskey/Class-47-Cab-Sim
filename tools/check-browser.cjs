// check-browser.cjs — drives the real game in a headless Chrome with a FAKE gamepad,
// takes screenshots, and checks the controls, the picture budget and the streaming.
//
// Needs puppeteer and Chrome (they are installed in ~/Claude_sandbox). Run it with:
//
//   NODE_PATH=~/Claude_sandbox/node_modules node tools/check-browser.cjs http://localhost:5173/
//   NODE_PATH=... node tools/check-browser.cjs http://localhost:4173/ --smoke   (a built copy: no test hook)
//
// Screenshots go to the folder given by --out (default /tmp/cab-shots). The dev server
// exposes window.__sim (see src/main.js); a built copy does not, so --smoke only checks
// that it starts and draws with no errors.
//
// Headless Chrome draws with software (SwiftShader), so its frame rate says NOTHING
// about the Raspberry Pi. It only proves the picture draws and the controls work.

const puppeteer = require("puppeteer");
const fs = require("fs");

const args = process.argv.slice(2);
const url = args.find((a) => a.startsWith("http")) || "http://localhost:5173/";
const smoke = args.includes("--smoke");
const outIndex = args.indexOf("--out");
const outDir = outIndex >= 0 ? args[outIndex + 1] : "/tmp/cab-shots";
fs.mkdirSync(outDir, { recursive: true });

const problems = [];
let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "ok   " : "FAIL "} ${name}${detail ? "   " + detail : ""}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The pad the page sees. The test changes these numbers to "press" buttons.
function installFakePad() {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
  const pad = { id: "Fake Logitech F310", index: 0, connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons };
  window.__pad = { mode: "none", pad };
  navigator.getGamepads = () => {
    if (window.__pad.mode === "none") return [null, null, null, null];
    return [{ ...pad, mapping: window.__pad.mode === "wrong" ? "" : "standard" }, null, null, null];
  };
}

(async () => {
  const browser = await puppeteer.launch({
    headless: "new", executablePath: "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--mute-audio"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 640, height: 360 });
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") problems.push("console.error: " + m.text()); });
  page.on("requestfailed", (r) => problems.push("requestfailed: " + r.url()));
  page.on("response", (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
  await page.evaluateOnNewDocument(installFakePad);

  const shot = async (name) => { const file = `${outDir}/${name}.png`; await page.screenshot({ path: file }); console.log(`     screenshot ${file}`); };
  // Pad helpers (buttons are numbered as in src/controls.js).
  const setPad = (mode) => page.evaluate((m) => { window.__pad.mode = m; }, mode);
  const press = (index, value = 1) => page.evaluate((i, v) => { const b = window.__pad.pad.buttons[i]; b.pressed = v > 0; b.value = v; }, index, value);
  const release = (index) => press(index, 0);
  const tap = async (index) => { await press(index); await sleep(250); await release(index); await sleep(250); };
  const sim = (fn, ...a) => page.evaluate(`(${fn.toString()})(...${JSON.stringify(a)})`);
  const state = () => sim(() => ({
    screen: window.__sim.screen, t: window.__sim.physicsSeconds, throttle: window.__sim.train.throttle,
    brake: window.__sim.train.brakeHandle, reverser: window.__sim.train.reverser, speed: window.__sim.train.speed_mps,
    distance: window.__sim.train.distance_m, cylinder: window.__sim.train.brakeCylinder,
  }));
  // Wait until the physics has simulated `seconds` more time (headless frames are slow, so wall time means nothing).
  const simulate = async (seconds) => {
    const start = (await state()).t;
    await page.waitForFunction((s, t) => window.__sim.physicsSeconds >= s + t, { timeout: 120000, polling: 100 }, start, seconds);
  };
  const frames = (n = 3) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const stats = () => page.evaluate(() => {
    const r = window.__sim.renderer.info; return { calls: r.render.calls, triangles: r.render.triangles, geometries: r.memory.geometries, textures: r.memory.textures, chunks: window.__sim.world.chunkCount };
  });

  await page.goto(url + (url.includes("?") ? "&" : "?") + "fixed", { waitUntil: "networkidle0" });
  await sleep(1500);

  // ---- 1. The start screen in its three states ----
  const overlayText = () => page.evaluate(() => document.querySelector(".overlay").innerText);
  await setPad("none"); await sleep(600);
  check("start screen, no pad: says no gamepad", /No gamepad found/.test(await overlayText()));
  await shot("01-start-no-pad");
  await setPad("wrong"); await sleep(600);
  check("start screen, wrong mode: says flip the switch to X", /switch on the back to X/.test(await overlayText()));
  await shot("02-start-wrong-mode");
  await setPad("ready"); await sleep(600);
  check("start screen, pad ready: says Gamepad ready", /Gamepad ready/.test(await overlayText()));
  await shot("03-start-ready");

  // ---- 2. Press A to start ----
  await tap(0);
  await sleep(1500);
  await shot("04-cab-at-rest");
  const hud = () => page.evaluate(() => document.querySelector(".hud").innerText.replace(/\s+/g, " "));
  check("A starts the drive (start screen goes away)", (await page.evaluate(() => getComputedStyle(document.querySelector(".overlay")).display)) === "none");

  if (smoke) {
    await tap(12); await tap(12);
    await press(7, 1); await sleep(4000); await release(7);
    await shot("05-smoke-driving");
    check("smoke: the HUD is showing", /mph/.test(await hud()), await hud());
  } else {
    // ---- 3. Control mapping ----
    let s = await state();
    check("the game is on the drive screen", s.screen === "drive");
    check("reverser starts in Neutral", s.reverser === 0);

    // Throttle in Neutral: friendly hint, and no movement.
    await press(7, 1); await simulate(0.6); await frames(2);
    check("RT in Neutral shows the hint 'Reverser to Forward'", /Reverser to Forward/.test(await hud()), await hud());
    await release(7);
    await sim(() => { window.__sim.train.throttle = 0; });

    await tap(13); // D-pad down
    check("D-pad down from Neutral: Reverse", (await state()).reverser === -1);
    await tap(12); // D-pad up
    check("D-pad up: back to Neutral", (await state()).reverser === 0);
    await tap(12);
    check("D-pad up again: Forward", (await state()).reverser === 1);
    await tap(12);
    check("D-pad up once more: stays at Forward", (await state()).reverser === 1);

    // RT full pull: 0.5 handle per physics second.
    let a = await state();
    await press(7, 1); await simulate(1.0); await release(7);
    let b = await state();
    const risePerSecond = (b.throttle - a.throttle) / (b.t - a.t);
    check("RT (full pull) raises the power handle at about 0.5 per second", Math.abs(risePerSecond - 0.5) < 0.08, `rate ${risePerSecond.toFixed(2)}/s`);
    await sleep(800);
    let c = await state();
    // (physics keeps running, so compare the handle, which must not move by itself)
    check("let go of RT: the handle stays where it is", Math.abs(c.throttle - b.throttle) < 0.02, `${b.throttle.toFixed(2)} -> ${c.throttle.toFixed(2)}`);

    await press(5, 1); await simulate(0.4); await release(5);
    let d = await state();
    check("RB lowers the power handle", d.throttle < c.throttle - 0.1, `${c.throttle.toFixed(2)} -> ${d.throttle.toFixed(2)}`);

    // Half pull rises at half the rate.
    await sim(() => { window.__sim.train.throttle = 0; });
    a = await state();
    await press(7, 0.5); await simulate(1.0); await release(7);
    b = await state();
    const halfRate = (b.throttle - a.throttle) / (b.t - a.t);
    check("RT (half pull) raises it at about half that rate", Math.abs(halfRate - 0.25) < 0.06, `rate ${halfRate.toFixed(2)}/s`);

    // Driving: the train speeds up with power on.
    await sim(() => { window.__sim.train.throttle = 1; });
    await simulate(4);
    s = await state();
    check("full power in Forward: the train speeds up", s.speed > 1.0, `speed ${(s.speed / 0.44704).toFixed(1)} mph after 4 s`);
    await shot("05-driving-full-power");

    // Brake handle.
    a = await state();
    await press(6, 1); await simulate(0.6); await release(6);
    b = await state();
    check("LT raises the brake handle", b.brake > a.brake + 0.15, `${a.brake.toFixed(2)} -> ${b.brake.toFixed(2)}`);
    const cut = await page.evaluate(() => window.__sim.train.powerCutOut);
    check("brake handle above 0.15 shows the power cut-out", cut === true);
    await frames(2);
    await shot("06-brake-applied");
    await press(4, 1); await simulate(1.0); await release(4);
    check("LB releases the brake handle", (await state()).brake < b.brake - 0.3, `${b.brake.toFixed(2)} -> ${(await state()).brake.toFixed(2)}`);

    // Speeding: the limit sign flashes when you are over the limit (75 mph here).
    await page.evaluate(() => { document.querySelector(".hud").style.display = ""; });
    await sim(() => window.__sim.setSpeedMph(60)); await frames(3);
    const calm = await page.evaluate(() => document.querySelector(".hud-limit").classList.contains("flash"));
    await sim(() => window.__sim.setSpeedMph(80)); await frames(3);
    const flashing = await page.evaluate(() => document.querySelector(".hud-limit").classList.contains("flash"));
    check("speed limit sign: steady at 60 mph, flashing at 80 mph (limit 75)", calm === false && flashing === true, `60 mph flash=${calm}, 80 mph flash=${flashing}`);
    await sim(() => window.__sim.setSpeedMph(0));

    // Emergency brake (Back).
    await sim(() => { window.__sim.train.throttle = 1; window.__sim.setSpeedMph(50); });
    await tap(8);
    s = await state();
    check("Back = emergency brake: power to zero, brake handle full", s.throttle === 0 && s.brake === 1, `throttle ${s.throttle} brake ${s.brake}`);
    await sim(() => { window.__sim.train.emergency = false; window.__sim.train.brakeHandle = 0; window.__sim.train.brakeCylinder = 0; window.__sim.setSpeedMph(0); });

    // X (headlights) and Y (wipers).
    await tap(2);
    check("X: headlights off -> dipped", (await sim(() => window.__sim.headlights)) === 1);
    await tap(2); await tap(2);
    check("X three times: back to off", (await sim(() => window.__sim.headlights)) === 0);
    await tap(3);
    check("Y: wipers on", (await sim(() => window.__sim.wipersOn)) === true);
    await tap(3);
    check("Y again: wipers off", (await sim(() => window.__sim.wipersOn)) === false);

    // Look around with the left stick.
    await page.evaluate(() => { window.__pad.pad.axes[0] = -1; });
    await sleep(2500);
    let yaw = await sim(() => window.__sim.look.yaw);
    check("left stick left: the view turns left (~70 degrees)", yaw > 1.0 && yaw < 1.3, `yaw ${(yaw * 57.3).toFixed(0)} deg`);
    await shot("07-look-left");
    await page.evaluate(() => { window.__pad.pad.axes[0] = 0; window.__pad.pad.axes[1] = 1; });
    await sleep(2500);
    const pitch = await sim(() => window.__sim.look.pitch);
    check("left stick down: the view looks down (~25 degrees)", pitch < -0.35 && pitch > -0.5, `pitch ${(pitch * 57.3).toFixed(0)} deg`);
    await shot("08-look-down");
    await page.evaluate(() => { window.__pad.pad.axes[1] = 0; });
    await sleep(3000);
    yaw = await sim(() => window.__sim.look.yaw);
    check("let go of the stick: the view springs back to the middle", Math.abs(yaw) < 0.05);

    // Start button pauses.
    await tap(9);
    check("Start pauses", (await state()).screen === "paused");
    await shot("09-paused");
    await tap(9);
    check("Start again resumes", (await state()).screen === "drive");

    // ---- Keyboard: the same jobs without a gamepad ----
    const kb = page.keyboard;
    await sim(() => { const t = window.__sim.train; t.throttle = 0; t.brakeHandle = 0; t.brakeCylinder = 0; t.speed_mps = 0; t.reverser = 0; });
    await kb.press("KeyF"); await frames(3);
    check("keyboard F: reverser to Forward", (await state()).reverser === 1);
    await kb.press("KeyR"); await frames(3); await kb.press("KeyR"); await frames(3);
    check("keyboard R twice: reverser to Reverse", (await state()).reverser === -1);
    await kb.press("KeyF"); await frames(3); await kb.press("KeyF"); await frames(3);
    a = await state();
    await kb.down("ArrowUp"); await simulate(1.0); await kb.up("ArrowUp");
    b = await state();
    check("keyboard Up raises the power handle (~0.5 per second)", Math.abs((b.throttle - a.throttle) / (b.t - a.t) - 0.5) < 0.1, `${a.throttle.toFixed(2)} -> ${b.throttle.toFixed(2)}`);
    await kb.down("KeyS"); await simulate(0.5); await kb.up("KeyS");
    check("keyboard Down lowers it", (await state()).throttle < b.throttle - 0.2);
    await sim(() => { window.__sim.train.throttle = 0; });
    await kb.down("KeyA"); await simulate(0.6); await kb.up("KeyA");
    b = await state();
    check("keyboard Left/A raises the brake handle", b.brake > 0.15, `brake ${b.brake.toFixed(2)}`);
    await kb.down("KeyD"); await simulate(1.0); await kb.up("KeyD");
    check("keyboard Right/D releases it", (await state()).brake < b.brake - 0.3);
    a = await state();
    await kb.down("ShiftLeft"); await kb.down("ArrowLeft"); await sleep(2500);
    const shiftYaw = await sim(() => window.__sim.look.yaw);
    await kb.up("ArrowLeft"); await kb.up("ShiftLeft");
    check("Shift + Left arrow looks left and does NOT apply the brake", shiftYaw > 0.8 && (await state()).brake <= a.brake + 0.01, `yaw ${(shiftYaw * 57.3).toFixed(0)} deg, brake ${(await state()).brake.toFixed(2)}`);
    await sleep(2500);
    await sim(() => { const t = window.__sim.train; t.throttle = 1; t.speed_mps = 20; });
    await kb.press("Space"); await frames(3);
    s = await state();
    check("keyboard Space: emergency brake", s.throttle === 0 && s.brake === 1);
    await sim(() => { const t = window.__sim.train; t.emergency = false; t.brakeHandle = 0; t.brakeCylinder = 0; t.speed_mps = 0; t.reverser = 1; });
    await kb.down("KeyH");
    await frames(2);
    check("keyboard H: horn (high tone) is on while held", (await sim(() => window.__sim.controls.hornHigh)) === true);
    await kb.up("KeyH");
    await kb.press("KeyT"); await frames(2);
    check("T hides the HUD", (await page.evaluate(() => getComputedStyle(document.querySelector(".hud")).display)) === "none");
    await kb.press("KeyT"); await frames(2);
    check("T shows the HUD again", (await page.evaluate(() => getComputedStyle(document.querySelector(".hud")).display)) !== "none");
    await kb.press("F1"); await sleep(600); await frames(2); await sleep(400);
    const readout = await page.evaluate(() => document.querySelector(".debug").innerText);
    check("F1 shows the performance readout", /draw calls/.test(readout) && /fps/.test(readout), readout.replace(/\n/g, " | "));
    await shot("13-f1-readout");
    await kb.press("F1");

    // ---- The horn: D-pad left = low note, D-pad right = high note, A = both ----
    await sim(() => { const t = window.__sim.train; t.throttle = 0; t.brakeHandle = 0; t.brakeCylinder = 0; t.speed_mps = 0; t.reverser = 1; });
    const hornNow = () => sim(() => ({ low: window.__sim.controls.hornLow, high: window.__sim.controls.hornHigh, roll: window.__sim.cab.parts.hornLever.rotation.z, pitch: window.__sim.cab.parts.hornLever.rotation.x }));
    await press(14); await frames(8); let horn = await hornNow();
    check("D-pad left: the LOW horn note only, and the horn lever moves left", horn.low && !horn.high && horn.roll > 0.3, JSON.stringify(horn));
    await release(14);
    await press(15); await frames(8); horn = await hornNow();
    check("D-pad right: the HIGH horn note only, and the horn lever moves right", !horn.low && horn.high && horn.roll < -0.3, JSON.stringify(horn));
    await release(15);
    await press(0); await frames(8); horn = await hornNow();
    check("A: both notes (two-tone), and the horn lever is pulled toward the driver", horn.low && horn.high && horn.pitch > 0.3, JSON.stringify(horn));
    await release(0); await frames(10); horn = await hornNow();
    check("let go of the horn: the lever springs back to the middle", Math.abs(horn.roll) < 0.06 && Math.abs(horn.pitch) < 0.06, JSON.stringify(horn));
    const audioReady = await sim(() => window.__sim.audio.available);
    check("the sound engine starts", audioReady === true);
    const both = await page.evaluate(() => window.__sim.auditHorn({ low: true, high: true }));
    const lowOnly = await page.evaluate(() => window.__sim.auditHorn({ low: true, high: false }));
    check("horn loudness (two-tone): audible, not clipping", both.peak > 0.15 && both.peak < 0.9 && both.rms > 0.03, `peak ${both.peak.toFixed(2)}, rms ${both.rms.toFixed(3)}`);
    check("horn loudness (one note): audible, not clipping", lowOnly.peak > 0.05 && lowOnly.peak < 0.9, `peak ${lowOnly.peak.toFixed(2)}, rms ${lowOnly.rms.toFixed(3)}`);

    // ---- The two big handles swing back toward the driver in a curve ----
    const arm = (t, b) => sim((t, b) => { const tr = window.__sim.train; tr.throttle = t; tr.brakeHandle = b; tr.brakeCylinder = b; }, t, b).then(() => frames(4)).then(() => sim(() => ({ brake: window.__sim.cab.parts.brakeHandle.rotation.y, power: window.__sim.cab.parts.powerHandle.rotation.y })));
    const arm0 = await arm(0, 0), arm5 = await arm(0.5, 0.5), arm10 = await arm(1, 1);
    check("brake handle swings back and round as it is applied (0, 50%, 100%)", arm0.brake < arm5.brake && arm5.brake < arm10.brake && arm10.brake > 2.2, `${(arm0.brake * 57.3).toFixed(0)}, ${(arm5.brake * 57.3).toFixed(0)}, ${(arm10.brake * 57.3).toFixed(0)} degrees`);
    check("power handle swings back and round the other way (0, 50%, 100%)", arm0.power > arm5.power && arm5.power > arm10.power && arm10.power < -2.0, `${(arm0.power * 57.3).toFixed(0)}, ${(arm5.power * 57.3).toFixed(0)}, ${(arm10.power * 57.3).toFixed(0)} degrees`);
    await sim(() => { const tr = window.__sim.train; tr.throttle = 0; tr.brakeHandle = 0; tr.brakeCylinder = 0; });

    // ---- Headlights light the track: off, dipped, full ----
    const beam = async () => { await frames(8); return sim(() => window.__sim.cab.parts.headlamp.intensity); };
    const beamOff = await beam();
    await tap(2); const beamDipped = await beam();
    await tap(2); const beamFull = await beam();
    await tap(2); const beamOff2 = await beam();
    check("X: the beam is off, then dipped, then brighter on full, then off again", beamOff === 0 && beamDipped > 100 && beamFull > beamDipped * 1.5 && beamOff2 < 1, `${beamOff.toFixed(0)}, ${beamDipped.toFixed(0)}, ${beamFull.toFixed(0)}, ${beamOff2.toFixed(0)}`);

    // ---- Curves lean the cab, hills tip it, and straights are level ----
    const tilt = async (miles) => { await sim((m) => window.__sim.teleport(m * 1609.344), miles); await frames(4); return sim(() => ({ roll: window.__sim.camera.parent.rotation.z, pitch: window.__sim.camera.parent.rotation.x })); };
    const onCurve = await tilt(0.85), onStraight = await tilt(1.3), onHill = await tilt(3.75);
    check("in a right-hand bend the cab leans to the right", onCurve.roll < -0.015, `roll ${(onCurve.roll * 57.3).toFixed(1)} degrees`);
    check("on the straight the cab is level", Math.abs(onStraight.roll) < 0.004, `roll ${(onStraight.roll * 57.3).toFixed(2)} degrees`);
    check("on the 1-in-140 climb the cab tips up (barely: about 0.4 degrees)", onHill.pitch > 0.004 && onHill.pitch < 0.012, `pitch ${(onHill.pitch * 57.3).toFixed(2)} degrees`);

    // ---- 4. Screenshots along the route, and the budget ----
    await sim(() => { const t = window.__sim.train; t.throttle = 0; t.brakeHandle = 0; t.brakeCylinder = 0; t.reverser = 1; t.direction = 1; t.speed_mps = 0; });
    const budget = [];
    const stops = { start: 0.05, curve: 0.9, wood: 1.6, overbridge: 2.26, moor: 3.8, embankment: 5.5, viaduct: 5.95, wood2: 8.9, moor2: 10.5, viaduct2: 12.35, end: 13.5 };
    for (const [name, miles] of Object.entries(stops)) {
      const d = miles * 1609.344;
      await sim((d) => window.__sim.teleport(d), d);
      await frames(6);
      await sleep(500);
      const st = await stats();
      budget.push({ d, ...st });
      console.log(`     ${name} (mile ${miles}): ${st.calls} draw calls, ${st.triangles} triangles, ${st.chunks} chunks, ${st.geometries} geometries`);
      if (["curve", "overbridge", "moor", "viaduct", "wood2"].includes(name)) await shot(`10-${name}`);
    }
    const maxCalls = Math.max(...budget.map((b) => b.calls)), maxTris = Math.max(...budget.map((b) => b.triangles));
    check("budget: draw calls under 200", maxCalls < 200, `max ${maxCalls}`);
    check("budget: triangles under 250,000", maxTris < 250000, `max ${maxTris}`);

    // Needles and levers really move: compare the desk area with and without speed and power.
    await sim(() => window.__sim.teleport(300));
    await sim(() => { const t = window.__sim.train; t.throttle = 0; t.brakeHandle = 0; t.speed_mps = 0; });
    await page.evaluate(() => { window.__pad.pad.axes[1] = 1; }); await sleep(2500); // look down at the desk
    await frames(4); await shot("11-desk-at-rest");
    await sim(() => { const t = window.__sim.train; t.throttle = 0.9; t.brakeHandle = 0.5; t.brakeCylinder = 0.5; t.speed_mps = 30; });
    await frames(3); await shot("12-desk-moving");
    await page.evaluate(() => { window.__pad.pad.axes[1] = 0; });

    // ---- 5. Streaming ----
    await sim(() => { const t = window.__sim.train; t.throttle = 0; t.brakeHandle = 0; t.brakeCylinder = 0; t.speed_mps = 0; window.__sim.teleport(0); });
    await frames(5);
    const base = await stats();
    let maxGeometries = base.geometries, minChunks = 99, maxChunks = 0;
    const routeLength = await sim(() => window.__sim.route.length_m);
    for (let d = 0; d <= routeLength; d += 100) {
      await sim((d) => window.__sim.teleport(d), d);
      await frames(2);
      const st = await stats();
      maxGeometries = Math.max(maxGeometries, st.geometries);
      minChunks = Math.min(minChunks, st.chunks); maxChunks = Math.max(maxChunks, st.chunks);
    }
    const end = await stats();
    check("streaming: geometries do not grow over a long run", maxGeometries <= base.geometries + 14, `start ${base.geometries}, max ${maxGeometries}, end ${end.geometries}`);
    check("streaming: only a few chunks exist at once", maxChunks <= 13, `chunks between ${minChunks} and ${maxChunks}`);
    const slowest = await sim(() => window.__sim.world.slowestBuild_ms);
    check("streaming: no single chunk takes long to build", slowest < 300, `slowest ${slowest.toFixed(0)} ms (a desktop CPU; the Pi will be slower)`);
    await sim(() => window.__sim.teleport(200));
    await frames(4);
  }

  if (!smoke) {
    // ---- The end of the line ----
    await page.evaluate(() => { document.querySelector(".hud").style.display = ""; });
    await sim(() => { const t = window.__sim.train; t.reverser = 1; t.direction = 1; t.throttle = 0; t.brakeHandle = 0; t.brakeCylinder = 0; t.speed_mps = 25; window.__sim.teleport(window.__sim.route.length_m - 150); });
    await page.waitForFunction(() => window.__sim.screen === "finished", { timeout: 60000, polling: 100 });
    const routeEnd = await sim(() => window.__sim.route.length_m);
    s = await state();
    check("buffer stop: the train is stopped just before the end of the line", s.speed === 0 && s.distance > routeEnd - 12 && s.distance < routeEnd, `distance ${s.distance.toFixed(0)} m of ${routeEnd.toFixed(0)}`);
    await sleep(800);
    check("the end-of-line screen is showing", /End of the line/.test(await overlayText()));
    await shot("14-end-of-line");
    await tap(0);
    await sleep(600);
    s = await state();
    check("A drives again: back at the start, on the drive screen", s.screen === "drive" && s.distance < 50, `distance ${s.distance.toFixed(1)} m`);
  }

  // ---- 7. No errors ----
  check("no page errors, console errors or failed requests", problems.length === 0, problems.length ? "\n        " + problems.join("\n        ") : "");
  // ---- Adaptive resolution: with slow frames (software drawing) the picture must shrink ----
  if (!smoke) {
    const page2 = await browser.newPage();
    await page2.setViewport({ width: 640, height: 360 });
    page2.on("pageerror", (e) => problems.push("pageerror (adaptive page): " + e.message));
    await page2.goto(url, { waitUntil: "networkidle0" });
    await page2.waitForFunction(() => window.__sim.adaptive.scale < 0.95, { timeout: 120000, polling: 500 });
    const size = await page2.evaluate(() => ({ scale: window.__sim.adaptive.scale, w: window.__sim.renderer.domElement.width, h: window.__sim.renderer.domElement.height }));
    check("adaptive resolution: slow frames make the picture smaller", size.scale < 0.95 && size.h < 720, `scale ${size.scale.toFixed(2)}, canvas ${size.w}x${size.h}`);
    await page2.close();
  }

  // ---- Night: the same game with ?time=night, and the headlights on ----
  if (!smoke) {
    const page3 = await browser.newPage();
    await page3.setViewport({ width: 640, height: 360 });
    page3.on("pageerror", (e) => problems.push("pageerror (night page): " + e.message));
    page3.on("console", (m) => { if (m.type() === "error") problems.push("console.error (night page): " + m.text()); });
    await page3.goto(url + "?fixed&time=night", { waitUntil: "networkidle0" });
    await page3.evaluate(() => { const s = window.__sim; s.start(); s.teleport(2000); s.setReverser(1); s.setHeadlights(2); });
    await sleep(3500);
    await page3.screenshot({ path: `${outDir}/15-night-headlights.png` });
    console.log(`     screenshot ${outDir}/15-night-headlights.png`);
    await page3.close();
  }

  await browser.close();
  console.log(failures === 0 ? "\nAll browser checks passed." : `\n${failures} browser check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
