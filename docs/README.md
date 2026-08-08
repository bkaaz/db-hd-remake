# Docs

Design notes and decisions for the DBZ: Hyper Dimension remake. This is where we
collect what we want to build **before** writing gameplay code.

## Index

- [`game-overview.md`](./game-overview.md) — what the original game is, what we
  know for sure, and what still needs confirming.
- [`assets.md`](./assets.md) — where graphics/audio come from and how much can be
  automated (research findings).
- [`tooling.md`](./tooling.md) — the asset pipeline: our own browser editor
  (sprite-sheet-first; MUGEN import parked) and its repo-integrated I/O.
- [`entity-editor.md`](./entity-editor.md) — **the active plan**: the Entity
  Editor (sprites, animations, hitboxes, sounds, inputs, states) and the
  lettered phases A–F we work through. Start here for "what's next".
- [`data-format.md`](./data-format.md) — the character file format (the contract
  between the entity editor and the engine).
- [`tech-stack.md`](./tech-stack.md) — technology choices and why.
- [`roadmap.md`](./roadmap.md) — rough phases, from setup toward a playable
  prototype.
- [`open-questions.md`](./open-questions.md) — decisions we still owe answers to.
- [`decisions.md`](./decisions.md) — log of decisions already made.

## Ground rule

We **don't guess**. Anything about the original game that we aren't certain of
is marked **(TBC — to be confirmed)** rather than invented. Facts get confirmed
before they drive implementation.
