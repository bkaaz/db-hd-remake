# 0064 — A round ends in its own module, behind a debug switch

**Status:** accepted 2026-11-03; its single `round.win` superseded by 0066

`Round` (`src/match/round.ts`) watches both fighters once a frame, after
the blows, and steps in at the end: a fighter at zero health is forced into
the file's `round.ko`; the scene skips every odd frame until a state with
`fullSpeed` or `round.down`; once the loser lies in `round.down`, the other
stands in `initial` and no shot is in the air, the announcement (`ko` /
`double_ko`, spawns exported from `a/1f`) holds everyone for 80 frames, then
the winner is forced into `round.win`. Nothing follows. Only the debug
scene has it, and only with its KO switch (`K`) on — off, health floors at
zero as before.

**Rejected:**

- **The KO decided in `landBlow` or `Entity.hurtBy`** — throws and seizures
  cut health without a blow, and a fighter would need to know a switch the
  scene owns.
- **The half speed's end as a state name in `round`** — Vegeta's KO handler
  never clears it on the last landing as Goku's does; a flag on the state
  goes with the state into `specials.json` (`replaces`).
- **One announcement entity with two animations** — `Effects.spawn` picks an
  animation at random.
