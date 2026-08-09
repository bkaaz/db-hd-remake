# Decisions log

Decisions that are settled. Newest first.

## 2026-08-09 — Push collision, and walking at a speed that matches the jump

- **Fighters can no longer stand inside each other.** Walking into the opponent
  pushes them, and the walker keeps advancing at reduced speed — as the original
  does.
- **The correction is split evenly between both bodies**, and that single rule
  produces the behaviour for free: a walker advancing at *v* overlaps by *v* each
  frame, gets pushed back *v/2* and moves the other *v/2*. No special case for
  who is pushing whom. If one is pinned against the edge of the stage, the other
  absorbs what is left.
- **A push body is one width per entity (`pushWidth`), not per-frame boxes.**
  Per-frame push boxes would shove the opponent every time an arm came out, and
  two fighters standing still would jitter against each other. This is how the
  genre does it. The `push` box type stays in the format for later.
- **Only grounded fighters push.** Otherwise a jump over the opponent would be
  blocked by them, which is the opposite of what a jump is for.
- **Walking was a third of jump speed** (0.83 against 2.3 px/frame), so the jump
  felt like a different game. Now 1.4 forward and 1.0 back — the jump is 1.6×
  walking rather than 2.8×.
- **The walk cycle was sped up in proportion** (12 → 7 frames a step), keeping
  the distance covered per cycle at ~20 px. Speed up the movement without the
  animation and the feet start sliding.

## 2026-08-09 — Jumping: impulse + gravity, and variants without new syntax

- **`vel` was a constant per state, which a jump cannot be.** Two fields carry
  it instead: **`launch`** — a velocity applied once on entering a state — and
  **`airborne`** — while true, gravity accumulates and the velocity carries as
  momentum rather than being re-applied. A state without `launch` leaves the
  velocity alone, which is what lets a take-off state hand its momentum to the
  airborne state that follows.
- **Gravity is an entity attribute, not a constant in code.** Opens
  `attributes.json` (phase C) with a single field rather than hard-coding it.
- **Four new triggers:** `held:up`, `falling`, `nearGround` and `landed`.
  `StateMachine.update` now takes a `Signals` object instead of a lone boolean —
  that list will keep growing. `falling` (past the apex) exists because a rise
  animation is shorter than the climb, so `animEnd` would fire while still going
  up: the phase boundaries come from the arc, not from animation lengths, and
  survive a change of jump height.
- **Jump direction needs no compound trigger.** The walking states already
  encode the held direction, so `idle → held:up` is a neutral jump while
  `walk_fwd → held:up` is a forward one. Held, not an edge, on purpose: an edge
  would be consumed by the frame that enters `walk_fwd` and the jump would
  vanish. Holding up to hop repeatedly comes out for free.
- **Phases are separate states**, because one animation cannot play a take-off
  once and then hand over: a travelling jump is take-off → somersault → fall →
  land, each its own state, chained by the triggers above.
- **Jump height is set by what it is for: clearing the opponent.** Goku is 81
  sprite px tall, so `launch [0, -7.8]` with `gravity 0.3` peaks at 101 px —
  the feet pass 20 px over the other fighter's head, comfortably but not
  absurdly. 52 frames in the air. Guessing at "higher" twice produced a jump
  three times taller than it needed to be; deriving it from the requirement
  settled it in one go. Height goes as `v²/2g`.
- **Every jump runs the same arc** — rise → `falling` → fall pose →
  `nearGround` → landing pose → `landed`. Only the rise differs: the vertical
  jump plays 14→15→16 and mirrors it back 16→15→14 on the way down (each half
  timed to the length of the climb, so the tuck happens at the apex, and
  seamless because both halves meet on 16);
  the travelling jumps play a take-off frame and **one** somersault, then hold
  the fall pose. The original does one rotation, not a spin loop.
- **The falling pose is the extended one (14), the landing pose the tucked one
  (15)** — legs dangling on the way down, knees drawn up to absorb. The reverse
  was tried first and read wrong.
- **Landing starts in the air.** A landing pose entered on touchdown is a
  flicker nobody sees, so `nearGround` (falling, and within the `landCue`
  attribute) hands over on the way down. `landCue` is a distance, but what it
  buys is frames, and that depends on the jump: 60 px is ~7 frames of this one.
  The landing state is itself `airborne` — still falling — and ends on `landed`.
- **Anchors decide whether a transition pops.** Frame 14 sat 93 px below its
  head and frame 15 only 77, so switching between them jumped the character by
  16 px. Anchors are per-frame offsets, so the fix is arithmetic: align the head
  (both now 77) and accept that 14's extended legs hang below the reference
  point, which is what an airborne pose should do anyway.
- **Somersault anchors were re-centred.** Auto-detection puts an anchor at the
  bottom of the frame, which for a rotating body means swinging around the feet
  and jittering between frames. The four spin frames now anchor on the
  silhouette's centre of mass, offset downward by the same distance the standing
  pose has between its centre of mass and its feet (38.7 px) — so the body
  rotates in place and keeps a consistent height.
- Frames confirmed against the contact sheet: rise 14, tuck 15 → 16, forward
  take-off 19, somersault 20→23 (and reversed for the back jump). The owner's
  first list, from memory, had the tuck frames wrong — the catalogue caught it.

## 2026-08-09 — A frame catalogue: what each sprite is, written down once

- **Problem:** which sprite is which pose lived only in the owner's head and was
  re-asked for every animation. That does not scale to ~10 characters, and it
  had already produced one mis-described set of frames.
- **`data/entities/<name>/descriptions.json`** — a section file with `groups`
  (frames per move, non-exclusive) and `frames` (a line per sprite). A leading
  `?` marks a guess, to be settled when the move is built rather than argued
  about up front. Group name matches the animation name when the group is one
  move, so the link needs no field.
- **Descriptions are written from looking**, via `npm run sheet` — a contact
  sheet with the frame numbers **burnt into the image**, because "count from the
  left" is exactly how a description lands on the wrong frame. Uses the PNG
  encoder added alongside the existing decoder; still no dependency.
- **Described on demand**, for the range being worked on. Describing all 219
  frames up front would produce text nobody verifies, that gets re-read anyway.
- **Rejected: a `sequence` field in the catalogue.** It would duplicate
  `animations.json` *and* be stale by construction, since the owner tunes the
  animation afterwards — turning the catalogue into both an input and a rotting
  copy of an output. Multiple use of a frame (a guard pose is the wind-up *and*
  the recovery: `32 → 33 → 32`) is recorded as prose in that frame's
  description instead.
- **Honest limit:** a sheet holds poses, not a recording. Which frames form a
  move, and roughly in what order, can be read off it; the true order and timing
  cannot. Those stay the owner's knowledge. Derived timings are never presented
  as Hyper Dimension frame data.
- **`npm run anim` now keeps existing durations** when the frame list is
  unchanged. It had twice overwritten timings the owner had tuned by hand; the
  script writes blindly where the editor asks first. When the frame list does
  change, defaults return and the previous values are printed.

## 2026-08-09 — Frame numbering: reading order, plain numbers, renumber by hand

- **Detection numbered frames by top edge**, so a taller pose starting a few
  pixels higher stole a lower number from the sprite to its left. Sheets are
  laid out in rows and neighbouring sprites belong together, so numbering must
  follow the layout: **group into rows by vertical overlap, then left to right**
  (`tools/entity-editor/src/rowOrder.ts`, pure and unit-tested; a rect joins a
  row when it shares at least half its height with it, so a tall sprite cannot
  swallow the row below).
- Confirmation the rule is right: with it, Goku's idle becomes 6,7,8 and the
  air spin becomes 20,21,22,23 — both consecutive, where before they were
  8,6,7 and 23,21,22,20.
- **Frame ids are plain numbers** (`"33"`), not `frame_33`. They *are* positions
  on the sheet; the prefix was noise the sheet view already stripped for
  display. Kept as strings because JSON keys are strings — and integer-like keys
  serialise in numeric order, so `frames.json` stays sorted for free.
- **Renumbering is manual and swaps.** Typing a number over a frame's id
  renumbers it; if that number is taken the two frames trade places, since
  renumbering is how an ordering mistake gets fixed and refusing would force a
  dance through a temporary number. Animation steps follow both ways.
- **Animation steps take a typed number, not a dropdown** — a `<select>` of 220
  frames is unusable. An unknown number is rejected and flagged.
- Existing data was migrated in place (one-off, in the shell) rather than by
  re-detecting, which would have discarded hand-adjusted frame rectangles.
  Only ids changed; rects, timings and boxes were untouched.

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
