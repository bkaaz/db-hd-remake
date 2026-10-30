# 0026 — A palette swap is the same sheet drawn in another palette

**Status:** accepted 2026-10-29 · how long the swap lasts superseded
2026-10-30 by 0027

When the original recolours a fighter — the Kamehameha's fire on whoever it
hits — the export draws the whole sheet again in each palette it steps
through (`FighterTables.variants`, sheets `goku@fire4.png` …), frame for
frame, so the same rectangles cut every variant. A fighter lists the variants
it has (`palettes` in its attributes); a blow names the run its victim shows
(`hitPalettes`, `combat/palettes.ts`), and the entity draws from the
variant's texture while the run lasts — through the hitstop too, as the
original's starts on the frame of contact.

**Rejected:**

- **A palette shader at runtime.** Fewer files, but a new technique in the
  engine that nothing else uses and no test can see; a sheet is checked by
  looking at it.
- **Tinting the sprite.** A multiply or a fixed colour is not the original's
  palette: its fire maps each colour to its own, darks to deep red.
