# 0081 — A layer repainted from palettes that step by themselves

**Status:** accepted 2026-11-07 · builds on 0031 · its wrapping superseded by 0082, 2026-11-07

An arena's clouds, fire and lightning are BG palettes the cartridge rewrites on
timers of its own, through hit pauses too (`rom.md`). A layer holding such
colours has, beside its picture, a picture of each pixel's colour number; each
palette has a picture of its steps. On a step, plain TypeScript repaints that
palette's pixels and uploads the layer: `src/arena/cycles.ts` is the pure part,
`src/arena/cycledLayer.ts` the canvas. An arena with nothing stepping keeps
plain pictures and pays nothing. A layer wraps round its width as a BG does
(`ArenaBackdrop`), since the silhouettes at double speed run past their map.

**Rejected:**

- **A picture of the whole layer per step.** Palettes on one arena step
  independently, so the pictures multiply by each other's steps.
- **A picture per palette per step, laid over the layer.** Dozens of 512 × 256
  textures in memory for a job a few thousand pixel writes do.
- **A palette shader.** The cheapest at run time, and the only shader in a
  codebase its owner is reading to learn it.
- **All pictures as colour numbers, lightings as palettes.** Tidier, but it
  rewrites what already works, for no arena that asks for it.
