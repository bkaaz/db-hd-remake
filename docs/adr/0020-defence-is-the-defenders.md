# 0020 — Defence is the defender's, taken before scaling

**Status:** accepted 2026-10-29

A fighter has a `defence` attribute, and every blow it takes loses that much
before the combo scales it, never going below nothing (`afterDefence` in
`combat/scaling.ts`). It is the cartridge's own rule — damage = the
attacker's table entry − the defender's defence (`rom.md`, Hit data) — so a
fighter read from the cartridge carries the original's numbers unchanged: the
blow its raw damage, the fighter its defence. `src/rom/hits.test.ts` holds
`goku`'s states to the cartridge's table.

Defaults to 0, so a fighter built by hand is untouched.

**Rejected:**

- **Subtracting a defence by hand when copying a blow's damage.** Goku's 27
  would have become 19, which is right only against Goku: the defence belongs
  to whoever is hit, and every second fighter would mean recomputing every
  first one's blows. The copy also could no longer be checked against the
  cartridge.
- **Defence after scaling.** The original has no scaling, so its numbers hold
  for an opener; taking defence last would let a long combo's late blows
  drop to nothing, which `scaledDamage`'s floor of one exists to prevent.
