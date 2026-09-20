// sky.js — everything far away: the sky, the sun, clouds, the hills on the horizon
// and the light. All of it follows the train around so it never gets closer.

import * as THREE from "three";
import * as C from "../config.js";
import { makeRandom } from "./random.js";

const SKY_RADIUS_M = 2000;
const HILL_RING_SEGMENTS = 72;

// Where the sun LOOKS to be (ahead and to the left, fairly high) ...
const SUN_SPOT_DIRECTION = new THREE.Vector3(-0.5, 0.38, -0.75).normalize();
// ... and which way the light really comes from. It comes from over the driver's
// shoulder so the trees and hedges we look at are lit, not dark and backlit.
const SUN_LIGHT_DIRECTION = new THREE.Vector3(-0.55, 0.65, 0.35).normalize();

// A blurry white blob drawn on a canvas: used for the sun and the clouds.
function softBlobTexture(width, height, blobs) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  for (const [x, y, radius, alpha] of blobs) {
    const gradient = g.createRadialGradient(x * width, y * height, 0, x * width, y * height, radius * width);
    gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gradient;
    g.fillRect(0, 0, width, height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSkyDome() {
  const geometry = new THREE.SphereGeometry(SKY_RADIUS_M, 24, 16);
  const top = new THREE.Color(C.SKY_TOP_COLOR);
  const horizon = new THREE.Color(C.SKY_HORIZON_COLOR);
  const colors = [];
  const positions = geometry.attributes.position;
  const mixed = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const height = Math.max(0, positions.getY(i) / SKY_RADIUS_M); // 0 at the horizon, 1 straight up
    mixed.copy(horizon).lerp(top, Math.pow(height, 0.55));
    colors.push(mixed.r, mixed.g, mixed.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const dome = new THREE.Mesh(geometry, material);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  return dome;
}

// A ring of low hills all the way round the horizon, in soft haze.
function makeHillRing(radius, minHeight, maxHeight, hazeAmount, seed) {
  const random = makeRandom(seed);
  const heights = [];
  const phase = [random() * 6, random() * 6, random() * 6];
  for (let i = 0; i < HILL_RING_SEGMENTS; i++) {
    const a = (i / HILL_RING_SEGMENTS) * Math.PI * 2;
    // Smooth bumps that wrap round exactly, plus a little roughness.
    const bump = 0.5 + 0.28 * Math.sin(a * 3 + phase[0]) + 0.18 * Math.sin(a * 7 + phase[1]) + 0.1 * Math.sin(a * 13 + phase[2]);
    heights.push(minHeight + (maxHeight - minHeight) * Math.min(1, Math.max(0, bump)) + random() * 6);
  }
  const positions = [];
  const colors = [];
  const hill = new THREE.Color(C.HILL_COLOR);
  const haze = new THREE.Color(C.SKY_HORIZON_COLOR);
  const topColor = hill.clone().lerp(haze, hazeAmount);
  const bottomColor = hill.clone().lerp(haze, Math.min(1, hazeAmount + 0.25));
  const corner = (i, top) => {
    const a = (i / HILL_RING_SEGMENTS) * Math.PI * 2;
    positions.push(Math.sin(a) * radius, top ? heights[i % HILL_RING_SEGMENTS] : -200, -Math.cos(a) * radius);
    const c = top ? topColor : bottomColor;
    colors.push(c.r, c.g, c.b);
  };
  for (let i = 0; i < HILL_RING_SEGMENTS; i++) {
    corner(i, false); corner(i + 1, false); corner(i + 1, true);
    corner(i, false); corner(i + 1, true); corner(i, true);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false });
  const ring = new THREE.Mesh(geometry, material);
  ring.renderOrder = -9;
  ring.frustumCulled = false;
  return ring;
}

function makeClouds() {
  const texture = softBlobTexture(256, 128, [
    [0.3, 0.6, 0.22, 0.9], [0.5, 0.5, 0.28, 0.95], [0.7, 0.6, 0.22, 0.9], [0.45, 0.72, 0.2, 0.7], [0.62, 0.35, 0.16, 0.8],
  ]);
  const material = new THREE.SpriteMaterial({ map: texture, fog: false, depthWrite: false, transparent: true, opacity: 0.92 });
  const group = new THREE.Group();
  const random = makeRandom(C.WORLD_SEED + 99);
  for (let i = 0; i < 14; i++) {
    const cloud = new THREE.Sprite(material);
    const angle = random() * Math.PI * 2;
    const distance = 900 + random() * 900;
    cloud.position.set(Math.sin(angle) * distance, 420 + random() * 380, -Math.cos(angle) * distance);
    const width = 500 + random() * 500;
    cloud.scale.set(width, width * 0.4, 1);
    group.add(cloud);
  }
  return group;
}

// Adds the sky, hills, sun, clouds and lights to the scene. Call update() every frame.
export function createSky(scene, quality) {
  const horizon = new THREE.Color(C.SKY_HORIZON_COLOR);
  scene.background = horizon;
  scene.fog = new THREE.Fog(horizon, quality.fogFar_m * 0.25, quality.fogFar_m);

  const dome = makeSkyDome();
  const farHills = makeHillRing(1600, 50, 190, 0.55, 5);
  const nearHills = makeHillRing(1150, 25, 95, 0.35, 11);
  const clouds = makeClouds();

  const sunMaterial = new THREE.SpriteMaterial({
    map: softBlobTexture(128, 128, [[0.5, 0.5, 0.5, 1], [0.5, 0.5, 0.18, 1]]),
    color: C.SUN_COLOR, fog: false, depthWrite: false, transparent: true,
  });
  const sun = new THREE.Sprite(sunMaterial);
  sun.scale.set(420, 420, 1);

  scene.add(dome, farHills, nearHills, clouds, sun);

  // Light: the sky lights everything a little from above, the sun lights it from one side.
  const skyLight = new THREE.HemisphereLight("#cfe3ff", "#a5a48a", 1.5);
  const sunLight = new THREE.DirectionalLight(C.SUN_COLOR, 2.3);
  sunLight.position.copy(SUN_LIGHT_DIRECTION).multiplyScalar(100);
  scene.add(skyLight, sunLight);

  return {
    // cameraPosition: where the driver is. trackY: how high the rails are here.
    update(cameraPosition, trackY) {
      dome.position.copy(cameraPosition);
      farHills.position.set(cameraPosition.x, trackY, cameraPosition.z);
      nearHills.position.set(cameraPosition.x, trackY, cameraPosition.z);
      sun.position.copy(cameraPosition).addScaledVector(SUN_SPOT_DIRECTION, 1700);
      // Clouds move at 97% of our speed, so they slowly drift backwards, far away.
      clouds.position.set(cameraPosition.x * 0.97, 0, cameraPosition.z * 0.97);
    },
  };
}
