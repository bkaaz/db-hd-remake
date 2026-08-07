# DBZ: Hyper Dimension — Remake

A browser-based, TypeScript fan remake of **Dragon Ball Z: Hyper Dimension**
(SNES / Super Famicom, 1996). Non-commercial fan project — work in progress.

## Stack

TypeScript · PixiJS v8 · Vite

## Getting started

```bash
npm install
npm run dev
```

Then open the URL Vite prints (it opens the browser automatically). You should
see a dark canvas with a placeholder label — the game itself isn't built yet.

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

Load a sheet from `assets/sheets/`, frame it, build animations, and Save — it
writes `content/entities/<name>.entity.json` (committed) plus a keyed
`assets/atlases/<name>.png` (gitignored).

## Docs

Design notes, roadmap, and open questions live in [`docs/`](./docs). Start with
[`docs/README.md`](./docs/README.md).

## Legal

This is a non-commercial fan project. _Dragon Ball Z_ and _Hyper Dimension_ are
properties of their respective owners (Bandai / Bird Studio / Toei / Nintendo).
No original game assets are distributed in this repository.
