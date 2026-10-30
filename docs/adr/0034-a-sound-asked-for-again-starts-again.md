# 0034 — A sound asked for again starts again, on its side

**Status:** accepted 2026-10-30

A sound played while a copy of it is still sounding stops that copy
(`Audio` in `src/audio/playback.ts`), as the original's sound driver
re-keys a sound's voices (`rom.md`, The sounds; `tools/re/log-dsp.lua`).
Copies are told apart by side: each fighter plays through
`audio.side("p1" | "p2")`, what it throws through its thrower's, and the
noise of a blow through the defender's — the original's player two asks
for other ids, so the two never cut each other.

**Rejected:**

- **Overlapping copies** — what it was: a string of hits stacked three
  hit noises, and charging's sound, asked for every 8 frames, sounded as
  five copies at once.
- **Dropping a request while the sound plays.** Tried for charging: the
  whole clip again and again, which the owner heard as worse — the
  original cuts, it does not wait.
- **Cutting by sound alone, across sides.** Player one's hit would
  silence player two's.
