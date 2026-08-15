# Docs

Design notes and decisions for the DBZ: Hyper Dimension remake. This is where we
collect what we want to build **before** writing gameplay code.

## Index

- [`plan.md`](./plan.md) — **the queue.** Start here for "what's next". It is
  the only file that lists work to do, and finished items are deleted from it.
- [`game-overview.md`](./game-overview.md) — what the original game is, what we
  know for sure, and what still needs confirming. Context, not requirements:
  the combat system is ours.
- [`combat.md`](./combat.md) — the fight we are building toward, and why each
  part is there. The shape, not a schedule.
- [`assets.md`](./assets.md) — where graphics/audio come from and how much can be
  automated (research findings).
- [`tooling.md`](./tooling.md) — the asset pipeline: our own browser editor
  (sprite-sheet-first; MUGEN import parked) and its repo-integrated I/O.
- [`entity-editor.md`](./entity-editor.md) — the Entity Editor: its data model,
  its tabs, and the phases it was built in (history, not a schedule).
- [`data-format.md`](./data-format.md) — the character file format (the contract
  between the entity editor and the engine).
- [`tech-stack.md`](./tech-stack.md) — technology choices and why.
- [`roadmap.md`](./roadmap.md) — the wider arc, from setup toward a playable
  prototype. No work items; those are in `plan.md`.
- [`bugs.md`](./bugs.md) — what is known to be broken. Not a queue; write an
  entry the moment you notice one, delete it when it is fixed.
- [`open-questions.md`](./open-questions.md) — decisions we still owe answers to.
- [`decisions.md`](./decisions.md) — log of decisions already made.

## Ground rule

We **don't guess**. Anything about the original game that we aren't certain of
is marked **(TBC — to be confirmed)** rather than invented. Facts get confirmed
before they drive implementation.
