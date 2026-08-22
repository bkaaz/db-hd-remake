# Entity Editor

The one tool that authors a complete game entity — sprites, animations, boxes,
sounds and (later) states. **"Entity" is generic on purpose:** it covers
fighters now and projectiles or stage objects later, and the editor already
opens the generated effects the same way it opens Goku.

What an entity *is* on disk: [`data-format.md`](./data-format.md). The `/api/*`
endpoints it talks to are `tools/entity-editor/server.ts`, which is where they
stay — a list of them lived in a doc and went stale twice in one day.

## If you know MUGEN

The mental model is the same one, held as **data rather than a scripting
language**:

| here | MUGEN |
|---|---|
| `frames.json` | SFF |
| `animations.json`, boxes per step | AIR + Clsn1/Clsn2 |
| `states.json` — a state binds an animation, physics and transitions | StateDef + triggers + ChangeState |
| a blow's `onHit`, `damage`, `hitstun` on the attacking state | HitDef → GetHit |
| `attributes.json` | CNS constants |
| `sounds.json` | SND |

The differences are deliberate and listed under *Deliberately absent* in
`data-format.md` — there is no state scripting, no `onEnter` controller list and
no command/motion vocabulary. A 2026-08-07 plan here sketched all three; none was
built, and states stayed text ([ADR 0013](./adr/0013-states-stay-hand-authored.md)).

## The tabs

| Tab | Purpose |
|---|---|
| **Sprites** | load a sheet, key the background, auto-detect, frames + anchors |
| **Animations** | timed steps, the hit/hurt/push box layer, preview |
| **Combos** | the chain graph — a node per attack at its hit frame, an edge per cancel labelled with the button and the frames of margin; hover to dim what it does not touch. Read-only: authoring stays in text ([ADR 0013](./adr/0013-states-stay-hand-authored.md)) |

Commands, Sounds and Attributes are placeholders beyond what is listed below.
They get built when the engine work that needs them comes up the queue —
[`plan.md`](./plan.md).

## How it got here

### First: why the editor is ours

No existing tool does all four things at once — run in a browser, slice a ripped
sheet, author fighting-game hit boxes, and export **our** format. Each covers a
slice, so using them would have meant hand-shuffling data and converting at the
end anyway.

| Tool | Does | Missing for us |
|---|---|---|
| Leshy SpriteSheet Tool (browser, free) | slices sheets, auto | no hit boxes, not our format |
| ShoeBox (free, Adobe AIR) | extracts sprites by blob detection | dated; same two gaps |
| Aseprite (desktop, paid) | edit and animate, JSON export | poor at slicing packed rips; no fighting hit boxes |
| TexturePacker / Free Texture Packer | packs individual PNGs into an atlas | the reverse direction; no hit boxes |

**Canvas 2D, not PixiJS.** Drawing frame, anchor and box overlays on an image is
native Canvas 2D work, and keeping PixiJS to the game runtime is what lets the
editor import the engine's pure modules without dragging a renderer along. The
editor is a second page on the project's Vite toolchain.

**It reads and writes the repo directly**, through `/api/*` on the Vite dev
server. The File System Access API was rejected — it asks the owner to re-grant a
folder and works in one browser family — and so was a separate server process,
which is a second thing to start and keep alive for endpoints Vite can host for
nothing. Upload/download was never on the table: the round-trip *was* the
bottleneck.

### And what it was spared

**A rewrite in Vue was proposed and rejected.** The bottleneck was never the UI
toolkit, it was that round-trip — and removing it is what made the toolkit
question uninteresting.

**A separate review tool, and a PNG frame exporter for Claude to eyeball hit
boxes, went the same way.** The first would duplicate the canvas and the box
code; the second buys accuracy that a generated skeleton does not need, since
hurt boxes are the tedious part and they are computable.

**And a read-only print of `states.json` was built and then deleted.** It showed
contents you can read and answered nothing you could not ask by opening the file.
What replaced it is a *graph*, because "what leads where" is the one question the
file cannot answer by being read — the relationships are scattered across `to`
fields and have to be assembled in the reader's head.

### Then: the phases

The lettered phases are **history, not a schedule**; remaining work is in
`plan.md` under its own letters. Kept because the reasoning behind the shape of
the tool lives in them.

| Phase | Editor | Engine | Unlocked |
|---|---|---|---|
| **A. Rename + tabs** ✅ | reorganised; `sprite-editor` → `entity-editor` | loader path update | a clean base, no new features |
| **B. Hit boxes** ✅ | box layer in Animations (draw, select, delete) | box overlay, toggle `B` | boxes authored and shown |
| **D1. States — engine** ✅ | — (`states.json` hand-written) | state-machine runner, opponent-relative facing | idle and walk from data |
| **D2. States — validation** ✅ | read-only States tab, problems flagged | shared `validateStates()` + `npm test` | safe hand-authoring; a visual state editor was dropped ([ADR 0013](./adr/0013-states-stay-hand-authored.md)) |
| **E. Sounds tab** ✅ | the game's bank by category, auditioned and edited | reuses `Audio` and `validateSounds()` unchanged | hearing `swing_2` against `swing_3`, which is the only way they differ |

The Sounds tab is the first thing in the editor that is **not** part of an
entity: the bank belongs to the game, so it loads and saves on its own route
rather than as a section of `data/entities/<name>/`. Which sound a *state* uses
is still typed into `states.json` by hand — the tab exists to find the id and
hear it, not to author the state.
