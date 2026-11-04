# 0074 — The original is played from a terminal

**Status:** accepted 2026-11-04 · narrows ADR 0022: a recording no longer needs
the owner

`npm run original -- <name>` plays a scenario of `tools/re/runs/` in Mesen's test
runner, with no window, from a save state in `raw/states/`. A scenario is the debug
dummy's own tokens (`src/debug/dummy.ts`), and its timeline stands through a hit
pause as the dummy's does, so one script means the same in both games. The log is
`record-fight.lua`'s: `tools/re/run.lua` goes before it, nothing else writes one.
The test runner starts before Mesen's single-instance check and saves no settings,
so the owner's open emulator is untouched. A run of the same scenario gives the same
log byte for byte.

The cartridge's logic is still read from its code first: a run shows what happened
once, the code says what decides it.

Rejected:

- **`emu.setInput`.** It needs a controller in port 2, and with none it took player
  one's pad; the pads are answered where the game reads them (`$4218`–`$421B`).
- **Walking the menus.** A save state is a minute of the owner's, once a pairing.
- **A second log script for runs.** Two writers of one format agree by hand.
- **`mesen-agent`, the windowless fork.** Another binary, its SA-1 untested, for what
  the owner's own Mesen already does.
