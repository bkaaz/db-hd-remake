import { defineConfig } from "vite";

// Minimal Vite config. We keep the pixel-art rendering crisp by leaving
// image optimization defaults alone for now; revisit when we add real assets.
export default defineConfig({
  server: {
    open: true,
  },
});
