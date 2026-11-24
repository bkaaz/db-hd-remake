# Data format — entity files

The contract between the editor, the scripts and the game. **The shape is not
here**: it is one TypeScript declaration that everything reading or writing an
entity imports, each field explained where it is declared.

| | |
|---|---|
| the file and its sections | [`src/entity/entityFile.ts`](../src/entity/entityFile.ts) |
| `states.json`, its fields and its triggers | [`src/entity/states.ts`](../src/entity/states.ts) |
| `sounds.json` | [`src/audio/sounds.ts`](../src/audio/sounds.ts) |
| `commands.json` | [`src/input/command.ts`](../src/input/command.ts) |

How the engine plays those fields is [`combat.md`](./combat.md), "How the
engine plays a blow". This file says only where the sections live, who writes
them, and what a type cannot say.

## An entity is a directory

`data/entities/<name>/` for a fighter, `data/spawns/<name>/` for what a state
brings into the world (ADR 0014). The game assembles a directory into one
`EntityFile` (`readEntity`, `src/data/files.ts`); the editor through the dev
server's `/api/entity`. Every section is optional, and the game defaults what is
missing.

| section | written by |
|---|---|
| `frames.json` | `npm run rom -- export`, whole (ADR 0090) |
| `animations.json` | `npm run rom -- export`, whole; an edit in the editor is lost at the next export (ADR 0017) |
| `states.json` | Goku's by hand, until the common part (`plan.md`); every other fighter's by `npm run rom -- states`, whole (ADR 0038) |
| `specials.json` | by hand, first drafted by `npm run rom -- draft` (ADR 0038) |
| `objects.json` | `npm run rom -- draft`: a fighter's objects no recording has given yet |
| `commands.json` | `npm run rom -- commands`, whole (ADR 0050) |
| `sounds.json` | the editor's Sounds tab; a fighter's voices by `npm run rom -- export`, which keeps the rest |
| `attributes.json` | by hand |
| `palettes.json` | by hand: colour sets of ours (ADR 0063) |
| `look.json` | a spawn's only: `npm run rom -- export` (ADR 0036) |

The editor saves **one section per Save**, chosen by the active tab, so a script
and a tab working on different sections never overwrite each other. The game
only reads.

Not entities, and written whole by the export: an arena's
`data/arenas/<name>/arena.json` (`src/arena/arenaFile.ts`). By hand:
`data/hud/faces.json` (where each face sits in its portrait, `src/hud/hud.ts`),
`data/hit-types.json`,
`data/roster.json`, `data/debug.json`.

## What a type cannot say

- **Time is in game frames at 60 FPS**, never milliseconds.
- **Coordinates are relative to the frame's anchor, Y down**, so facing is a sign
  flip on X.
- **How long a reaction lasts is its blow's hitstun**, not its drawing: a shorter
  animation holds its last frame, a longer one is cut off.
- **`states.json` keeps a blow's short form** (`"type"`), because the editor saves
  what it loaded; everything that reads it spells the type out (`withHitTypes`,
  `src/combat/hitTypes.ts`).
- **Validation is `validateStates()`**, run by the game at load and by the
  editor; what it checks is that function.

## Sound is two files with one id space

| file | holds |
|---|---|
| `data/audio/sounds.json` | the **bank**: every effect of the original, one entry per cartridge id |
| `data/entities/<name>/sounds.json` | that fighter's **voices** and lines |

An id defined in both is an error, not an override (`soundIdCollisions()`). A
bank entry is named for what it is and its id (`hit_09`; `sfx_<id>` while nobody
knows) and plays as the driver plays its `rom` id (ADR 0092). A reaction's
`sound` resolves in the fighter's own file first, which is how he gets a voice.

## Deliberately absent

Throw boxes · per-box damage, hitstun or knockback · `onEnter` effects · a
scripting escape hatch · blockstun (`guard_hit` ends with its animation) · a
top-level `"version"`, added when the schema first breaks.
