# 0043 — A re-armed blow is a part, and parts are cut in one place

**Status:** accepted 2026-10-31 · extends 0023

Where a move's handler re-arms the blow (`$0D:D8A2`) while a hit box is
out, the export cuts a part, so the state that plays it brings a fresh
swing — and takes the record of its own first striking step, which can
differ: Jumping Knee Slash is light 42, heavy 24, then a knockdown at 19.
Quadruple Kick's last kick, re-armed at 70, is two parts.

How a move is cut — blows, handler jumps, re-arms, cuts by other moves'
handlers, by hand — and which record each part's blow takes is
`src/rom/parts.ts`, read by the export, `port` and the check of a state's
blow (`animBlow.ts`). Each used to cut on its own; `animBlow` took
`mNN_k` for the k-th blow, which a re-armed part is not.

**Rejected:**

- **`rehit`** — an interval, where the cartridge names frames, and one
  record for every hit.
- **Re-arming inside a state** — a state names one blow; a second record
  on the same state would be a second way to say what a part says.
