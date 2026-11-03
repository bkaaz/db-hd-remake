# 0059 — A shove into the screen's edge passes to the other

**Status:** accepted 2026-11-03

A body whose shove (a reaction's knockback, a state's `shove`) carries it
into the screen's edge hands what is left of it to the other fighter,
reversed, and stops (`src/combat/corner.ts`, wired in `Fighters`): the
original's `$0D:C8F0`, which tests x < camera + 17 and x ≥ camera + 240 —
ours, the camera's `screen` bounds. Player one's shove first, player two's
only if he has none. Not passed while the shoved one has no health, nor
from a move in `$0D:CA35`'s table: `11`–`16` (the standing reels), `29`–`32`,
`7e`. So a blocked blow, a knockdown, a trip or a crouching reel in the
corner pushes the attacker back; a standing reel does not.

**Rejected:**

- **The world's edge** — the original's test is the screen's, which is
  where a cornered fighter stands while the camera is held by the other.
- **Every reaction passing it**, for a stronger anti-corner rule — not the
  original's; `combat.md` keeps the change for after the port.
- **Adding it to the other's own speed** (the original adds his dx that
  frame) — ours replaces his shove; his `vel` still moves him `?`.
