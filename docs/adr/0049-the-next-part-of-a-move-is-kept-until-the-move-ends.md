# 0049 — The next part of a move is kept until the move ends

**Status:** accepted 2026-11-01

A move whose handler reads the command for the move after it while it plays
— Vegeta's Sliding Kick `a4` → Rushing Knee `a5` → Cross Punch `a6`
(`rom.md`, "A move that reads the next one") — is a transition with
`queued: { from }`: from that frame of the state, the first time its `when`
holds it is kept and its press spent, and it is taken when the animation
ends, ahead of every other way out. Forcing a state (a hit) forgets it
(`src/entity/states.ts`, `Transition.queued`).

A special's entry from a state with no plain press of its button goes first
in that state (`src/rom/specials.ts`) — `stand_up` asks for commands as
idle does (`$0F:9EB1`) but has no button of its own.

**Rejected:**

- **Our cancel windows (`cancelable`)** — they cut the move short at the
  press; the original plays `a4` to its last frame, hit or miss.
- **A longer input buffer** — `a4` reads for 36 frames; a press that lives
  that long would start moves nobody asked for everywhere else.
- **Checking the press at `animEnd`** — the press is long gone by then, and
  the motion's window with it.
- **A trigger that remembers** (`queued:…` beside `released:`) — the kept
  thing is the transition, not a fact about input; a trigger would need a
  second name for its target.
