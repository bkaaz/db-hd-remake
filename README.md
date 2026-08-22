# A 2D fighting engine, and the tool that authors it

A browser fighting-game engine written from scratch in TypeScript, together with
the editor that authors its content — sprites, animations, collision boxes and
state machines. It is demonstrated on **Dragon Ball Z: Hyper Dimension**
(SNES / Super Famicom, 1996): a non-commercial fan project, work in progress.

What is actually built here:

- **An engine** — a data-driven state machine per entity, hit/hurt/push
  collision, gravity and jump arcs, hitstop, knockback and knockdown, all
  authored as JSON rather than hard-coded.
- **An entity editor** — a Canvas 2D tool that cuts sprite sheets into frames,
  sets anchors, builds timed animations and draws collision boxes.
- **Authoring tools that compute instead of guess** — hurt boxes fitted to the
  silhouette from the sprite's alpha, labelled contact sheets, and a seeded
  pixel-art generator that draws the game's effects from code.
- **Tests over the parts that can be tested** — the state machine, its
  validator, collision and the generators run in Node, free of PixiJS.

The reasoning behind every decision, including the ones that were tried and
dropped, is in [`docs/decisions.md`](./docs/decisions.md).

## Stack

TypeScript · PixiJS v8 · Vite · Vitest

## Getting started

```bash
npm install
npm run fx               # generate the effect sprites (we draw those ourselves)
npm run dev
```

Then open the URL Vite prints (it opens the browser automatically). Two fighters
face each other on a ground line. **←/→** walks, **↑** jumps, **↓** crouches,
**A**/**S**/**Z**/**X** are the four attack buttons — light, medium, heavy and
special, by strength rather than by limb — and holding away from your opponent blocks
whatever lands next. **T** makes the training dummy attack on a timer, so the
reactions can be seen; **B** toggles the collision-box overlay and **D** the readout of what the engine
thinks about both fighters — state, rank, buffer, hit pause, combo count. **L**
starts and stops a recording of what happened, written to `logs/session.log`
(gitignored) as events rather than frames, so a combo attempt reads as twenty
lines instead of six hundred.

Without the game's assets the page reports that the entity could not be loaded.
Getting them is the next section, and it is not a command.

## Assets (Bring Your Own Assets)

This repo ships **only our code + data** — no copyrighted game art. Source assets
live under `assets/` (gitignored), by type:

```
assets/sheets/         one image per entity — the editor and the game read these
assets/sheets/spawns/  effect sheets, written by npm run fx
assets/audio/          clips cut from a capture of the game's sound test
assets/backgrounds/    (future) stage art
```

**Every entity is one image, and its transparency is in the file.** There is no
second, keyed copy of a sheet anywhere: the background is removed once, in the
editor, and what is written back is what everything reads.

**There is nothing to download.** A manifest and a fetch command used to pull the
Goku sheet from The Spriters Resource; both are gone, because neither half of the
pack is a public file any more. The audio was captured from the game's own sound
test on the author's machine and was never published anywhere, and the sheet has
since been modified — see below. The pack lives with the author: **ask, and you
get a copy.**

### The sheet is no longer the published rip

The community rips of Hyper Dimension have gaps — poses the game uses that nobody
extracted, starting with the crouching guard. Rather than swap the foundation or
carry a second image, missing sprites are drawn or composed and **appended to the
bottom of `assets/sheets/goku.png`**. Two things follow, and both matter before
anyone opens that file in an image editor:

- **Append only, never re-flow.** `data/entities/<name>/frames.json` is
  coordinates into one specific image, and frame ids run in reading order along
  each row. Rows added at the bottom leave every existing frame true; moving
  anything already on the sheet invalidates them silently — nothing crashes, the
  wrong sprite just draws.
- **It matches no public download and no checksum.** Keep an untouched copy of
  the original rip beside it, so a better rip can still be diffed against what
  this started from.

### What is the pack, and what is derived

The pack is `assets/sheets/*.png` and `assets/audio/raw/` — losing those means
losing work. Everything else under `assets/` comes back from a command:
`assets/sheets/spawns/` from `npm run fx`, `assets/audio/sfx/` from
`npm run split-audio`, `assets/contact/` from `npm run sheet`.

See [`docs/assets.md`](./docs/assets.md) for why the project is arranged this way.

## Entity editor

```bash
npm run editor           # asset pipeline tool at /tools/entity-editor/
```

Load a sheet from `assets/sheets/`, frame it, build animations, and Save. An
entity is a **directory of section files** — `data/entities/<name>/frames.json`,
`animations.json`, `states.json`, … (committed) — and Save writes the section
belonging to the active tab — JSON only, never the image.

The one exception is **Apply to sheet** in the BG controls, which writes the
colour-keyed pixels back over `assets/sheets/<name>.png` itself. It is its own
button, used once per sheet, because it is the only thing here that destroys
pixels. See [`docs/data-format.md`](./docs/data-format.md).

## Docs

- [`docs/decisions.md`](./docs/decisions.md) — the decision log, newest first.
  The most useful file here if you want to see how the thing was reasoned about.
- [`docs/plan.md`](./docs/plan.md) — the work queue, and the only one. Finished
  items are deleted from it, so it only ever shrinks.
- [`docs/data-format.md`](./docs/data-format.md) — the contract between the
  editor and the engine.
- [`docs/`](./docs) — everything else; start at [`docs/README.md`](./docs/README.md).

## Credits

This project would not be practical without the people who ripped the game's
graphics and published them. The sheets it reads are theirs, not ours.

- **Goku** — ripped by contributors to
  [The Spriters Resource](https://www.spriters-resource.com/snes/dragonballzhyperdimension/asset/45315/).
  Everything appended below the original rip's last row is the author's own.

This list is the whole of it. A sheet that enters the project adds a line here,
naming whoever ripped it and where it came from; a sheet that stops being used
loses its line.

## Legal

This is a non-commercial fan project. _Dragon Ball Z_ and _Hyper Dimension_ are
properties of their respective owners (Bandai / Bird Studio / Toei / Nintendo).
No original game assets are distributed in this repository — not the sprites, not
the audio, and not in any encoding. What is here is the code and the data we
wrote ourselves, which is coordinates into an image the repository does not
carry.
