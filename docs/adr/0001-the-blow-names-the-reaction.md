# 0001 — The blow names the reaction

**Status:** accepted 2026-08-09 · extended 2026-08-15 and 2026-08-22 by [0002](./0002-the-defenders-situation-is-a-flag.md)

An attack state's `onHit` names a state on the **defender**. The defender's own
`onGotHit` is the fallback, so an attack that says nothing still produces a
reaction rather than silence.

**Rejected: the defender inspecting what hit it.** It puts the knowledge in the
wrong place — what separates a jab from a smash is a property of the blow — and
it grows with every attack anyone adds, in every fighter that can be hit.

## What follows from it

**A reaction name is a shared vocabulary, implemented per fighter.** `hurt`,
`hurt_heavy`, `knockdown` mean the same thing across the roster, but each entity
provides its own. The validator can therefore only check the attacker's own
states, which is why an unknown `onHit` target is a **warning** and not an
error — and why a reaction counts as an entry point when hunting unreachable
states: nothing ever *transitions* into one.

**The precedence is one pure function**, `reactionFor` in `src/entity/states.ts`,
so the rule is stated once and tested in Node rather than being an `??` buried in
the render loop. It takes the defender's whole state rather than a bare flag —
one argument that says "here is the situation" beats two that each carry a piece
of it.

**It started the family.** Everything else a blow decides took the same shape —
an optional field on the attack state over an entity-wide default: `damage`,
`hitstop`, `hitstun`, `hitFx`, `sound` / `hitSound` / `blockSound`, `smash`. Any
new property of a blow belongs there too, not on the defender and not in the
engine.

**Knockback needed no machinery.** A reaction faces its attacker, so a negative
`vel` x is already "backwards, away" and it slides for as long as the reaction
holds. The distances themselves are tuning and live in `combat.md`.
