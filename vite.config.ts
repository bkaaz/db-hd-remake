import { defineConfig } from "vite";
import { spriteEditorServer } from "./tools/sprite-editor/plugin";

// Minimal Vite config. We keep the pixel-art rendering crisp by leaving
// image optimization defaults alone for now; revisit when we add real assets.
export default defineConfig({
  plugins: [spriteEditorServer()],
  server: {
    open: true,
  },
  build: {
    rollupOptions: {
      input: {
        // The game itself.
        game: "index.html",
        // The asset pipeline tool (see docs/tooling.md).
        spriteEditor: "tools/sprite-editor/index.html",
      },
    },
  },
});
