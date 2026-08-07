# CLAUDE.md

Guidance for Claude when working in this repository.

## What this project is

A browser-based fan **remake of _Dragon Ball Z: Hyper Dimension_** — a 2D
versus fighting game originally released on the **SNES / Super Famicom in 1996**
(developer TOSE, publisher Bandai). This is a **non-commercial fan project**.

Written in **TypeScript**, rendered in the browser with **PixiJS v8**, bundled
with **Vite**.

## Working style (important)

The project owner wants to go **slowly and deliberately**:

- **Do not guess. Ask about everything.** When a design or scope decision is
  unclear, ask rather than assume — especially details about the original game's
  mechanics, roster, or feel.
- Prefer small, reviewable steps over large jumps.
- The primary conversation language with the owner is **Polish**. Code,
  comments, commits, and docs are in **English**.

## Tech stack

- **Language:** TypeScript (strict mode)
- **Rendering:** PixiJS v8 (WebGL 2D)
- **Build/dev server:** Vite
- **Package manager:** npm
- **Assets:** placeholders (simple shapes) for now; real art decided later.

## Commands

```bash
npm install      # install dependencies
npm run dev      # start Vite dev server (opens browser)
npm run build    # typecheck + production build
npm run typecheck# typecheck only
```

## Structure

```
.
├── index.html        # page shell + #app mount
├── src/
│   └── main.ts       # entry point — currently just boots Pixi (no game logic)
├── docs/             # design notes & decisions (read these before building)
├── vite.config.ts
└── tsconfig.json
```

## Current status

Repo scaffolded with a runnable-but-empty Pixi boot. **No game logic exists
yet.** Mechanics are still being discussed and recorded in `docs/`.

See `docs/` for the game overview, roadmap, and open questions.
