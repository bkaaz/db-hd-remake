# 0025 — A beam is a bolt, what comes out beside it, and its thrower's light

**Status:** accepted 2026-10-29 · leaves 0014 standing: the bolt still knows
nothing of its thrower

The charged Kamehameha, as the cartridge builds it: the head is a bolt like
any other — it flies, hits and ends; the base at the hands is a spawn put
out beside it (`fires.with`) that never hits and is gone when the head is;
the band between them, and the ball before them, are added light the
thrower draws (`ball`, `band` on its states; `combat/ball.ts`,
`combat/band.ts`). The bolts tell the thrower how far the head has flown,
each frame, and that it is gone — the reverse of what 0014 refused. Only a
bolt thrown by a state with a band says so, or a ki blast still in the air
would pull the band to itself. The thrower holds his firing pose
(`holdStep`) until the head is gone.

**Rejected:**

- **The band as a sprite stretched or tiled to the head.** The original
  draws it as a window of added colour; a sprite would need art the
  cartridge does not have.
- **The band drawn by the bolts.** It starts at the thrower's hands and
  belongs to his state; drawing it there keeps the bolts free of him.
- **The beam gone with the move, as the original's** ($0F:E5FC). Without an
  arena it vanished in mid-air where the original's has long left the
  screen (owner, 2026-10-29); revisit with a stage and a camera.
- **The base as an effect.** An effect plays out and is forgotten; the base
  must last exactly as long as the head.
