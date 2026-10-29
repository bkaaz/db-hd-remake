# The cartridge — what is known

A map of what has been found in the original, and how. Why we read it at all:
[ADR 0016](./adr/0016-the-original-is-read-from-the-cartridge.md); how — the
code first, a recording to confirm: [ADR 0022](./adr/0022-logic-is-read-from-the-code.md). Addresses
are confirmed unless marked `?`. A field that code reads gets its address in
that code; this page is for what nothing reads yet.

**The ROM:** `raw/rom/` (BYOA). The dump in use carries a fan translation's
patch (4 MB, header title overwritten); character data sits where PalMod
expects it in the clean Japanese 3 MB dump, so the patch appended rather than
moved. Mapping mode `0x23`: an **SA-1** cartridge — a second 65816 that runs
most of the game logic.

## Where to start a search

For one move, start with `npm run rom -- port <id>`: what the tables and its
handler say, already put together (`src/rom/port.ts`). Each of these has
led somewhere; `npm run dis -- find <bytes>` lists every place a pattern
occurs.

- **Who sets a move:** `$01:8518`, with the move id in A —
  `find 22 18 85 01`; an `a9 nn` just before it is a move by number.
- **Who reads or writes a field:** `b5 nn` (`LDA $nn,X`), `95 nn` (`STA`),
  `d6 nn` (`DEC`) — e.g. `find b5 8c`. The other fighter is `JSL $0D:D7DB`,
  which leaves Y = X ^ `$0300`, and is read as `b9 nn 00` (`LDA $00nn,Y`).
- **Per-fighter data:** a table indexed by field `0x00`, ×2 or ×32 — the hit
  table (`$3D:8000`), the attributes (`$3D:9D9B`, through `$0D:C4C1`), the
  close lines (`$3D:9EDB`). A constant table in bank `$3D` is likely another.
- **A sound:** `JSL $0D:D82E` with the id in A — `find 22 2e d8 0d`.
- **What a move does while it plays** — moving, re-arming its hit: its
  handler. `$0F:8000` runs each fighter's frame and jumps through `JML
  [$67]`: a 2-byte table per fighter at `$0F:8061` (Goku `$0F:8075`), then 3
  bytes per move id. A handler keys on field `0x44` (frames since the move
  began) and sets vx as `LDA #imm / STA $7C,X`, mirrored for facing left;
  `JSL $0D:D8A2` re-arms the blow for the next hit. The normals share one
  (`$0F:AA54`); a special has its own — Quadruple Kick's is `$20:8663`.
- **Where code lives:** `$01` the animation and object engines, `$0D` the
  rules of a fight (hits, buttons, the CPU's choices), `$0F` move handlers.
  `dis` cannot tell code from data: a run of `BRK`, `COP` or `SBC long` is a
  table, not a routine.

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

**An object's behaviour is its type's code**: `$0F:B44B` runs the ten slots
and jumps through a word table by type at `$0F:B467` (type `0` `$0F:B789`,
`a` the ki blast `$0F:E0D7`); a type may jump again by animation (type `0`:
`$0F:B79F`). A slot's fields: `+0` type (bit 7: alive), `+1` animation, `+2`
frame shown, `+3` tile base, `+4` attributes, `+05`–`+07` x and `+08`–`+0A`
y (8.16), `+0B` a timer, `+0C` / `+0E` vx / vy (8.8) — moved by `$0F:E4EB`.
`b0`'s last five bytes are the timer's start and vx / vy, x mirrored facing
left (`$01:87CA`): the ki blast 3.0 / 0, the Kamehameha's beam 3.0 / −3.0.
The usual animator is `INC $0B,X / CMP #n` then `INC $02,X / CMP #m`: n
frames a step, m steps, then gone (`JSL $0F:B4ED`). The beam (type `0`
animation `2`, `$0F:B7BE`) never changes its frame: it lives 80 frames,
stopped during hitstop, and every 4 frames loads resource `0x130` + (frame
counter `$74` / 4 mod 4) over its tiles (`JSL $01:84EF`) — it shimmers by
swapping graphics.

**`b0`'s second byte is a counter** (field `0x6e`): a spawn fires only when
they match, then counts it up. A handler picks among a script's spawns by
setting it — the charged Kamehameha (`aa`, handler `$20:8447`) leaves it 0
for a full charge (A held past frame 35), sets `10` for a release in 20–35
and `18` before 20, so the frame-44 spawns that fire are type `a`
animation `21`, `20` or `19` (80 / 60 / 40 damage, vx 4) with animation
`22` beside it. The pose after (`89`) is cut short once the beam is gone
(`JSL $0D:EBE0` with `Y` = animation and type).

**`b1` starts an effect that is drawn, not a sprite** (`$01:8834`, counter
field `0x6f`): kind, position and size into a block per side at `$30BA` /
`$30CA`, drawn by `$2A:A36D` by kind. Kind 2 is the charging ball
(`$2A:A58F`): a circle whose half-width per line comes from the table at
`$2A:A70C` times the radius `+0A`, drawn as a window with colour maths. The
Kamehameha's handler grows it by 2 a frame (`INC $30C4` twice); once
released it shrinks by 2 a frame and is gone.

**The charged Kamehameha's objects** (type `a`, by animation at
`$0F:E0ED`): its head is animation `19`, `20` or `21` (32×32, 32×48, 48×64),
showing frame `($74 & 4) / 4` — the two frames flip every 4 frames of the
global counter — and gone once its owner leaves the move (`$0F:E5FC`);
`22` is the base at the hands, 24 px ahead of the fighter, a step every 4
frames, steps 2–4 looped while the beam is drawn, 5–7 on the way out
(`$0F:E70F`). The beam between them is not an object: the base writes its
start into the effect block (`$30BC`), and a `b1` effect of kind 1 draws the
band. A drawn effect is added light: the yellow COLDATA 20, 20, 8 (of 31)
added to BG1, BG2 and sprites inside a window (`$2A:A29A`). The band runs
from `+2` to `+6` of the block — the head writes its own x there each frame
and thickens it by 1 every 8 frames up to 5, or 9 for the full charge
(`$0F:B63D`); its half-height is the block's size × `+0C` / 256, `+0C`
being `b1`'s last byte × 16. All of it is resource `0x32` (loaded at `$6C00`) in that resource's
own palette — a resource's record holds a palette pointer at bytes 5–7.
`npm run rom -- object a 15 32@6c00 80` draws an object's frames to look at.

The export makes each object Goku spawns a spawn entity (ADR 0018); which
ones, with their recorded timing, is `objects` in `src/rom/cartridge.ts`.
Object slots: ten of 16 bytes at I-RAM `$3300`; each type's behaviour is its
own code in bank `$0F`.

**`a0` plays a sound**, not a blow: `$0D:D82E` queues the id at `$cb`
(`$00:DE31`) and `$00:D879` hands it to the APU at `$2141`. For player two
the id is shifted by the byte at `$0D:D852 + id` — each side's voice sits in
its own range: `+9` for the effects `05`–`0d`, `+3` for the voices from
`30`. The sound test plays its number as the id, unchanged below `0x50`
(`$00:D213`, number in `$19A6`) — but the clips of our capture are numbered
by where the silences fell, not by the sound test, so a clip is **not** an
id: matching them by an offset gave a wrong hit sound. A melee hit plays
`09` (`$0D:D1B7`) and the defender's own `30`; a projectile's, `0a` and `30`
(`$0D:D1E6`). The export puts each script's `a0` on the animation step it
begins (`sfx`); `"rom"` in a `sounds.json` is which ids are matched — by the
code that plays them, since a clip's number says nothing:

| id | played by | ours |
|---|---|---|
| `06` / `07` | a punch's / a kick's script | `swing_1` / `swing_2` |
| `09` | a melee hit (`$0D:D1BC`) | `hit_1` |
| `0a` | a projectile's hit, a blocked projectile (`$0D:CF6D`, `D1E9`) | — |
| `0b` | the ki blast fired (script) | `blast_1` |
| `0c` | landing from a jump (`$0F:9FB8`) | `land_1` |
| `0d` | a body hitting the floor (knockdown handler `$0F:A217`) | `land_2` |
| `17` | a blocked melee blow (`$0D:CF55`) | `block_1` |
| `19` | charging ki, every 8 frames (`$0F:A044`) | `charge_1` |
| `25` | charging the Kamehameha (`aa`'s script) | `charge_2` |
| `30` | the defender's voice, on every blow taken (`$0D:D1C3`) | goku's `voice_hurt` |
| `31` | the voice at KO (`$0D:D10C`) | — |
| `32` | an attack's shout (the ki blast, specials) | goku's `voice_shout` |

**Charging ki refills health**: `+5` every 8 frames up to field `0x62`
(`$0F:A059`) — the one bar on screen is both.

Not read yet: command `80` (move `9d` uses it), `a1` (`$00:DE9F`, sound
related), and `c0` (sets fighter field `0x96`).

## The buttons

**The player's buttons pick a move in `$0D:FEC8`** — the move ids are
numbers in that code, the same for every fighter; which button picks which
is the table in `src/rom/buttons.ts`. Pressed buttons are fields `0xE8` /
`0xE9` (the pad's low and high byte), held directions `0xED`. On the ground
Y and B have a close and a far move: close when the gap between the two
fighters (field `0x20`) is under the attacker's own line (`$0D:C4A1`), two
bytes per fighter at `$3D:9EDB` — Goku 44 for Y, 48 for B. A recording
agreed: close Y at 41 px, far from 53. The CPU keeps lines of its own for
deciding what to do (`$0D:F7F6`, `$0D:F95B`, `$0D:F96F`).

**Special moves come first** (`$0D:F085`): a command table of 0x150 bytes
per fighter at `$3D:9EEF` (offsets `$0D:F5CF`) — 0x88 on the ground, 0x40
in the air, the rest for mode `$0552` — in 8-byte rows, scanned last row
first: bytes 0–3 conditions (masks on fighter fields `0x4C`/`0x4D` `?`;
Meteor Smash's `0x41` and the ki moves' `05`/`0a` are presumably low health
and ki), byte 4 a sequence, byte 5 the move. A sequence (`$0D:F2E6` + 2 ×
number, words in bank `$0D`) is a button word, then directions **newest
first**, ended by `0000`, as the pad's bits facing right: B `8000`, Y `4000`,
A `0080`, X `0040`, R `0010`; → `0100`, ← `0200`, ↓ `0400`, ↑ `0800`. Goku's
Quadruple Kick, `a5`: `8002 0100 0500 0400 0600 0200` — ← ↙ ↓ ↘ → + B. The
button word's low bits (`02`, `08`) and the windows the matcher reads from
`$6002` / `$6006` / `$600A` are not read yet. The pad's history is a ring
in BW-RAM at `$63D0` (+`$1E0` for player two).

A blow of a multi-hit move takes the record covering its first active
step; the records change a step before each kick's hit box ends (ADR 0023).
Quadruple Kick walks forward: vx 2.375 at frames 14, 26, 48, 70 and 1.25 at
18, 32, 54, 76, kept until changed (nothing slows it), re-armed at 26, 48,
70 — `goku`'s `quad_kick` states copy it as `velAt`.

| move | input | name |
|---|---|---|
| `a5` | ← ↙ ↓ ↘ → B | Quadruple Kick |
| `a4` | → ↓ ↘ B | Jumping Knee Slash |
| `a6` | ↓ ↙ ← B | spinning kick |
| `a7` | ↓ ↘ → Y | Double Punch |
| `a2` | → B | Double Kick |
| `9c` / `9e` | ← ↓ ↙ Y / B | teleport towards / away |
| `a9` | → ← → A | large ki blast |
| `ab` | ← ↙ ↓ ↘ → A | Kamehameha |
| `aa` | ↓ ↙ → A | Super Kamehameha |
| `ad` | ← ↙ ↓ ↘ → ↗ Y | Meteor Smash |
| `a8` | R + B | side slash |
| `9d` | close + X | the throw `?` |
| `a0`, `a1`, `9f` | → ← → / ↓ ↙ ← / ↓ ↘ → + X | not in the move lists `?` |
| `ac` | in the air | Slash Down Kick |

## Hit data

Looked up **at contact**, from the attacker's move and step — nothing in
the script names it. Melee: `$0D:D189`; a projectile/object: `$0D:D1DA`,
through its own table at `$3D:9624`.

**The table** (`$0D:D7E5`, read by `src/rom/hits.ts`): `$3D:8000` + 2 × character → that fighter's
pointers, one per move from `0x90` (`move − 0x90`) → a list of 6-byte
records. The first record whose byte 0 is ≥ the attacker's step (field
`0x46`) is used; `ff` means every step — one move can hit differently
step by step. The 5 bytes after it:

| byte | what |
|---|---|
| 0–2 | which reaction, as bits — the bit read depends on the defender's situation (below) |
| 2 | also: `0x20` chip on guard = damage / 8, `0x40` = damage / 16; `0x80` read for the attacker's own move `?` (`$0D:DC8B`) |
| 3 | damage, + attacker field `0x6a` − defender field `0x6b`, never below 0; taken off health (field `0x60`) |
| 4 | stun: taken off field `0x68`, which refills by 1 about every 16 frames up to 20; at 0 the defender is dizzy (move `1d`, 200 frames) and it refills to 20 |

**Attack and defence** are set at the round's start (`$01:8112`): `0x6a`
from the ATTACK option (`$1ACB` / `$1AD1`), `0x6b` from `$1ACD` / `$1AD3`
plus the fighter's own defence — byte 0 of his attributes (below), 8 for
Goku. Recorded in Goku against a CPU Vegetto, options at +0: every blow
either side landed took exactly byte 3 of the attacker's own table minus
the defender's defence — Goku's 8, Vegetto's 12 — but one: Goku's `ca`
took 6, not 12; its record sets byte 2 bit 2 (`$D4D4`) `?`.

**A fighter's attributes**: 32 bytes at `$3D:9D9B + 32 × character`
(`$0D:C4C1` reads one). Byte 0 is defence; then 8.8 words, of which the
recorded ones match: walk 1.5 forward and 1.25 back (words 0–1), jump
−9.86 (word 12), gravity 0.469 (word 14). The rest are speeds not
identified yet.

**Which reaction** (`$0D:D29C`–`D353`). Grounded (field `0x23` ≥ `0xc8`),
bits of bytes 0–1 as one word: `0x0004` `$D622`, `0x0008` light,
`0x0010` heavy, `0x0020` → move `19`, `0x0040` knockdown (move `1b`),
`0x0080` → move `42`/`43`, `0x0400` → move `1e`, `0x0800` `$D670`,
`0x1000` `$D540`. Airborne, bits of byte 1: `01` → move `1a`, `02`
knockdown, `04` → move `1e`, `08` `$D670`. Then byte 2 bits 0–2 for both
(`$D3F3`, `$D46E`, `$D4D4`). Light is move `15` (`13` when field `0x97`
bit 0 is set), heavy `16` (`14`); `$0D:D7BA` turns them into `17`/`18`
`?`. Hitstun is that move's script — light 14 frames, heavy 26 — not a
number in the record.

**Knockback is per reaction, not per blow**: `$0D:D708` with a reaction
index sets field `0x8c`, the push speed `0x88` (8.8 fixed point, turned by
the attacker's facing) and vy from a table of 6-byte entries at `$0D:D68A`.
Light (index 2) pushes 2.0 px/frame, heavy (3) 3.0, knockdown (4) 2.0 and
−4.0 up. The push **slows by 0.25 every frame** until it stops
(`$0D:EC5F`, which slows vx the same way) — 9 px in all for light, 19.5
for heavy. `0x8c` takes the entry's first word — 8 light, 12 heavy, 48 in
the air, 64 down or dizzy — the frames a push of that speed lasts, and
counts down outside hitstop. A blow sets hitstop (`$30B2`) to `0x8a`.

**Health** starts from the ENERGY option, 400 by default (`$1AC9` /
`$1ACF`, per side), or 80 or 999 in other modes (`$01:8150`, `$01:826F`).
Training is mode `$1A02 = 3`, where damage is zeroed. One bar on screen
holds health and ki, but firing a ki blast leaves `0x60` alone — ki is
another field, `0x62` or `0x64` `?`.

## Another fighter

Every per-fighter table is reached through a pointer table of **ten 3-byte
entries, one per fighter** — the roster. Goku is entry 0 in all of them,
Vegetto entry 4 (his recorded blows match only that hit table); the others
are not mapped yet. Found 2026-10-29 by
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
| `log-hits.lua` | both fighters' move, step, health and stun on every change, with what the hit code sets — what a blow cost |
| `log-oam.lua` | every sprite in OAM while an object of one type is up — what the game draws, frame by frame |

Measured on Goku (2026-10-28, training mode): walk 1.5 px/frame forward and
1.25 back; jump −9.86 px/frame with gravity 0.469; hitstop 8 frames; the
defender's reaction to a close Y, 21 frames.
