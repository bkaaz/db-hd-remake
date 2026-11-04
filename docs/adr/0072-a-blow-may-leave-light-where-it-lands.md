# 0072 — A blow may leave light where it lands

**Status:** accepted 2026-11-04

Rushing Suki Combo's handler (`ae`, `rom.md`) draws its effects from what a blow
did, not from its script: a ball at each landed blow's spark, a column over the
last. The state says `hitLight` and `combat/hitLight.ts` owns the light, which
starts on the frame after the hit's pause and outlives the state that struck.
`paletteRun` runs a state through palettes exported as `run0` … (`runPalettes`).

**Rejected:**

- **A generated spark entity for the ball** — it is added light in the
  original's own circle, as the charging ball is (`combat/ball.ts`), not a
  sprite, so `add-effect`'s rules do not apply to it.
- **`ball` on the states** — that sits at the fighter's hands, and the state it
  belongs to is over before this light is.
- **Picking the palette run by player, as the code does** — the entity knows its
  colours and not its side, and the two lists differ only in those colours.
