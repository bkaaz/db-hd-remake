# 0055 — The sound bank is the original's sound test, one file per id

**Status:** accepted 2026-11-03 · supersedes the last "Rejected" line of
[0024](./0024-a-scripts-sounds-ride-on-its-steps.md), whose premise — "the
sound test plays its number as the id" — was wrong; the rest of 0024 stands ·
where the files come from superseded 2026-11-07 by 0090

A script recording the original's sound test (`tools/re/record-sound-test.lua`)
logs every id the game asks for and the frame of every press; `npm run
sound-test` cuts Mesen's WAV of it by those frames into
`assets/audio/sfx/<id>.wav` — each effect by its id, each fighter's voices
(`goku_30`, `goku_31`, `goku_32`) and every spoken line (`line_0d`). The
bank, `data/audio/sounds.json`, has **one entry per effect id**: named what
it is and its id (`hit_09`, `sfx_1b` while nothing is known), its `file` the
id's file, its `rom` the id. Every gain is one number, because the files keep
the levels the game plays them at. A fighter's `sounds.json` holds his voices
and lines on the same files (`src/rom/voice.ts`); `goku_old` uses Goku's.

So nothing is matched by likeness or by ear any more: an id the cartridge
asks for has a file because the sound test played it.

**Rejected:**

- **Cutting a capture by its silences and matching clips to ids** (the
  numbered clips, `samples --map`, alignment by order). Every match was a
  guess with a score; the sound test's number turned out not to be an id,
  which shifted the menu sounds by one under the owner's own ear.
- **Rendering a sound from the chip's samples along a DSP recording.** Its
  one real use came out like nothing the game plays.
- **Decoding voices and lines from the cartridge as the files.** Lossless,
  but at their own levels, and without the KO, which the sound test has.
  The cartridge's voice samples stay — to tell whose voice is whose.
- **Keeping several names for one sound** (`swing_1`, `hit_2`, `land_3`).
  One entry per id; the states point at it.
