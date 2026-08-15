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

**Two consecutive steps may name the same frame**, and for attacks they usually
should. How long a pose is *shown* and how long its hit box is *out* are
different questions, and one `dur` answers only one of them. Give the striking
frame a short step carrying the hit box and a long step carrying none: the
sprite never changes, so the swing reads exactly as before, while the window in
which it can connect is short enough to be worth aiming at and to punish when
it misses.

```jsonc
{ "frame": "33", "dur": 4,  "boxes": [ /* hurt… */, { "type": "hit", … } ] },
{ "frame": "33", "dur": 12, "boxes": [ /* hurt… */ ] }
```

The attacks authored before 2026-08-15 do not do this — they hold the hit box
for the whole strike, because the long active was standing in for **hitstop**,
which did not exist yet. See the `add-animation` skill for the numbers.

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

  **A component may be `null`, meaning "keep this axis".** `[null, -2.4]` is a
  bounce: it decides how high you come back up and says nothing about how fast
  you were already skidding. Without it a bounce has to name a horizontal speed,
  and any number it names is right for one launcher and wrong for the next — an
  uppercut arrives at 1 px a frame and a sweep at 4.5.

  Landing zeroes the **vertical** velocity only, for the same reason: touching
  the ground stops the fall, not the slide.
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
- **`rank`** — on a **reaction** state: how severe it is. Flinch 1, stagger 2,
  knockdown 3, on the floor 4. Absent means 0, which is every state that is not
  a reaction.

  The rule: **a blow never lowers the rank the defender is already in.** A jab
  cannot rescue someone mid-knockdown or stand a floored fighter up; the blow
  still connects, still costs health and still makes its noise, it simply does
  not interrupt — the victim keeps falling on the arc they were on. An *equal*
  rank re-enters, which is what a combo is.

  One number rather than a table of which reaction may replace which, because a
  table grows with every fighter times every reaction and this does not.
  Consequence worth knowing: nothing forces rank 4, so a downed or getting-up
  fighter cannot be interrupted at all — wake-up invulnerability, arrived at by
  the same rule rather than as a special case.
- **`hitstun`** — on an **attack** state: game frames it holds its victim
  helpless, overriding the entity's `hitstun` attribute (12). The fifth of the
  family with `onHit`, `hitstop`, `hitFx` and `damage` — the blow decides how it
  is taken, how long the game stops, what it looks like, what it costs and now
  how long it holds. See "Attacks and hitstun" below for what it owns and what
  it moves.
- **`invulnerable`** — on any state: blows pass straight through. Not a hit for
  zero damage — **nothing connects**: no spark, no noise, the combo does not
  grow, and the attacker's swing is not spent, so the same active frames may
  still land once the state is over.

  Goku marks the whole trip to the floor: `bounce`, `downed`, `getup`. Rank 4
  already stops a blow *interrupting* those, but a refused reaction still costs
  health, and a fighter there can neither block nor move — free damage for as
  long as the attacker keeps swinging. What it does **not** buy is an escape:
  the window ends exactly when control returns, so a blow timed to arrive on
  the first vulnerable frame still lands, and is blockable, which is the point.

  A state that is invulnerable with no transitions is warned about — untouchable
  and unleavable is a fighter removed from the match.
- **`smash`** — on an **attack** state: may this blow lift or floor a body that
  is already helpless? Past `SMASH_LIMIT` **re-launches** (2, in
  `src/combat/combo.ts`) the reaction is refused exactly as rank refuses one —
  the blow connects and costs health, and the victim keeps falling on the arc
  they were on. Two smashes do not spend anything: the one that **opens** a
  combo, because it lifts a fighter who had control and that is a launch rather
  than a re-launch, and one that rank refused anyway, because it changed nothing.

  It is the hard limit scaling cannot give: a curve makes a fourth uppercut
  weak, never impossible, while equal rank re-entering means an uppercut can
  relaunch what it just knocked down, forever. Authored on the blow rather than
  derived from whether its reaction launches, because every knockdown launches
  and only some are meant to be able to do it twice. Goku marks two: `uppercut`
  and `kick_finisher`. Chain links that juggle are **not** smashes — a juggle
  keeps a body up, it does not floor it again.
- **`ifAirborne`** — on a **reaction** state: the state to use instead when the
  entity being forced into it is off the ground. Without it an airborne
  defender is put into a grounded reaction and snaps to the floor, erasing the
  jump.

  It hangs off the reaction rather than off every attack because there are
  three ways to be hit and there will be dozens of attacks: an attack names one
  `onHit` and gets the right air version for free. What a blow does is decided
  by the blow (flinch, stagger, knockdown); *being in the air* changes only the
  pose and the impulse, which belong to the reaction.

  **One hop, forced entries only.** A state never redirects into a transition
  it chose itself, and the air version's own `ifAirborne` is not followed.
  Naming a state that does not exist is an **error** (unlike `onHit`, this
  names a state in this same file); naming one that is not `airborne` is a
  warning, since it would produce the very snap the field exists to prevent.
- **`transitions[]`** — evaluated **in order, first match wins**, and **at most
  one fires per frame** (predictable, no state loops).
  - `when` — a trigger, optionally negated with a leading `!` — **or a list of
    them, all of which have to hold**:

    ```jsonc
    { "when": ["hitConfirmed", "pressed:medium"], "to": "kick_high" }
    ```

    A chain link needs two facts at once — the attack connected *and* a button
    was pressed — and so will a command normal (forward plus a button). One
    conjunction covers both, which is why there is no `pressed:medium+fwd`
    style trigger per pair. The vocabulary:
    - `held:fwd` / `held:back` — movement input, facing-relative.
    - `held:up` — up is a **world** direction, not facing-relative. Held rather
      than an edge, deliberately: see "jump variants" below.
    - `pressed:light` / `pressed:medium` / `pressed:heavy` /
      `pressed:special` — that attack button went down **this frame** (an edge,
      so holding the key does not repeat the move). One trigger per button
      rather than a generic `pressed:attack`, which stopped meaning anything
      once there was more than one. The buttons are named by **strength**, not
      by limb: which blow is a punch and which a kick is the character's
      business — see [`combat.md`](./combat.md).
    - `animEnd` — a non-looping animation reached its last frame (latched until
      the animation changes).
    - `stunEnd` — the hitstun this entity was put in has run out. True whenever
      there is none left, so only a reaction has any use for it. It is the way
      out of every grounded reaction, and the reason a flinch's length is a
      number on the blow instead of a property of a drawing.
    - `falling` — moving downward, i.e. past the apex. The signal the arc gives
      you: a rise animation is shorter than the climb, so `animEnd` would fire
      while still going up.
    - `nearGround` — falling and within `landCue` of the ground. A landing pose
      started at touchdown is a flicker; this starts it on the way down so it
      finishes as the feet arrive.
    - `landed` — the entity touched the ground (latched until the state
      changes).
    - `hitConfirmed` — the attack this state is playing has **connected**:
      landed or been blocked, never merely swung. This is what a chain link
      hangs off, and why swinging at air ends a string instead of continuing
      it. Cleared on entering any state, so each link has to connect on its own.
  - `to` — target state.

**Jump variants without a conjunction.** "Up **and** forward" is a conjunction,
and `when` can express one — but it does not need to, because the walking states
already encode the held direction. Worth keeping in mind now that the syntax
exists: **the state you are in is itself a condition**, and using it costs
nothing to read.

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
forced into the attack's `onHit` state, or its own `onGotHit` — or, if it was
off the ground, into that reaction's `ifAirborne`. **Knockback needs
no field of its own:** a reaction state faces the attacker, so a negative `vel`
X is "backwards, away" — the reaction slides for as long as it lasts.

**How long it lasts is `hitstun`, and that is a number on the blow** (added
2026-08-15). A grounded reaction leaves on `stunEnd`, never on `animEnd`: an
animation shorter than the hold keeps its last frame, a longer one is cut off.
The pose is a drawing, and a drawing has no business setting frame data — a
combo is nothing but the defender's hitstun minus the attacker's recovery.

Two consequences worth knowing before tuning it. **Knockback moves with it**,
because `vel` applies every frame the reaction lasts, so holding somebody longer
also pushes them further; the chain distance test multiplies by `hitstun` for
exactly that reason. And **airborne reactions ignore it** — they end when the
ground arrives, and being helpless in the air lasts as long as the fall.

Deliberately **not** yet: `onEnter` effects, the scripting escape hatch, and
blockstun — `guard_hit` still ends with its animation.

**This file is hand-authored** (the editor's States tab is a read-only view —
see [`decisions.md`](./decisions.md)), so `validateStates()` in `src/entity/states.ts`
checks it in both places: the game reports problems on screen at load, the
editor flags them in the States tab. It catches a missing/unknown `initial` or
`onGotHit`, an `anim`, `to` or `ifAirborne` that does not exist, an unknown
trigger and a malformed `vel`; it warns about unreachable states — an air
version counts as reached through the reaction that names it — an `ifAirborne`
target that is not itself `airborne`, states with no way out, and
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
