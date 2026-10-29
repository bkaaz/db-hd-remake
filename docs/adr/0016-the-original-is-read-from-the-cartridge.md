# 0016 — The original is read from the cartridge

**Status:** accepted 2026-10-28, after a proof of concept the same day ·
which instrument comes first superseded 2026-10-29 by 0022

What the remake takes from the original — sprites, palettes, the order and
timing of a move's poses, walk and jump speeds — is **read out of the owner's
own ROM**, not ripped from a sheet someone published. The ROM lives in
`raw/rom/` (BYOA, never in git); what is extracted from it lands in `assets/`
like any other asset, and only the code that extracts it is committed.

**Two instruments, by question:**

- **How the game behaves** — speeds, move ids, hitstop, which sprite is up —
  is read from RAM while the owner plays in Mesen 2: a Lua script in
  `tools/re/` records, a script reads the recording. Nothing is learned by
  reading 65816 code that a recording can answer.
- **Where the data is** — a sprite's tiles, its layout, a palette — is found by
  tracing which ROM bytes the SA-1 reads while it does a thing, and is then
  decoded by pure TypeScript in `src/rom/`, tested against what the game
  itself produced.

Taking the numbers is not taking the design: `combat.md` still decides how the
fight plays, and the original's values are where tuning starts, not where it
must end.

**Rejected:**

- **Disassembling first** (Ghidra, a full 65816 listing). The answers so far
  came from a recording in minutes; code is read only where a recording cannot
  reach, such as a format.
- **Python for the tooling.** Faster to sketch in, but it would be a second
  ecosystem beside Vitest, `png.ts` and the types the engine shares.
- **An emulator at runtime.** The game still loads static assets
  (`assets.md`); Mesen is a research tool only.
- **A public disassembly or RAM map.** None was found on 2026-10-28 — only
  PalMod's palette offsets and a translation project's text tools.
