# 0057 — One body frees the other's held script

**Status:** accepted 2026-11-03

A state may carry `frees: N` (`src/entity/states.ts`): on its frame N the
opponent's `freed` trigger fires, and stays true until he enters another
state. `Fighters` passes it between the pair (`src/match/fighters.ts`), as
it passes a throw. It is the original's `f0`-and-up script step, which
holds its drawing while the fighter's field `0x4b` is below the step's
byte (`$01:86F0`), and pinned's `4a`, which on its frame 40 sets the
other's `0x4b` past it (`$0F:A545`): Galactic Gunfire aims until the body
is down, then fires. `pinned_lie` frees on 9; `gunfire_volley` holds its
aiming step (`holdStep`) and goes on `freed`.

**Rejected:**

- **A trigger on the opponent's state by name** (`foe:pinned_lie`) — late
  by the 8 frames the original waits, and a thrower that names his
  victim's states breaks with every fighter whose states differ.
- **A fixed delay in Galactic Gunfire** — the fall's length depends on how
  high he was held, which depends on whom.
- **Cutting the animation at every hold step**, to play af's 4 frames after
  it — holds are in dozens of moves of each fighter; the part names would
  shift under their states.
