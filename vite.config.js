import { defineConfig } from "vite";

export default defineConfig({
  // "./" makes the built site work from any folder, including GitHub Pages.
  base: "./",
  build: {
    // Three.js on its own is about 500 kB, so don't warn about it.
    chunkSizeWarningLimit: 800,
  },
  server: {
    port: 5173,
    strictPort: true, // if 5173 is busy, say so instead of quietly using another port
  },
});
