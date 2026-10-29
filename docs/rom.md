# The cartridge — what is known

A map of what has been found in the original, and how. Why we read it at all:
[ADR 0016](./adr/0016-the-original-is-read-from-the-cartridge.md). Addresses
are confirmed unless marked `?`. A field that code reads gets its address in
that code; this page is for what nothing reads yet.

**The ROM:** `raw/rom/` (BYOA). The dump in use carries a fan translation's
patch (4 MB, header title overwritten); character data sits where PalMod
expects it in the clean Japanese 3 MB dump, so the patch appended rather than
moved. Mapping mode `0x23`: an **SA-1** cartridge — a second 65816 that runs
most of the game logic.

## RAM — the fighter block

In the SA-1's **I-RAM**: player one at `$3100`, player two at `$3200`, the same
field at the same offset. Code reaches a field as `$46,X` with X = `$3100`. The
fields known so far, with what is still a guess marked: `FIGHTER_FIELDS` in
`src/rom/cartridge.ts` (`npm run dis` names them in its output).

Outside the block: `0x80–0x87` and `0x90–0x97` of I-RAM are rectangles (x1,
x2, y1, y2, 16-bit) that follow the drawing `?`; `0x0b2` counts hitstop down.

## ROM

Pointers are 3-byte **LoROM** addresses (`$32:BAE9` is file `0x193ae9`). Goku's
tables, and how a drawing is put together, are in `src/rom/cartridge.ts` and
`src/rom/frame.ts`; `npm run rom` reads them.

| where | what |
|---|---|
| `0xb0000` … | Goku's palettes, 32 bytes each, by stage lighting and side (PalMod) |
| `0x1d8000 + 32 × drawing` | the drawing's boxes — which slot is what: `src/rom/collision.ts` |
| `0x27b161` | a second Goku palette, "Hair lighting and KI Blast effects" (PalMod) — the ki blast's and the hair overlay's |
| `0x62a15` … | Goku's animation scripts in bank `$0C`: 256 pointers by move id, then the scripts (below) |

**An animation script** is what a move plays: steps that hold a drawing for
some frames, with commands between them — far Y is `02 ee ee  08 46 00
a0 00 06  08 4a 00  04 4a 00  10 46 00  00`, frame for frame what a recording
shows. The engine is at `$01:85FD`; the format, each command's length and what
is known of its meaning are in `src/rom/script.ts`, and the table from move id
to script in `src/rom/cartridge.ts`. `npm run rom -- move 92` prints one;
the export turns each into an animation named `m92` (`src/rom/animation.ts`).

**Whether a move repeats is not in its script.** The engine restarts every
script that reaches `00`; the move's code ends it (an attack, once its frames
are up) or keeps it going (idle, walking), and some code holds one step while
a button is down (the dash). Only a hold step in the script — crouching's `f0`
— says it in the data. What the code does, per move, is listed beside
`moveAnim` until the handlers are read.

**How a step is drawn is in the script too**: `d0` moves the drawing away from
the fighter's position and `e0` flips it whole, both lasting until set again —
the sprite routine at `$00:8180` adds the one and XORs the other with the
facing. The somersault is two drawings, raised 48 px and turned. The export
makes each such way of showing a drawing a frame of its own
(`src/rom/look.ts`).

**`b0` spawns an object** (handler `$01:873F`): a type and an animation, a
start step, flags and a palette, and a position from the fighter's, x
mirrored when facing left. Objects are animated by `$00:843F`: type →
`$09:B258` → the type's animations → steps of 3-byte pointers to frames in
the same layout format as a fighter's. Goku's transformation spawns type 0
animation 5 — the missing top of the hair; his ki blast is type `a`
animation 3, 40 px ahead and 56 px up.

**Every graphic is a resource**: one table of 11-byte records at `0x40000`
(`$08:8000`, looked up by `$00:B265`) — a pointer to tiles, their size,
a pointer to a palette. Goku's tile set `n` is resource `0x100 + n`; the
rest are loaded into fixed places in VRAM, and an object's tile numbers
count from there (a `b0` can shift them, `0x800` words = `0x80` tiles).
Matched tile by tile against a VRAM snapshot (`tools/re/dump-vram.lua`,
2026-10-29), all with the hair-lighting palette `0x27B161`:

| what | resource | VRAM | tiles |
|---|---|---|---|
| ki blast | `0x31` | `$7500` | raw, 48 |
| transformation hair | `0x51` | `$6C00` | its tiles 0–7 are the overlay's `0x40`–`0x47` |

The export makes each object Goku spawns a spawn entity (ADR 0018); which
ones, with their recorded timing, is `objects` in `src/rom/cartridge.ts`.
Object slots: ten of 16 bytes at I-RAM `$3300`; each type's behaviour is its
own code in bank `$0F`.

Not read yet: command `80` (move `9d` uses it), and what `a0` / `a1` /
`c0` set off — the attack ids are where hit data must be.

## Another fighter

Every per-fighter table is reached through a pointer table of **ten 3-byte
entries, one per fighter** — the roster. Goku is entry 0 in all of them; which
fighter the other entries are is not mapped yet. Found 2026-10-29 by
searching for pointers to Goku's tables:

| what | pointer table | Goku's entry | `FighterTables` field |
|---|---|---|---|
| layouts, by drawing | `0x487d2` | `$09:880E` | `layouts` |
| drawing → its tile resource | `0x487f0` | `$09:8A54` | `tileSets` |
| boxes, by drawing | `0x151aa5` | `$3B:8000` | `boxes` |
| animation scripts, by move | `0x88de` (`$01:88DE`) | `$0C:AA15` | `scripts` (the index) |
| resource loaded at VRAM `$6800` | `$01:848B`, 2-byte ids | `0x47` | — |

The **tile-resource table holds a 2-byte resource id per drawing** (`0x012f`
is resource `0x12f`), not a tile set and a "used" flag as
`tileSetOf` in `src/rom/cartridge.ts` reads it — right for Goku only because
all his resources are `0x1xx`. A resource's record names its palette too
(Goku's: `$16:8000`, the `0xb0000` PalMod lists). The fighter-block field
`0x41` holds the script-table index, `0x00` the character.

A new fighter: fill a `FighterTables` from these tables, export, then record
his objects' timing (`log-objects.lua`) and VRAM (`dump-vram.lua`) for
`objects` — the only part the cartridge's data does not hold.

## How it was found

`tools/re/` — Mesen 2 Lua scripts, run from Debug → Script Window with *Allow
access to I/O* on; each writes into `logs/`.

| script | answers |
|---|---|
| `record-ram.lua` | every RAM region and the pad, once per frame — find a value by what was pressed |
| `log-dma.lua` | every DMA, beside the sprite id — where graphics come from |
| `trace-tiles.lua` | every ROM read the SA-1 makes while it fills the tile buffer, in order |
| `trace-anim.lua` | every ROM read around a change of move, step, drawing or tile set |
| `log-moves.lua` | which move id each action picks, with the pad and velocities — runs at full speed |
| `dump-vram.lua` | VRAM, palettes and OAM every few frames — which resource each tile on screen came from |
| `log-objects.lua` | every change to the ten object slots — an object's frames, timing and speed |
| `log-oam.lua` | every sprite in OAM while an object of one type is up — what the game draws, frame by frame |

Measured on Goku (2026-10-28, training mode): walk 1.5 px/frame forward and
1.25 back; jump −9.86 px/frame with gravity 0.469; hitstop 8 frames; the
defender's reaction to a close Y, 21 frames. Health does not fall in training — find it in
a real match.
