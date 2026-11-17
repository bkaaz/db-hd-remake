# 0032 — The HUD is the original's, cut into the cells the fight rewrites

**Status:** accepted 2026-11-17 · replaces 0032 of 2026-10-30, whose status line
0041 has removed

The fight's HUD is the original's BG3 band, drawn from the ROM with the cells the
fight rewrites left empty — the numbers, the bars, the names — and a row of tiles
for each part (`src/rom/hud.ts`); `data/hud/hud.json` says where the cells are.
The game fills them each frame as the original's code does (`src/hud/health.ts`).

**Rejected:**

- **The whole BG3 map, rewritten entry by entry** as the original does — a
  tile-map renderer in the game for one band of four rows.
- **A picture of the band per value** — the bar alone has 75 lengths a side.
- **Our own bars restyled** — the owner wants the original's.
