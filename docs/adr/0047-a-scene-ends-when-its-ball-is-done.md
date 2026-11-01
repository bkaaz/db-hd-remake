# 0047 — A scene ends when its ball is done, not on a frame

**Status:** accepted 2026-11-01 · supersedes 0046's fixed damage frame

Saiyan Meteor's damage waits for its ball, as the original's does
($20:8D93): thrown from the hands at where the opponent lies, 8 px a
frame, it swells into an explosion where it reaches the floor, the arena
is held white for 60 frames with bursts all over the screen, and only
then does the throw's blow land. While it flies the mover's clock and
animation stand still, and when it lands they jump to frame 454, as the
handler holds and sets `$44`. A `seize` with a `finale`
(`src/match/finale.ts`) lets go when the finale is done; `release.frame`
is for a scene without one. The state's clock is held and moved by
`Entity.holdClock` / `jumpTo` and `StateMachine.setFrame`.

**Rejected:**

- **The fixed frame** (530), kept from the slice before: the white, the
  bursts and the mover's fall all follow the ball, and a frame right for
  one distance is wrong for the next.
- **The ball as a projectile of its own** — it hits nothing; it is drawn
  light whose landing starts the end, and its thrower draws it.
