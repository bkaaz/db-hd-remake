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
work** — the engine code and our authored `*.entity.json` (frame rects,
anchors, animations, hitboxes). **Copyrighted images/audio are never committed**
(gitignored) and never enter git history. The user supplies the source sheet
from their own copy; the tool loads it locally. This is the model that keeps
projects like OpenRA / ScummVM / DevilutionX legally distributable.

**There is one machine, and the pack lives on it** (2026-08-21). The project
used to pin each asset to a canonical public download — source URL plus expected
sha256 — so that coordinates stayed valid wherever the repo was cloned. Neither
half of that survived contact with the work: the audio was captured from the
game's sound test and exists nowhere public, and the sheet is now appended to by
hand, so it matches no published file. The manifest and its fetch command are
gone; the README says to ask the author for the pack.

**Layout — three gitignored roots, and each answers one question** (2026-08-22).
They mirror each other, so where a file goes is never a judgement call:

```
raw/       audio/sound-test.wav      sheets/goku-rip.png     what these were made from
           rom/*.sfc  (the cartridge, ADR 0016)
assets/    audio/sfx/*.wav           sheets/goku.png         what the game reads
preview/                                                     what a person looks at
```

- **`assets/` is exactly what the game opens.** Nothing else. `sheets/spawns/`
  is the one part of it a command rebuilds (`npm run fx`).
- **`raw/` is exactly what cannot be regenerated.** The uncut capture that
  `npm run split-audio` cuts into `assets/audio/sfx/`, and untouched rips.
  Nothing reads it at runtime.
- **`preview/` is disposable** — contact sheets and effect previews, rebuilt by
  `npm run sheet` and `npm run fx`, never read back by code.

**The payoff is that `npm run pack` needs no knowledge.** One archive is
`assets/`, the other is `raw/`; there is no file list to drift out of date,
because the directories *are* the answer. The archives land in `dist/assets/`,
and a copy of one somewhere else is the backup — the file in `dist/` dies with
the same disk the repo does.

**Attribution lives in the README's Credits section**, one line per sheet naming
whoever ripped it and where it came from. It moved there when the manifest was
deleted, on the grounds that a credit is read by a person and not by a script.

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
browser-based entity editor. See [`entity-editor.md`](./entity-editor.md).

⚠️ When looking for sprites, do not confuse Hyper Dimension with **"Hyper Dragon
Ball Z" (Team Z2)** — a different game with original, custom-drawn HD art, not
Hyper Dimension's SNES sprites.

## The sheet we have, and why it stays

**A bigger rip exists and was measured rather than guessed.** Sprite Database's
is 3.3× the area of ours and includes the black-haired base form we barely have;
a single sprite uses 18 colours and its palette values match ours exactly, so the
same poses are pixel-identical and a script could have carried every frame id,
anchor and box across. **It was still refused: drop shadows and effects are
painted into those sprites and cannot be subtracted.** A shadow welded to a frame
cannot be put under a fighter who is in the air, and an aura welded into a pose
cannot be switched off — the opposite direction from generating our own effects.
Gaps get filled another way rather than by swapping the foundation.

**The sheet is 1-bit alpha, and that is a property to protect.** SNES sprites
were drawn or not drawn; there is no anti-aliasing to preserve. It is also what
keeps palette swaps possible, since a colour map is only unambiguous while every
pixel is exactly one palette colour. **So hand-drawn additions must never be
anti-aliased.**

**Colours that look off-palette usually are not.** The rip carries two spellings
of the same SNES colour — an exact 5-bit round-trip, `v<<3` against
bit-replication — so 27 of its colours are one colour written twice, and its 118
colours are really 91. Choosing between the two is choosing a spelling, not a
colour. Leave it alone: normalising the sheet would buy a palette-swap tool that
does not exist yet, and that tool can group by `c>>3` in one line at build time.

## What may live in the repo, and what may not

The rule is **not** "code yes, images no". Copyright attaches to the expression,
not to the file format: the same sprite written as a PNG, a base64 string or a
TypeScript array of pixels is the same work in a different container.

The line is whether the repo carries the expression or only points at it. One
test settles it:

> **If the source sheet were deleted, would this file still produce the sprite?**
>
> - **Yes** → it *is* the artwork, whatever its extension. Keep it out.
> - **No, it needs the sheet** → it is a pointer or a recipe. Fine to commit.

By that test: `frames.json` is coordinates into somebody else's image and is
useless without it — fine. A recipe that composes a missing pose out of two
existing frames carries no pixels and only works for someone who already has the
sheet — fine. A pixel array of a ripped sprite fails, however it is encoded.

**Art drawn from scratch is yours** and may be committed in any form — our
generated effects are the example. It is still a derivative of a protected
character design, so it does not make the project free of the original rights;
what it does is avoid the one clear-cut act, which is redistributing extracted
assets.

**Sprites appended to the sheet give that right up, and knowingly.** A pose drawn
by hand into `goku.png` would be committable on its own; painted into the ripped
sheet it is inseparable from it, so it stays gitignored with everything else in
`assets/`. The alternative — a second image, own art only — costs `frames.json` a
per-frame "which sheet", and the gaps are mostly composites of ripped frames
anyway, which could not be committed either. The seam was judged not worth the
format change. Revisit it if a fighter ever ends up mostly hand-drawn.

**The risk that buys, named rather than hidden:** a hand-edited sheet has
*versions*, and `frames.json` is coordinates into one of them. Restoring an
older copy would draw the wrong sprite for every frame above 180 and error on
none of them. The owner took that knowingly when the manifest and its sha256
went (2026-08-21); the mitigation is the append-only rule, which keeps existing
ids true. If it ever bites, what comes back is a hash kept purely as a version
check — not the fetcher.

That is the whole point of BYOA. It was never a claim of legal cover for a fan
remake — it removes the single unambiguous risk at a cost of nothing, and keeps
git history clean, which is a property you lose exactly once.

## Tools

- **Mesen-S** — SNES emulator with debugger, OAM/tile viewers, PNG export, and a
  Lua scripting API. Research/extraction/RE tool for filling sprite-sheet gaps.
  Not a runtime dependency.

## Reference material

- Spriters Resource — DBZ: Hyper Dimension
- Sprite Database — DBZ: Hyper Dimension
- [Wikipedia — DBZ: Hyper Dimension](https://en.wikipedia.org/wiki/Dragon_Ball_Z:_Hyper_Dimension)
- [Mesen-S — Script Window / Lua API](https://www.mesen.ca/snes/docs/debugging/scriptwindow.html)
- [Romhacking.net — DBZ: Hyper Dimension](https://www.romhacking.net/games/284/)
- English fan translation: Twilight Translations (2010) — useful as reference.

## Open items

- Verify per-character sheet completeness (which frames, if any, are missing).
- Decide how hitbox/frame-data is authored and stored (see roadmap Phase 3).
