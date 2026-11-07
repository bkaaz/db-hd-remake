# 0085 — The journey's bands are one picture of every screen

**Status:** accepted 2026-11-07

The cartridge draws a sideways journey's bands with colour windows: per line,
two spans out of four tables a way, every fourth frame turned inside out
(`rom.md`, The journey's screens). There are only sixteen screens, so the
export draws them all into one picture (`src/rom/bands.ts`) and the game shows
one a frame by the cartridge's order (`arena/bands.ts`, `arena/bandsView.ts`).
It is served as an arena's layer is, under `journey`, an arena nobody fights in.

**Rejected:**

- **Drawing the spans every frame**, a `Graphics` of 224 lines. The same
  sixteen screens, rebuilt sixty times a second.
- **A window shader.** As in ADR 0081, the only shader in a codebase its owner
  reads to learn it.
- **The windows' tables in `data/`.** They are the cartridge's own drawing,
  which stays in `assets/` (BYOA) like every other.
