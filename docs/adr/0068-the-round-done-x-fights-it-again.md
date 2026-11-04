# 0068 — The round done, X fights it again

**Status:** accepted 2026-11-04; supersedes 0064's "Nothing follows"

The winner's pose plays 304 frames (`$0D:EBCC`) and a draw is done at
once after its announcement (`$0F:B2DE`); then `Round.done`. The debug
scene does not wait for it: a second into the pose (`AGAIN_AFTER`, owner)
or once a draw is done, it says "press X to fight again" and, on the
first X pressed after that, asks to be built again from the same request — health, places, mode
and intro as they were asked for. The pose plays on while it waits.

**Rejected:**

- **Any button** — one held through the pose would start the next fight
  at once; X, the first press taken after the round was done.
- **A second round** — there are no rounds yet; this is the debug scene
  starting over, not a match going on.
