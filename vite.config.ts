import { defineConfig } from "vite";
import { entityEditorServer } from "./tools/entity-editor/server";

// Minimal Vite config. We keep the pixel-art rendering crisp by leaving
// image optimization defaults alone for now; revisit when we add real assets.
export default defineConfig({
  plugins: [entityEditorServer()],
  server: {
    open: true,
  },
  // relative, so dist/web plays from wherever it is hosted, a subpath included
  base: "./",
  build: {
    // Vite empties its outDir on every build: the game's is a subdirectory of
    // `dist/`, which is everything that leaves the repo.
    outDir: "dist/web",
    rollupOptions: {
      input: {
        // The game itself.
        game: "index.html",
        // The entity editor tool (see docs/entity-editor.md).
        entityEditor: "tools/entity-editor/index.html",
      },
    },
  },
});
