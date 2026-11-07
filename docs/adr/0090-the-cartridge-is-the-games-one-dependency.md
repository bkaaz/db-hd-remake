# 0090 — The cartridge is the game's one dependency, read at runtime

**Status:** accepted 2026-11-07, after a proof of concept the same day ·
supersedes the "An emulator at runtime" line of
[0016](./0016-the-original-is-read-from-the-cartridge.md) and where
[0055](./0055-the-bank-is-the-sound-test-by-id.md)'s files come from; its
one entry per id stands

The player brings his own ROM: the page asks for the file, checks its SHA-1
against the dumps we know (`src/cartridge/romFile.ts`), and draws every
picture and plays every sound from it in the browser. Nothing copyrighted is
built, hosted or backed up; `assets/` becomes a cache anyone can rebuild, and
then goes. In development `ROM_PATH` in `.env.local` stands in for the
player's file (`/api/rom`).

- **Pictures** come from the same `src/rom/` code the export runs, so the
  layout `frames.json` points into is the one the browser draws
  (`src/cartridge/romSheets.test.ts`).
- **Sounds** are the cartridge's own driver running on an SPC700 + DSP of ours
  (`src/apu/`): its uploads put in the chip's RAM, an effect asked for by its
  id in port 1, as the game asks. Measured against the sound test's
  recordings, the same level and length.
- **`goku_old` goes**: his sheet is a hand-extended rip the cartridge does not
  hold. Git keeps him.

**Rejected:**

- **The ROM as a build dependency**, its pictures in the bundle. Simpler, but
  the build would carry the original's assets: the thing this removes.
- **A ready emulator** (`@smwcentral/spc-player`, blargg's snes_spc as WASM):
  plays `.spc` files only, no access to the ports, LGPL; compiling snes_spc
  ourselves needs Emscripten. Ours is pure TypeScript and tested in Node.
- **Rendering effects from the samples along a DSP recording** — still
  rejected (0055): the driver plays them, we do not imitate it.
- **The boot ROM's handshake.** The uploads go straight into RAM; the 64
  bytes of IPL are Nintendo's and not needed.
