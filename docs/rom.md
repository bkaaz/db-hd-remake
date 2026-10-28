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
| `0x1d8000 + 32 × drawing` | read on every drawing change: 4-byte entries up to `0x80` — the drawing's boxes `?` |
| `0x632xx`, `0x633xx` | **animation scripts** in bank `$0C`, Goku's normals among them (below) |

**An animation script** is a list of steps, read three bytes at a time:

```
n  drawing  00     hold `drawing` for n frames      (drawing ee: keep the current one)
a0 xx yy           a command between steps — every attack has one after its
                   first step, so it likely arms the hit `?`; c0 xx, f0 xx yy too
00                 end
```

Far Y is `02 ee ee  08 46 00  a0 00 06  08 4a 00  04 4a 00  10 46 00  00` at
`0x632cf`, frame for frame what a recording shows; close Y and X sit beside it.
The steps are data, but **what plays which script** is not found: the handlers
are 65816 code (a jump table on the step number), and no table from move id to
script has turned up yet.

Unpacked tiles go to BW-RAM `$0C00` (player one) / `$1600` (player two) and are
DMA'd to VRAM `$6000` / `$7000` as 4bpp tiles.

## How it was found

`tools/re/` — Mesen 2 Lua scripts, run from Debug → Script Window with *Allow
access to I/O* on; each writes into `logs/`.

| script | answers |
|---|---|
| `record-ram.lua` | every RAM region and the pad, once per frame — find a value by what was pressed |
| `log-dma.lua` | every DMA, beside the sprite id — where graphics come from |
| `trace-tiles.lua` | every ROM read the SA-1 makes while it fills the tile buffer, in order |
| `trace-anim.lua` | every ROM read around a change of move, step, drawing or tile set |

Measured on Goku (2026-10-28, training mode): walk 1.5 px/frame forward and
1.25 back; jump −9.86 px/frame with gravity 0.469; hitstop 8 frames; the
defender's reaction to a close Y, 21 frames. Health does not fall in training — find it in
a real match.
