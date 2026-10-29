# 0023 — A multi-hit move is a state per blow

**Status:** accepted 2026-10-29 · extends 0018 (cutting a move)

The export cuts a move where each blow after the first begins — a step that
shows a hit box after one that did not (`blowStarts` in `src/rom/animation.ts`)
— and names the parts `mNN`, `mNN_2`, … as a spawn's are. Each part is a
state of its own: its own damage and its own hit type, chained by `animEnd`.
Quadruple Kick (`a5`) is four: three heavy, the last a knockdown.

A blow takes the hit record covering its **first active step**
(`recordAt` in `src/rom/hits.ts`). The cartridge's records change one step
before a kick's hit box ends, so which record a kick takes in the original
depends on the frame it connects; the first step is the one an opener lands
on, and gives 24, 25, 26, 27 — one per kick.

How the move walks comes from its handler, not its script (`rom.md`, Where
to start a search): it sets a forward speed at given frames and keeps it
until it sets another. A state says the same with `velAt` — `[frame, speed]`
pairs from its own first frame — so each part carries its slice of the
move's schedule.

**Rejected:**

- **One state with `rehit`.** One damage and one type for all four kicks,
  where the original gives each its own and ends on a knockdown.
- **Cutting where the records change.** Lands mid-kick: the same hit box
  would open a new state and hit twice.
- **A constant `vel` per part.** Right in distance, wrong in feel: the
  original lunges with each kick and slows between them.
- **Damage per hit inside one state.** A new field for what a state already
  carries; a blow is a state (0015).
