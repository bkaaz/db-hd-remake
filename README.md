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
- **The cartridge read by script** — the original's drawings, animation
  scripts, boxes and objects decoded from the player's own ROM, and its sound
  driver run on an emulated SNES sound chip, all in the browser.
- **Tests over the parts that can be tested** — the state machine, its
  validator, collision, the ROM readers and the sound chip run in Node, free
  of PixiJS.

Why the engine is shaped as it is, including what was tried and dropped, is in
[`docs/adr/`](./docs/adr/) — one architecture decision per file.

## Stack

TypeScript · PixiJS v8 · Vite · Vitest

## Getting started

```bash
npm install
echo 'ROM_PATH=path/to/your.sfc' > .env.local   # optional: else the page asks
npm run dev
npm run build            # dist/web: plays from any static host, given a ROM
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

## Your own ROM

This repo ships **only our code + data** — no copyrighted game art or sound.
The game reads the original's pictures and sounds from **your own dump of the
cartridge**, in the browser: the page asks for the file once, checks it is a
dump the readers know, and keeps it in that browser (IndexedDB) for next time. In development, `ROM_PATH` in `.env.local` points at it and
the page asks nothing. Why, and what was rejected:
[ADR 0090](./docs/adr/0090-the-cartridge-is-the-games-one-dependency.md).

Every picture is drawn from it, and every sound is the cartridge's own sound
driver playing it on an emulated SNES sound chip
([ADR 0092](./docs/adr/0092-every-sound-is-the-drivers-rendered-once.md)).

## Entity editor

```bash
npm run editor           # asset pipeline tool at /tools/entity-editor/
```

Open an entity to see its sheet as the ROM draws it, its animations, boxes,
sounds and cancel graph. An entity is a **directory of section files** —
`data/entities/<name>/frames.json`, `animations.json`, `states.json`, …
(committed) — and Save writes the section belonging to the active tab. See
[`docs/data-format.md`](./docs/data-format.md).

## Docs

- [`docs/adr/`](./docs/adr/) — the architecture decisions, one per file, each on
  one screen. The most useful place here if you want to see how the thing was
  reasoned about.
- [`docs/plan.md`](./docs/plan.md) — the work queue, and the only one. Finished
  items are deleted from it, so it only ever shrinks.
- [`docs/data-format.md`](./docs/data-format.md) — the contract between the
  editor and the engine.
- [`docs/`](./docs) — everything else; start at [`docs/README.md`](./docs/README.md).

## Credits

- **The SNES sound chip's interpolation table** is rebuilt from the formula of
  [ares](https://github.com/ares-emulator/ares) (ISC licence, © 2004-2025 ares
  team, Near et al) — `src/apu/gauss.ts`.
- **The chip's arithmetic** — the SPC700's flags, BRR, the envelopes, the
  echo — follows nocash's *fullsnes*.
- **The Goku rip** from
  [The Spriters Resource](https://www.spriters-resource.com/snes/dragonballzhyperdimension/asset/45315/)
  carried the project until the cartridge was read; nothing uses it any more.

A source that enters the project adds a line here.

## Legal

This is a non-commercial fan project. _Dragon Ball Z_ and _Hyper Dimension_ are
properties of their respective owners (Bandai / Bird Studio / Toei / Nintendo).
No original game assets are distributed in this repository or in its build — not
the sprites, not the audio, and not in any encoding. What is here is the code and
the data we wrote ourselves; every picture and sound is drawn from the player's
own cartridge, in the browser, at runtime.
