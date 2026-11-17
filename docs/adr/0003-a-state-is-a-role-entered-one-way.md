# 0003 — A state is a role, and there is one way into it

**Status:** accepted 2026-11-17 · replaces 0003 of 2026-08-09, whose naming of
animations by pose ADR 0017 has superseded

**A state's name says its role.** One animation can be played by several states
that differ in what they do — a link of a string and the same blow as an ender —
so damage and reaction belong to the state, never the animation.

**Both routes into a state run one `enterState()`**: the transition the machine
chooses and the reaction the engine forces on a fighter who was hit. A field
applied on only one of them is dead on the other.

**A forced state restarts its animation; a chosen one does not.** Walking forward
into walking back keeps its cycle; a second blow on a body already in its
reaction must start the reaction again, or no string is ever a true combo.

**Rejected:**

- **A `moves.json` beside the states.** A combo is a path through states; a
  parallel structure is a second source of truth.
- **Fixing each route separately** — the next field added to `StateDef` would
  spring the same trap.
