# 0009 — The dummy is given a timeline, never a condition

**Status:** accepted 2026-08-16 (`src/debug/dummy.ts`, `data/debug.json`)

The practice dummy is driven by **a list of steps**: an action name, or a number
of frames of nothing. It has no conditions and no policy.

**A dummy that can say "if he blocked, then…" is a second state machine beside
`states.json`** — one with its own vocabulary, its own bugs and no validator.
Whatever it grew into would be an AI written by accident, and a half-built AI is
the kind of thing that survives for years.

**A step holds its directions and edges its buttons.** `"back 30"` is half a
second of holding back; `"light 30"` is one press and then twenty-nine frames of
the button being down without being pressed again. Anything else would have the
dummy mashing sixty times a second. `fwd` and `back` are resolved against the
dummy's own facing, so the file reads the way the fight does while the world
knows only left and right.

**Its clock stops when its body is frozen.** A hit pause holds the body for ten
frames while the world keeps counting, so a timeline that ran through the pause
drifted ten frames per blow and the same script meant one thing on a whiff and
another in a combo. A dummy exists to be repeatable, so its steps are counted in
frames the body actually lives through.

## The screen it lives on is `debug`

Not `fight`, and deliberately not `training`. A training mode is a *player's*
screen with practice conveniences and will want to exist beside the fight; this
one is for whoever is building the engine — box overlays, the state readout, log
recording and a scripted dummy, none of which a player should reach. Both real
screens are still to be built, and naming this one after either would have taken
the name they need.
