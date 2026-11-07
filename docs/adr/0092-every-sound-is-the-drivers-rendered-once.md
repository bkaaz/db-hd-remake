# 0092 — Every sound is the cartridge's driver, rendered once

**Status:** accepted 2026-11-07 · supersedes where
[0055](./0055-the-bank-is-the-sound-test-by-id.md)'s files come from and its
rejection of lines decoded from the cartridge; its one entry per id stands

Every effect, a fighter's cry, KO and shout, and every spoken line is played
by the cartridge's own sound driver on our SPC700 + DSP (`src/apu/`), as the
game asks for it: an effect or a voice by its id in port 1, with the
fighter's samples uploaded as a fight uploads them (`$00:98EC`); a line
streamed through the ports as the game's CPU streams it (`apu/line.ts`).
Each is rendered once, when its bank is first wanted, from the first sample
it sounds to its last, and played as a Web Audio buffer as the files were. A
bank entry names the cartridge's `rom` id or `line`, and `fighter` for a
voice; no entry names a file. Against the sound test's recordings, every
effect, voice and line has their level and length.

**Rejected:**

- **The chip running live** (an AudioWorklet fed the game's requests as they
  happen): the driver would mix overlapping sounds and could play the music,
  but it is a timing problem across threads; rendering once changes nothing
  the files did not already do. Kept for when the music comes.
- **A line's BRR decoded straight**, with its level fitted to the recording:
  the same sound by another road, with a number to keep that the driver
  already knows.
- **Keeping the recordings as a test's reference**: the comparison was run
  once, on every sound, before they were deleted (`git log`); a test on a
  file nobody can fetch is one that skips forever.
