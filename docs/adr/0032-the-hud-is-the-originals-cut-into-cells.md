# 0032 — The HUD is the original's, cut into the cells the fight rewrites

**Status:** accepted 2026-10-30 · replaces our bars inside the game's screen (0029)

The fight's HUD is the original's BG3 band (`rom.md`, The HUD). The export
draws it with the cells the fight rewrites left empty — the numbers, the
bars, the names — and, under it, a row of tiles for each of those parts in
that part's colours and flips (`src/rom/hud.ts`); `data/hud/hud.json` says
where the cells are and which tile shows how much (`src/hud/hudFile.ts`).
The game fills the cells each frame as the original's code does
(`src/hud/health.ts`): the shown health trails the real one by 1 a frame,
three digits, a bar full from 150. What is ours — the keys, the state, ki
until the original's dial is read — is a status line outside the screen
(`src/ui/status.ts`).

**Rejected:**

- **The whole BG3 map and its tiles, with the game rewriting map
  entries** as the original does. Faithful to the letter, but it puts a
  tile-map renderer in the game for one band of 4 rows.
- **A picture of the band per value**, drawn at export. The bar alone has
  75 lengths per side.
- **Our own bars restyled.** The owner wants the original's (2026-10-30).
