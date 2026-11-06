# Data format — entity files

The contract between the editor, the scripts and the game.

**The shape is not here.** It is one TypeScript declaration, and everything that
reads or writes an entity imports it:

| | |
|---|---|
| the file and every field in it | [`src/entity/entityFile.ts`](../src/entity/entityFile.ts) |
| `states.json`, its fields and its triggers | [`src/entity/states.ts`](../src/entity/states.ts) |
| `sounds.json` | [`src/audio/sounds.ts`](../src/audio/sounds.ts) |
| `commands.json` | [`src/input/command.ts`](../src/input/command.ts) |

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
  commands.json      the cartridge's command table — written by
                     npm run rom -- commands, never by hand
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
| `states.json` | **by hand**; the editor's States tab is a read-only view. Another fighter's is written whole by `npm run rom -- states --fighter <name>`, or all of them by `states --all`; a test fails when one is out of date ([ADR 0038](./adr/0038-a-fighters-own-specials-are-merged-into-the-template.md)) |
| `specials.json` | by hand, first drafted by `npm run rom -- draft --fighter <name>` ([ADR 0070](./adr/0070-the-rest-of-the-roster-is-drafted-from-the-reports.md)) — another fighter's own specials, merged into his `states.json` by that command; shape in `src/rom/specials.ts` |
| `objects.json` | `npm run rom -- draft` — his objects with no recording yet, as `npm run rom -- export` draws them; shape `OwnObject`, `src/rom/ownObjects.ts` |
| `sounds.json` | the editor, Sounds tab; a fighter's voice from the cartridge (the entries with a `rom` or a `line`) by `npm run rom -- export`, which keeps the rest |
| `attributes.json` | by hand |
| `palettes.json` | by hand — colour sets of our own, as rules over his palette, which `npm run rom -- export` draws in every lighting ([ADR 0063](./adr/0063-a-colour-set-of-ours-is-a-rule-over-his-palette.md)); shape in `src/entity/palettesFile.ts` |

The editor saves **one section per Save**, chosen by the active tab, so a script
and a tab can work on different sections without overwriting each other. The
game only ever reads. `npm run fx` writes whole entities into `data/spawns/`;
those are entities too and every tab works on them.

An arena is not an entity: `data/arenas/<name>/arena.json` says how its
layers scroll, and `npm run rom -- export` writes it whole, with its
pictures in `assets/arenas/<name>/`. Its shape: `src/arena/arenaFile.ts`.
The HUD is the same kind of thing: `data/hud/hud.json` and
`assets/hud/hud.png`, written whole by the export, shape in
`src/hud/hudFile.ts`.

## Decisions the shape does not explain

- **Timing is in game frames at 60 FPS, never milliseconds.** Frame data is
  integer and deterministic — the fighting-game standard.
- **Coordinates are relative to the frame's anchor, Y-down** (matching PixiJS),
  so facing is a sign flip on X with no geometry to recompute.
- **`push` boxes are the body two fighters keep apart with**, the first two
  of a step's in order: the body, then the head. The export writes them from
  the cartridge on every step (ADR 0039). An entity that authors none pushes
  with its `pushWidth` attribute, and only on the ground.
- **Knockback is on the reaction, not the blow.** A reaction faces its
  attacker, so a negative `vel` x is "backwards, away", and it slides for as
  long as the reaction lasts. A `shove` is the cartridge's kind: a speed on
  entering that loses 0.25 a frame until it stops (ADR 0021); with `shoveFor` it
  keeps its whole speed that many frames and then stops, as a reel does. How long a
  reaction lasts comes from the blow's `hitstun`, not from the pose: a shorter
  animation holds its last frame, a longer one is cut off. A drawing has no
  business setting frame data.

## How a blow travels, which no one file shows

A hit connects when an attacker's `hit` box overlaps a defender's `hurt` box, and
it lands **once per entry into the state**, however many frames the box stays
out. The defender is forced into the attack's `onHit`, or their own `onGotHit` if
it names none — then into that reaction's `ifAirborne` or `ifCrouching` if they
were off the ground or low. A body already in a reaction with `ifHitAgain` goes where
that rule says instead, whatever the blow (ADR 0052); an attack's `launches`
replaces the launch of the reaction it sends into, by name.

**How a blow is taken comes from its hit type.** A state that says `"type"`
gets `onHit`, `hitstun`, `hitstop` and `relaunch` from `data/hit-types.json`,
one table shared by every fighter, and may not set any of them itself. Its
`damage` is its own and required beside a type (ADR 0019); `npm run blows`
prints every blow of an entity side by side. `states.json` keeps the short form, because the editor saves it
back; the engine, the validator and `npm run chains` read it spelled out
(`withHitTypes` in `src/combat/hitTypes.ts`). What two blows of one type may
differ in — `cancelBy`, the sounds, the spark — stays on the state. A state
that names no spark leaves the file's `hitFx`, and the engine's `spark_1`
when the file names none either; a blocked blow leaves the file's `guardFx`
when it names one. `goku` leaves the cartridge's `hit_spark` and
`guard_spark`, `goku_old` ours.

Blocking is decided at the moment of contact rather than by standing in a guard
state, so the stance is the last thing that still knows the defender was low:
`StateDef.guard` overrides the file's `onGuard` while in it.

The start and end of a round are the file's `round` — his intro, the state
a KO forces, the one he lies done in, the winner's poses (`RoundStates`) —
and `fullSpeed` on a state whose arrival ends a KO's half speed before that
(`src/match/opening.ts`, `src/match/round.ts`, ADR 0064, 0066, 0067).
A fighter's `specials.json` may name his own poses (`poses`) in place of the
template's.

Validation is `validateStates()` in `src/entity/states.ts`, run by the game (on
screen at load) and by the editor. **What it checks is in that function** and is
not listed here — the list used to be, and went stale twice in one day.

## Sound is two files with one shared id space

| file | holds | owned by |
|---|---|---|
| `data/audio/sounds.json` | the **bank** — every effect of the original, one entry per id | the game |
| `data/entities/<name>/sounds.json` | that fighter's **voices** and lines, nothing else | the fighter |

Nothing in an impact is anyone's: the hit, `09`, is not Goku's, and the next
nine fighters would each want a copy of it. A grunt *is* his.

- **An id defined in both files is an error, not an override.** That is what
  makes two files safe — nobody has to remember which wins, because winning is
  not on offer. `soundIdCollisions()` reports it at load.
- **A bank name is what it is and the cartridge's id** — `hit_09`,
  `land_0c`; `sfx_<id>` while nobody has said what plays it. Its `file` is
  that id's file of the sound test (`<id>.wav`, `audio-capture.md`) and its
  `rom` the id. One entry per id, so two names for one sound cannot happen.
- **A reaction naming a `sound` is how a fighter gets a voice** — and that id
  resolves in the fighter's own file rather than the bank, the only kind that
  does.
- **A step's `sfx` is what the cartridge plays as that step begins** —
  its own ids, written by `npm run rom -- export` from the script (ADR 0024).
  A bank entry says which id it is with `rom`. A state's `sound` is for what
  no script plays.
- **A `grab` with `caught` holds whoever the blow before it caught**, in any state
  and in the air, where he is; off the floor he plays `m30_<thrower>_<move>_air`
  (ADR 0071). The transition to it is `connected`, after `blocked` — `connected`
  fires on a block too. That blow says `catches`: its attacker's pause begins a frame into his next state. A launch with `quiet` skips the reaction's sound. `startsAt` enters a state part-way through its animation.
- **`hitLight` lights what a state's blow lands on** (`"ball"`, `"pillar"`, ADR 0072), and
  `paletteRun` runs a state through palettes from its frame 1, `plain` or `alt`;
  `paletteAt` holds a palette from a frame on, `[[1, "glow"], [46, null]]`.
- **`pillar` stands a light on the floor ahead of a state** and runs on through the next ones (ADR 0079); a bolt's `sharesBlow` spends its set's other blows with its own.
- **A step's `spawns` are what its script puts out as it begins**, once per
  start of the animation, not per loop — written by the export for a move
  that holds the opponent (ADR 0045) and for an object listed with `onStep`
  (ADR 0048); everywhere else a state's `fires` does it. A spawn whose
  `attributes.json` says `follows` rides on its owner until he leaves that
  start of the animation: `"pose"` showing the frame his drawing names,
  `"body"` playing its own (`src/fx/follow.ts`).
- **`opens` makes a shot a door**: landing on a body that does not block, it strikes
  nothing and puts its thrower in the named state, whose `seize` plays the scene. A
  `seize` with no `place` takes him where he stands, with no `launch` keeps him there,
  `hides` stops drawing him from a frame, and `ball` flies in his place and lets him
  out where it ends (`match/ball.ts`). A later state of the scene names it in `sceneOf`.
  Its `steps` may keep him at an offset from the seizer in the air (`on`), end his flight (`lands`), play his `anim` only as far as its script's hold (`toHold`, a step's `hold` in `animations.json`; `still` on the `seize` keeps him on its first drawing) or sound (`cry` him, `sound` the seizer); a spark may `sound` and `pause` the pair; `dome`, `bars`, `sparks` and `screens` are what the scene draws by frame (`match/sceneLight.ts`, ADR 0076).
- **`parry` makes a state wait for a blow** (ADR 0077): a blow whose hit box touches this state's is turned on the striker, who is held, and the state goes to `to`; `except` names by his fighter the moves that get through. A `seize` step's `draws` and `atBy` give the drawing and the offset by the held body's fighter. A `release` with `ahead` leaves him facing the seizer: a blow taken, not a throw. `launch.quiet` skips his cry.
- **A `grab`'s `shocks`** flashes the held body in `attributes.shock`, four frames each (Shocking Stunner). A state after a grab with a `caught` grab of its own keeps him held, with no idle between.
- **A `grab`'s `flips`** keeps the held body on the step before `step` until `frame`, then draws it upside down. **`stillCamera`** keeps the camera from following vertically while he is in the state; on a grab's `launch`, until the thrown body lands.
- **`flipsOnLeaving`**: he flips as he leaves the state, with no `turnsBy`.
- **`behindAt`** is `behind` from a frame of the state. **A bolt's `fallsToFloor`** has its thrower's floor for ground, **`burstsAtEnd`** bursts where its `lasts` runs out, `throughPause` is not held by a hit pause.
- **A bolt's `landsAs`** names the bolts it is rewritten as on reaching its `burstsAbove` floor, on the floor in its place (ADR 0078). **A `seize`'s `free`** runs the scene a shot `opens` on its own clock, the seizer's state left alone (ADR 0078); its `light.flickers` keeps two radii, `release.flash` whitens the screen, `release.fxAbove` puts its `fx` that high on him. **A `grab.launch`'s `fx` and `flash`** are the same from the thrower.
- **`stopsOnContact`** ends a state's ground speed at its blow's contact, not before a frame if it names one. **`dips`** draws him so many px down from each frame named, boxes staying. **`savesFlight`** keeps the speeds he comes in with, **`resumesFlight`** puts them back later in the move.
- **`throwsFoe` strikes the opponent wherever he is**, on a frame of a state: `ahead` leaves him facing the thrower, `fx` leaves an effect on him (Vegetto's throw).
- **`turnsBy` is the state a body plays its turn in**, on finding the opponent behind
  it: idle, walking and the crouch, into `turn_round`. With none it flips on the spot.
- **`fires.also` is more bolts on the same frame**, each hitting on its own, at its own
  `at` and with the first bolt's `spawn` and `state` unless it names its own (Kakusan's
  three). Unlike `with`, which never hits and goes when the bolt goes.
- **A frame's `shadow: true` in `frames.json`** says the fighter casts the floor's shadow while it shows, in the
  sheet's frames `shadow0` to `shadow3`, by height (`entity/shadow.ts`). Written by the export; one painted into
  the drawing needs none.
- **`holdFrames` ends a `holdStep`** on that frame of the state, rather than at the
  state's end; **a `grab`'s `lift`** raises the held body a pixel a frame from frame
  `from`, `px` in all. Both for Psychic Lift's rise.
- **`aim` steers a shot to the opponent's height**: from frame `from` its vy is
  `speed` toward `above` px over his feet, 0 within `within` (`entity/aim.ts`). Its
  forward speed stays its own, so it chases a jump and never turns back.
- **`sound` plays once on entering the state; `loopSound` is retriggered every
  `loopEvery` frames until you leave it, or until `loopUntil`.** Not a seamless loop: that repeats at
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
(a state's `velAt` changes it at given frames on the ground, its `air` in the air) · `onEnter` effects · a scripting escape hatch · blockstun
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
