// debug.js — the performance readout (press F1) and, only while you are working on
// the game (npm run dev), a hook so the automatic tests can look inside it.

// Shows or hides a box of numbers about how hard the computer is working.
export function createDebugReadout() {
  const box = document.createElement("pre");
  box.className = "debug";
  box.style.display = "none";
  document.body.appendChild(box);

  window.addEventListener("keydown", (event) => {
    if (event.code === "F1") {
      event.preventDefault(); // F1 normally opens the browser's help
      box.style.display = box.style.display === "none" ? "block" : "none";
    }
  });

  let sinceUpdate = 0;
  return {
    get visible() { return box.style.display !== "none"; },
    show(visible) { box.style.display = visible ? "block" : "none"; },

    // Call every frame. It only redraws the text a few times a second.
    update(seconds, info) {
      sinceUpdate += seconds;
      if (sinceUpdate < 0.25 || box.style.display === "none") return;
      sinceUpdate = 0;
      const fps = info.averageMs > 0 ? 1000 / info.averageMs : 0;
      box.textContent = [
        `${fps.toFixed(0)} fps   ${info.averageMs.toFixed(1)} ms per frame`,
        `draw calls ${info.calls}   triangles ${info.triangles.toLocaleString()}`,
        `picture ${info.width} x ${info.height}  (${Math.round(info.scale * 100)}% of ${info.baseHeight}p)`,
        `chunks ${info.chunks}   geometries ${info.geometries}   textures ${info.textures}`,
        `quality ${info.quality}   distance ${info.distance_m.toFixed(0)} m`,
        info.pad,
      ].join("\n");
    },
  };
}
