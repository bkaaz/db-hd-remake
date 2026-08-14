# Open questions

Decisions we still owe answers to. We resolve these before they block work.
Move resolved ones into [`decisions.md`](./decisions.md).

## Scope & vision

- **Q1 — Remake fidelity:** faithful recreation, modernized reimagining, or a
  minimal "core combat" slice first?
- **Q2 — First playable slice:** which characters/stage/moves define "done" for
  the first milestone?
- **Q3 — Single-player scope:** do we want AI opponents, story mode, or is local
  2-player (same keyboard) enough to start?

## Game facts to confirm (see game-overview.md)

- **Q4 — Roster:** ✅ Resolved — 10 fighters confirmed (see `game-overview.md`).
- **Q5 — Core mechanics:** 🟡 Partially resolved — shared health/Ki bar, Rush
  Battle System, desperation moves and four-button controls are confirmed. Still
  open: exact **move sets, inputs, frame data, hitboxes, round rules**.
- **Q6 — Reference material:** 🟡 Partially resolved — using Wikipedia + ripped
  sprite sheets (Spriters Resource / Sprite Database) + emulator observation.
  Still open: does the owner want to base "feel" on specific gameplay footage?

## Hardcoding: what is cheap to leave, and what gets expensive

Raised by the owner on 2026-08-14, reading `main.ts` after the split. Nothing
here is a bug — it is all the shape of a game that has exactly one fighter, one
opponent, one screen and no menu. The question each time is not "is this
hardcoded" but **what does leaving it cost, and when does that bill arrive.**

Deliberately not answered in one sitting; each gets its own conversation.

- **Q9 — `boot()` is still one long function.** ⏸ Deferred on purpose — most of
  its length is building a fight, which moves into `FightScene`. Fixing it before
  that means fixing it twice. See `decisions.md`, 2026-08-14.
- **Q10 — Constants have no home.** ✅ Resolved — they mostly already do. No
  constants file; a value lives beside its only user. The two genuinely shared
  ones define units, not tuning. See `decisions.md`, 2026-08-14.
- **Q11 — `"goku"` is written into `main.ts`.** ✅ Resolved — it is a scene
  parameter, not a constant, and the URL supplies it (Q13).
- **Q12 — Effects and sounds are tied to one entity.** ✅ Resolved — one game-wide
  sound bank in `data/audio/`, voices stay with the fighter, effects move to
  `data/fx/`. See `decisions.md`, 2026-08-14. Migration is queued in `plan.md`.
- **Q13 — One scene, assumed everywhere.** ✅ Resolved — a scene is built from
  plain parameters, chosen by the URL. See `decisions.md`, 2026-08-14. Still
  open, and deliberately so: how a scene *changes* to the next one. That gets
  decided when there are two scenes to move between.
- **Q14 — Getting straight to a scene while developing.** ✅ Resolved with Q13 —
  it is not a separate feature. A scene describable by parameters can be entered
  by anything that can supply them, the URL included.

## Technical

- **Q7 — Logical resolution:** target internal resolution and scaling approach.
  Now has a concrete consequence: entities' world positions are kept in screen px
  at a fixed `SCALE`, while authored data (boxes, `vel`) is in sprite px. Moving
  the world to a logical resolution changes the engine only — authored data
  keeps its meaning. Decide before the world grows (stages, camera).
- **Q8 — Multiplayer:** local only, or eventual online? (Affects architecture.)
