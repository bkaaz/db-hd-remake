# 0002 — The defender's situation is a flag, not a state name

**Status:** accepted 2026-08-15 (`airborne` / `ifAirborne`) · extended 2026-08-22
(`crouching` / `ifCrouching`) · builds on [0001](./0001-the-blow-names-the-reaction.md)

A defender who is in the air, or low, takes a blow differently. That is
expressed as a **flag on the state** and a **redirect on the reaction** — never
as an attack knowing where its victim was, and never as the engine knowing the
name of a state.

An attack still names one `onHit` and gets the right version for free.

**Rejected: an `onHitAir` beside every `onHit`.** Wrong axis. There are three
ways to be hit and there will be dozens of attacks: a blow that knocks you over
knocks you over whether or not you were jumping. What being airborne changes is
the pose and the impulse, and both belong to the reaction.

**Rejected: a rule in the engine** — "if the defender is crouching, use the
crouching version". It puts a state name into code that has no business knowing
any, and it would force every fighter to spell their stances the same way.

## What the flag buys that a state name cannot

**It composes through a string.** The situation outlives the stance: by the
second blow the defender is in `hurt_crouch`, not in `crouch`. Marking the
*reaction* `crouching` as well is what makes the redirect keep working — where a
state name would have to be remembered and re-linked by hand.

**Severity travels with it.** Rank is compared *after* the redirect, so a
reaction may name an air version that outranks it: one blow flinches a standing
opponent at rank 1 and lifts a falling one at rank 3. That is how a light chain
link can juggle a body its own launcher put in the air, with no engine change.

**One hop, and only on a forced entry.** A redirect that chains is a loop
waiting to be authored, and a state the fighter *chose* was never the problem.
Both are pinned by tests.

## Still open

`StateDef.guard` predates the flag and answers a question this ADR already
answers — see [0004](./0004-guarding-is-decided-at-contact.md). Now that
`crouching` exists it could become `guard_hit.ifCrouching`, which would delete
the field, its validator warning and one hand-written self-reference for
identical behaviour. Not done unasked, because the guard shipped and was
verified by recording hours before the flag existed.
