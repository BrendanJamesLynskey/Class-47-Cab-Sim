// hud.js — the small information display at the top of the screen, and the big
// message screens (start, paused, end of line). It is ordinary web page text
// laid over the 3D picture. The look of it is in the <style> part of index.html.

const el = (tag, className, parent) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (parent) parent.appendChild(e);
  return e;
};

export function createHud() {
  const root = el("div", "hud", document.body);

  // ---- The top bar ----
  const speedBox = el("div", "hud-speed", root);
  const speedNumber = el("span", "hud-speed-number", speedBox);
  el("span", "hud-unit", speedBox).textContent = " mph";
  const limitSign = el("div", "hud-limit", root);

  const levers = el("div", "hud-levers", root);
  const powerRow = el("div", "hud-row", levers);
  el("span", "hud-label", powerRow).textContent = "POWER";
  const powerBar = el("span", "hud-bar", powerRow);
  const powerFill = el("span", "hud-fill hud-fill-power", powerBar);
  const powerText = el("span", "hud-percent", powerRow);
  const brakeRow = el("div", "hud-row", levers);
  el("span", "hud-label", brakeRow).textContent = "BRAKE";
  const brakeBar = el("span", "hud-bar", brakeRow);
  const brakeFill = el("span", "hud-fill hud-fill-brake", brakeBar);
  const brakeText = el("span", "hud-percent", brakeRow);

  const reverserText = el("div", "hud-reverser", root);
  const progressText = el("div", "hud-progress", root);
  const hintText = el("div", "hud-hint", root);
  const statusText = el("div", "hud-status", root);

  const soundHint = el("div", "sound-hint", document.body);
  soundHint.textContent = "Sound off: press any key";
  soundHint.style.display = "none";

  // ---- The big message screen ----
  const overlay = el("div", "overlay", document.body);
  const card = el("div", "overlay-card", overlay);

  let enabledByDriver = true;
  let hiddenBehindOverlay = false;
  const refresh = () => { root.style.display = enabledByDriver && !hiddenBehindOverlay ? "" : "none"; };

  // Only touch the page when the words change: it is much cheaper.
  const last = new Map();
  const setText = (element, text) => {
    if (last.get(element) !== text) { last.set(element, text); element.textContent = text; }
  };
  const setClass = (element, name, on) => element.classList.toggle(name, on);

  return {
    // The driver can hide the display with T; it is also hidden behind the start screen.
    setEnabled(enabled) { enabledByDriver = enabled; refresh(); },
    toggle() { enabledByDriver = !enabledByDriver; refresh(); },
    setBehindOverlay(hidden) { hiddenBehindOverlay = hidden; refresh(); },
    // Browsers keep sound off until a key is pressed: tell the player how to turn it on.
    setSoundHint(visible) { soundHint.style.display = visible ? "block" : "none"; },

    // view = { speed_mph, limit_mph, speeding, throttle, brakeHandle, reverser, distance_miles, length_miles, hint, status }
    update(view) {
      setText(speedNumber, String(Math.round(view.speed_mph)));
      setText(limitSign, String(view.limit_mph));
      setClass(limitSign, "flash", view.speeding);
      powerFill.style.width = `${Math.round(view.throttle * 100)}%`;
      brakeFill.style.width = `${Math.round(view.brakeHandle * 100)}%`;
      setText(powerText, `${Math.round(view.throttle * 100)}%`);
      setText(brakeText, `${Math.round(view.brakeHandle * 100)}%`);
      setText(reverserText, `Reverser: ${["Reverse", "Neutral", "Forward"][view.reverser + 1]}`);
      setClass(reverserText, "warn", view.reverser === 0);
      setText(progressText, `${view.distance_miles.toFixed(2)} of ${view.length_miles.toFixed(1)} miles`);
      setText(hintText, view.hint || "");
      setText(statusText, view.status || "");
    },

    // Show a message card over the picture, or pass null to hide it.
    // screen = { title, lines: [text], prompt, padMessage, padClass }
    showOverlay(screen) {
      if (!screen) { overlay.style.display = "none"; last.delete(card); return; }
      const key = JSON.stringify(screen);
      overlay.style.display = "flex";
      if (last.get(card) === key) return;
      last.set(card, key);
      card.replaceChildren();
      el("h1", "", card).textContent = screen.title;
      for (const line of screen.lines || []) el("p", "", card).textContent = line;
      if (screen.padMessage) el("p", `pad ${screen.padClass || ""}`, card).textContent = screen.padMessage;
      if (screen.prompt) el("p", "prompt", card).textContent = screen.prompt;
    },
  };
}
