# 0035 — A held body is moved by whoever holds it

**Status:** accepted 2026-11-17 · consolidates 0035, 0046, 0047, 0057, 0058, 0071
and 0076 (2026-10-31 – 2026-11-06), which it replaces

A throw, a scene played on the opponent and a blow that catches all hold the
other body from **outside** it: a state of the holder says so — `grab`, `seize`,
`finale`, `frees`, `throwsFoe` — and `match/throw.ts`, `seize.ts` and
`finales.ts` move the pair each frame, as the cartridge's handler does. The held
fighter plays animations the export writes into **his** entity, one per holder and
move (`m30_<holder>_<move>`), in his own drawings and palette. Every pair of the
roster is data, not code.

**Rejected:**

- **The held fighter's own state machine placing him** — a state of his would
  have to know whom it is held by, in every fighter.
- **The held drawings in the holder's sheet** — they are the opponent's tiles, in
  his palette and lighting.
- **One field for a throw and a scene** — a throw carries the body every frame, a
  scene sets it down once and flies it; every throw would read past options it
  does not use.
- **A trigger on the opponent's state by name**, or **a fixed delay**, to wait for
  a body — names break with every fighter whose states differ, and a fall's length
  depends on who fell.
- **An ending on a fixed frame** — a scene ends when its ball lands, which depends
  on the distance.
