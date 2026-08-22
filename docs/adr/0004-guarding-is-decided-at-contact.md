# 0004 — Guarding is decided at contact, and the stance names its own block

**Status:** accepted 2026-08-10 · extended 2026-08-22 (`StateDef.guard`) ·
related to [0002](./0002-the-defenders-situation-is-a-flag.md)

**There is no guard state to stand in.** Holding away from the opponent is
already `walk_back`, so a blocking stance would compete with walking for the same
input. Instead the engine asks, at the moment a blow connects, whether the
defender is holding away — which is also how the genre has always worked: the
guard pose appears on an attack that actually arrives, never as something you
stand around in.

`onGuard` is the mirror of `onGotHit`: one top-level field naming the block
reaction, and a fighter without it simply cannot block. Both count as entry
points for the unreachable-state check, since neither is ever transitioned into.

**The looping guard stance was built first and thrown away the same hour.** With
no stance to stand in, an idling guard has nobody to play it.

## How you cover is a fact about you

A stance may name its own block with `StateDef.guard`, falling back to the
file's `onGuard`. `crouch` names `guard_crouch`.

**On the stance, not on the attack.** The same jab is blocked standing or
crouching depending on what the *defender* was doing, so the field belongs where
that fact lives. An attack that must not be blocked low is a different question,
would hang off the attack, and does not exist yet.

**And not a rule in the engine** — see [0002](./0002-the-defenders-situation-is-a-flag.md).
The rule is `guardStateFor` in `src/entity/states.ts`, beside `guardable`, so it
is pure and tested in Node rather than a line inside the PixiJS half.

**A block blocks the way it already is**, so `guard_crouch` names itself. This is
the part that was wrong first and is not obvious: because a block can block again
(`guard_hit` has no rank, deliberately — `combat.md` §7), the second blow of a
blocked string arrives while the defender is still *in* the first block. The
state being asked how to cover is `guard_crouch`, not `crouch`; naming no guard
of its own it fell back to `onGuard` and stood the fighter up mid-string. The
general fallback stays right for `guard_hit`.

What makes that safe for the next fighter is not the fix but the **validator
warning**: a state used as a block whose own block resolves elsewhere is
reported, because forgetting the self-reference is silent until somebody blocks
twice in a row.
