# 0081 — The camera, the arenas and the journey between them are the original's

**Status:** accepted 2026-11-17 · consolidates 0030, 0031, 0059, 0081, 0082, 0083,
0084, 0085 and 0086 (2026-10-30 – 2026-11-07), which it replaces

**The camera** is the original's (`src/camera/`): pushed by a fighter in the
screen's outer band, never centred, and it runs after the bodies have moved and
been pushed apart, so it may stop one at the screen's edge. A shove that reaches
that edge passes to the other fighter (`combat.md`, §6).

**An arena** is a few pictures as large as the world, each scrolled at its own
speed (`arena.json`); palettes the cartridge steps on its own timers repaint the
pixels that use them. **A sending blow** changes the arena in place on the same
stage, after a journey played frame by frame from the cartridge's handlers
(`arena/flight.ts`), on the owner's graph of ways (`arena/ways.ts`). A sideways
journey's bands are one picture of every screen.

**Rejected:**

- **A camera centred between the fighters** — not the original's.
- **Bodies clamped to the screen before the camera** — the screen would never
  scroll; **the push apart after it** — it would scroll every other frame.
- **One picture per arena**, or **a picture per palette step** — the sky moves at
  half speed, and steps multiply.
- **A shader** for palettes or windows — the only one in a codebase its owner reads.
- **A new scene for the new arena** — it would drop the combo, the round and the
  recording; **the journey played through the fighters' states** — the original's
  handlers move both bodies from outside their scripts.
- **The original's fights above the floors** — there is no fight in the air
  (`combat.md`).
