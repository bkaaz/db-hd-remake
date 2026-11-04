# 0067 — A round opens on the arena, both intros at once

**Status:** accepted 2026-11-03

`Opening` (`src/match/opening.ts`), with the debug scene's intro switch
(`I`) on: both fighters are forced into the file's `round.intro` — the
cartridge's `3c` — where they stand at a round's start; once both stand in
`initial`, READY drops in (`ready`, exported from `a/1e`), turns into
FIGHT! on tick 64 and is gone on 96, and the fight is on. Until then no
buttons count, and no KO. Apart from `Round`, which owns the end; the two
share `RoundWorld`, an announcement being a `Placard` put at a height.

**Rejected:**

- **A screen of its own before the fight, as the original** — the owner
  wants the intros on the arena.
- **One intro after the other** — the original's scene gives both their
  `3c` on the same frame (`$02:A242`).
- **Two switches, intro and READY/FIGHT!** — one without the other has no
  use (owner).
- **The opening inside `Round`** — the start and the end share nothing but
  the screen; one file would be two jobs.
