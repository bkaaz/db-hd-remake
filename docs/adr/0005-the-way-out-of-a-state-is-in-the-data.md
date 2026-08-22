# 0005 — The way out of a state is in the data

**Status:** accepted 2026-08-09 (`launch` / `airborne`, arc triggers) · extended
2026-08-15 (`stunEnd`, and `when` as a conjunction)

**No state ends by magic.** Every exit is a transition with a trigger, in
`states.json`, where the validator can see it and the editor lists it for free.
When hitstun arrived it could have been the engine pushing a reaction out after
N frames; it is `stunEnd`, a trigger like any other, against exactly one state in
the game that would have ended by a rule nobody could read in the file.

## A phase boundary comes from the world, not from the animation

`falling`, `nearGround`, `landed`, `stunEnd` — the triggers that end a state say
something about the fighter, never about how many frames the artist drew. A rise
animation is shorter than the climb, so `animEnd` fires while the body is still
going up. Reading the boundary off the arc instead means the jump survives being
retuned to any height.

The same argument makes a jump **four states** rather than one animation with
phases: take-off, somersault, fall, land. One animation cannot play a take-off
once and then hand over.

Two fields carry what a constant `vel` could not: **`launch`**, applied once on
entering a state, and **`airborne`**, under which gravity accumulates and
velocity carries as momentum. A state without `launch` leaves the velocity alone,
which is what lets a take-off hand its momentum to the state that follows — and
later what let a `null` component mean "keep this axis".

## Several triggers at once, rather than compound triggers

`when` takes a list, and every trigger in it must hold. A chain link needs two
facts at the same time: the attack connected *and* a button was pressed.

**Rejected: a compound trigger per pair** — `confirmed:medium`, later
`fwd:heavy`. It multiplies with the button count and again with every new
pairing. Command normals (a direction plus a button) want exactly the same
mechanism, so a conjunction is built once and covers both.

A direction needs no conjunction at all: the walking states already encode which
way is held, so `idle → held:up` is a neutral jump and `walk_fwd → held:up` is a
forward one. Held rather than an edge, or the frame that enters `walk_fwd` would
consume the press and the jump would vanish.
