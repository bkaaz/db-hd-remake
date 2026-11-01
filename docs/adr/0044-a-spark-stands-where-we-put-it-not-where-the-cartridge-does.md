# 0044 — A spark stands where we put it, not where the cartridge does

**Status:** accepted 2026-11-01

The cartridge's sparks and explosions (`hit_spark`, `guard_spark`, the
bursts) are drawn where ours always were: a melee blow's spark at
`impactPoint` — the leading edge of the boxes' overlap
(`src/combat/hit.ts`) — and a projectile's burst at the overlap's middle
(`src/match/blow.ts`). Which effect appears follows the original; where it
appears does not.

**Rejected:**

- **The original's place** (`$2A:8D63`): the mean of the four edges of
  the two boxes that touched, which is halfway between their centres, not
  inside the overlap. A fist sunk into a large hurt box puts the spark
  halfway into the body, away from the fist. The owner judged it the
  original's flaw, and the position feeds nothing else, here or in the
  cartridge, so keeping ours costs nothing.
