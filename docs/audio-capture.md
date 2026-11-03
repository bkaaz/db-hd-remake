# Recording the game's sounds

Every sound the game has — each effect, each fighter's three voices, every
spoken line — is in the original's **sound test** (the options menu), one at
a time with no music under it. One recording of it, played through by a
script, is the whole bank: `assets/audio/sfx/`, one file per sound, named by
the id the game asks for (`05.wav`, `goku_31.wav`, `line_0d.wav`).

**What comes out is game audio.** It lives in `assets/` and `raw/`
(gitignored) and travels only in the owner's asset pack. The scripts are
ours and committed; their output is not.

## 1. Record

In Mesen, on the sound test's screen with the cursor on **000**:

1. Start Mesen's own audio recording (*Record Audio*) into
   `raw/audio/sound-test-ids.wav`. It writes what the sound chip produced: no
   microphone, no mixer.
2. Run `tools/re/record-sound-test.lua` at once. Leave the pad alone: it
   presses A, waits for every voice to go quiet, moves to the next entry,
   waits for the cursor's own sound to end, and again, through the whole
   list. It logs every id the game asks for and the frame of every press
   into `logs/dsp-sound-test.txt`.
3. When it says *all played*, stop the WAV, then the script.

The WAV and the log are started by hand, apart; the cutter finds how far one
runs ahead of the other, so neither has to be started on a given frame.

## 2. Cut

```bash
npm run sound-test -- --dry-run   # report only
npm run sound-test                # writes assets/audio/sfx/
```

Each press is cut from the frames the log gives it, slid against the WAV
until the log's sounding frames and the WAV's loud ones agree — the whole
recording first, then each press on its own, since Mesen's WAV drifts a few
frames against the game's. A file is named by what the game asked for, never
by where the silences fell; whose voices are whose is heard from the
cartridge's own samples of them. The level is left as the game played it, so
one `gain` fits the whole bank.

A second recording (`raw/audio/sound-test-lines.wav` beside
`logs/dsp-sound-test-lines.txt`), if there is one, carries on where the first
stopped — the 2026-11-03 bank was recorded in two.

## 3. The bank

`data/audio/sounds.json` has one entry per effect id: its `file` is the id's
file and its `rom` the id, so a script's `sfx` and a state's `sound` find it.
A fighter's voices and lines are in his own `sounds.json`, which
`npm run rom -- export` writes (`src/rom/voice.ts`).
