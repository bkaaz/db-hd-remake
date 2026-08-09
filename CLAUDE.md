# CLAUDE.md

Guidance for Claude when working in this repository.

## What this project is

A browser-based fan **remake of _Dragon Ball Z: Hyper Dimension_** — a 2D
versus fighting game originally released on the **SNES / Super Famicom in 1996**
(developer TOSE, publisher Bandai). This is a **non-commercial fan project**.

Written in **TypeScript**, rendered in the browser with **PixiJS v8**, bundled
with **Vite**. Goal: a fighter that *plays well* using the original HD sprites;
exact fidelity to the original's mechanics is secondary.

## Working style (important)

The project owner wants to go **slowly and deliberately**:

- **Do not guess. Ask about everything.** When a design or scope decision is
  unclear, ask rather than assume — especially details about the original game's
  mechanics, roster, or feel.
- Prefer small, reviewable steps over large jumps. A phase may be split into
  smaller slices (e.g. D1 = engine, D2 = editor) — propose the split and wait.
- **Never commit on your own.** The owner reviews changes first. Make and verify
  the changes, then stop — commit only when the owner explicitly says to.
- The primary conversation language with the owner is **Polish**. Code,
  comments, commits, and docs are in **English**.
- **Record settled decisions** in `docs/decisions.md` (newest first), and keep
  the affected doc (`data-format.md`, `entity-editor.md`, …) in sync.
- **The queue is `docs/plan.md`, and finished items are DELETED from it** — in
  the same change that finishes them, not later. It is the *only* file that
  lists work to do; the reasoning goes to `decisions.md`, the timing is in git.
  `roadmap.md` and `entity-editor.md` describe the arc and the history and must
  never grow a to-do list again. A queue that only shrinks cannot drift.
- **Editor and engine co-evolve:** every phase is a vertical slice — data model
  + editor + engine + verification. See `docs/entity-editor.md`.

## Running the app (assume it is already running)

The owner keeps the dev server and the editor **running at all times** on their
default ports:

| What | URL |
|---|---|
| Game | http://localhost:5173 |
| Entity editor | http://localhost:5174/tools/entity-editor/ |

- **Do not start, restart or kill them, and do not spawn background processes**
  for them. If a port is unreachable or behaves oddly, **say so and ask** — do
  not "fix" it by launching your own.
- `npm run typecheck` and `npm run build` are free to run at any time; do run
  them before handing work back.

## Verifying changes (ask first — always)

**Never drive a browser (Playwright / Chrome DevTools) on your own initiative,
not even for a quick smoke check.** The owner usually has the game open next to
the session and can see for themselves; unsolicited screenshot requests waste
their time. Browser automation is also poor at what matters here — timing and
feel — because of seconds of latency between a synthetic keypress and a capture.

After a change, run typecheck/build **and `npm test`**, then **offer these
options and let the owner choose** (the first is the default):

1. **No check** — the owner already sees it works, or trusts the change.
2. **The owner tests** — hand over a short list of concrete things to look at;
   they send screenshots only if something is off.
3. **Playwright smoke check** — page boots, console clean, one screenshot.
4. **Full Playwright scenario** — describe the scenario before running it.

Browser automation stays available for bugs the owner reports and for
reproduction work — but the owner picks it; you only offer it.

### Unit tests — how pure logic gets verified

Pure logic (the state machine and its validator; later the input buffer and
collision resolution) is written free of PixiJS so it can be tested in Node.

- **`npm test`** (Vitest, `*.test.ts` next to the source) — run it after any
  change to that logic, and before handing work back.
- **Tests live in the repo. Never "verify" logic with a throwaway script in a
  temp directory** — that checks the code once, by eye, and leaves nothing
  behind that can fail later. If a check is worth running, it is worth
  committing as a test.
- Assert on behaviour, not on logs. A test that cannot fail is not a test:
  when adding one, confirm it fails against a deliberately broken version of
  the code before keeping it.
- New pure logic ships **with** its tests in the same slice, not "later".
- What tests do **not** cover: how anything looks, animation timing, feel. That
  stays with the owner (see above).

## Authoring content: compute it, don't reason about it

There will be many entities and hundreds of animations, so the split is fixed:

- **Anything derivable from the data is computed by a script**, never worked out
  by hand or by eye. Hurt boxes, an attack's active frame, default timings all
  come from the sprite rectangles — deterministic, identical every time, and
  free of context. Never pull `frames.json` into context to do arithmetic.
- **What each sprite is gets written down**, in
  `data/entities/<name>/descriptions.json` — groups of frames per move, plus a
  line per frame, with `?` marking a guess. Render `npm run sheet` and look at
  the sprites rather than inventing descriptions. Describe the range you are
  working on, not the whole sheet.
- **Never guess which pose is which** when it matters and the catalogue is
  silent — ask. A wrong frame is a silent, expensive mistake.
- **Order and timing are not derivable from a sheet.** It holds poses, not a
  recording; a frame often appears twice in one animation (guard → strike →
  guard). That knowledge comes from the owner and lives in `animations.json`.
- **What you produce is a skeleton the owner then adjusts** in the editor. Being
  roughly right and clearly labelling the guesses beats being slow. Always
  separate what was *computed* from what was *guessed* when reporting.
- **Do not block on approval** for this kind of work — the owner verifies on
  their own schedule.

Procedure, flags and pitfalls: the **`add-animation` skill**
(`.claude/skills/add-animation/`), loaded on demand so it costs nothing in
sessions that are about something else.

**Effects are generated, not ripped** (`npm run fx`): no hit spark exists to rip,
and the rules that keep generated pixel art from looking bolted onto 1996
sprites are narrow and easy to break. Read the **`add-effect` skill**
(`.claude/skills/add-effect/`) before touching anything that draws an effect.

## Tech stack

- **Language:** TypeScript (strict mode)
- **Rendering:** PixiJS v8 (WebGL 2D) — game runtime only
- **Editor:** plain Canvas 2D + TS (no PixiJS)
- **Build/dev server:** Vite · **Package manager:** npm
- **Assets:** real ripped HD sprite sheets, supplied by the owner (BYOA, below)

## Commands

```bash
npm install       # install dependencies
npm run dev       # game dev server (5173) — normally already running
npm run editor    # entity editor (5174)   — normally already running
npm run build     # typecheck + production build
npm run typecheck # typecheck only
npm test          # Vitest, run once (npm run test:watch to keep it running)
npm run anim -- <entity> <anim> --frames 1,2,3 --kind attack|loop|hurt
                  # build an animation with derived boxes/timing (--list, --dry-run)
npm run sheet -- <entity> --frames 0-30
                  # labelled contact sheet into assets/contact/ (gitignored)
npm run fx        # generate the effect entities (atlas + frames + animations)
                  # from src/fx.ts — no ripped hit spark exists (--dry-run)
npm run fetch-assets   # download/verify source sheets from assets.manifest.json
npm run hash-assets    # print sha256 of local assets (to fill the manifest)
```

## Structure

```
.
├── index.html                    # game page shell + #app mount
├── src/                          # the game (PixiJS) + pure logic (*.test.ts)
│   ├── main.ts                   #   boot, wiring, input
│   ├── entityDef.ts              #   load entity data + atlas -> EntityDef
│   ├── entity.ts                 #   Entity: one live instance in the world
│   ├── states.ts                 #   state-machine runner + validator (no PixiJS)
│   ├── hit.ts                    #   box → world, overlap, hit detection (no PixiJS)
│   └── boxes.ts                  #   derive boxes/timing from sprites (no PixiJS)
├── scripts/anim.ts               # build an animation from a frame list
├── scripts/sheet.ts              # labelled contact sheet of frames, to look at
├── scripts/png.ts                #   minimal PNG read/write (no dependency)
├── .claude/skills/               # procedures loaded on demand (add-animation)
├── tools/entity-editor/          # the authoring tool (Canvas 2D)
│   ├── plugin.ts                 #   Vite dev-server plugin: /api/* endpoints
│   └── src/                      #   editor UI
├── data/entities/<name>/         # OUR data, committed: frames.json,
│                                 #   animations.json, states.json, …
├── assets/                       # BYOA — gitignored, never committed
│   ├── sheets/                   #   source sprite sheets
│   └── atlases/                  #   generated keyed atlases
├── docs/                         # design notes & decisions (read before building)
├── scripts/fetch-assets.mjs      # BYOA fetch/verify
├── vite.config.ts
└── tsconfig.json
```

## Data and assets

- **Naming:** the authored thing is an **Entity** (never "actor", "character" or
  "fighter" — see `docs/decisions.md`). In code, **`EntityDef`** is the loaded
  definition (textures + animations + states) and **`Entity`** is one live
  instance in the world; two Gokus are two entities sharing one `EntityDef`.
- An entity is a **directory of section files** (`frames.json`,
  `animations.json`, `states.json`, …), not one blob. The dev-server plugin
  assembles them for `GET /api/entity`; the editor saves **one section at a
  time** via `POST /api/section` (the active tab decides which). Format:
  `docs/data-format.md`.
- **BYOA (Bring Your Own Assets):** copyrighted images/audio are gitignored and
  must **never** enter git history. Only code, `data/` and
  `assets.manifest.json` are committed. See `docs/assets.md`.

## Current status

The **Entity Editor** authors sprites and animations (framing, background
color-key, auto-detection, anchors, timed steps, hit/hurt/push boxes); the
**game** loads an entity and runs it as a **state machine** from `states.json`.
Goku walks, jumps in three variants, pushes the opponent, and fights with four
attack buttons: a hit picks the reaction it deserves (flinch, stagger or
knockdown), pauses the game, pushes the defender back and leaves a generated
spark where the boxes met. A hit still costs no health.

**What is next: `docs/plan.md`** — the queue, and the only one. Full decision
log: `docs/decisions.md`.
