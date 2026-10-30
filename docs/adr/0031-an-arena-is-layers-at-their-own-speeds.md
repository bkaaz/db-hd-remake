# 0031 — An arena is layers, each scrolling at its own speed

**Status:** accepted 2026-10-30 · builds on 0029, 0030

An arena on screen is a few pictures as large as the world, back to front,
each scrolled sideways as `camera x × speed + offset` and vertically with
the camera and the shake (`data/arenas/<name>/arena.json`,
`src/arena/arenaFile.ts`). The export cuts the original's two BG layers
where they scroll apart and stacks the rest by tile priority
(`src/rom/arena.ts`); the tournament is a half-speed sky and a court. The
debug scene's grid is a backdrop like any arena and stays the default;
`?arena=<name>&time=<lighting>` replaces it — a scene parameter (0008).
The fighters are drawn in front of every layer.

**Rejected:**

- **The original's scroll per block of scanlines** — three blocks per
  layer, their values set every frame. Its top block lies under the
  original's HUD; cut at world rows, two pictures say what is seen.
- **One picture per arena, scrolled as one.** The tournament's sky moves at
  half speed, and a picture cannot.
- **The arena chosen in a debug mode** (`data/debug.json`). A mode is a
  situation to replay; which arena it plays on is independent of it, and
  the address bar already says which scene is running.
