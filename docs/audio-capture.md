# Capturing sound effects from the game

No usable rip of this game's sound effects exists — the one archive that has the
game offers **character voices** only, and what is downloadable elsewhere is the
SPC music. But the game has a **sound test** in its options menu, which plays
every effect cleanly and one at a time. That is a better source than any rip:
no background music, no overlap, in order.

The method is one recording and one script. Record a single pass through the
whole sound test, then cut it into separate clips automatically.

**What comes out is game audio.** It lives in `assets/audio/` (gitignored) and,
if it needs to reach another machine, gets a line in `assets.manifest.json` with
a `sha256`. The tools here are ours and are committed; their output is not.

## 1. Record the sound test

**With a desktop emulator — the way this was done.** Mesen records its own audio
output: bind *Start/Stop Recording Audio* to a key and it writes a WAV of what
the APU produced. No microphone, no system mixer, no resampling, and nothing to
feed back into itself. Mesen 2 is archived; the maintained continuation is
[MesenCE](https://github.com/nesdev-org/MesenCE), and on macOS it needs SDL2
(`brew install sdl2-compat`) and a trip past Gatekeeper.

**Leave a clear pause on every entry — at least a second.** This is the one
thing that decides how much work the cutting is, and there is now evidence: the
first pass through the sound test was hurried, and 79 of its clips arrived with
the menu's blip fused to the front. A second pass at half the speed produced
**zero**. The pause costs a minute; not pausing costs a trim pass and leaves a
few clips that no cut can separate.

**Write down the order** as you go. The script numbers the clips; only you know
which number is the punch.

### If you would rather stay in the browser

Capturing the tab works, at the cost of going through the system's resampler:
`getDisplayMedia({ video: true, audio: true })`, pick the emulator's **tab**, and
tick **Share tab audio** — Chrome offers audio for tabs only, not for windows or
screens, and without the tick the capture is silent. Two things that are easy to
get wrong and both silently ruin the result:

- **Take both channels.** `getChannelData(0)` is the left channel, not a mono
  mix, and the SNES pans its effects — anything hard right would vanish.
- **Do not route the capture to `ctx.destination`.** A `ScriptProcessor` only
  runs while connected to something, but playing the captured audio back into
  the tab you are capturing builds a feedback loop. Connect through a
  `GainNode` with `gain = 0`.

## 2. Cut it up

```bash
npm run split-audio -- assets/audio/raw/sound-test.wav --dry-run   # report only
npm run split-audio -- assets/audio/raw/sound-test.wav --blip 1    # writes 000.wav …
```

It prints every clip with its position, length and peak level, so a bad
recording shows up before anything is written. Clips are levelled to a common
peak by default (`--raw` keeps the original levels), which means `gain` in
`sounds.json` stays a creative choice instead of a correction for the recording.

**`--blip <clip>` is for the menu.** A sound test is walked with the cursor, and
the menu answers every press with a blip of its own, so the recording holds two
sounds for every effect. Find one clip that is the blip — in a dry run it is the
one length and level that keeps repeating — and name it. Every copy of it then
goes: dropped where it stands alone, and cut off the front of any effect it ran
into. The match is by *shape*, so it survives the levels drifting during a
capture, and the one judgement a person makes here they make once.

Where the blip and the effect genuinely overlap, no cut separates them. Those
clips are marked `!` in the report and left as they are, rather than trimmed on
a guess that would shave the attack off the effect.

| symptom | fix |
|---|---|
| far too many clips | the threshold is under the recording's hiss — `--threshold 0.04` |
| effects cut in half | an effect has a quiet moment inside it — lengthen `--gap` |
| clips missing | the threshold is above a quiet effect — lower it |
| clips marked `!` | record those few entries again, more slowly |

`--only 0,3,7` writes just those clips, numbered as they are in the full list —
useful for auditioning a handful before committing to all of them, and the
numbering does not shift when the rest follow.

## 3. Name them and wire them in

Rename the numbered files to what they are, then point `sounds.json` at them
with the `file` field, which replaces the synthesised placeholder without any
state changing. Add the pack to `assets.manifest.json` if it needs to travel.

## Why not just record each effect separately

Because you would do it a hundred times, by hand, and do it again after
realising the levels were wrong. One pass plus a script is repeatable: a better
recording costs one command, not an afternoon. That is not hypothetical — this
recording was made twice, and the second pass cost a single re-run.
