// main.js — starts the game.
// (Milestone 0: just an empty scene that clears to sky blue, to prove the whole
// pipeline works. The cab and the railway arrive in the next milestone.)

import * as THREE from "three";
import { RENDER_WIDTH, RENDER_HEIGHT, CAMERA_FOV_DEG, SKY_COLOR } from "./config.js";

const canvas = document.getElementById("game");

// antialias is off on purpose: the Raspberry Pi has to work hard enough already.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(1);
renderer.setSize(RENDER_WIDTH, RENDER_HEIGHT, false); // false = leave the CSS size alone, the page stretches it

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY_COLOR);

const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, RENDER_WIDTH / RENDER_HEIGHT, 0.05, 2000);

function frame() {
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();

// Only in "npm run dev": lets the tests look inside the game.
if (import.meta.env.DEV) {
  window.__sim = { renderer, scene, camera };
}
