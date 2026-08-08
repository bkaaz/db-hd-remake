# Decisions log

Decisions that are settled. Newest first.

## 2026-08-08 — Working process: verification, servers, unit tests

- **Never drive a browser (Playwright) unasked** — not even a smoke check. After
  a change: typecheck/build, then *offer* verification options with "no check"
  as the default. Rationale: the owner keeps the game open beside the session and
  usually already sees the result, so unsolicited screenshot requests cost their
  time; browser automation is also weak at exactly what matters (timing, feel).
  Recorded in `CLAUDE.md`.
- **The dev server (5173) and editor (5174) are always running** — the owner
  starts them. Never start/restart/kill them or spawn background processes;
  report a dead port instead.
- **Unit tests (Vitest) land at Phase E**, not before: today's state machine is
  small enough to eyeball, and Phase D2 will still reshape the format, whereas
  the input buffer and motion recognition in E are combinatorial and invisible to
  the eye. Pure logic (`src/states.ts` and successors) stays PixiJS-free so it
  can be tested in Node.

## 2026-08-08 — `vel` is authored in sprite pixels (unit fix)

- Box coordinates were in sprite px while `vel` was in screen px — two scales in
  one entity. Changing the render scale would have silently changed every
  authored speed relative to the sprites.
- **`vel` is now in sprite px**, like boxes; `Entity` multiplies by the render
  scale. Goku retuned to keep the same feel: `2.5 → 0.83`, `1.8 → 0.6`.
- Fixed while only three values existed. An entity's world position is still in
  screen px — a fixed logical resolution is open question **Q7**, and when it
  lands the authored `vel` values keep their meaning.

## 2026-08-08 — Phase D1: states v0 (engine first), facing is opponent-relative

- Phase D is split: **D1 = data format + engine runner** (`states.json` written by
  hand), **D2 = the States tab in the editor**. The JSON is small enough that a UI
  first would have been the slower path.
- **State = animation + velocity + transitions.** Format in
  [`data-format.md`](./data-format.md#states-v0-added-2026-08-08).
- **Velocity X is facing-relative** (+ = forward), matching the box-coordinate
  convention — one rule for both, no world-space special cases.
- **Facing belongs to the engine, not the data:** `sign(opponentX − selfX)`,
  applied only in states with `"turn": true`, so an attack cannot turn around
  mid-swing. Movement input is translated to `fwd`/`back` through facing.
- **Trigger vocabulary v0 is tiny on purpose:** `held:fwd`, `held:back`,
  `animEnd`, each negatable with `!`. Transitions are ordered, first match wins,
  **one transition per frame**. `onEnter`, `hit` and the script escape hatch wait
  for later slices.
- **The temporary arrow-key walk is gone.** The game now runs `idle` /
  `walk_fwd` / `walk_back` from `data/entities/goku/states.json`.
- A **second Goku** stands in as a training dummy so facing has an opponent. It
  runs the same state machine with no input. **No push collision yet** — the two
  walk through each other.
- Goku's animation `anim` renamed to **`idle`**.

## 2026-08-08 — Entity data split into per-section files; per-section save

- An entity is a **directory** of section files, not one blob:
  `data/entities/<name>/frames.json`, `animations.json` (later: `states.json`,
  `commands.json`, `sounds.json`, `attributes.json`).
- The dev-server plugin **assembles** all `<section>.json` in the dir for
  `GET /api/entity` (so the game/editor still see one object), and writes ONE
  section via `POST /api/section {name, section, data, atlasPngBase64?}`.
- The editor **Save button saves only the active tab's section** (Sprites →
  `frames.json` + atlas; Animations → `animations.json`), so editing one section
  never clobbers another. Label reflects the section.
- Rationale: the model keeps growing; monolithic save risked overwriting
  sections you didn't touch, and per-section files give cleaner diffs.

## 2026-08-08 — Never auto-commit

- Do not run `git commit` on your own. The owner reviews the diff and commits on
  explicit request. Recorded in `CLAUDE.md`.

## 2026-08-07 — Naming: Entity (final); storage data/ + assets/ (no public/)

- **Amended 2026-08-08 — definition vs instance:** the engine needs both the
  authored thing and a live instance of it. Both keep the agreed word: **`EntityDef`**
  = the loaded definition (frame textures + animations + states), **`Entity`** =
  one live instance in the world (sprite, position, facing, state machine). Two
  Gokus on screen are two `Entity` objects sharing one `EntityDef`. The suffix
  carries the distinction — **do not reintroduce "Actor"**, which this entry
  rejected. `-Def` also matches the existing `FrameDef` / `AnimDef` / `StepDef`
  / `StateDef` convention.
- Final name: **Entity** (chosen over Actor / Character / Fighter). Rationale:
  "entity" is the common term in hand-rolled game code (ECS lineage), generic for
  future non-character objects, and clean in TS. Tool = **Entity Editor**
  (`tools/entity-editor/`); files `*.entity.json`; API `/api/entity`.
- **Storage (supersedes the `public/…` paths in older entries below):** our data
  in `data/entities/` (committed); BYOA images in `assets/` (gitignored:
  `assets/sheets/`, `assets/atlases/`). **No `public/`.** Game and editor load
  via the dev-server plugin (`/api/entity`, `/api/atlas`, `/api/sheet(s)`).

## 2026-08-07 — Editor becomes the Entity Editor

- The tool generalizes from "sprite editor" to **Entity Editor**: authors a whole
  game entity (sprites, animations, hitboxes, sounds, inputs, states). "Entity" is
  generic (fighters now, projectiles/objects later). Full plan in
  [`entity-editor.md`](./entity-editor.md).
- **Rename:** data `character` → `entity`; files `*.character.json` →
  `*.entity.json`; tool `tools/sprite-editor/` → `tools/entity-editor/`; dir
  `public/characters/` → `public/entities/`.
- **States model:** hybrid — mostly data-driven (visual), with a small scripting
  escape hatch for unusual behavior.
- **Editor + engine co-evolve**: each phase is a vertical slice
  (data + editor + engine + verify in game).
- **Start with Phase A** (rename + tab restructure, no new features).

## 2026-08-07 — Editor I/O (repo-integrated) + BYOA storage

- **Repo-integrated editor** instead of upload/download. A **Vite dev-server
  plugin** exposes `/api/...` endpoints (Node fs) to list sheets and read/write
  character JSON directly to repo files. Chosen over File System Access API and a
  separate server. Details/plan in [`tooling.md`](./tooling.md).
- **Storage = BYOA (Bring Your Own Assets).** We keep the project publishable:
  commit **only our work** — engine code + `characters/*.character.json`.
  Copyrighted images/audio are **gitignored** and never enter git history; the
  user supplies the source sheet from their own copy. Considered but rejected
  "commit everything, repo private forever" (blocks publication + pollutes git
  history). See [`assets.md`](./assets.md).
- **Distribution:** a committed `assets.manifest.json` (name → source URL +
  sha256) plus `npm run fetch-assets` downloads canonical sheets from their
  public source on the user's machine (we ship a pointer, not the bytes).
- **File layout:** all BYOA source assets under one gitignored `assets/` root,
  split by type (`assets/sheets/`, `assets/audio/`, `assets/backgrounds/`, …);
  committed `public/characters/<name>.character.json`; runtime keyed atlas
  `public/atlases/<name>.png` (gitignored, regenerated locally).
- **Fetch built:** `assets.manifest.json` (committed) + `npm run fetch-assets`
  (download/verify by sha256, manual-placement guidance) + `npm run hash-assets`.
- **History verified clean:** no image/asset blob has ever been committed.
- **Atlas = whole keyed sheet** for now (frames reference rects); tight repacking
  deferred.

## 2026-08-07 — Character data format v0 accepted

- Accepted the v0 character file format (atlas + frames/anchors + timed
  animations + hit/hurt/push boxes). Full spec in [`data-format.md`](./data-format.md).
- Timing in **game frames (60 FPS)**, not ms.
- Box types: **hit / hurt / push** to start.
- Coordinates **relative to anchor, Y-down** (PixiJS convention); facing flip =
  negate X. This is the contract between the sprite editor and the engine.

## 2026-08-07 — Tooling: build our own sprite editor, sprite-sheet-first

- **Build our own** browser-based sprite/animation/hitbox editor in our stack
  (TS + PixiJS, in-repo under `tools/`). No existing tool exports to our format
  or handles fighting-game hitboxes + our schema. Details in
  [`tooling.md`](./tooling.md).
- **Architecture:** one internal data model (frames + anchors + animations +
  hitboxes), with pluggable importers (sprite sheet now) and one exporter (our
  format).
- **MUGEN import is parked**, not descoped forever: kept as a documented future
  accelerator. The clean data model keeps that slot open without rework.
- **Remake goal (context):** a well-playing fighter using Hyper Dimension HD
  sprites; fidelity to the original's exact mechanics is secondary.

## 2026-08-07 — Asset strategy

- **Approach:** reimplement the engine in TypeScript, reuse the original game's
  data as static assets. **No emulator at runtime** — emulator (Mesen-S) is only
  a research/extraction/RE tool. Model follows OpenRA / ScummVM / DevilutionX.
- **Rejected:** running an emulator as the runtime and "modding" its logic live
  (Option A) — hardest, most fragile path, and leads to 65816 assembly instead
  of TypeScript. It does not remove the manual hitbox/frame-data work anyway.
- **Basis:** research confirmed the full 10-character roster is already ripped by
  the community, so pixel-ripping is largely avoided. Details in
  [`assets.md`](./assets.md).

## 2026-08-07 — Initial setup

- **Rendering:** PixiJS v8 (over Phaser / raw Canvas / raw WebGL).
- **Assets:** start with placeholder shapes; real art decided later.
- **Scope of first step:** repo + docs only. Game mechanics to be discussed
  before any gameplay code is written.
- **Stack:** TypeScript (strict), Vite, npm.
- **Working style:** go slowly; don't guess — confirm facts and decisions with
  the owner. Conversation in Polish; code/docs in English.
