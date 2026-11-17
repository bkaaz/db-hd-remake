# 0019 — A blow is a state; its type says how it is taken

**Status:** accepted 2026-11-17 · consolidates 0001, 0002, 0004, 0015, 0019 and
0020 (2026-08-09 – 2026-10-29), which it replaces

A blow is an attack state: **which animation** (poses, boxes, timing), **which hit
type** from `data/hit-types.json` (the reaction and its hitstun, hitstop and
relaunch, shared by every fighter) and **its own `damage`**, less the defender's
`defence` before the combo scales it. The type names the reaction; the
defender's state redirects it by a flag of its situation (`ifAirborne`,
`ifCrouching`), one hop, on a forced entry only. Guarding is decided at contact,
and the stance names its own block. How each of these plays: `combat.md`.

**Rejected:**

- **The defender inspecting what hit it**, or **the engine knowing a stance by
  name** ("if crouching, use…") — the knowledge goes in the wrong place and grows
  with every attack in every fighter.
- **`onHitAir` beside every `onHit`** — the wrong axis: three situations, dozens of
  attacks.
- **A state overriding one of its type's numbers** — per-blow tuning under another
  name; a blow that needs other numbers is another type.
- **Damage on the type**, as a value or a default — the cartridge's damage is per
  blow, its reaction one of a few kinds; one number in two places.
- **Defence subtracted by hand when copying a blow**, or **after scaling** — it
  belongs to whoever is hit, and a late blow of a long combo would drop to nothing.
- **A guard state to stand in** — it would compete with walking back for one input.
