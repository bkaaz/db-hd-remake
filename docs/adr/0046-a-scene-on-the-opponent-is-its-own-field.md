# 0046 — A scene played on the opponent is its own field, beside the throw

**Status:** accepted 2026-11-01 · beside 0035

Saiyan Meteor's `ae` takes the opponent once — set down 40 px in front,
facing the mover — and he plays an animation of his own (`m47`) while the
scene throws him up, bounces him and leaves him lying; at its end the
throw's own `$0F:B321` costs him 118 and knocks him down. A state's
`seize` says all of it (`src/entity/states.ts`, `SeizeDef`), and
`src/match/seize.ts` plays it on the pair, as `throw.ts` plays a `grab`.

The damage lands on a fixed frame for now (530): in the original it waits
for the ball's flight, which depends on the distance — the ball and its
explosion are the next slice.

**Rejected:**

- **`grab` extended** — a throw carries him every frame in drawings its
  own track names; this sets him down once and flies him. One field doing
  both would make every throw read past options it does not use.
- **His own state machine flying him** — rejected for the throw (0035) for
  the same reason: a state of his would have to know whose scene it is.
