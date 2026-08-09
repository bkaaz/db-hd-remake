# Data format — entity files (v0)

The format the entity editor **exports** and the game **loads** — the contract
that ties the tool to the engine.

**On-disk layout (updated 2026-08-08):** an entity is a *directory of section
files*, not one blob: `data/entities/<name>/frames.json`, `animations.json`
(later `states.json`, etc.). The dev-server plugin assembles them into the single
object below for `GET /api/entity`; the editor saves one section at a time via
`POST /api/section`. The assembled shape (below) is unchanged.

Accepted 2026-08-07 · split into sections 2026-08-08.

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
// goku.entity.json
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

## States (v0, added 2026-08-08)

Section file `states.json`. A state binds an **animation + velocity + transition
rules**; the entity is a state machine and the engine runs it every game frame.

```jsonc
// data/entities/goku/states.json
{
  "initial": "idle",
  "states": {
    "idle": {
      "anim": "idle",
      "vel": [0, 0],
      "turn": true,
      "transitions": [
        { "when": "held:fwd",  "to": "walk_fwd" },
        { "when": "held:back", "to": "walk_back" }
      ]
    },
    "walk_fwd": {
      "anim": "walk",
      "vel": [0.83, 0],
      "turn": true,
      "transitions": [ { "when": "!held:fwd", "to": "idle" } ]
    }
  }
}
```

- **`initial`** — state entered on spawn.
- **`onGotHit`** *(optional, top level)* — the state the engine **forces** on
  this entity when an opponent's hit box reaches one of its hurt boxes, whatever
  it was doing at the time. One field instead of every state remembering to
  handle being hit (MUGEN's GetHit state does the same). The engine also treats
  it as an entry point, so it is never reported "unreachable".
- **`anim`** — animation played while in the state (restarts on entry).
- **`vel`** — `[x, y]` per game frame, in **sprite pixels** — the same unit as
  box coordinates, so display scale never changes what the data means (the
  engine multiplies by the render scale). **X is facing-relative** (+ = forward).
  **Y is reserved** and ignored until gravity exists.
  > Caveat: an entity's world position is still kept in *screen* px. Moving the
  > whole world to a fixed logical resolution is open question **Q7**; when it
  > lands, authored `vel` values keep their meaning — only the engine changes.
- **`turn`** — may the entity turn to face its opponent while in this state?
  Facing is engine-owned (`sign(opponentX − selfX)`), so attacks set `turn:false`
  and cannot spin around mid-swing.
- **`transitions[]`** — evaluated **in order, first match wins**, and **at most
  one fires per frame** (predictable, no state loops).
  - `when` — trigger, optionally negated with a leading `!`. v0 vocabulary:
    - `held:fwd` / `held:back` — movement input, facing-relative.
    - `pressed:attack` — attack button went down **this frame** (an edge, so
      holding the key does not repeat the move).
    - `animEnd` — a non-looping animation reached its last frame (latched until
      the animation changes).
  - `to` — target state.

**Attacks and hitstun.** An attack is an ordinary state: a non-looping animation
with `hit` boxes on its active steps, `turn: false` so it cannot spin mid-swing,
and `{ "when": "animEnd", "to": "idle" }` to recover. A hit connects when an
attacker's `hit` box overlaps a defender's `hurt` box; it lands **once per entry
into the state**, however many frames the box stays out. There is no `hitstun`
field yet — the reaction lasts as long as the `onGotHit` state's non-looping
animation, which is authored in the editor anyway. Damage and health wait for
`attributes.json`.

Deliberately **not** in v0 (later slices): `onEnter` effects, `hit` data
(damage/hitstun/knockback), the scripting escape hatch, jump/gravity.

**This file is hand-authored** (the editor's States tab is a read-only view —
see [`decisions.md`](./decisions.md)), so `validateStates()` in `src/states.ts`
checks it in both places: the game reports problems on screen at load, the
editor flags them in the States tab. It catches a missing/unknown `initial` or
`onGotHit`, an `anim` or `to` that does not exist, an unknown trigger and a
malformed `vel`; it warns about unreachable states, states with no way out, and
the classic slip — a state whose only exit is `animEnd` playing a **looping**
animation, which can never be left.

## Notes / open for later

- Versioning: add a top-level `"version"` when the schema first changes.
- Not yet included (future): throw boxes, per-box damage/hitstun/knockback,
  sound triggers per step, per-frame movement (velocity), hit properties. These
  attach naturally to a `step` or a `box` when we get to combat mechanics.
