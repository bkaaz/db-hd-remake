# 0032 — The HUD is ours, drawn in the original's pixels

**Status:** accepted 2026-11-24 · replaces 0032 of 2026-11-17, the original's
BG3 band cut into the cells its fight rewrites

The fight's HUD is a design of ours (`src/hud/`): one outlined corner a side,
drawn in the game's pixels on a canvas the HUD shows as a texture. The health
bar is the original's — its look, its drain of a point a frame, its flash below
81 — laid in layers of 100; ki is six marks, fatigue a line, the name in a 5 × 7
font of ours, in English. The face is cut, unscaled, from the fighter's portrait
on the cartridge's after-fight screen (`src/rom/portrait.ts`), where
`data/hud/faces.json` says.

**Rejected:**

- **The original's band** (0032 before this) — it shows neither ki nor fatigue,
  and its names are in Japanese.
- **HTML and CSS over the canvas** — smooth edges and type that cannot keep to
  the pixel the rest of the screen keeps to.
- **The portrait halved or scaled** — any resampling blurs the original's
  pixels; a face cut at full size does not.
- **The head standing out of the frame** — at full size it covers the corner
  to the screen's edges.
- **A layer counter of the layers below only** — the owner counts the one
  draining too.
