# 0042 — A move flies by a timeline on its state

**Status:** accepted 2026-10-31

A state's `air` lists what the move's handler sets on frames of the state:
vx, vy, gravity (a number, or the fighter's own) and `toApex`, a gravity
that only slows a rise. The first `vy` takes the body off the ground;
before it the state is a ground state and `vel` / `velAt` move it. The
arithmetic is `src/entity/air.ts`; the entity applies a frame's entries
before it moves the body, the original's order.

It is what Jumping Knee Slash (`a4`) needs — off the ground at its frame
16 with gravity off, slowed to a hang, gravity back at 42 — and what
Abiseh Geri (`a6`) needs: off at 8, its speed changed twice in flight.

**Rejected:**

- **A `launch` at a frame** — covers the take-off and nothing after it.
- **A state per change of speed** — the knee slash would be cut at 16, 24
  and 42 for physics alone; parts are for what a state waits on (0018,
  0023, 0028), not for arithmetic.
- **`rehit`'s kind of interval for the re-arms** — the handler re-arms on
  named frames; those are parts (0043).
