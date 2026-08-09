# Decisions log

Decisions that are settled. Newest first.

## 2026-08-09 — Hurt boxes are fitted to the silhouette, not the frame rect

- **Problem:** deriving a hurt box from the frame rectangle gives one box around
  the *whole* sprite, so an outstretched arm makes the legs as wide as the
  punch. On Goku's punch frame that box was 100% of the bounding area.
- **Now:** the script reads the atlas, takes each row's horizontal extent from
  the alpha mask, and greedily merges neighbouring rows — always the pair adding
  the least empty area — into `--hurt-boxes N` bands (default 3). The result
  hugs the body: narrow head, wide torso where the arms are, narrow legs. Same
  punch frame: 60% of the bounding area, in three boxes.
- **PNG decoding uses the built-in `node:zlib`** rather than a dependency: the
  atlas is written by the editor's canvas, so it is always 8-bit non-interlaced
  RGB(A). The decoder refuses anything else loudly instead of misreading it, and
  is round-trip tested against an encoder in the test file that exercises all
  five row filters.
- **The fitting itself is pure and testable** (`hurtBoxesFromMask` in
  `src/boxes.ts`, driven by ASCII-art masks in the tests); only the decoding
  lives in `scripts/`.
- Falls back to the single bounding box, with a message, when the atlas is
  missing — it is gitignored (BYOA), so a fresh clone has none until
  `npm run fetch-assets`.

## 2026-08-09 — Authoring pipeline: scripts compute, the owner adjusts

There will be ~10 entities × ~20 animations, so how an animation gets made
matters more than any single animation.

- **No approval gates.** The owner supplies the frame list; Claude produces the
  whole animation and state in one go; the owner verifies and edits later, on
  their own schedule. Gates were considered and dropped — they serialise the two
  sides for no gain, since the output is explicitly a *skeleton to adjust*, not
  a finished move.
- **Anything derivable is computed by a script**, not reasoned about. Frames are
  cut tight around the silhouette, so a hurt box *is* the frame rect relative to
  the anchor; the active frame of an attack is the one reaching furthest in
  front of the anchor. `src/boxes.ts` (pure, tested) + `scripts/anim.ts`
  (`npm run anim`). Rationale is as much about cost as correctness: doing this
  in-context means pulling a 2000-line `frames.json` in per animation, for
  arithmetic that is deterministic — and a script gives the same answer every
  time, which a model does not.
- **The owner names which frames are which pose.** Never inferred.
- **Reports separate computed from guessed** (hurt boxes vs hit box, timing,
  choice of active frame), so the owner knows where to look.
- **Default timings** (wind-up 4 / active 2 / recovery 5; loops 6; reaction ~12
  total) are generic fighting-game values, **not** Hyper Dimension frame data,
  which is undocumented. Tunable by feel, never presented as faithful.
- **Editor is no longer the only writer**, so a stale save could silently
  destroy generated data. `/api/entity` now returns per-section mtimes, the
  editor remembers them, and a save that would overwrite a newer file asks
  first. Added a **Reload data** button (re-reads sections, keeps the sheet).
- **New validator warning:** a state whose animation has steps without a hurt
  box — frames where the fighter cannot be hit and nothing says so.
- **Procedure lives in a skill** (`.claude/skills/add-animation/`), not in
  `CLAUDE.md`: it is loaded on demand, so it costs nothing in sessions about
  something else. `CLAUDE.md` keeps only the principles and points at it.
- **Rejected:** rewriting the editor in Vue (the bottleneck was never the UI
  toolkit — it was the round-trip, which the new flow removes), a separate
  review tool (would duplicate the canvas and box code), and a PNG frame
  exporter for Claude to eyeball hit boxes (bought accuracy that a skeleton
  does not need; hurt boxes are the tedious part and they are computable).

## 2026-08-09 — Attacks: hit detection, `onGotHit`, keyboard layout

- **An attack is an ordinary state**, not a new concept: non-looping animation,
  `hit` boxes on its active steps, `turn: false`, recovery via
  `animEnd → idle`. New trigger **`pressed:attack`** — an *edge*, so holding the
  key does not machine-gun.
- **Getting hit is a single top-level field, `onGotHit`.** The engine forces
  that state on the defender whatever it was doing, instead of every state
  having to declare how it reacts. Same shape as MUGEN's GetHit state.
- **No `hitstun` field yet.** The reaction lasts as long as the `onGotHit`
  state's non-looping animation — timing you author in the editor regardless.
  An explicit field can come later if the animation length turns out to be the
  wrong knob. Damage and health wait for `attributes.json` (phase C): without a
  health bar there is nothing to see.
- **One hit per entry into the attack state**, tracked by the engine, so a hit
  box that stays out for several frames still lands once.
- **Collision lives in `src/hit.ts`** — pure, unit-tested, and used by the box
  overlay too, so what is drawn is exactly what collides.
- **Keyboard = the ZSNES default layout:** SNES `A`=`X`, `B`=`Z`, `X`=`S`,
  `Y`=`A`, `L`=`C`, `R`=`D`, directions on the arrow keys. Only SNES `Y`
  (keyboard `A`, the weak punch) is wired for now; the remaining buttons and a
  remapping screen come later.
- **Still out:** blocking, knockback, push-box collision between bodies (the
  fighters still walk through each other), hit sparks and sounds.

## 2026-08-08 — Vitest now; tests live in the repo, never in a scratch script

- **Vitest is in** (`npm test`), starting with `src/states.test.ts` — 18 cases
  covering the validator and the state-machine runner, including one that
  validates the entity data actually committed under `data/entities/`.
- **Brought forward from Phase E.** Three things changed: dropping the States
  editor froze the states format, so tests written now will not be rewritten;
  the validator is a *safety net*, and when a safety net breaks silently it
  looks exactly like "no problems"; and the test content already existed as a
  throwaway script.
- **The rule this replaces:** verifying logic by running a one-off script in a
  temp directory. That checks the code once, by eye, and leaves nothing that can
  fail later. If a check is worth running, it is worth committing.
- **A test that cannot fail is not a test:** new tests are confirmed against a
  deliberately broken version of the code before being kept. Done here — the
  trigger check and the one-transition-per-frame rule were each broken on
  purpose, and the suite caught both.
- Recorded in `CLAUDE.md` under the verification protocol.

## 2026-08-08 — States stay hand-authored; validator instead of a States editor

- **Phase D2 (a full States tab) is dropped for now.** The editor earns its keep
  on **spatial and timing** data — framing sprites, anchors, hitboxes, animation
  preview — where text is guesswork. States are **relational** data ("this state
  plays that animation and goes there when X"), which reads and edits well as
  text, and beats a form at copy-paste between characters, find & replace and
  git diffs. MUGEN splits the same way: sprites/boxes in a tool, states in text.
- **The real risk of hand-editing is a silent typo** in a cross-reference, not
  tedium. So we bought exactly that: `validateStates()` in `src/states.ts`
  (pure, no PixiJS) checks `initial`, that every `anim` and every transition
  target exists, that triggers are known, that `vel` is two numbers, and warns
  about states unreachable from `initial`.
- **One validator, two callers:** the game runs it at load and shows the
  problems on screen (previously a `console.warn` nobody reads); the editor's
  **States tab shows the machine read-only** with the same problems flagged.
  Save is disabled there rather than misleading.
- **Timing argument:** the states format is still moving (`hit`, `onEnter`, the
  script hook arrive with combat). Building the editing UI now means building it
  against v0 and reworking it at every extension.
- **Revisit when** a character passes ~15 states, or once combat has settled the
  format — then we will know what the tab should actually contain.

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
- ~~**Unit tests (Vitest) land at Phase E**, not before~~ — **superseded the
  same day**, see the entry below. The reasoning rested on Phase D2 reshaping the
  states format; D2 as an editing UI was then dropped, so the format stopped
  moving and the argument for waiting went with it. Pure logic
  (`src/states.ts` and successors) stays PixiJS-free either way.

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
