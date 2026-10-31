# 0041 — The canvas is the game's screen; our tools are HTML around it

**Status:** accepted 2026-10-31 · supersedes the half of 0029 that put our
tools in window pixels on the canvas and fixed the scale at 3

The canvas is exactly the game's screen at a whole scale — nothing else is
drawn into it. Everything ours is HTML laid out by CSS around it
(`index.html`, `src/ui/page.css`): the setup bar above, the two readouts
beside it on their players' sides, the input strip and the switches below,
notices over it. `src/ui/page.ts` owns the layout and the scale; `GameView`
reads the scale back off the canvas's size.

The scale is a whole number, picked on the setup bar or `auto` — the
largest that leaves room for both readouts — and remembered in localStorage
(`src/ui/scale.ts`). When a picked scale leaves no room beside the game,
the readouts go under it. Below ×2 the page is not meant to work (owner).

Controls follow how many options they hold: a select for a list that grows
(scene's fighters, arena), a row of buttons for a few fixed ones (time,
mode, health, scale), a lit button for a switch, naming its key. The key
labels and the key sheet are read from `input/keyboard.ts`, so no line can
name a key that does something else.

The status line is gone: its keys are the folded key sheet, its switches
the bar's buttons, ki and state the readouts.

**Rejected:**

- **Our tools as PixiJS text on a window-sized canvas** — what it was: CSS
  cannot lay out what it cannot see, so each part was pinned to a corner
  of the window, far from the game.
- **A fractional scale that fills the window** — blurs pixel art.
- **A sidebar holding every tool** — the eye jumps between it and the game;
  the readouts belong on their players' sides.
- **A live view of `logs/session.log`** — a feature, not a layout; the
  readouts answer "what is happening now".
