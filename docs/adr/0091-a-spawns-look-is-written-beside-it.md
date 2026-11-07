# 0091 — A spawn's look is written beside it

**Status:** accepted 2026-11-07

What an object looks like — its type and animation, the frames drawn in the
order the sheet packs them, its tile base, its palette, the VRAM loads, the
variants it is drawn in — is written by `npm run rom -- export` as the spawn's
`look.json` (`SpawnLook`, `src/rom/spawnLook.ts`). The browser draws its
pictures from that and the ROM alone; how long each frame shows stays its
`animations.json`. A spawn kept from an earlier export gets its look too, its
frames in the order its animations show them.

**Rejected:**

- **Working the look out again in the browser.** For every fighter but Goku
  it comes from a Mesen recording in `logs/` and his `objects.json` — a
  player has neither.
- **The frame order from `frames.json`.** Its keys are numbers, and JSON gives
  them back sorted, not in the order the sheet was packed.
