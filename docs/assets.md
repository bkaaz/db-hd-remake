# Assets — strategy & sourcing

How we get the graphics/audio for the remake, and how much of it can be
automated. Based on research done 2026-08-07.

## Strategy: reimplement the engine, reuse the original data

We follow the proven fan-remake model (like OpenRA, ScummVM, DevilutionX): we
**reimplement all game logic in TypeScript** and **load the original game's
assets as static data**. We do **not** run an emulator at runtime. An emulator
is only a **research/extraction tool** (see below).

Project is **non-commercial** and aims to stay **publishable**. Original assets
are property of Bandai / Toei / Bird Studio.

**Storage policy — Bring Your Own Assets (BYOA):** we commit **only our own
work** — the engine code and our authored `*.character.json` (frame rects,
anchors, animations, hitboxes). **Copyrighted images/audio are never committed**
(gitignored) and never enter git history. The user supplies the source sheet
from their own copy; the tool loads it locally. This is the model that keeps
projects like OpenRA / ScummVM / DevilutionX legally distributable.

To keep our coordinates valid across machines we pin to a **canonical source
sheet** (documented source URL + expected hash) per character; an optional
`fetch-assets` helper can download the canonical sheets on the user's behalf.

(Note: practical common-practice reasoning, not legal advice.)

## Key finding: the full roster is already ripped

The community has ripped **all 10 playable characters**. The original roster
maps 1:1 to what's available:

| Original roster            | Ripped (Spriters Resource / Sprite Database) |
|----------------------------|----------------------------------------------|
| Goku                       | Goku                                         |
| Gohan                      | Gohan                                        |
| Piccolo                    | Piccolo                                      |
| Majin Vegeta               | Vegeta                                       |
| Vegito                     | Vegito                                       |
| Gotenks                    | Gotenks                                      |
| Majin Buu                  | Fat Buu                                      |
| Kid Buu                    | Kid Buu                                      |
| Frieza                     | Frieza                                       |
| Perfect Cell               | Cell                                         |

Also available: **portraits, ending sprites, ~2 backgrounds/stages, "extras"**.

⚠️ Caveat from research: some sheets **may be incomplete** (occasional missing
frames). So an emulator ripper is kept as a **gap-filling tool**, not the
primary source.

## What can be automated — honest assessment

| Element | Automation | Notes |
|---|---|---|
| **Character sprites** | ✅ Already done | Use existing ripped sheets — skips the tedious pixel-ripping entirely. |
| **Slicing sheets → frames + atlases** | 🟡 Semi-auto | Tools (Aseprite / TexturePacker + a script) cut & pack, but tagging animation frames needs some manual work. |
| **Filling gaps in sheets** | 🟡 Semi-auto | Mesen-S: OAM viewer + PNG export + Lua API to rip missing frames live. |
| **Hitboxes / frame data** | 🔴 Manual | Not present in sheets; no public disassembly found. Authored by hand, informed by frame-stepping the game in an emulator. |
| **Physics / logic / game feel** | 🔴 Reimplemented | 65816 machine code — studied in a debugger, rewritten in TS. Not "extractable". |

**Bottom line:** "everything fully automatic" is not achievable, but the
biggest/most tedious block — the artwork — is essentially already available.
What remains (hitboxes, frame data, logic) is the actual work of *building a
fighting game* and cannot be automated away by any approach.

## Primary path: sprite sheets + our own editor

Active plan: use ripped **sprite sheets** and process them with our own
browser-based sprite editor. See [`tooling.md`](./tooling.md).

### MUGEN — parked (future accelerator)

MUGEN characters built on Hyper Dimension sprites (e.g. Kamekaze's pack) carry
frame grouping, timing, anchors and hitboxes/hurtboxes (`.air` Clsn1/Clsn2) as
parseable data — a shortcut if hand-authoring gets too slow. **Not part of the
active plan**; kept documented so we can reach for it later.

⚠️ Do not confuse with **"Hyper Dragon Ball Z" (Team Z2)** — a different game
with original, custom-drawn HD art, not Hyper Dimension's SNES sprites.

## Tools

- **Mesen-S** — SNES emulator with debugger, OAM/tile viewers, PNG export, and a
  Lua scripting API. Research/extraction/RE tool for filling sprite-sheet gaps.
  Not a runtime dependency.
- **Fighter Factory** — reference/validation viewer for MUGEN data (parked path).

## Reference material

- [Spriters Resource — DBZ: Hyper Dimension](https://www.spriters-resource.com/snes/dragonballzhyperdimension/)
- [Sprite Database — DBZ: Hyper Dimension](https://spritedatabase.net/game/382)
- [Wikipedia — DBZ: Hyper Dimension](https://en.wikipedia.org/wiki/Dragon_Ball_Z:_Hyper_Dimension)
- [Mesen-S — Script Window / Lua API](https://www.mesen.ca/snes/docs/debugging/scriptwindow.html)
- [Romhacking.net — DBZ: Hyper Dimension](https://www.romhacking.net/games/284/)
- English fan translation: Twilight Translations (2010) — useful as reference.

## Open items

- Verify per-character sheet completeness (which frames, if any, are missing).
- Decide atlas format & animation metadata schema for PixiJS.
- Decide how hitbox/frame-data is authored and stored (see roadmap Phase 3).
