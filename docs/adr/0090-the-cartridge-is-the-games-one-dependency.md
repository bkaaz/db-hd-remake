# 0090 — The cartridge is the game's one dependency, read from its code

**Status:** accepted 2026-11-17 · consolidates 0016, 0022, 0074, 0075, 0090, 0093
and 0095 (2026-10-28 – 2026-11-17), which it replaces

**The player brings his own ROM.** The page checks its SHA-1 against the dumps we
know (`src/cartridge/romFile.ts`) and draws every picture and plays every sound
from it, with the same `src/rom/` code the export runs. Nothing copyrighted is
built, hosted or committed; in development `ROM_PATH` stands in for the file.
`data/` is ours and read through Vite's glob, so `dist/web` plays from any static
host.

**The cartridge's logic is read from its code first** (`npm run dis`, from
`rom.md`'s "Where to start a search"), and every finding goes into `rom.md`. A
run of the original only confirms a reading: `npm run original` plays a scenario
in Mesen's test runner from the owner's save state, and `npm run moves` plays a
fighter's every move in both games and reports what differs. The sandbox's
Mesen and its setup: `tools/re/run.lua`, `rom.md`.

**Rejected:**

- **The ROM as a build dependency**, its pictures in the bundle — the build would
  carry the original's assets.
- **A recording first, code only where it cannot reach** — a recording measures an
  answer without its rule. **A full disassembly** — the search is targeted, and
  `rom.md` is the map it leaves.
- **A ready SPC emulator** (`.spc` players, snes_spc as WASM) — no access to the
  ports, LGPL or Emscripten; ours is TypeScript tested in Node.
- **Reading `data/` through the dev server's `/api/*`** in development and from
  files in a build — two roads, one untested until a deploy.
- **Walking the original's menus** in a scripted run, or **`emu.setInput`** — a save
  state is a minute of the owner's, and the pads are answered where the game
  reads them.
- **A Linux build of the owner's Mesen** — none is published; the sandbox's older
  one is told a newer state's version is its own.
