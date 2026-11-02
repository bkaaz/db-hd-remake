# 0053 — Back and forward together are neither, for the commands

**Status:** accepted 2026-11-02; beside [0050](./0050-a-special-is-asked-for-as-the-cartridge-asks.md)

The pad the command reader sees (`padFrame`, `src/input/command.ts`) holds
neither back nor forward while a keyboard holds both. The cartridge's pad
cannot hold both, and a roll ← ↙ ↓ ↘ → typed by pressing → before letting
go of ← never held ↓ alone — Big Bang failed 4 times in 10 on it (a
recording with the pad's line, 2026-11-02). The commands stay exact.

**Rejected:**

- **Last pressed wins** — the same roll goes ↙ straight to ↘, still no ↓.
- **For the whole keyboard** — walking and the rest would change with it;
  only the commands needed it.
- **Easing the command** — ADR 0050.
