# 0056 — A falling bolt bursts on its floor

**Status:** accepted 2026-11-03; beside [0054](./0054-a-bolt-lives-as-its-objects-code-says.md)

A bolt's state may carry `burstsAbove` (`src/entity/states.ts`): its ground
is that many game px above its thrower's floor, not the height it was put out
at, and reaching it puts out its `burstsInto` where it is and ends it
(`src/match/projectiles.ts`). Vegeta's Vertical Ki (`b1`, object `1/06`)
falls at `b0`'s vy 4 and is rewritten as `a/02` once its y is `B8`, 16 px
above the floor line (`$0F:BB05`; the owner: they burst on the ground). An
airborne state with it needs no `landed` transition; one without
`burstsInto` is an error.

**Rejected:**

- **A general "becomes another object when …"** — one object does it; a
  rule with a condition language for one case is a second state machine.
- **A `landed` transition into a burst state of the bolt** — the burst is an
  effect (`burst_s`), as on a hit; a bolt state for it would hit, and would
  have to be ended by hand.
- **The floor line itself (`burstsAbove: 0`) for this shot** — the cartridge
  tests `B8`, not the fighters' 200.
