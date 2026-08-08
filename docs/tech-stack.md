# Tech stack

## Choices

| Area            | Choice        | Notes |
|-----------------|---------------|-------|
| Language        | TypeScript    | Strict mode. |
| Rendering       | PixiJS v8     | WebGL 2D renderer; **game runtime only**. |
| Editor          | Canvas 2D     | `tools/entity-editor/` is plain Canvas 2D + TS — drawing overlays on an image is native Canvas work. |
| Build / dev     | Vite          | Fast dev server + bundler; a dev-only plugin serves the editor's `/api/*`. |
| Package manager | npm           | Default. |
| Art             | Ripped HD sprites | Real sprite sheets supplied by the owner under BYOA (see [`assets.md`](./assets.md)); no placeholders anymore. |
| Tests           | Vitest (planned) | For PixiJS-free logic, in Node. Agreed to land at phase E, not before. |

## Why PixiJS (not Phaser / raw Canvas)

Chosen for a balance of control and productivity: Pixi gives a fast, efficient
sprite renderer while we keep full control over game-specific logic (input,
frame data, collision, state machines) — which for a fighting game we want to
own ourselves rather than fit into a general framework's conventions.

## Rendering notes

- `antialias: false`, `scaleMode: "nearest"` and CSS `image-rendering: pixelated`
  — this is a pixel-art game, so we keep edges hard.
- Sprites are drawn at a fixed `SCALE` (currently 3) against a window-sized
  canvas.
- Internal resolution / scaling strategy: **(TBD)** — likely a fixed logical
  resolution scaled to fit the window; see **Q7** in
  [`open-questions.md`](./open-questions.md). Until then an entity's world
  position is in screen px, while authored data (boxes, velocities) is in sprite
  px, so the data survives that change.

## Things intentionally deferred

- Audio engine
- Input mapping / gamepad support (keyboard only for now)
- Netcode / multiplayer (may be out of scope entirely — TBD)
- Tight atlas repacking (the atlas is the whole keyed sheet for now)
