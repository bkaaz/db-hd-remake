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

After a change, run typecheck/build, then **offer these options and let the
owner choose** (the first is the default):

1. **No check** — the owner already sees it works, or trusts the change.
2. **The owner tests** — hand over a short list of concrete things to look at;
   they send screenshots only if something is off.
3. **Playwright smoke check** — page boots, console clean, one screenshot.
4. **Full Playwright scenario** — describe the scenario before running it.

Browser automation stays available for bugs the owner reports and for
reproduction work — but the owner picks it; you only offer it.

Pure logic (state machine, later input buffer and collisions) is written free of
PixiJS so it can be verified in Node instead of a browser. **Unit tests (Vitest)
are agreed for Phase E** — where input buffering and motion recognition become
combinatorial — not before.

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
npm run fetch-assets   # download/verify source sheets from assets.manifest.json
npm run hash-assets    # print sha256 of local assets (to fill the manifest)
```

## Structure

```
.
├── index.html                    # game page shell + #app mount
├── src/                          # the game (PixiJS)
│   ├── main.ts                   #   boot, wiring, input
│   ├── entityDef.ts              #   load entity data + atlas -> EntityDef
│   ├── entity.ts                 #   Entity: one live instance in the world
│   └── states.ts                 #   pure state-machine runner (no PixiJS)
├── tools/entity-editor/          # the authoring tool (Canvas 2D)
│   ├── plugin.ts                 #   Vite dev-server plugin: /api/* endpoints
│   └── src/                      #   editor UI
├── data/entities/<name>/         # OUR data, committed: frames.json,
│                                 #   animations.json, states.json, …
├── assets/                       # BYOA — gitignored, never committed
│   ├── sheets/                   #   source sprite sheets
│   └── atlases/                  #   generated keyed atlases
├── docs/                         # design notes & decisions (read before building)
├── scripts/fetch-assets.mjs
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
**game** loads an entity and runs it as a **state machine** — Phase D1 gave it
`states.json`, opponent-relative facing and idle/walk, replacing the temporary
arrow-key walk.

Next: **D2** (States tab in the editor), then **E** (Commands / input).
Roadmap and phase table: `docs/entity-editor.md`. Full decision log:
`docs/decisions.md`.
