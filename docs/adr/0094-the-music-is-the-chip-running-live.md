# 0094 — The music is the chip running live

**Status:** accepted 2026-11-07 · supersedes [0092](./0092-every-sound-is-the-drivers-rendered-once.md)'s
rejection of the chip running live, for the music; its effects stay rendered
once until they move onto this chip

A fight's song is played by the cartridge's driver on our SPC700 + DSP
running in an AudioWorklet (`src/audio/chip.worklet.ts`), fed by the page
(`src/audio/music.ts`): the boot uploads and the song's (`src/apu/music.ts`),
the song asked for on port 0 once the driver has set itself up. The worklet
makes 32 kHz and draws a line between two samples to reach the page's rate
(`audio/resample.ts`). The song loops as the driver loops it; nothing of
ours knows where. The debug scene plays its song from its first frame to its
end (`scenes/debug.ts`): the setup bar's music pick — a song, none, or the
original's random one (`match/song.ts`) — which is the page's, kept as the
scale is, not the scene's request: a new pick is heard at once. It plays at 30% of the effects' level (`audio/music.ts`)
until a settings screen makes that the player's.

**Rejected:**

- **The song in the scene's request**, beside the arena: every pick
  rebuilt the arena (owner).
- **Rendering each song once into a buffer**, as the effects are: a song
  loops, so its loop point would have to be found, and minutes of sound
  rendered at the start — the stall `plan.md` already has to remove.
- **An AudioContext made at 32 kHz**, the browser resampling: every sound
  of the page would move to that rate, the effects' buffers with it.
- **The song sent through the driver's own transfer**, as the game sends it
  (`$00:D914`): the bytes go straight into the chip's RAM, as the boot's do
  (`apu.ts`), and the songs play as the original's (owner, by ear).
