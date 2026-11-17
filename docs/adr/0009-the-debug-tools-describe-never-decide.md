# 0009 — The debug tools describe the fight; they never decide it

**Status:** accepted 2026-11-17 · consolidates 0006, 0009 and 0010 (2026-08-15 –
2026-08-16), which it replaces

- **The dummy plays a timeline**, never a condition (`src/debug/dummy.ts`): steps
  of an action or a number of frames, a direction held and a button pressed once,
  its clock stopped while its body is frozen.
- **A recording describes, never computes** (`src/log.ts`, `match/record.ts`, `L`):
  events, not frames, each line carrying both fighters and the gap since the last,
  with presses entering and leaving the buffer.
- **The chain graph is derived** from `states.json` and the animations by one
  function (`combat/chains.ts`) that `npm test`, `npm run chains` and the editor
  share.

**Rejected:**

- **A dummy that reacts** ("if he blocked…") — a second state machine without a
  validator; an AI written by accident.
- **A recording printing what the game did not work out** — a log that changes
  the game to suit itself.
- **A table of links written down**, or **a test with its own arithmetic** — wrong
  the first time a number moves, and two formulas disagree by a frame.
