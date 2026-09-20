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

export function createWorld(scene, path, route, quality) {
  const ctx = { path, route, quality, seed: C.WORLD_SEED };
  const terrain = createTerrain({ path, seed: C.WORLD_SEED });

  // One shared material: it colours every triangle by its own vertex colours.
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const chunks = new Map(); // chunk number -> { mesh, triangles }
  const lastChunk = Math.floor(path.totalLength_m / C.CHUNK_LENGTH_M);

  function buildChunk(index) {
    const d0 = index * C.CHUNK_LENGTH_M;
    const d1 = d0 + C.CHUNK_LENGTH_M;
    const builder = new MeshBuilder();
    terrain.addTerrain(builder, d0, d1);
    addTrack(builder, ctx, d0, d1);
    addFurniture(builder, ctx, d0, d1);
    addNature(builder, ctx, terrain, d0, d1);
    const geometry = builder.build();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.matrixAutoUpdate = false; // it never moves, so don't waste time re-working out where it is
    scene.add(mesh);
    chunks.set(index, { mesh, triangles: builder.triangleCount });
  }

  function dropChunk(index) {
    const chunk = chunks.get(index);
    scene.remove(chunk.mesh);
    chunk.mesh.geometry.dispose(); // give the graphics memory back
    chunks.delete(index);
  }

  // Builds what's missing ahead of the train (a few per frame) and frees what is behind.
  // Returns true if it is still catching up.
  function update(distance_m, maxBuilds = C.MAX_CHUNK_BUILDS_PER_FRAME) {
    const current = Math.floor(distance_m / C.CHUNK_LENGTH_M);
    const first = Math.max(0, current - C.CHUNKS_BEHIND);
    const last = Math.min(lastChunk, current + quality.viewChunks);

    for (const index of [...chunks.keys()]) {
      if (index < first || index > last) dropChunk(index);
    }
    let builds = 0;
    for (let index = first; index <= last && builds < maxBuilds; index++) {
      if (!chunks.has(index)) { buildChunk(index); builds++; }
    }
    return builds >= maxBuilds;
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
    get triangleCount() { let t = 0; for (const c of chunks.values()) t += c.triangles; return t; },
  };
}
