# 0035 — A throw holds the opponent in his own drawings, for every pair

**Status:** accepted 2026-10-31

A throw is the thrower's state: it holds the opponent from its start and
lets him go with a launch, all of it read off the cartridge
(`npm run rom -- port 9d`). While held, the opponent plays
`m30_<thrower>_<move>` — move `30`, the original's hold — an animation
written into **his** entity by the export from the thrower's opponent
track (script command `80`): the drawing the track names for his
character, held as long as the thrower's step. Every thrower of the
roster, every move with a track, every fighter: the pair is data, not code.
Where he is held comes from the thrower's handler table (`$0D:DE9A`,
`hold.ts`), by his character and the thrower's step; the launch's numbers
from `$0F:B321`'s arguments.

**Rejected:**

- **Goku against Goku first, the held drawings fixed** — faster, but every
  other pair would be a second piece of work, and the tracks already name
  them all.
- **The held fighter's own state machine placing him.** In the original
  the thrower's handler moves him every frame and his move `30` plays no
  script (`$01:85FD`); a state of his own would have to know whom it is
  held by.
- **The held drawings in the thrower's sheet.** They are the opponent's
  tiles, in his palette and his lighting.
