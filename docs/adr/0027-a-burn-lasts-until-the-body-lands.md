# 0027 — A burn lasts until the body lands, not for a run

**Status:** accepted 2026-10-30 · supersedes ADR 0026's "a blow names the run
its victim shows (`hitPalettes`)" and "through the hitstop too"

A blow that `burns` sets its victim burning, and burning lasts until the body
next lands — the original's own end (`$0D:CB47`), not a count. While it lasts
the entity steps through every variant its attributes list under `burn`, two
frames each, round and round (`combat/palettes.ts`), starting at a random one
because the original's counter is the game's, shared by both players. The
step holds while the game is frozen. The sheets themselves are still drawn as
ADR 0026 says.

**Rejected:**

- **A run named by the blow** (`hitPalettes`, ADR 0026). It was read off one
  recording of palettes 4–9 and counted through the hitstop; the code steps
  through all 15 and stops on landing, which no fixed run reproduces once
  the victim falls from a different height.
- **Starting every burn at the first palette.** Tidier and testable, but not
  what the original shows; the same Kamehameha lights its victim differently
  from one fight to the next.
