import { defineConfig } from "vite";
import { entityEditorServer } from "./tools/entity-editor/server";

// Minimal Vite config. We keep the pixel-art rendering crisp by leaving
// image optimization defaults alone for now; revisit when we add real assets.
export default defineConfig({
  plugins: [entityEditorServer()],
  server: {
    open: true,
  },
  build: {
    // Vite empties its outDir on every build, so the game gets a subdirectory of
    // its own: `dist/` is everything that leaves the repo, and `dist/assets/`
    // holds the packs `npm run pack` writes. Point this back at `dist` and the
    // next build deletes them.
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
