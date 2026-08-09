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
npm run fetch-assets     # sprite sheets are not in this repo — see below
npm run fx               # generate the effect sprites (we draw those ourselves)
npm run dev
```

Then open the URL Vite prints (it opens the browser automatically). Two fighters
face each other on a ground line. **←/→** walks, **↑** jumps, **↓** crouches,
**A**/**S** punch, **Z**/**X** kick, and holding away from your opponent blocks
whatever lands next. **T** makes the training dummy attack on a timer, so the
reactions can be seen; **B** toggles the collision-box overlay.

Without the assets step the page reports that the entity could not be loaded.

## Assets (Bring Your Own Assets)

This repo ships **only our code + data** — no copyrighted game art. Source assets
live under `assets/` (gitignored), by type:

```
assets/sheets/       character sprite sheets (the editor reads these)
assets/audio/        (future) sfx / music
assets/backgrounds/  (future) stage art
```

On a fresh clone, fetch them with:

```bash
npm run fetch-assets     # download/verify assets listed in assets.manifest.json
npm run hash-assets      # print local files' sha256 (to fill the manifest)
```

If an asset has no direct download URL, the command prints exactly where to get
it and where to place it. See [`docs/assets.md`](./docs/assets.md).

## Entity editor

```bash
npm run editor           # asset pipeline tool at /tools/entity-editor/
```

Load a sheet from `assets/sheets/`, frame it, build animations, and Save. An
entity is a **directory of section files** — `data/entities/<name>/frames.json`,
`animations.json`, `states.json`, … (committed) — and Save writes the section
belonging to the active tab, plus a keyed `assets/atlases/<name>.png`
(gitignored). See [`docs/data-format.md`](./docs/data-format.md).

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

Every sheet the project uses is listed, with whoever ripped it and where it came
from, in [`assets.manifest.json`](./assets.manifest.json) — one file, which is
the credit list as well as the download list. Add the ripper and the source
whenever you add a sheet, and keep the list to sheets actually in use.

## Legal

This is a non-commercial fan project. _Dragon Ball Z_ and _Hyper Dimension_ are
properties of their respective owners (Bandai / Bird Studio / Toei / Nintendo).
No original game assets are distributed in this repository — only pointers to
where they can be found, and the code and data we wrote ourselves.
