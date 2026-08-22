# Open questions

Decisions we still owe answers to. We resolve these before they block work.

**A resolved question is deleted from this file**, in the change that resolves
it — the answer goes to [`adr/`](./adr/) if it is architecture and to
[`combat.md`](./combat.md) if it is gameplay, and that is then the only place it
lives. Numbers are never reused. Like `plan.md`, this file only shrinks: an
entry marked *resolved* and left here reads exactly like a live one, which is
how a file stops being read at all.

## Scope & vision

- **Q1 — Remake fidelity:** 🟡 Partially resolved — **gameplay is ours**, and
  deliberately not faithful: the owner dislikes the original's combat and that
  is a main reason the remake exists (`combat.md`). The sprites,
  the roster and the look stay Hyper Dimension. Still open: how much of the
  presentation beyond that (stage planes, HUD, round flow) we keep.
- **Q2 — First playable slice:** which characters/stage/moves define "done" for
  the first milestone?
- **Q3 — Single-player scope:** do we want AI opponents, story mode, or is local
  2-player (same keyboard) enough to start?

## Game facts to confirm (see game-overview.md)

- **Q5 — Core mechanics:** 🟡 Partially resolved — shared health/Ki bar, Rush
  Battle System, desperation moves and four-button controls are confirmed. Still
  open: exact **move sets, inputs, frame data, hitboxes, round rules**.
- **Q6 — Reference material:** 🟡 Partially resolved — using Wikipedia + ripped
  sprite sheets (Spriters Resource / Sprite Database) + emulator observation.
  Still open: does the owner want to base "feel" on specific gameplay footage?

## Hardcoding: what is cheap to leave, and what gets expensive

Raised by the owner on 2026-08-14, reading `main.ts` after the split. Nothing
here is a bug — it is the shape of a game with one fighter, one opponent, one
screen and no menu. The question is never "is this hardcoded" but **what does
leaving it cost, and when does that bill arrive.**

- **Q9 — `boot()` is still one long function.** ⏸ Deferred on purpose — most of
  its length is building a fight, which moves into `FightScene`. Fixing it before
  that means fixing it twice.
- **Q15 — How a scene *changes* to the next one.** What a scene is, and how one
  is entered, is settled ([ADR 0008](./adr/0008-a-scene-is-what-its-parameters-say.md));
  what a scene says when it wants to be replaced is not. Deliberately left until
  there are two screens to move between, which is the first moment the answer
  can be judged rather than guessed.

## Technical

- **Q7 — Logical resolution:** target internal resolution and scaling approach.
  Now has a concrete consequence: entities' world positions are kept in screen px
  at a fixed `SCALE`, while authored data (boxes, `vel`) is in sprite px. Moving
  the world to a logical resolution changes the engine only — authored data
  keeps its meaning. Decide before the world grows (stages, camera).
- **Q8 — Multiplayer:** local only, or eventual online? (Affects architecture.)
  Deliberately left open rather than answered by default: the expected opponent
  is the CPU, but combat is designed as if a second human will arrive, because
  a versus-sound system also plays well against the CPU and not the reverse.
  See [`combat.md`](./combat.md).
