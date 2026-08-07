# Data format — character files (v0)

The format the sprite editor **exports** and the game **loads**. One file per
character. This is the contract that ties the tool to the engine.

Accepted 2026-08-07.

## Model

```
character = atlas image + frames (rects + anchors) + animations (timed frame
            sequences) + boxes (hit / hurt / push, per animation step)
```

## Accepted design decisions

1. **Timing in game frames (60 FPS), not milliseconds.** Frame data is integer
   and deterministic — the fighting-game standard.
2. **Three box types to start: `hit` (deals damage), `hurt` (can be hit),
   `push` (body collision).** Throws/other types added later.
3. **Coordinates relative to the frame's anchor, Y-down (matches PixiJS).**
   Facing left/right is just a sign flip on X — no geometry recompute.

## Example

```jsonc
// goku.character.json
{
  "name": "goku",
  "atlas": "goku.png",              // packed atlas of frames
  "frames": {
    // anchor = pivot point in px (e.g. between the feet),
    // measured from the frame's top-left corner
    "idle_0": { "x": 2,  "y": 2, "w": 64, "h": 96, "anchor": [32, 94] },
    "walk_0": { "x": 68, "y": 2, "w": 66, "h": 96, "anchor": [33, 94] }
  },
  "animations": {
    "idle": {
      "loop": true,
      // dur = number of game frames at 60 FPS (NOT milliseconds)
      "steps": [
        { "frame": "idle_0", "dur": 6 },
        { "frame": "idle_1", "dur": 6 }
      ]
    },
    "punch": {
      "loop": false,
      "steps": [
        {
          "frame": "punch_0", "dur": 3,
          // boxes in px RELATIVE TO the anchor; flipping facing = negate X
          "boxes": [
            { "type": "hurt", "x": -20, "y": -90, "w": 40, "h": 90 },
            { "type": "push", "x": -16, "y": -88, "w": 32, "h": 88 }
          ]
        },
        {
          "frame": "punch_1", "dur": 4,
          "boxes": [
            { "type": "hit",  "x": 20,  "y": -70, "w": 34, "h": 20 },
            { "type": "hurt", "x": -20, "y": -90, "w": 40, "h": 90 }
          ]
        }
      ]
    }
  }
}
```

## Field reference

- **`name`** — character id.
- **`atlas`** — path to the packed sprite atlas PNG.
- **`frames`** — map of frame id → rect in the atlas plus `anchor`.
  - `x, y, w, h` — frame rectangle in atlas pixels.
  - `anchor` — `[x, y]` pivot in px from the frame's top-left corner.
- **`animations`** — map of animation id → `{ loop, steps }`.
  - `loop` — whether playback repeats.
  - `steps[]` — ordered frames:
    - `frame` — frame id (must exist in `frames`).
    - `dur` — duration in game frames (60 FPS).
    - `boxes[]` (optional) — collision boxes active on this step:
      - `type` — `hit` | `hurt` | `push`.
      - `x, y, w, h` — rectangle in px, relative to the frame's anchor, Y-down.

## Notes / open for later

- Versioning: add a top-level `"version"` when the schema first changes.
- Not yet included (future): throw boxes, per-box damage/hitstun/knockback,
  sound triggers per step, per-frame movement (velocity), hit properties. These
  attach naturally to a `step` or a `box` when we get to combat mechanics.
