# Roadmap — the wider arc

Where the project is going, in broad strokes. **This file lists no work.** The
queue is [`plan.md`](./plan.md), and it is the only one — see `CLAUDE.md`.

## Stage 0 — Setup ✅ done

Repo, tooling (TS + Vite + PixiJS), a runnable boot, docs skeleton, dev server
and editor running locally.

## Stage 1 — Asset pipeline ✅ done

The Entity Editor (sheet loading, background color-key, auto-detection, frames +
anchors, timed animations, hit/hurt/push boxes), repo-integrated I/O via the
Vite dev-server plugin with per-section save, the BYOA asset strategy with
`fetch-assets` / `hash-assets`, and entity data format v0
([`data-format.md`](./data-format.md)).

## Stage 2 — Fighting core 🟡 in progress

Authored animations run in the game at 60 FPS, boxes are authored and drawn,
and an entity is a state machine (`states.json`, opponent-relative facing).
Goku walks, punches, takes hits, jumps and pushes the opponent; hits connect
but cost nothing. The rest of this stage — impact, hitstop, effects, the full
move set, health, blocking, input commands, sounds — is queued in
[`plan.md`](./plan.md).

## Stage 3 — A match

Two fighters both player-controlled on one keyboard, the health/Ki bar (the
original's single shared resource), round rules and win/lose, a stage.

## Still undecided

Scope of the remake (faithful / reimagined / minimal slice) and what defines the
first playable milestone — see [`open-questions.md`](./open-questions.md) Q1–Q2.
Art, audio, full roster and modes are intentionally left undefined.
