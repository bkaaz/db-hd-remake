# 0054 — A bolt lives as its object's code says

**Status:** accepted 2026-11-02; narrows 0014 (a bolt cannot reach its thrower)

What an object's code does every frame is read (`npm run rom -- code`,
`src/rom/objectCode.ts`) and said on the bolt's state, never guessed from a
recording:

- `outlivesHit` — it plays on where it hits; its blow lands once, or again
  after `rehit` (Ground Flare's re-arm, `$0F:B9CD`).
- `rides` — it takes its thrower's place every frame, at the offset it was
  put out at (Energy Field, `$0F:BBB3`). `Projectiles` moves it; the bolt
  still holds no reference to him.
- `endsWithMove` — gone when its thrower leaves the state that put it out
  (`$0F:BB51`, `$0F:B9C0`).
- `lasts` and the frames shown — from the code's table when it has one
  (`OwnObject.ticks`), not the recording, whose frames lag.

A bolt that lands is not frozen by its own blow: it waits out the hitstop
with every bolt, as the original's objects wait on `$30B2`.

**Rejected:**

- **Effects' `follows` for bolts** — an effect never hits; one mechanism
  for both would make every spark a projectile.
- **Timing from the recording when the code has a table** — the emulator
  drops frames (70 for the flare's 66).
