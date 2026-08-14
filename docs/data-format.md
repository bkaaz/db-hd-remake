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
   `push` (body collision).** Throws/other types added later. In practice push
   collision uses the `pushWidth` attribute rather than per-frame `push` boxes —
   a push box that followed the animation would shove the opponent whenever an
   arm came out. The box type stays for cases that need it later (crouching
   narrower, for instance).
3. **Coordinates relative to the frame's anchor, Y-down (matches PixiJS).**
   Facing left/right is just a sign flip on X — no geometry recompute.

## Example

```jsonc
// goku.entity.json
{
  "name": "goku",
  "atlas": "goku.png",              // packed atlas of frames
  "frames": {
    // id = the frame's number on the sheet, running along each row then down.
    // anchor = pivot point in px (e.g. between the feet),
    // measured from the frame's top-left corner
    "0": { "x": 2,  "y": 2, "w": 64, "h": 96, "anchor": [32, 94] },
    "1": { "x": 68, "y": 2, "w": 66, "h": 96, "anchor": [33, 94] }
  },
  "animations": {
    "idle": {
      "loop": true,
      // dur = number of game frames at 60 FPS (NOT milliseconds)
      "steps": [
        { "frame": "0", "dur": 6 },
        { "frame": "1", "dur": 6 }
      ]
    },
    "punch": {
      "loop": false,
      "steps": [
        {
          "frame": "32", "dur": 3,
          // boxes in px RELATIVE TO the anchor; flipping facing = negate X
          "boxes": [
            { "type": "hurt", "x": -20, "y": -90, "w": 40, "h": 90 },
            { "type": "push", "x": -16, "y": -88, "w": 32, "h": 88 }
          ]
        },
        {
          "frame": "33", "dur": 4,
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
- **`frames`** — map of frame id → rect in the atlas plus `anchor`. Ids are the
  frame's number on the sheet (`"0"`, `"1"`, …), assigned in reading order:
  along a row, then down. Renumbering in the editor swaps two frames.
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
- **`onGuard`** *(optional, top level)* — the state forced on this entity when
  it **blocks** a blow. There is no guard stance to stand in: holding away is
  already how you walk backwards, so a blocking state would fight with
  `walk_back`. The block is decided at the moment of contact instead — the
  defender counts as guarding if it is grounded and holding away from its
  opponent — which is also how the genre has always worked, with the guard pose
  appearing only on a blow that actually arrives. Omit the field and the fighter
  cannot block. Blocking in the air is refused: a jump-in blocked for free
  removes the point of jumping in.
- **`anim`** — animation played while in the state (restarts on entry).
- **`vel`** — `[x, y]` per game frame, in **sprite pixels** — the same unit as
  box coordinates, so display scale never changes what the data means (the
  engine multiplies by the render scale). **X is facing-relative** (+ = forward).
  **Y is reserved** and ignored until gravity exists.
  > Caveat: an entity's world position is still kept in *screen* px. Moving the
  > whole world to a fixed logical resolution is open question **Q7**; when it
  > lands, authored `vel` values keep their meaning — only the engine changes.
- **`launch`** — `[x, y]` velocity set **once, on entering** the state, in sprite
  px per frame; X facing-relative, Y **negative is up**. This is how a jump
  starts. A state without `launch` leaves the velocity alone, which is what
  carries momentum from a take-off state into the airborne one that follows.
- **`airborne`** — while true the entity is off the ground: gravity is added to
  its vertical velocity every frame and its horizontal velocity carries, instead
  of `vel` being re-applied. Landing (reaching the ground line) zeroes the
  velocity and fires the `landed` trigger.
- **`turn`** — may the entity turn to face its opponent while in this state?
  Facing is engine-owned (`sign(opponentX − selfX)`), so attacks set `turn:false`
  and cannot spin around mid-swing.
- **`damage`** — health this state's attack takes off, overriding the entity's
  `damage` attribute. The fourth field of one family, with `onHit`, `hitstop`
  and `hitFx`: the blow decides how it is taken, how long the game stops, what
  it looks like and what it costs.
- **`onHit`** — the reaction this state's attack forces on whoever it hits: the
  name of a state **on the defender**, not in this file. The blow decides how it
  is taken, which is what separates a jab from a smash. When a state names
  nothing, the defender's own `onGotHit` applies — so `onHit` overrides a
  default rather than replacing the mechanism. Reaction names are a small
  vocabulary every fighter is expected to implement (`hurt`, later `hurt_heavy`,
  `knockdown`); the validator can only check the attacker's own states, so an
  unknown name is a **warning**, not an error.
- **`transitions[]`** — evaluated **in order, first match wins**, and **at most
  one fires per frame** (predictable, no state loops).
  - `when` — trigger, optionally negated with a leading `!`. v0 vocabulary:
    - `held:fwd` / `held:back` — movement input, facing-relative.
    - `held:up` — up is a **world** direction, not facing-relative. Held rather
      than an edge, deliberately: see "jump variants" below.
    - `pressed:punch` / `pressed:kick` / `pressed:punchHeavy` /
      `pressed:kickHeavy` — that attack button went down **this frame** (an
      edge, so holding the key does not repeat the move). One trigger per
      button rather than a generic `pressed:attack`, which stopped meaning
      anything once there was more than one.
    - `animEnd` — a non-looping animation reached its last frame (latched until
      the animation changes).
    - `falling` — moving downward, i.e. past the apex. The signal the arc gives
      you: a rise animation is shorter than the climb, so `animEnd` would fire
      while still going up.
    - `nearGround` — falling and within `landCue` of the ground. A landing pose
      started at touchdown is a flicker; this starts it on the way down so it
      finishes as the feet arrive.
    - `landed` — the entity touched the ground (latched until the state
      changes).
  - `to` — target state.

**Jump variants without compound triggers.** "Up **and** forward" is a
conjunction, and triggers are single conditions — but no new syntax is needed,
because the walking states already encode the held direction:

```
idle      → held:fwd → walk_fwd,  held:up → jump_up
walk_fwd  → held:up  → jump_fwd
walk_back → held:up  → jump_back
```

Holding up alone gives a neutral jump; holding forward and then up spends one
frame in `walk_fwd` and jumps forward from there — 16 ms late, imperceptible.
This is also why the trigger is `held:up` and not an edge: an edge would be
consumed by the frame that enters `walk_fwd`, and the jump would be swallowed.
Holding up to hop repeatedly then falls out for free, as in most fighters.

A travelling jump is two states: a take-off (`launch`, one-frame animation,
`animEnd → …_air`) followed by an airborne state looping the somersault until
`landed`. One animation cannot both play a take-off once and loop afterwards.

**Attacks and hitstun.** An attack is an ordinary state: a non-looping animation
with `hit` boxes on its active steps, `turn: false` so it cannot spin mid-swing,
and `{ "when": "animEnd", "to": "idle" }` to recover. A hit connects when an
attacker's `hit` box overlaps a defender's `hurt` box; it lands **once per entry
into the state**, however many frames the box stays out. The defender is then
forced into the attack's `onHit` state, or its own `onGotHit`. **Knockback needs
no field of its own:** a reaction state faces the attacker, so a negative `vel`
X is "backwards, away" — the reaction slides for as long as it lasts. There is no `hitstun`
field yet — the reaction lasts as long as the `onGotHit` state's non-looping
animation, which is authored in the editor anyway. Damage and health wait for
`attributes.json`.

Deliberately **not** in v0 (later slices): `onEnter` effects, `hit` data
(damage/hitstun/knockback), the scripting escape hatch, jump/gravity.

**This file is hand-authored** (the editor's States tab is a read-only view —
see [`decisions.md`](./decisions.md)), so `validateStates()` in `src/entity/states.ts`
checks it in both places: the game reports problems on screen at load, the
editor flags them in the States tab. It catches a missing/unknown `initial` or
`onGotHit`, an `anim` or `to` that does not exist, an unknown trigger and a
malformed `vel`; it warns about unreachable states, states with no way out, and
the classic slip — a state whose only exit is `animEnd` playing a **looping**
animation, which can never be left.

## Sounds (added 2026-08-10 · split into bank and voices 2026-08-14)

Sound lives in **two files with one shared id space**:

| file | holds | who owns it |
|---|---|---|
| `data/audio/sounds.json` | the **bank** — swings, impacts, blocks, landings | the game |
| `data/entities/<name>/sounds.json` | that fighter's **voices**, nothing else | the fighter |

Nothing in an impact is anyone's: clip 007 is not Goku's, and the next nine
fighters would each want a copy of the same thing. A grunt *is* his. So the
split follows the one the original draws — see `decisions.md`, 2026-08-14.

**An id defined in both files is an error, not an override.** That is what makes
two files safe: nobody has to remember which one wins, because winning is not on
offer. `soundIdCollisions()` reports it at load.

**Bank ids are numbered per category and append-only** — `swing_1`, `swing_2`,
`hit_1`. The name says nothing about who plays it, because a name that does is a
guess that ages: `swing_kick` was used by kicks *and* by heavy punches. A state
picks a variant, so giving a move a different swing is one string, not a new
definition. `swing_7` must always mean what it means today, since `states.json`
points at it by name.

Two variants may share a `file` and that is not duplication — `hit_2` is a
heavier hit that borrows `hit_1`'s clip until someone names a heavier one among
the 107 clips nobody has listened to yet. When they do, one field changes.

```jsonc
// data/audio/sounds.json — the bank
{
  "hit_1":   { "label": "hit landed: damage went in",
               "kind": "noise", "freq": 420, "decay": 0.11, "gain": 0.42, "vary": 0.10,
               "file": "007.wav" },
  "block_1": { "label": "a blocked hit",
               "kind": "tone",  "freq": 900, "decay": 0.09, "gain": 0.30, "vary": 0.06 }
}
```

- **`label`** — what it sounds like, in words. Where the meaning went once ids
  became numbers: for a person reading the file and for the editor's picker.
  Never used to look anything up.

- **`kind`** — `noise` (filtered white noise: impacts, whiffs) or `tone`
  (a falling sine: the thin ring of a blocked blow).
- **`freq`** — centre frequency in Hz; lower reads as heavier.
- **`decay`** — length in seconds. Impacts live between 0.05 and 0.25.
- **`gain`** — peak volume, above 0 and at most 1.
- **`vary`** — random pitch spread as a fraction of `freq`. Without it a run of
  hits sounds like a stuck key rather than a fight.
- **`file`** — a `.wav` in `assets/audio/sfx/`, served by `/api/sfx`. Takes
  precedence over the spec once loaded. The clips keep the numbers the splitter
  gave them rather than being renamed, so re-cutting the capture cannot orphan a
  sound; **`data/audio/sound-test.json` is the catalogue** saying which number is
  what, with `?` for the ones nobody has identified yet — the same convention as
  `descriptions.json` for sprites.

`gain` applies to a sample too, and `vary` becomes playback speed rather than a
filter frequency — one definition of the wobble, `rateFor()`, shared by both.
What a sample does *not* use is `decay`: a recording carries its own envelope.

**A sound with a `file` may drop `kind`, `freq` and `decay` entirely.** Some
sounds have no honest synthesised stand-in — a voice above all — and inventing
one is worse than staying quiet for the moment before the sample loads. Without
a `file` all three are still required: a sound has to be *something*.

A reaction state naming a `sound` is how a fighter gets a voice: `hurt` and
`knockdown` play the grunt on being entered, which is the moment the blow lands.
That id resolves in the fighter's own file rather than the bank — the only kind
of sound that does.

**A key starting with `_` is a note, not a sound** — JSON has nowhere else to put
one, and the validator skips it.

A state names sounds with three fields, the same family as `onHit`, `hitstop`,
`hitFx` and `damage` — the blow decides how it sounds too:

- **`sound`** — played on entering the state: the swing, not the impact.
- **`hitSound`** — played when this state's attack lands.
- **`blockSound`** — played when it is blocked.

An unknown id is silent rather than fatal: sound is the last thing added to a
move and the first thing forgotten. `validateSounds()` runs at load and reports
malformed specs, since a broken sound fails quietly.

## Attributes (added 2026-08-09)

Section file `attributes.json` — constants that belong to the fighter rather
than to any one state. So far one:

```jsonc
{
  "gravity": 0.3,    // sprite px per game frame, squared
  "landCue": 60,     // sprite px above the ground where a fall starts landing
  "pushWidth": 30,   // body width for push collision, centred on the anchor
  "hitstop": 6,      // game frames both fighters freeze for on a connecting hit
  "health": 100,     // what the fighter can take before there is nothing left
  "damage": 6        // what an attack costs when its own state does not say
}
```

`hitstop` is the pause that makes a blow feel like it met something. Both
fighters freeze completely — animation, movement and state changes — so the
pose the hit landed on is held still. An attack state can override it with its
own `hitstop` field, because a heavy blow wants a longer pause and that belongs
to the blow rather than to either body.

`landCue` is a distance, but what matters is how many frames it buys before
touchdown — and that depends on the jump. For Goku's 150 px jump: 24 px is
about 2.5 frames, 40 px about 4.5, 60 px about 7, 80 px about 10.

An airborne sequence therefore reads: rise → `falling` → fall pose →
`nearGround` → landing pose → `landed`.

`landCue` also decides when a falling body starts pushing again. Above it two
bodies overlap freely, which is what lets a jump pass over the opponent; below
it they separate like the grounded bodies they are about to be.

Missing values fall back to engine defaults (`src/entity/entityDef.ts`), so the file is
optional — but **anything meant to be tuned is written out explicitly anyway**.
A value you are expected to adjust should be visible where you would look for
it, not hidden in a default.

Missing values fall back to engine defaults, so the file is optional. Health,
walk speeds and the rest arrive with phase C.

## Notes / open for later

- Versioning: add a top-level `"version"` when the schema first changes.
- Not yet included (future): throw boxes, per-box damage/hitstun/knockback,
  sound triggers per step, per-frame movement (velocity), hit properties. These
  attach naturally to a `step` or a `box` when we get to combat mechanics.
