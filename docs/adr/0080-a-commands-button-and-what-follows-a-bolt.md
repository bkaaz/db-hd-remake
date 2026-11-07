# 0080 — A command's button, and what follows a bolt

**Status:** accepted 2026-11-07

Buu's moves (`rom.md`, Buu) brought these to the engine.

- **`fires.atBy`** places a bolt by the button of the command that began the move. The state machine keeps it in `commandPress`, through the states after the command.
- **`around` on a `fires.with`** keeps a companion at a fixed offset from its bolt every frame, never mirrored (`match/around.ts`).
- **`endsWithMove` is read from the bolt's state now**, not only as it comes out: it goes with the move until it moves. This reaches Freeza's Jubaku Ha, whose flying ball no longer dies with his move.
- **A command row goes by its own condition.** A table too long for its area runs on into the next (Buu's Disk Tackle, `commands.ts`).
- **`grab.cries`, `seize.release.whenLands`, a step's `onBy`, `floorBurst` and `floorSound`, `soundsAt`, `muted`, `fromTop`** are small fields, each described where it is declared.

**Rejected:** a state for each button and each order of Earth Stab's three stabs (thirteen states for three numbers); the ball's stages as one bolt told by its thrower when to go (no such signal exists, and a new bolt each stage is what Mightiness Bomber does); `$0D:C40A`'s bob and the piece's flips by the game's count on the shared clock (a state's clock is close enough here); the second blow of the crouching Y as `light` (`hits.test.ts` holds a state to its part's record: `bugs.md`).
