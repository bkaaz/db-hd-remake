import { defineConfig } from "vite";
import { entityEditorServer } from "./tools/entity-editor/plugin";

// Minimal Vite config. We keep the pixel-art rendering crisp by leaving
// image optimization defaults alone for now; revisit when we add real assets.
export default defineConfig({
  plugins: [entityEditorServer()],
  server: {
    open: true,
  },
  build: {
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
