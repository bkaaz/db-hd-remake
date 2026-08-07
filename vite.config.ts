import { defineConfig } from "vite";
import { actorEditorServer } from "./tools/actor-editor/plugin";

// Minimal Vite config. We keep the pixel-art rendering crisp by leaving
// image optimization defaults alone for now; revisit when we add real assets.
export default defineConfig({
  plugins: [actorEditorServer()],
  server: {
    open: true,
  },
  build: {
    rollupOptions: {
      input: {
        // The game itself.
        game: "index.html",
        // The actor editor tool (see docs/actor-editor.md).
        actorEditor: "tools/actor-editor/index.html",
      },
    },
  },
});
