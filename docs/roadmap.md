# Roadmap (rough)

High-level phases. Deliberately loose — we go slowly and confirm scope as we go.
Nothing past Phase 0 is committed yet.

## Phase 0 — Setup ✅ (in progress)

- [x] Repo, tooling (TS + Vite + PixiJS), runnable empty boot
- [x] Docs skeleton
- [ ] `npm install` verified, dev server runs and renders the placeholder

## Phase 1 — Design on paper (next)

- [ ] Confirm the game's facts (roster, mechanics) — fill in the **(TBC)** gaps
- [ ] Decide remake scope: faithful vs. reimagined vs. minimal slice
- [ ] Define the **first playable slice** (e.g. one stage, two placeholder
      fighters, move + jump + block)

## Phase 2 — Core engine skeleton

- [ ] Fixed-timestep game loop
- [ ] Scene/state management (menu, match)
- [ ] Input system (keyboard first)
- [ ] Placeholder fighter that moves on a stage

## Phase 3 — Fighting core

- [ ] Character state machine (idle/walk/jump/attack/hit/block)
- [ ] Hitboxes / hurtboxes, collision, frame data
- [ ] Health + energy resources
- [ ] One special move end-to-end

_Later phases (art, audio, full roster, modes) intentionally left undefined._
