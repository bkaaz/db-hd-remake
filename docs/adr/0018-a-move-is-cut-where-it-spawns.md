# 0018 — A move is cut where it spawns; its objects are spawn entities

**Status:** accepted 2026-10-29 · extends 0017 (it names the parts)

An object a script starts with `b0` — the ki blast, the transformation's hair
— is exported as a **spawn entity** of its own (ADR 0007), into
`data/spawns/<name>/`, and the move that starts it is **cut there**: `m9b`
runs up to the blast, `m9b_2` from it on, because a state fires its spawn on
entry. A spawn before anything is shown stays with the first part.

What the exporter knows about an object that the data does not say — its
frame timings and whether it hits — is listed per fighter in
`src/rom/cartridge.ts` (`objects.spawns`), from a recording of the object
slots, since each object type's own code holds it. A spawn's `states.json`
(speed, damage) is written by hand, like a fighter's.

**Rejected:**

- **A delay on `fires`** (fire N frames after entry). It would put the
  original's timing in a second place — the state — beside the animation
  that already has it.
- **Compositing an object into the fighter's frames.** The hair overlay
  happens to step with the drawings it sits on, but the ki blast flies off,
  and two mechanisms for one command is one too many.
- **Reading object timings from their code now.** Each object type is its
  own routine in bank `$0F`; one recording gave the two we need.
