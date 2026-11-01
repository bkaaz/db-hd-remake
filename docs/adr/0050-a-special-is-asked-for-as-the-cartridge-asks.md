# 0050 — A special is asked for as the cartridge asks

**Status:** accepted 2026-11-01

A cartridge fighter's commands are the cartridge's: its command table,
written whole into `commands.json` by `npm run rom -- commands`, and
matched over the pad's history by the original's rules — the button gone
down in the last 5 frames, each direction found exactly within 12 (or 24)
frames of the next, charges, "any of", a button mid-sequence
(`src/input/command.ts`; `rom.md`, the pad's history). A state asks for
one by its move, not by a shape.

`input/motion.ts` stays for `goku_old`, whose moves the cartridge never
had.

**Rejected:**

- **Tightening `motion.ts`'s windows** — the shapes would stay ours, named
  by hand per move (where the mix-ups came from), and the exact match, the
  charge and the 5-frame button would each be a special case bolted on.
- **The button through our buffer** (12 frames) — Vegeta's Cross Punch
  came out of a press the original had already forgotten.
- **Easing the exact match** (a diagonal for a cardinal, a button held
  while rolling) — the owner: close to the original while porting, the
  fight is reworked after (2026-11-01).
