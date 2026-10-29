# 0021 — A reaction's shove dies out by a fixed amount a frame

**Status:** accepted 2026-10-29

A state may carry `shove`: a facing-relative speed it enters with, which loses
0.25 px a frame until it stops (`combat/knockback.ts`), on top of its `vel`,
on the ground. It is the cartridge's knockback (`rom.md`, Hit data): light
starts at 2.0 and travels 9 px, heavy at 3.0 and travels 19.5.

The original's reactions get states of their own that use it — `reel_light`,
`reel_heavy` and their crouching versions, the targets of the `light` and
`heavy` hit types — and ours keep their `vel` untouched, to be reconciled
with them later (owner, 2026-10-29).

**Rejected:**

- **A constant `vel` sized to the same distance.** Right in pixels, wrong in
  feel: an even slide for the whole reaction instead of a hard shove that dies.
- **Retuning `hurt_chain` / `hurt_heavy`.** They are ours and `goku_old`'s;
  the original's numbers go on states named for the original.
- **The name `push`.** Already the separation of two bodies (`combat/push.ts`,
  `pushWidth`).
