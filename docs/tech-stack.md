# Tech stack

## Choices

| Area            | Choice        | Notes |
|-----------------|---------------|-------|
| Language        | TypeScript    | Strict mode. |
| Rendering       | PixiJS v8     | WebGL 2D renderer; well suited to sprite-based fighters. |
| Build / dev     | Vite          | Fast dev server + bundler. |
| Package manager | npm           | Default. |
| Art             | Placeholders  | Simple shapes for now; real art decided later. |

## Why PixiJS (not Phaser / raw Canvas)

Chosen for a balance of control and productivity: Pixi gives a fast, efficient
sprite renderer while we keep full control over game-specific logic (input,
frame data, collision, state machines) — which for a fighting game we want to
own ourselves rather than fit into a general framework's conventions.

## Rendering notes

- `antialias: false` and CSS `image-rendering: pixelated` — this is a pixel-art
  game, so we keep edges hard.
- Internal resolution / scaling strategy: **(TBD)** — likely a fixed logical
  resolution scaled to fit the window. Decide when we start on real rendering.

## Things intentionally deferred

- Audio engine
- Asset pipeline (sprite atlases, animation format)
- Input mapping / gamepad support
- Netcode / multiplayer (may be out of scope entirely — TBD)
