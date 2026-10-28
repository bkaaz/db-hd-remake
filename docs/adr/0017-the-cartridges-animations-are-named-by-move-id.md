# 0017 — The cartridge's animations are named by move id, and regenerated

**Status:** accepted 2026-10-28 · an exception to the naming in 0015 for
animations read from the ROM; hand-built entities keep 0015

`goku`'s `animations.json` is written whole by `npm run rom -- export`: one
animation per move id, named `m` + the id in two hex digits (`m92`), its steps
the steps of that move's script. **A hand edit to it is lost on the next
export** — what needs changing is changed in the exporter, or later overlaid
from a file the exporter does not own. `frames.json` and `goku.png` are
written by the same command and follow the same rule.

A name for what a move *is* — "far punch" — is optional and lives in
`descriptions.json`, never in the animation's name.

**Rejected:**

- **Names for the pose (0015).** Nobody knows yet what most of the 256 moves
  are; a guessed name is a wrong name that looks settled. `m92` is the one
  name the game's RAM, `npm run dis`, the recordings and `docs/rom.md` share.
- **A hand-kept map from id to name** applied by the exporter. It is a second
  source of truth for something the ROM already identifies.
- **One animation per distinct script** (152 for Goku, not 256). States name
  a move; making them find which id owns the shared script is work the
  duplication saves.
- **A bare hex id** (`92`) as the name: frame ids are decimal strings, and
  `"92"` the move would read as frame 92.
