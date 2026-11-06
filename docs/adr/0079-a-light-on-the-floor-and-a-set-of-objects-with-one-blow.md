# 0079 — A light on the floor, and a set of objects with one blow

**Status:** accepted 2026-11-06

Cell's ultimates (`rom.md`, Cell) brought four things to the engine.

- **`pillar` on a state** (`combat/pillar.ts`): kind 4 of `$30BA`, started by a state and running on the entity's own clock through the next ones. `SceneBar` stays the scene's: it has no state to start from and belongs to `seize`.
- **`sharesBlow` on a bolt:** whichever of a set lands first spends the others' swing, through `markHit`. Fresh sets are armed.
- **`outOfReach`** (`combat/hitGate.ts`), `$2A:8B92` for `1e` alone. It is in `Entity.invulnerable`, so a blow keeps its frames and lands later. This reaches every fighter's `high` blows.
- **`savesFlight` is read before a command stops him.** It read 0 until now, so a forward jump lost its speed: Freeza's Evil Energy moves too.

`grab.strikes` puts an effect on a held body. `approach.until` ends the run where a handler stops him. `keptOnScreen` and `burstsBelow` are bolt fields.

**Rejected:** a `SceneBar` on plain states (it needs a seizure's clock and held body); a pillar in `screen` cues (a cue fires once and has no shape); the sets each one hit, as the `b0` table implies (three blows in the recording, not twelve); the bit `0x7A`'s other moves in the gate (what writes it is unread).
