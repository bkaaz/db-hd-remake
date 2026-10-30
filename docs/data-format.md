# Data format — entity files

The contract between the editor, the scripts and the game.

**The shape is not here.** It is one TypeScript declaration, and everything that
reads or writes an entity imports it:

| | |
|---|---|
| the file and every field in it | [`src/entity/entityFile.ts`](../src/entity/entityFile.ts) |
| `states.json`, its fields and its triggers | [`src/entity/states.ts`](../src/entity/states.ts) |
| `sounds.json` | [`src/audio/sounds.ts`](../src/audio/sounds.ts) |

Those carry the reasoning for a field beside the field. This file carries only
what a type cannot say: where the sections live, who may write them, and which
obvious things were left out on purpose.

## An entity is a directory, not a file

```
data/entities/goku/
  frames.json        id -> rect on the sheet + anchor
  animations.json    id -> { loop, steps }
  states.json        the state machine
  sounds.json        this fighter's own voices
  attributes.json    constants that belong to the fighter
```

The dev-server plugin assembles them into one object for `GET /api/entity`, and
that object is `EntityFile`. Nothing on disk holds it whole.

Sections are optional: an entity is authored one at a time and the editor opens
half-built ones, so the game defaults what is missing rather than refusing to
load it.

## Who writes what

| section | written by |
|---|---|
| `frames.json` | the editor, Sprites tab |
| `animations.json` | the editor, Animations tab — **and** `npm run anim`; for `goku`, `npm run rom -- export` writes it whole ([ADR 0017](./adr/0017-the-cartridges-animations-are-named-by-move-id.md)) |
| `states.json` | **by hand**; the editor's States tab is a read-only view |
| `sounds.json` | the editor, Sounds tab |
| `attributes.json` | by hand |

The editor saves **one section per Save**, chosen by the active tab, so a script
and a tab can work on different sections without overwriting each other. The
game only ever reads. `npm run fx` writes whole entities into `data/spawns/`;
those are entities too and every tab works on them.

An arena is not an entity: `data/arenas/<name>/arena.json` says how its
layers scroll, and `npm run rom -- export` writes it whole, with its
pictures in `assets/arenas/<name>/`. Its shape: `src/arena/arenaFile.ts`.

## Decisions the shape does not explain

- **Timing is in game frames at 60 FPS, never milliseconds.** Frame data is
  integer and deterministic — the fighting-game standard.
- **Coordinates are relative to the frame's anchor, Y-down** (matching PixiJS),
  so facing is a sign flip on X with no geometry to recompute.
- **`push` boxes exist in the type and are not used.** Push collision reads the
  `pushWidth` attribute instead, because a box that followed the animation would
  shove the opponent whenever an arm came out. The type keeps `push` for a case
  that needs it later — a narrower crouch, say.
- **Knockback is on the reaction, not the blow.** A reaction faces its
  attacker, so a negative `vel` x is "backwards, away", and it slides for as
  long as the reaction lasts. A `shove` is the cartridge's kind: a speed on
  entering that loses 0.25 a frame until it stops (ADR 0021). How long a
  reaction lasts comes from the blow's `hitstun`, not from the pose: a shorter
  animation holds its last frame, a longer one is cut off. A drawing has no
  business setting frame data.

## How a blow travels, which no one file shows

A hit connects when an attacker's `hit` box overlaps a defender's `hurt` box, and
it lands **once per entry into the state**, however many frames the box stays
out. The defender is forced into the attack's `onHit`, or their own `onGotHit` if
it names none — then into that reaction's `ifAirborne` or `ifCrouching` if they
were off the ground or low.

**How a blow is taken comes from its hit type.** A state that says `"type"`
gets `onHit`, `hitstun`, `hitstop` and `relaunch` from `data/hit-types.json`,
one table shared by every fighter, and may not set any of them itself. Its
`damage` is its own and required beside a type (ADR 0019); `npm run blows`
prints every blow of an entity side by side. `states.json` keeps the short form, because the editor saves it
back; the engine, the validator and `npm run chains` read it spelled out
(`withHitTypes` in `src/combat/hitTypes.ts`). What two blows of one type may
differ in — `cancelBy`, the sounds, the spark — stays on the state.

Blocking is decided at the moment of contact rather than by standing in a guard
state, so the stance is the last thing that still knows the defender was low:
`StateDef.guard` overrides the file's `onGuard` while in it.

Validation is `validateStates()` in `src/entity/states.ts`, run by the game (on
screen at load) and by the editor. **What it checks is in that function** and is
not listed here — the list used to be, and went stale twice in one day.

## Sound is two files with one shared id space

| file | holds | owned by |
|---|---|---|
| `data/audio/sounds.json` | the **bank** — swings, impacts, blocks, landings | the game |
| `data/entities/<name>/sounds.json` | that fighter's **voices**, nothing else | the fighter |

Nothing in an impact is anyone's: clip 007 is not Goku's, and the next nine
fighters would each want a copy of it. A grunt *is* his.

- **An id defined in both files is an error, not an override.** That is what
  makes two files safe — nobody has to remember which wins, because winning is
  not on offer. `soundIdCollisions()` reports it at load.
- **Bank ids are numbered per category and append-only** — `swing_1`, `hit_1`.
  A name that says who plays it is a guess that ages: `swing_kick` was used by
  kicks *and* by heavy punches. `swing_7` must always mean what it means today,
  because `states.json` points at it by name.
- **Two variants may share a `file`.** `hit_2` borrows `hit_1`'s clip until
  someone names a heavier one; when they do, one field changes.
- **A reaction naming a `sound` is how a fighter gets a voice** — and that id
  resolves in the fighter's own file rather than the bank, the only kind that
  does.
- **A step's `sfx` is what the cartridge plays as that step begins** —
  its own ids, written by `npm run rom -- export` from the script (ADR 0024).
  A bank entry says which id it is with `rom`; an id nobody has matched plays
  nothing. A state's `sound` is for what no script plays.
- **`sound` plays once on entering the state; `loopSound` is retriggered every
  `loopEvery` frames until you leave it.** Not a seamless loop: that repeats at
  exactly the clip's own length and can never overlap itself, and the original's
  charge is one short clip fired again before the last copy has finished. The
  copies stacking is what turns a repeat into a sustain, so `loopEvery` shorter
  than the clip is the point rather than a mistake. **Pick it as the clip's
  length divided by how many copies should overlap** — measure the `.wav` rather
  than guessing, because the same interval is a sustain under a long clip and a
  machine gun under a short one. Goku's charge overlaps three. Two states naming the same
  `loopSound` hand it over rather than restarting the clock, which keeps a hitch
  out of the seam between a drop-in pose and its loop.

## Tuning `landCue`

It is a distance, but what matters is the frames it buys before touchdown — and
that is not a property of `landCue` alone. A body crossing the threshold on a
high jump is falling faster than one on a short hop, so the same distance buys
fewer frames the higher the fighter went. Work it out against the `launch` and
`gravity` actually in `attributes.json` rather than against a remembered table;
a jump retuned by a pixel moves every number in it.

## Deliberately absent

Throw boxes · per-box damage, hitstun or knockback · per-frame velocity
(a state's `velAt` changes it at given frames) · `onEnter` effects · a scripting escape hatch · blockstun
(`guard_hit` still ends with its animation) · a top-level `"version"`, added when
the schema first breaks. Most attach naturally to a `step` or a `box` when the
mechanics that need them exist.

## One assembled entity, abridged

```jsonc
{
  "name": "goku",
  "sheet": "goku.png",                 // path under assets/sheets/
  "frames": {
    // id = the frame's number on the sheet, along each row then down.
    "33": { "x": 194, "y": 3, "w": 72, "h": 91, "anchor": [16, 91] }
  },
  "animations": {
    "punch": {
      "loop": false,
      "steps": [
        { "frame": "32", "dur": 4 },
        // boxes are px relative to the anchor; flipping facing negates x
        { "frame": "33", "dur": 3,
          "boxes": [{ "type": "hit", "x": 25, "y": -58, "w": 11, "h": 18 }] },
        { "frame": "33", "dur": 5 },   // the same pose, held, with no box out
        { "frame": "32", "dur": 3 }
      ]
    }
  },
  "states": {
    "initial": "idle",
    "onGotHit": "hurt",
    "states": {
      "punch": {
        "anim": "punch",
        "type": "flinch",
        "cancelBy": 8,
        "transitions": [{ "when": ["cancelable", "pressed:attack"], "to": "punch_knee" }]
      }
    }
  },
  "attributes": { "gravity": 0.3, "health": 100 }
}
```
