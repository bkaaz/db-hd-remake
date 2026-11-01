# 0048 — An effect that rides its owner goes on its step, once per start

**Status:** accepted 2026-11-01 · narrows 0045's rejection of spawns on
steps for every move

An object whose code keeps it on its owner and kills it when he leaves the
move — idle's lightning, type `0` animation `6` (`$0F:B862`) — is put out
by the step its `b0` begins, in the moves `onStep` lists for it
(`src/rom/cartridge.ts`), and cuts nothing. The others still go through a
state's `fires` (0018). In a move its code does not live in, it is left off:
the original kills it on its first frame.

A step's spawns fire **once per start of the animation**, not on every loop:
a `b0` fires on a counter the move's start resets and the script's loop does
not (field `0x6e`). A start of the same animation again counts as a new one.

`follows` in an effect's `attributes.json` says how it rides: `"pose"`, the
frame its owner's drawing names (normal Goku's hair, `$0F:B8F2`), or
`"body"`, its own animation (`src/fx/follow.ts`). Either is gone when the
owner's animation starts again or changes.

**Rejected:**

- **A state field that spawns on entry** — a second place for what the
  script already says, as a delay on `fires` would have been (0018).
- **Spawning on every loop and letting the effect replace itself** — a
  looping idle would restart the lightning every 36 frames, and its 108-frame
  cycle would never reach the bolts.
- **Gone when the owner's animation name changes** — re-entering the same
  animation would leave the old one on screen beside the new one.
