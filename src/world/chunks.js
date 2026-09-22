// chunks.js — builds the world in pieces ("chunks") 100 m long, just ahead of the
// train, and throws away the pieces behind it. We never build the whole route at once:
// that would take a long time and use a lot of memory.

import * as THREE from "three";
import * as C from "../config.js";
import { MeshBuilder } from "./mesh-builder.js";
import { createTerrain } from "./terrain.js";
import { addTrack } from "./track.js";
import { addFurniture } from "./furniture.js";
import { addNature } from "./nature.js";
import { addBridges } from "./bridges.js";
import { addCrossings } from "./crossings.js";
import { addStations } from "./stations.js";
import { addVillage } from "./village.js";
import { addTown } from "./town.js";
import { createEnvironment } from "./environment.js";

export function createWorld(scene, path, route, quality) {
  const ctx = { path, route, quality, seed: C.WORLD_SEED };
  const env = createEnvironment(route, path.totalLength_m);
  const terrain = createTerrain({ path, seed: C.WORLD_SEED, env, route });

  // One shared material: it colours every triangle by its own vertex colours.
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const chunks = new Map(); // chunk number -> { mesh, triangles, extras }
  let slowestBuild_ms = 0;  // how long the slowest chunk took to build (shown in the tests)
  const lastChunk = Math.floor(path.totalLength_m / C.CHUNK_LENGTH_M);

  // Building a chunk is slow, so it is done in small steps (terrain, then track, then
  // fences and bridges, then trees and animals), one step per frame. That way the game
  // never freezes for a moment while it builds the world ahead.
  const STEPS = [
    (builder, d0, d1) => terrain.addTerrain(builder, d0, d1),
    (builder, d0, d1) => addTrack(builder, ctx, d0, d1),
    // (`extras` collects the few signs that have writing on them: they are separate meshes.)
    (builder, d0, d1, extras) => {
      addFurniture(builder, ctx, terrain, d0, d1);
      addBridges(builder, ctx, terrain, d0, d1);
      addCrossings(builder, ctx, terrain, d0, d1);
      addStations(builder, ctx, terrain, d0, d1, extras);
      addVillage(builder, ctx, terrain, d0, d1);
      addTown(builder, ctx, terrain, d0, d1);
    },
    (builder, d0, d1) => addNature(builder, ctx, terrain, d0, d1),
  ];
  let job = null; // the chunk being built: { index, builder, extras, step }

  function timed(work) {
    const started = performance.now();
    work();
    slowestBuild_ms = Math.max(slowestBuild_ms, performance.now() - started);
  }

  function finishJob() {
    const geometry = job.builder.build();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.matrixAutoUpdate = false; // it never moves, so don't waste time re-working out where it is
    scene.add(mesh);
    for (const extra of job.extras) scene.add(extra);
    chunks.set(job.index, { mesh, extras: job.extras, triangles: job.builder.triangleCount });
    job = null;
  }

  // Does one step of the building work. Returns false if there is nothing left to build.
  function doOneStep(first, last) {
    if (job && (job.index < first || job.index > last)) job = null; // the train moved on: give up on it
    if (!job) {
      let index = first;
      while (index <= last && chunks.has(index)) index++;
      if (index > last) return false;
      job = { index, builder: new MeshBuilder(), extras: [], step: 0 };
    }
    const d0 = job.index * C.CHUNK_LENGTH_M, d1 = d0 + C.CHUNK_LENGTH_M;
    timed(() => {
      STEPS[job.step](job.builder, d0, d1, job.extras);
      job.step++;
      if (job.step === STEPS.length) finishJob();
    });
    return true;
  }

  function dropChunk(index) {
    const chunk = chunks.get(index);
    scene.remove(chunk.mesh);
    chunk.mesh.geometry.dispose(); // give the graphics memory back
    for (const extra of chunk.extras) { scene.remove(extra); extra.geometry.dispose(); }
    chunks.delete(index);
  }

  // Builds what's missing ahead of the train (a little each frame) and frees what is behind.
  function update(distance_m, maxSteps = C.MAX_BUILD_STEPS_PER_FRAME) {
    const current = Math.floor(distance_m / C.CHUNK_LENGTH_M);
    const first = Math.max(0, current - C.CHUNKS_BEHIND);
    const last = Math.min(lastChunk, current + quality.viewChunks);

    for (const index of [...chunks.keys()]) {
      if (index < first || index > last) dropChunk(index);
    }
    for (let steps = 0; steps < maxSteps; steps++) {
      if (!doOneStep(first, last)) break;
    }
  }

  // Builds everything around a spot at once (used at the start and after a jump).
  function prime(distance_m) {
    update(distance_m, Infinity);
  }

  function dispose() {
    for (const index of [...chunks.keys()]) dropChunk(index);
    material.dispose();
  }

  return {
    update, prime, dispose, terrain,
    get chunkCount() { return chunks.size; },
    get slowestBuild_ms() { return slowestBuild_ms; },
    get triangleCount() { let t = 0; for (const c of chunks.values()) t += c.triangles; return t; },
  };
}
