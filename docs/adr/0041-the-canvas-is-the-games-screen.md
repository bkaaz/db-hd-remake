# 0041 — The canvas is the game's screen, in game pixels; our tools are HTML

**Status:** accepted 2026-11-17 · consolidates 0029 and 0041 (2026-10-30 –
2026-10-31), which it replaces

A fight is drawn into one container the size of the original's screen,
256 × 224, and every position, speed, box and camera number is in game pixels —
the numbers the cartridge holds. The canvas is exactly that screen at a whole
scale, picked or `auto`, and nothing else is drawn into it. Everything ours —
the setup bar, the readouts, the switches, notices — is HTML laid out by CSS
around it (`src/ui/page.ts`).

**Rejected:**

- **The world in window pixels**, each number times a scale — every number read
  from the cartridge multiplied on its way in.
- **A screen that fills the window**, or **a fractional scale** — the camera's
  push and margin would mean another game's camera, and pixel art blurs.
- **Our tools as PixiJS text on the canvas** — CSS cannot lay out what it cannot
  see.
- **A sidebar holding every tool** — the readouts belong on their players' sides.
