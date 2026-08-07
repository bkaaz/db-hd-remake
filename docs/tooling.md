# Tooling — asset pipeline (actor editor)

How we turn sprite sheets into game-ready data. We build our own small
browser-based tool rather than gluing several existing ones together.

## Decision: build our own, sprite-sheet-first

No existing tool does all of what we need (browser + slice ripped sheets +
fighting-game hitboxes + export to **our** format). Each covers only a slice, so
we'd end up hand-shuffling data and converting at the end anyway.

**MUGEN import is parked** (see below) — not part of the active plan. We build
for sprite sheets first.

**Implementation note:** the editor is built with **plain Canvas 2D + TS**
(under `tools/actor-editor/`), not PixiJS — drawing frame/anchor/box overlays
on an image is native Canvas 2D work. PixiJS is reserved for the game runtime.
The editor shares the project's Vite toolchain as a second page.

## Architecture: one data model, multiple importers

The tool is built around a single internal data model:

```
model = frames + anchors + animations (timing) + hitboxes/hurtboxes
```

Around it:

- **Importer — sprite sheet (active):** load a PNG → cut into frames (manual
  rectangles first; auto blob-detection later) → set per-frame anchor → group
  frames into named animations with timing → author hitboxes/hurtboxes.
- **Importer — MUGEN (parked):** slot kept open. Later, parsing `.air` (text)
  fills frames/timing/anchors/hitboxes almost for free; `.sff` provides images.
- **Exporter — our format:** PixiJS atlas (PNG + JSON) + animation/hitbox data.

The same primitives ("draw a rectangle", "set a point") serve frame selection,
anchors, and hitboxes — so the code is smaller than it sounds.

Keeping this clean model means the parked MUGEN importer can slot in later
without reworking the editor or exporter.

## Phases

- **Phase 1 — MVP (small):** ✅ done — `tools/actor-editor/`. Load image →
  manual rectangle frame selection → per-frame anchor → animations with timing →
  playback preview → export `*.actor.json` + atlas. Verified end-to-end
  (draw frames → build animation → export matches `data-format.md`).
- **Phase 2 (in progress):**
  - ✅ Background color-keying (auto-detect + eyedropper + tolerance; alpha baked
    into export).
  - ✅ Auto-slice via connected-component detection ("Detect all" + "Magic
    click"), with a gap-close slider to merge fragments and a min-area filter.
  - ⬜ Hitbox/hurtbox/push layer.
  - ⬜ Tight atlas repacking; more UX polish.
- **Phase 3 (parked):** MUGEN importer — `.air` parser first (cheap, high
  value), then `.sff` parser.

## Repo-integrated I/O

Replacing upload/download with direct repo file access, since the editor is
always used against a specific sheet in this repo. **Implemented**
(`npm run editor`, `npm run fetch-assets`).

- **Mechanism:** a **Vite dev-server plugin** (`configureServer`, dev-only) with
  endpoints:
  - `GET /api/sheets` — list `assets/sheets/`.
  - `GET /api/actor?name=` — read existing character JSON (to keep editing).
  - `POST /api/actor` — write JSON + keyed atlas PNG to repo files.
  - Source images are served by Vite directly (`/assets/sheets/<name>.png`).
- **Command:** `npm run editor` (dedicated port; optional `?sheet=` preselect).
- **UI:** sheet dropdown + Load (hydrates from existing JSON) instead of upload;
  Save (writes to repo) instead of download. Upload/download kept as fallback.
- **Layout:** input `assets/sheets/<name>.png` (gitignored); committed
  `content/actors/<name>.actor.json`; runtime keyed atlas
  `assets/atlases/<name>.png` (gitignored, regenerated locally).
- **Storage = BYOA:** only our code + JSON + the manifest are committed; images
  are gitignored and never enter git history. A committed `assets.manifest.json`
  + `npm run fetch-assets` fetch/verify source assets on the user's machine. See
  [`assets.md`](./assets.md) and [`decisions.md`](./decisions.md).

**Status:** ✅ Vite plugin (`/api/sheets`, `/api/sheet`, `/api/actor`
GET/POST); ✅ dropdown Load from repo + hydrate existing JSON; ✅ Save writes
`content/actors/*.json` + keyed `assets/atlases/*.png`; ✅ `assets.manifest.json`
+ `npm run fetch-assets` / `hash-assets`. Verified end-to-end on a real sheet
(load → detect → save → reload → hydrate) and the missing-asset guidance path.

## Existing tools — landscape (for reference)

| Tool | Does | Missing for us |
|---|---|---|
| Leshy SpriteSheet Tool (browser, free) | slices sheets (auto), export | no hitboxes / MUGEN / our format |
| ShoeBox (free, Adobe AIR) | extract sprites (blob detection) | dated; no hitboxes / MUGEN / our format |
| Aseprite (desktop, paid) | edit/animate, JSON export | poor at slicing packed rips; no fighting hitboxes; no MUGEN |
| TexturePacker / Free Texture Packer | pack individual PNGs → atlas | reverse direction; no hitboxes |
| Fighter Factory (desktop) | reads/visualizes MUGEN SFF/AIR + Clsn boxes | desktop; outputs MUGEN format; no sheet slicing |

**Fighter Factory** is kept as a *reference/validation* tool for MUGEN data, not
for production.

## Parked: MUGEN as a future accelerator

If hand-authoring frames/hitboxes gets too slow, MUGEN characters built on Hyper
Dimension sprites (e.g. Kamekaze's pack) are a documented shortcut: their `.air`
files already contain frame grouping, timing, anchors (offsets) and
hitboxes/hurtboxes (Clsn1/Clsn2) as parseable data. See [`assets.md`](./assets.md)
for sources and the ⚠️ "Hyper Dragon Ball Z (Z2) is different sprites" caveat.
