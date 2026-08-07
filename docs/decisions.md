# Decisions log

Decisions that are settled. Newest first.

## 2026-08-07 — Character data format v0 accepted

- Accepted the v0 character file format (atlas + frames/anchors + timed
  animations + hit/hurt/push boxes). Full spec in [`data-format.md`](./data-format.md).
- Timing in **game frames (60 FPS)**, not ms.
- Box types: **hit / hurt / push** to start.
- Coordinates **relative to anchor, Y-down** (PixiJS convention); facing flip =
  negate X. This is the contract between the sprite editor and the engine.

## 2026-08-07 — Tooling: build our own sprite editor, sprite-sheet-first

- **Build our own** browser-based sprite/animation/hitbox editor in our stack
  (TS + PixiJS, in-repo under `tools/`). No existing tool exports to our format
  or handles fighting-game hitboxes + our schema. Details in
  [`tooling.md`](./tooling.md).
- **Architecture:** one internal data model (frames + anchors + animations +
  hitboxes), with pluggable importers (sprite sheet now) and one exporter (our
  format).
- **MUGEN import is parked**, not descoped forever: kept as a documented future
  accelerator. The clean data model keeps that slot open without rework.
- **Remake goal (context):** a well-playing fighter using Hyper Dimension HD
  sprites; fidelity to the original's exact mechanics is secondary.

## 2026-08-07 — Asset strategy

- **Approach:** reimplement the engine in TypeScript, reuse the original game's
  data as static assets. **No emulator at runtime** — emulator (Mesen-S) is only
  a research/extraction/RE tool. Model follows OpenRA / ScummVM / DevilutionX.
- **Rejected:** running an emulator as the runtime and "modding" its logic live
  (Option A) — hardest, most fragile path, and leads to 65816 assembly instead
  of TypeScript. It does not remove the manual hitbox/frame-data work anyway.
- **Basis:** research confirmed the full 10-character roster is already ripped by
  the community, so pixel-ripping is largely avoided. Details in
  [`assets.md`](./assets.md).

## 2026-08-07 — Initial setup

- **Rendering:** PixiJS v8 (over Phaser / raw Canvas / raw WebGL).
- **Assets:** start with placeholder shapes; real art decided later.
- **Scope of first step:** repo + docs only. Game mechanics to be discussed
  before any gameplay code is written.
- **Stack:** TypeScript (strict), Vite, npm.
- **Working style:** go slowly; don't guess — confirm facts and decisions with
  the owner. Conversation in Polish; code/docs in English.
