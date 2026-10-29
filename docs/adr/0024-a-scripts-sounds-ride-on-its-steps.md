# 0024 — A script's sounds ride on its steps, as the cartridge's ids

**Status:** accepted 2026-10-29

The export writes each `a0` of a move's script onto the animation step it
begins, as the cartridge's own id (`sfx` in `animations.json`); the engine
plays it as the step begins, through the bank entry whose `rom` names that
id. What the script plays is computed; which of our clips that is, is
knowledge, kept in one field of the bank. An id nobody has matched is silent.

**Rejected:**

- **The state's `sound`, played on entry.** A move's swings fall inside its
  parts (Quadruple Kick: move frames 8, 18, 36, 54 against parts at 0, 26,
  48, 66), and one state has one entry.
- **The export resolving ids to our names.** Every new match would mean a
  re-export, and an unmatched id would have nothing to be written as.
- **Matching ids to clips by number.** The sound test plays its number as
  the id; our clips are numbered by the silences in a capture (`rom.md`).
