# 0003 — A state is a role, an animation is a shape

**Status:** accepted 2026-08-09 · completed 2026-08-15 by the one-animation /
two-states split, which is the first time it was needed rather than argued for

**A state's name says its role; an animation's says its shape.** `punch_hook`
and `kick_roundhouse` are poses. `kick_high` and `kick_high_chain` are two roles
playing one of them — the standing heavy, which *wants* a big knockback because
it creates space, and the middle link of a string, which must not push the
victim out of reach of the next blow. No single number satisfies both, and no
second drawing was needed to say so.

That split is what makes reuse work: one animation, several states, different
damage and different reactions depending on where in a chain — or in a special —
it sits. Stance is part of a move's identity where it binds one (`kick_crouch`,
`kick_air`), because those are not interchangeable variants of one pose.

**Rejected: `punch_1`, `punch_2`, …** The number encodes the order frames
happened to appear on the sheet, which is a fact about the sheet and not about
the blow. `"anim": "punch_3"` cannot be read without opening a second window,
and across fighters the same number would mean nothing in common.

**Rejected: a `moves.json`.** A combo needs no definition of its own: an
animation is the pose, a state is the consequence, a chain is a path through the
states. A parallel structure would be a second source of truth to reconcile. If
the repetition between chain links ever hurts, the cure is a `like` field on a
state — built when it hurts, not before.

## A role means the same thing however you were put into it

Two routes lead into a state: the transition the machine chooses, and the
reaction the engine forces on a fighter who has been hit. **Both run one
`enterState()`.** They did not once, and a knockdown's impulse was dead code from
the day it was written — applied on the chosen route, and a knockdown is only
ever forced. Fixing the second place rather than merging the two would have
re-sprung the trap at the next field added to `StateDef`.

**A pose several states fall back into has to be a held pose, not a sequence.**
Six states returned to `crouch` — every crouching move plus both crouching
reactions — and `crouch` was the two frames of *going down*, so all six replayed
the descent and the fighter stood up for an instant before kneeling into his own
attack. Split: `crouch_down` is the transition, played once on the way in;
`crouch` is the held frame, looping, and is what everything returns to.
Deliberately **no validator rule** — the general shape has one instance and
several honest counter-examples (`fall`, `getup` and `bounce` are all sequences
that are legally returned to), so this is a precedent for the next occurrence
rather than a rule invented from one.

**A forced state restarts its animation; a chosen one does not.** `walk_fwd →
walk_back` should keep one cycle running rather than stutter, so re-entering the
same animation deliberately does nothing — which is exactly backwards for a
blow. Being hit again while already in `hurt` refreshed nothing, so the second
blow of every string held the defender for whatever was left of the first
reaction. No combo in the game had ever been a true combo, and the data was
fine the whole time.
