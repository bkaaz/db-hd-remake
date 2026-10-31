# 0029 — The world is in game pixels, inside one scaled screen

**Status:** accepted 2026-10-30 · where our tools go and the fixed scale
superseded by 0041 (2026-10-31)

A fight is drawn into one container the size of the original's screen
(256×224), centred in the window and scaled as a whole (`GameView` in
`src/view.ts`). Positions, speeds, boxes and the camera are in game pixels —
the numbers the cartridge holds — and the screen's size and its scale are
each one value in that file; nothing else in a fight knows the window's
size. Inside the screen: the backdrop and the world, which scroll, and the
HUD, which does not. Outside, in window pixels: what is ours rather than
the game's — the status line, the debug panel, notices. The debug boxes
are drawn in the world, since they must sit on the bodies.

The size is the original's because the camera's rules are written against
it (`rom.md`, The camera); it is expected to change (owner, 2026-10-30).
The arenas from the cartridge are 512×256, which bounds how far it can.

**Rejected:**

- **The world in window pixels, each number times a scale** — what it was:
  every number read from the cartridge would be multiplied on its way in,
  and changing the scale would be a hunt rather than an edit.
- **A screen that fills the window.** The camera's 64-px push and 16-px
  margin would then mean another game's camera.
- **The HUD outside the screen, placed by it, to keep its text sharp.**
  The HUD is the game's: it goes in and is as pixelated as the rest
  (owner, 2026-10-30), until the original's replaces it.
