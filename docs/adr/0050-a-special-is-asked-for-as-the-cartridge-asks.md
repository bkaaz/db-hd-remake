# 0050 — A special is asked for as the cartridge asks

**Status:** accepted 2026-11-17 · consolidates 0050 and 0053 (2026-11-01 –
2026-11-02), which it replaces

A cartridge fighter's commands are his command table, written whole into
`commands.json` by `npm run rom -- commands` and matched over the pad's history
by the original's rules (`src/input/command.ts`, `rom.md`). A state asks for one
by its move id. For the commands alone, back and forward held together are
neither, as the cartridge's pad can never hold both.

**Rejected:**

- **Our own motion shapes with looser windows** — named by hand per move, where
  the mix-ups came from; the exact match, the charge and the 5-frame button would
  each be a special case.
- **The button through our 12-frame buffer** — moves came out of a press the
  original had already forgotten.
- **Easing the exact match** — close to the original while porting; the fight is
  reworked after (owner, 2026-11-01).
- **Last pressed wins, or neither for the whole keyboard** — the first still skips
  ↓ in a roll, the second changes walking.
