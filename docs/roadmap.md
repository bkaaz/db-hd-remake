# Roadmap (rough)

High-level phases. Deliberately loose — we go slowly and confirm scope as we go.

> **One phase numbering, not two.** Day-to-day work follows the lettered phases
> **A–F** in [`entity-editor.md`](./entity-editor.md) — each is a vertical slice
> (data model + editor + engine + verification). This file is only the wider arc
> around them.

## Stage 0 — Setup ✅ done

- [x] Repo, tooling (TS + Vite + PixiJS), runnable boot
- [x] Docs skeleton
- [x] Dev server + editor run locally

## Stage 1 — Asset pipeline ✅ done

- [x] Entity Editor: sheet loading, background color-key, auto-detection,
      frames + anchors, timed animations, hit/hurt/push boxes
- [x] Repo-integrated I/O (Vite dev-server plugin, per-section save)
- [x] BYOA asset strategy + `fetch-assets` / `hash-assets`
- [x] Entity data format v0 ([`data-format.md`](./data-format.md))

## Stage 2 — Fighting core 🟡 in progress

Tracked in detail as phases A–F in [`entity-editor.md`](./entity-editor.md).

- [x] Rendering authored animations in the game (60 FPS, per-step duration)
- [x] Hitbox/hurtbox/push authoring + in-game overlay (phase B)
- [x] State machine: `states.json`, opponent-relative facing, idle/walk (D1)
- [ ] States tab in the editor (D2)
- [ ] Commands / input buffer / motion recognition (E) — plus unit tests
- [ ] Attributes: HP, speeds, gravity (C)
- [ ] Attacks: hit detection, damage, hitstun, blockstun, knockback
- [ ] Jumping + gravity; push-box collision between fighters
- [ ] Sounds (F)

## Stage 3 — A match

- [ ] Two fighters, both player-controlled (same keyboard)
- [ ] Health/Ki bar (the original's single shared resource)
- [ ] Round rules, win/lose, a stage

## Still undecided

Scope of the remake (faithful / reimagined / minimal slice) and what defines the
first playable milestone — see [`open-questions.md`](./open-questions.md) Q1–Q2.
Art, audio, full roster and modes are intentionally left undefined.
