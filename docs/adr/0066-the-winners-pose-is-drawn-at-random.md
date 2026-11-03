# 0066 — The winner's pose is drawn at random

**Status:** accepted 2026-11-03; supersedes 0064's single `round.win`

`round.win` is a list of states, and the winner strikes one of them at
random (`Round`, `RoundWorld.random`): `win`, the cartridge's `3e`, and
`win_air`, its `82`. The original gives `82` only to a fight ended above
the arena (`$0F:B2AD`, `$0552`); this game will have no fight there
(owner, `combat.md`, Where the fight happens), so the pose would never
play.

**Rejected:**

- **By the arena, as the original** — the arena it needs will not exist.
- **A debug switch for which pose** — a player would never see `82`; the
  owner wants both in the game.
