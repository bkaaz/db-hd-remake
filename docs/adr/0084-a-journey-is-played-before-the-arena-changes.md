# 0084 — A journey is played before the arena changes

**Status:** accepted 2026-11-07 · supersedes the cut in 0083 · its arrival up superseded by 0086, 2026-11-07

Once a sending blow's pause is over the fight stands still and a journey plays:
the defender flies off at 8 px a frame, the arena goes, sideways he flies back
in and hangs, and both are put down on the new arena. `arena/flight.ts` is its
plan frame by frame, the cartridge's handlers and recorded timings, pure and
tested; `match/journey.ts` plays it on the scene, which steps nothing else
meanwhile. The flying poses are the template's `sent_up`, `sent_side`,
`sent_down` (moves `21`, `23`, `25`). Up and down both drop in from over the
screen: the original's way up ends in the air, which ours has not.

**Rejected:**

- **Playing it through the fighters' states**, a state per phase with `vel` and
  timers. The original's own handlers move both bodies from outside their
  scripts, and every fighter would need the states and their numbers twice.
- **Running the fight during it.** Nothing in the original can act while
  `$37` is in the journey's screens.
