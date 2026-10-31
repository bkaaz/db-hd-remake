# 0039 — A fighter pushes with his drawing's body and head

**Status:** accepted 2026-10-31 · replaces the one-number body for every
entity that authors `push` boxes (`data-format.md`, which said they were unused)

The cartridge keeps two fighters apart with two rectangles per drawing —
slot 0 the body, slot 1 the head (`$2A:80ED`, `rom.md`, Bodies) — tested in
the plane, each against each, and pushes each fighter half the overlap
along x. The export writes both as `push` boxes on every step
(`src/rom/collision.ts`); `Fighters.pushApart` uses them, in the air too,
through `bodyOverlap` and `pushApart` in `src/combat/push.ts`. A drawing
without them (lying) pushes nothing; a held fighter pushes nothing. An
entity whose animations author no `push` box — `goku_old` — keeps
`pushWidth` and `Entity.solid`, solid only on the ground.

**Rejected:**

- **Keeping the fixed width and making an airborne body solid** — no
  height, so a jump could never pass over anyone, and still not what the
  original tests.
- **Body against body only** — the head box decides when one fighter drops
  onto the other's shoulders; the cartridge tests all four pairs.
- **Reading the one number from slot 0 per drawing** — a width without a
  height is the bug this replaces.
