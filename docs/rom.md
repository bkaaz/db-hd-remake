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
  Some key on the script's step instead (field `0x46`), through a table and
  `JMP ($0064)` — the knockdown's `$0F:A217`; `handler.ts` follows both.
- **Where code lives:** `$01` the animation and object engines, `$0D` the
  rules of a fight (hits, buttons, the CPU's choices), `$0F` move handlers.
  `dis` cannot tell code from data: a run of `BRK`, `COP` or `SBC long` is a
  table, not a routine.

## RAM — the fighter block

In the SA-1's **I-RAM**: player one at `$3100`, player two at `$3200`, the same
field at the same offset. Code reaches a field as `$46,X` with X = `$3100`. The
fields known so far, with what is still a guess marked: `FIGHTER_FIELDS` in
`src/rom/cartridge.ts` (`npm run dis` names them in its output).

Outside the block: `0x80`–`0x9f` of I-RAM are four rectangles (x1, x2, y1,
y2, 16-bit), two per fighter, that a blow is tested with (Where a blow's
object is put, below); `0x0b2` counts hitstop down.

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
— says it in the data: a byte `f0`–`ff` and a drawing, held while the
fighter's field `0x4b` is below that byte (`$01:86F0`, which keeps it in
`0x4a`); something else moves `0x4b` past it — Galactic Gunfire, below. What the code does, per move, is listed beside
`moveAnim` until the handlers are read.

**A handler can start a move part-way, inside a step.** The crouching
attacks `94` / `95` (handler `$0F:AA60`) end through `$0F:A10D`: it sets the
crouch, `03`, and writes its frame counter `$44` from a byte per character at
`$0F:A124` — Goku 6, so two of the way down's eight frames show before the
held crouch (`src/rom/crouch.ts`). Vegeta's knockdown handler jumps to frame
100, inside his lying step. The export cuts a part where either begins
(`moveAnims`' `frameCuts`).

**A move's handler flies the body itself.** It sets vx and vy on frames of
its own and can turn gravity off (field `0x28` bit 3, `$0D:CB06`) —
Jumping Knee Slash (`a4`, `$20:85E2`) leaves at frame 16 at vy −7 with
gravity off, and from 24 to 41 adds 0.5 to vy only while rising
(`$20:85EE`), so it hangs at the top until 42 gives gravity back; Abiseh
Geri (`a6`) leaves at 8 at its own gravity. `port` prints the vy set and
the gravity turned off and on; the rising-only slowing it cannot, being a
test of vy itself. A re-arm (`$0D:D8A2`) while a hit box is out cuts a part
too, so each re-armed blow takes its own record (`src/rom/parts.ts`).

**How a step is drawn is in the script too**: `d0` moves the drawing away from
the fighter's position and `e0` flips it whole, both lasting until set again —
the sprite routine at `$00:8180` adds the one and XORs the other with the
facing. The somersault is two drawings, raised 48 px and turned. The export
makes each such way of showing a drawing a frame of its own
(`src/rom/look.ts`).

**The floor's shadow** (`$00:8212`, after a fighter's drawing, so behind him): a drawing casts one if its bit is set in the map `$00:82F6` gives by character; others have one painted in, or none. Layouts: `$09:B26E` by character, four sizes, tiles from `0x80` (the resource at `$6800`, `$01:848B`; player two's `0x180`), his own palette, at his x and y `0xC8` less `$30AE`. The size is `(0xB8 − y)` clamped at 0, `& 0x30`, `>> 4`; none for y under `0x79` or from `0xCB`, or while `$30A8` is set `?`. `src/rom/shadow.ts`, `src/entity/shadow.ts`.

**Which fighter is drawn over the other** is one bit for the pair, `$30B0`
bit 0 (`$00:812E`): clear, player one's sprites go into OAM first and so
in front; set, player two's. Arming a blow (`$0D:D8A2`) puts the mover in
front, and every move a button or a command begins does, a blow in it or not (recorded: a throw, a ki blast, Yuudoh), as handlers holding a body do (`$20:DF66`, `$20:E31F`); `$0D:D8D5` puts him behind — Side Slash's handler (`a8`, the 3D
move, `$20:83DF`) and `$0D:EBB8` call it, the latter from `$0F:A358` (the
KO, `1c`, at its frame 168 — A KO, below) and `$0F:A9E3`. Every object slot
(`$3300`–`$3390`) goes into OAM before both (`$00:80E8`), so in front of
them, a lower slot in front of a higher one (Gohan's intro: `2/05`, the dust, over `2/06`). Ours: `Fighters.inFront` (`src/match/fighters.ts`), and a state's
`behind` for `$0D:D8D5`; effects and
bolts are added to the stage after the fighters, so in front as well. A `b1`
effect — a ball, a band — is added light over sprites and stage alike
(`$2A:A29A`), so it is over all of them; ours: a fighter's balls
(`addedLight`) kept on top of the world, the band left under the base and
head it runs between (owner).

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

**A move loads its objects' tiles** (`$01:84B3`: resource A into OBJ VRAM
at word Y, Y `$6C00` for player one and `$7C00` for player two, through
`$00:B265`) — Goku's Kamehameha `0x32`, Vegeta's `ac` `0x4d` and his `ad`
`a9` `ab` `b1` `0x4f` (`npm run rom -- port`). Tiles only: **an object's
colours are what its own code loads** (`$01:84EF`: palette record A through
`$00:B2FC` into CGRAM `$0100` for player one, `$0120` for two — OBJ
palettes 0 and 1), a run stepped every 4 frames while it is up: the
Kamehameha's beam and Final Flash's heads records `0x130`–`0x133`
(`0x2ADE1C` … `…7C`, by `$74`), the Big Bang `0x11C`–`0x120` (`0x27BD24` …
`…A4`, `$0F:BAAC`, counted in the thrower's field `0xF0`). A resource's
own record palette is not it — `0x4D`'s is the Big Bang's.

**How an object picks its frame** is one of four, all in its code: from the game's count (`$74 & 8 >> 2`, Freeza's `6/06`, a flip every 8 frames), by flipping field `02` on a timer (`LDA $02,X / EOR #1`, Cell's `7/06`), from a table a tick (`$0F:D3C2`, 0 0 0 0 1 1 1 1 2 2 2 2, Freeza's `6/11`, the timer's `CMP` saying where it wraps or ends), or held for a table's time per frame (`$0F:E329`, 6 8 3 4 3 3 3, Cell's `a/21`, back to frame 2 after 6). The recorded frames of a slowed game are stretched: `6/11` shows 8 frames a picture where the table says 4.

**An object's behaviour is its type's code** (read: `npm run rom -- code a 3`): `$0F:B44B` runs the ten slots
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
stopped during hitstop, and every 4 frames loads palette record `0x130` +
(frame counter `$74` / 4 mod 4) into its owner's OBJ palette (`JSL
$01:84EF`) — it shimmers by swapping colours. Type `1` jumps by animation through `$0F:B97E`; Vegeta's
`ad` Big Bang (`1`/`4`, `$0F:BAB6`) runs `+0B` 0–9 and shows the frame
`$0F:BAE5` names for it (0 for five, 1 for five), with no end of its own. Vegeta's Energy Field (`1`/`7`, `$0F:BB4D`) and Ground Flare (`1`/`2`, `$0F:B9BC`) test their thrower's move every frame and are gone when he leaves it (`ab` / `d2`, `a9` / `d3`); the field takes his x and his y − 40 each frame (`$0F:BBB3`) and plays `19` on ticks 1, 4 … 25, gone at 27; the flare shows a frame a tick from `$0F:BA07`, gone at 66, and sets its type's bit 6 — its blow armed again — every 32nd frame of the game (`$0F:B9CD`). Vegeta's Vertical Ki (`1`/`6`, `$0F:BAEF`, `b1`) falls at `b0`'s vy 4, shows frames 0 0 1 1 a tick from `$0F:BB49` round and round, steps the Big Bang's palettes, and once its y is `B8` or more — 16 px above the floor line, outside `$0552`'s mode — the slot is rewritten as `a/02` (`$0F:BB05`). His Jumping Bomb's (`1`/`8`, `$0F:BBF1`, `9e`) and Energy Dash's (`1`/`9`, `$0F:BC4C`, `a8`) sprays stand where they are put, live while he is in `9e` / `cc` or `a8` / `ce`, load palette `0x11C` on tick 1 (`$0F:B9A9`) and show the frame `$0F:BC3A` / `$0F:BC95` names per tick, gone at 17 / 22. Their tile base is 0: tiles `0x22`–`0x47` / `0x24`–`0x39`, in his own sprite (OBJ `$6000` on, DMA'd from `$00:6C00`), which holds the whole tile set of the drawing he shows — `7d`'s `0x255` and `80`'s `0x259` unpack to more tiles than their record's size, and the sprays are those extra tiles. `npm run rom -- code` reads all of it.

**Idle's lightning** is type `0` animation `6` (`$0F:B862`), put out by
idle's own script (`00`, once per entry, timer 0) and by `60` — the pose
`$0F:AF29` sets both fighters to at once `?`. While the fight runs (`$32`
& `7F` = 1) it stands on its owner's x / y every frame and lives only
while his move is `00` or `60`, else it is gone. Every 4th frame of `$74`
it steps `+0B` through 0–26 and back to 0, showing the frame `$0F:B8B2`
names: frame `0E` (nothing) for 13 steps, then frames 0–13 — 52 frames
dark, 56 of bolts, again. Tiles: resource `0x47` at `$6800`, which a b0's
`+80` reaches; drawn in OBJ palette 0, which it never loads — `0x27B161`
in `logs/objects-goku.bin`.

**An object off the screen is gone** (`$0F:B47D`, after every slot): more
than `0xA0` px from the screen's middle — the camera's x + `0x80`
(`$0571`) or y + `0x70` (`$0574`) — on either axis, it is killed
(`$0F:B4ED`). Type `9` animation `8` and type `8` animations `14` and `15`
are spared.

**`b0`'s second byte is a counter** (field `0x6e`): a spawn fires only when
they match, then counts it up. A handler picks among a script's spawns by
setting it — the charged Kamehameha (`aa`, handler `$20:8447`) leaves it 0
for a full charge (A held past frame 35), sets `10` for a release in 20–35
and `18` before 20 — into `0x6f` too (`$20:84DD`), so the `b1` effects follow
the same choice — so the frame-44 spawns that fire are type `a`
animation `21`, `20` or `19` (80 / 60 / 40 damage, vx 4) with animation
`22` beside it. The pose after (`89`) is cut short once the beam is gone
(`JSL $0D:EBE0`: `Y` = animation in the high byte, type in the low nibble;
carry set when none of the owner's object slots holds it).

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
(`$0F:B63D`). Kind 1 is `4 × size` lines, the middle half the whole length
and the outer ones shortened from the base end in proportion (`$2A:A4B6`) —
`2 × size` tall at the hands opening to `4 × size` at the head; kind 4, the
small shot's, is `2 × size` all along (`$2A:A78D`). All of it is resource `0x32` (loaded at `$6C00`) in that resource's
own palette — a resource's record holds a palette pointer at bytes 5–7.

**Final Flash** (Vegeta's `ac`, handler `$20:9A43`) is the charged
Kamehameha's shape: the same `f0` choice at frames 20 / 32 (counter `18` /
`10`, jump to frame 42), the ball (kind 2) at 24, −46, resource `0x4D`.
Frame 44: head `1/0d` / `0c` / `0b` (80 / 60 / 40, vx 4) at 36, −46, base
`1/0a` at 18, −46, band kind 4 (`2 × size` all along) of size 16 / 12 / 8.
The heads call `$0F:B63D` with a ceiling of 7 / 12 / 8 — never above the
size they start at, so the band never thickens; they show frame `($74 &
0C) / 4` (`0b`) or step every 4th frame mod 5 / 6 (`0c`, `0d`), load palette
record `0x130` + n every 4 frames (`$0F:BE3D`), and live while
he is in `ac` or `b5` (`$0F:BE66`). The base sits 18 px ahead of him and
writes the band's start 8 px further; frames 0–1, 2–4, 5–6 as `kame_base`.
When `ac`'s script runs out the handler sets move **`b5`** (`b6` in mode
`$0552`): the firing pose held (`a7` / `a6`, 4 frames each) until the head
is gone, then a jump to frame 72 / 76 / 80 by size and the move's end at
96. Hits: `1/0d` → `a/18`, `0c` → `a/17`, `0b` → `a/02` (`$2A:8F77`,
`8F52`, `8F2D`), all three setting the defender burning. A recording runs slow while the beam
is out — the emulator drops frames (f2730 of the Big Bang's) — so its
durations are longer than the code's.
`npm run rom -- object a 15 32@6c00 80` draws an object's frames to look at.

**What a melee blow leaves** — a spark where the boxes met (`$2A:8D63`,
below), in a free object slot (`$0D:D905`, carry set when none):
landed, `a/00` (`$2A:8150` → `$2A:8D45`), which when no slot is free takes
one from the dust and the like (`$0D:D932`); blocked, `a/06` (`$2A:83BA`,
mirrored at `$2A:8465` → `$2A:8DE2`), when `$2A:84B4` says it was blocked:
by the defender's move (below `0f`, `0f`–`10`, above) and a bit of the
data at `$0D:D7E5`'s pointer `?`. Both are
written into the slot as a projectile's explosion is, so their tiles and
palette are taken to be the explosions' `?`. Each stands on frame 0 while
`$30B2` (the hitstop) runs, then steps: `a/00` frames 0–3, 4 frames each
(`$0F:E13B`); `a/06` frames 0–4, 3 each (`$0F:E520`). `a/06` also comes
from `$2A:868A`, after setting both fighters' field `0x96` to `f8` (a clash
`?`), and `$2A:9A32` (not read). Exported as `hit_spark` and `guard_spark`.

**Where a blow's object is put** (`$2A:8D63`): the mean of the four x and
the four y edges of the two rectangles that touched, `/ 4` rounded down —
halfway between their centres, not inside the overlap. Each fighter has two
rectangles (`$2A:87DE` fills player one's `$80` / `$90`, `$2A:886A` player
two's `$88` / `$98`, from the block's `0xa0`… at an offset chosen by the
caller, `0x80` there meaning none), and `$2A:89D0` tries the pairs `80/88`,
`90/98`, `80/98`, `90/88`, leaving the first that touches in `$DC`. Ours
are put elsewhere (ADR 0044).

**What an object strikes with** (`$2A:88F6`): `$2A:9AE3` by type, its pointer by animation, its pointer by the frame shown: x1 y1 x2 y2, signed, turned by the facing, `0x80` first for nothing. Only an object with both top bits of its first byte (`c0`) strikes (`$2A:81DC`), player one's in the even slots, two's in the odd. `objectBox` in `src/rom/collision.ts`.

**What a projectile becomes when it hits** (`$2A:8E31`): by the hitting
object's type (`$92 & 0F` of the defender, table `$2A:8E4B`), then its
animation (`$93`, type `a`'s table `$2A:98EB`), the slot is killed and
rewritten as an explosion where the boxes met (`$2A:8D63`, above):
the ki blast `a/03` → `a/01`; the Kamehameha's heads `a/13` / `14` / `15` →
`a/02` / `17` / `18`, and those set the defender burning (`$2A:99CC`: field
`0x26` bit 7, when `0x25` has bit 3). `a/18` and `a/17` copy themselves on
their step 1, 4–11 px away at random, while their `+0C` is under 2 / 1 —
three explosions and two (`$0F:E1A9`); all step through `$0F:E2A9`'s
6 8 3 4 3 3 3 frames and are gone. Recorded for all three (2026-10-30).
`src/rom/objectHit.ts` reads the answer for any object: most of a fighter's standing objects stay. Type `1` by animation at `$2A:8EC7`: `1/04`–`06` → `a/02` (`$2A:8F0B`),
`1/0b`–`0d` → `a/02` / `17` / `18` and burning (`$2A:8F2D`–`8F77`). `1/02` and `1/07`–`09` (Ground Flare, Energy Field, the sprays) stay: their blow is disarmed and `$2A:9A0B` leaves a melee blow's spark beside them, `a/00` landed or `a/06` blocked (by the defender's `0x25` bit 3).

**Burning** (`$0D:EC98`): every 2 frames a counter shared by both players
steps through the 15 fire palettes (`0x180` + 0–14, `JSL $01:8316`) — so
where in them a burn starts depends on the game, not the blow — until the
body lands (`$0D:CB47`: vy ≥ 0 and y ≥ 200 clears the bit and reloads its
own palette, field `0x17`). The 15 are `$95:C78E` on, 32 bytes each.

**The Kamehameha after its head is gone**: from frame 52 the handler looks
for its head (`JSL $0D:EBE0`, type and animation in the player's slots) and,
not finding it, jumps the move to frame 124 / 128 / 132 — 16 / 12 / 8 more
frames of the firing pose, then 8 of drawing `00`. The base plays its way
out (steps 5–7). The band thins away where it stands: freeing an object's
slot (`$0F:B4ED`) sets byte 1 of its owner's `b1` block when `$0F:B527`
(by type, then animation) says so — type `a`, animations `10`–`16` — and
from then the block's size drops by 1 a frame until it is gone (`$2A:A3F7`;
the flat kind 4, `$2A:A78D`, the same). A big explosion's first frame with the defender knocked
down sets the game's `$37` to `16` (`$0F:E261`): the white, below.
The `a/0d` beside the defender are its knockdown's, not the beam's.

**A knockdown** (move `1b`, and `1e`; handler `$0F:A217`, by step through
`$0F:A22D`) rises in drawing `59` until vy turns, falls in `32`, and hits
the floor: dust, sound `0d`, and a bounce (`$0D:EC12`: vy = −¼ of the
landing speed, field `0x33`, but never under 2.0 up — so an ordinary
knockdown, landing at 4.0, leaves at 2.0; it also sets `$E3` to `8108` —
the stage's shake, The camera below), drawing `33` for 4 frames then `32`
in the air. The second landing raises dust again, plays `0c` and stops it;
it lies in `34` for 32 frames and gets up (move `1f`). Each step is a jump
of field `0x44` into the one script (`0x20`, `0x40`, `0x64`).

**Dust** is object `a/0d` (`$0D:DE6C`): put at the body's x on the floor
line (y 200), in the explosions' OAM slot and tiles, 4 steps of 6 frames
(`$0F:E559`). Every fall onto the floor calls it — 35 places, the other
characters' reactions and specials among them (`find 22 6c de 0d`).

**A spoken line is `a1`**, not an effect (`$00:DE9F`): its id picks a
sample from `$00:DB98` (3 bytes each) streamed to the sound chip
(`$00:DB61`); when one is already playing the fighter shouts `32` instead.
The Kamehameha says line 0 (`$13:D7D0`) on its first frame, Final Flash
line `0d` (`$13:ECE0`) as it fires. A line is chunks, each a byte count
and that many bytes of BRR sent to the chip at `$3700` (`$00:DA6F`), until
a count of 0; a chunk's last block ends it. 75 bytes go a frame (`$067A`),
so it plays at 8000 samples a second. There are `2e` of them (`00`–`2d`),
each in the sound test (`line_0d.wav`); a fighter's are the ids his
scripts' `a1` name (`src/rom/lines.ts`). A recording's `$2141` shows the stream's bytes for as long as a line goes, so an effect's id asked for meanwhile cannot be told from them: read the handler (`find 22 2e d8 0d`). A lone `36` 5 frames in is the stream's too `?`.

**The Kamehameha's hit lights the defender up** (`dump-vram.lua`,
`log-palettes.lua`): the burning above, and BG palettes 2–7 turn white for
16 frames. While the beam is out the thrower's object palette changes
every 4 frames (palette records `0x130`–`0x133` through `$01:84EF`, above).

The export makes each object Goku spawns a spawn entity (ADR 0018); which
ones, with their recorded timing, is `objects` in `src/rom/cartridge.ts`.
**Mr. Buu's Energy Field** (`8/12`, `$0F:D8BE`) has no picture: it strikes with what the move's `b1` effect of kind 2 draws, the circle. It adds 2 to the radius (`$30C4` / `$30D4`) up to `0x41`; from `0x40` the radius is `0x40` plus `$0F:D939` `1 2 2 1` by `$74 & 3`. The frame shown is radius / 4, which names its box; gone once its owner leaves `af` / `d8` (`$0F:B5F5`). None of it steps in a hit pause. The circle shrinks by 2 a frame from the script's frame 140. A hit disarms its blow (top bits `f8` → `b8`) and puts `a/02` in another slot; armed again 60 frames later.

**Mr. Buu's win** (`3e`) holds `35` from frame 128, to the end of the round; the script's steps after it do not play (recorded).

**Mr. Buu's intro** (`3c`) holds `2f`, arms up, 113 frames from frame 62, 175 in all (recorded), with no effect of its own: only his line.

**Mr. Buu's charge** (`0c`, handler `$0F:E8C7`) does not load the glow's palette (`$0F:A072`: CGRAM stands still), and its sound is `46` (`$0F:A03A`, by character; `9` has `17`, others `19`). Frame 5 puts out `8/03`, frame 10 `8/0a`, two pictures of steam by turns while the move lasts; held, step 5 goes back to frame 10, and let go it plays that step with `8/0b`.

**Mr. Buu's Oyatsu Kosen** (`a5`, then `a6`, handler `$0F:F2B3`): the object `8/04` (palette record `0x25`, as his other effects) reaches him and stays, and he plays `5f`, set 80 px off: 96 frames of a pose, flashing in records `0x115` / `0x116` by `$74 & 4` (`$0F:A67F` → `$0F:A92F`, table `$0F:A950`), then kind 2 on him at 0, −40, size 8, 1 larger a frame to 47 and back. At its top he is the drawing `c1`, 40 px up: candy. `a6` holds `7d`, then `7e` with `8/16` for 68 frames, and draws him in, 2 and 1 px a frame, into `48` at his mouth. Chewing, and on frame 80 he comes out at +44, −32 (`$0F:F2CE`), vx 2, vy 2, bounces once at vy −8 and lands into `1b` at vx 2.5, vy −7, with `a/17`.

**Mr. Buu's Buu Breath** (`b0`, then `b1`, handler `$0F:EF88` by the phase in `F0`): the object `8/17` reaches him and puts him in `56` for 103 frames, set 80 px off. `b1` asks `1c`, waits on `$37` at frame 1, rises at vy −9.375 from 3, holds frame 17 until it tops out, goes to the screen's middle at vx 2 and y `6C`, holds frame 35 until there; at frame 78 kind 6, a wedge of light from him to the floor, swept 8 px a frame across the screen (`$0F:F0DF`), then the band (`$0F:F1BC`, `F1F3`), `$37` = `23` and 300 frames of `$0F:F241`, then `21` and `22`. He falls at vy −4 and throws him (`$0F:B321`): 130, `1b`, vx 2.5, vy −7, burning.

**Mr. Buu's throw** (`9d`, handler `$0F:EC60`) lets go on frame 39 and goes straight into `9c`, 93 frames of a spoken line and his poses, before he can act; the script's last step is never shown.

**Mr. Buu's Flying Bomber** (`ad`, handler `$0F:F4DF`) walks at vx 1, stops on step 5, and on frame 38 turns to him and takes 1/32 of the way to 8 px short of him (`$0F:F542`), as Side Slash does. The same code (`22 DB D7 0D A5 00 18 79 20 00`) is at `$10:B69C`, `$10:C552`, `$10:D978`, `$20:841E`, `$20:979E`, `$20:A58A`, `$20:C1D0`, `$20:C7DD`.

**Mr. Buu's Rolling Tackle** (`aa`, handler `$0F:F3E8`) comes only out of Planet Attack (`a8`, `d1`). A hop: vx 3, vy −4 on step 0, his gravity from step 1, its blow from frame 16; landing jumps it to 64, a second, lower hop at vx 1, vy −2 for step 4, gravity from step 5, and landing again to 76 at vx 0.

**Mr. Buu's Butt Drop** (`9e`, handler `$0F:EE42`) starts stopped with vy −2 (field `0x82`, `$0F:EE4F`), and falls on his gravity, its blow out while it falls; landing jumps it to frame 24. On step 3 it leaves the floor at vx 2, vy −4, with gravity from step 4, and on step 5 it waits at frame 40 until it lands (`$0F:EEA6`), then a frame of `05`.

**Mr. Buu's Powersault** (`ac`) puts `8/05` out at its blow: no blow of its own, tiles `+0x80` in OBJ palette 0, on his x, its frame by his step (`$0F:D7B7`: 1, 2, 3 on steps 2 to 4), gone as he leaves the move.

**Mr. Buu's Planet Attack** (`a8`, handler `$0F:F336`) is a rush: vx 6 from the move's frame 16, dust while a slot is free (`$0D:DE6C`), drawings `8c` and `8d` round and round. Its blow connecting clears field `0x25` bit 7, and the handler jumps to frame 26 with vx 1.5; from frame 26 it goes back to 16 until it has counted 24 frames armed (`F0`), so three rounds at most.

**Mr. Buu's Mightiness Bomber** (`8/0f`–`11`, `$0F:D87E`, handler `$0F:F75D`) has no picture either: the circle. Put out at his +52, −56 on the move's frame 22, radius +1 a frame to `0x10`, the handler moves it on 1 px a frame (`$F2`). At frames 38 and 46, with A held, the slot becomes the next object (`$0F:F7A2`: `8/10` to radius `0x18`, `8/11` to `0x20`); released, the move jumps to 53. On 54 it leaves at `vx` 4 and no longer needs him (`$0C` set, `$0F:D8A1`). A hit before then ends all of it (`$0F:F7F2` finds no slot), and he plays the rest of the script. Its box is one size per object, ±16, ±24, ±32, damage 50, 68, 80, and a hit rewrites the slot as `a/02`, `17`, `18` and sets the defender burning (`$2A:99CC`); the circle shrinks by 2 a frame where it was, through the hit's pause too.

Type `a` objects draw from tile base 0 in the shared `0x30` at `$6500` and `0x31` at `$7500`, there all fight, in palette `0x27AE98` (`npm run rom -- vram`). A reel takes its first shove step before the hit pause, for a fist and a bolt alike.

Object slots: ten of 16 bytes at I-RAM `$3300`; each type's behaviour is its
own code in bank `$0F`. **Five are each player's** — player one's at `$3300`
+ `0x20` × n, player two's at `$3310` + `0x20` × n — and `$0D:D905` finds a
free one among the owner's only, so a fighter has at most five objects out:
past that, dust (`$0D:DE6C`) is simply not raised, while a landed blow's
spark (in the defender's slots) takes one from his dust (`$0D:D932`). Ours
have no such limit.

**`a0` plays a sound**, not a blow: `$0D:D82E` queues the id at `$cb`
(`$00:DE31`) and `$00:D879` hands it to the APU at `$2141`. For player two
the id is shifted by the byte at `$0D:D852 + id` — each side's voice sits in
its own range: `+9` for the effects `05`–`0d`, `+3` for the voices from
`30`. **A sound asked for again restarts its voices** — those of a
different sound play on (`tools/re/log-dsp.lua`, 2026-10-30: two hits 17
frames apart re-key the hit's two voices and the hurt voice's; charging's
`19` every 8 frames). Player one hitting player two asks for `06` (the
swing, the attacker's), `12` (the hit, `09` + 9: the defender's side) and
`33` (`30` + 3, the defender's voice).

A sound is a sample at a pitch: `06` and `07` are both sample `17`. The
effects take voices 5–7 and samples from `10`; the music the rest, and a
few effects (`01`–`04`, `21`, `28`, `39`) play on the music's samples, so
they sound as whatever music is loaded has them `?`. The Kamehameha's shot
is `0a` from its script, and the sound lasts while the beam flies: a
strike (`16` @ `03EB` with `14` @ `0785`, 10 frames), then a rising rush
(`15`, `021F` → `05DF`) over a long low tone (`14` @ `03F9`). Its hit is a
ki blast's — `0a` and `30` on the defender's side, other voices, so the
shot sounds on. The explosion object (`$0F:E1A9`) asks for no sound; the
original plays nothing when Goku jumps, as far as the code shows.

**The sound test's number is not an id**: its list (`tools/re/record-sound-test.lua`, 2026-11-03) runs every effect once by id — `01`–`0d`, then every other id from `17` (`17`, `19`, … `29`, `2b`–`2d`, `2f`), `38`–`3a`, `3d`, `3f`–`41`, `44`, `46`, `48`–`4d`, `4f`; the ids between are player two's, shifted (`$0D:D852`) — then each fighter's three voices, the blow taken (`30`), the **KO (`31`)** and the shout (`32`), in the order goku, gohan, gotenks, vegeta, vegetto, cell, piccolo, mr_buu, buu, freeza, then every spoken line `00`–`2d`, and wraps to its first entry. `npm run sound-test` cuts a recording of it into one file per entry, named by what the game asked for, into `assets/audio/sfx/` (`audio-capture.md`) — every bank entry is its id's file. A melee hit plays
`09` (`$0D:D1B7`) and the defender's own `30`; a projectile's, `0a` and `30`
(`$0D:D1E6`). The export puts each script's `a0` on the animation step it
begins (`sfx`); `"rom"` in a `sounds.json` is the id an entry is. What
plays each, where it is known:

| id | played by | ours |
|---|---|---|
| `02` / `03` / `04` | the menus (`$02:A4A6`…); `04` as a character is chosen (owner) | `sfx_02` / `sfx_03` / `confirm_04` |
| `05` | Side Slash's script, as he steps into the depth | `swing_05` |
| `06` / `07` | a punch's / a kick's script (`06` for Goku's near B too) | `swing_06` / `swing_07` |
| `09` | a melee hit (`$0D:D1BC`) | `hit_09` |
| `0a` | a projectile's hit, a blocked projectile (`$0D:CF6D`, `D1E9`); the Kamehameha's shot (`aa`'s script) | `burst_0a` |
| `0b` | the ki blast fired (script) | `blast_0b` |
| `0c` | landing from a jump (`$0F:9FB8`) | `land_0c` |
| `0d` | a body hitting the floor (knockdown handler `$0F:A217`) | `land_0d` |
| `17` | a blocked melee blow (`$0D:CF55`) | `block_17` |
| `19` | charging ki, every 8 frames (`$0F:A044`); Vegeta's Energy Field's object, ticks 1, 4 … 25 (`$0F:BBAC`) | `charge_19` |
| `25` | charging the Kamehameha (`aa`'s script) | `charge_25` |
| `27` | the sound test's cursor, on every → (`record-sound-test.lua`'s log) | `cursor_27` |
| `29` | a teleport's script, as he vanishes | `teleport_29` |
| `2c` | Saiyan Meteor's explosion, every 64th frame while white (`$0F:F2A0`) | `explosion_2c`, ours as the ball hits the ground |
| `2d` / `2f` | Saiyan Meteor's ball at the fist (`ae`'s script, 200) / over the head (306) | `ball_2d` / `ball_2f` |
| `38` | Saiyan Meteor at 386, before the throw | `meteor_38` |
| `3d` | Vegeta's Ground Flare (`a9`'s script): sample `15`, one voice sliding down from `07D8` | `flare_3d` |
| `30` | the defender's voice, on every blow taken (`$0D:D1C3`) | the fighter's `voice_hurt` |
| `31` | the voice at KO (`$0D:D10C`) | the fighter's `voice_ko` |
| `32` | an attack's shout (the ki blast, specials) | the fighter's `voice_shout` |

**A fighter's voice is two samples** the chip is given as a fight loads
(`$00:98EC`): by character × 9 at `$00:DD48`, a pointer to player one's
sample directory (8 bytes for `$1A78`), player two's (`$1A88`), and the
samples (for `$4000`, player two's `$5600`) — each a byte count and an
address, then the bytes. The first is the cry of a blow taken (`30`), the
second the shout (`32`), both at pitch `03F6`. Goku's are `$15:8000`.
`src/rom/voice.ts` reads them, by which `npm run sound-test` tells whose
voices its recording holds; the KO (`31`) is not among them, and is
streamed `?` — the sound test holds it (`goku_31.wav`).

**Charging ki refills health** (`$0F:A020`): every 2 frames of the game's
count `$74` the dial (field `0x66`) steps 1; at 12 it goes back to 0 and
the health gains 5, up to field `0x62` — +5 every 26 frames, the dial
turning once for each. Field `0x62` is the starting health and nothing
lowers it (`$01:8164`). The charging sound plays every 8 frames — `19`, but `46` for Mr. Buu and
`17` for Buu (`$0F:A020` asks field `0x00`). It is move
`0c`, set by `$0D:F983` while B and Y are held (field `0xEC` & `C000`) on
the ground; Goku's handler (`$20:8182`) jumps into the shared code above
while both stay held, and on entering step 4 sends the script back to
frame 6, so drawings `12`–`14` loop; let go, the pass plays out to `00`.
Recorded (`tools/re/log-charge.lua`): the dial steps every 2 frames, +5
every 26, sound `19` asked for every 8 — a frame of the game is a frame
of the screen. Each request restarts the voice (`tools/re/log-dsp.lua`,
voice 6, sample `0x18`, about 4 frames after it): its pitch starts at
`0237`, rises to `0258` from the 4th frame and is cut by the next — so
what is heard is the sound's first 8 frames, again and again (`cut` in
`data/audio/sounds.json`).
Y pressed a frame before B starts the far Y (`92`) for one frame, and the
charge takes over — the normals' handler checks for Y + B too `?`.
On frame 2 it loads palette field `0x17` + 8 — a glow while charging
(`$0F:A072`) — and the own palette again at the end. Goku's records
`0x48`–`0x4F` point at `0x40`–`0x47`'s colours, so he does not glow;
Vegeta's `0x58` on are his own, brighter (`glowPalettes`, a state's `glow`).

`90` stops the script; `c0 v` sets fighter field `0x96` to `v`: bit 6
and blows pass the fighter by (`$2A:81C7`, `$2A:8291` skip him) — the
knockdown `1b` sets `70` from its first frame, `1e` from 64, getting up
`1f` too, and Jumping Knee Slash `40` for its first 16 frames; bits 4–5
(Quadruple Kick's `20`): bit 5 is his own blow off (`$2A:8138`, `$2A:8291`), bit 4 is not read `?`. A new move leaves the field as
it was (`$01:8518`). `port` prints where it changes; `80` is the opponent's track (The throw, below).
`src/rom/script.ts` reads every command a Goku script uses.

## The camera

`$0D:C542`, once a frame: the horizontal camera (`$0D:C61B`), then the
vertical (`$0D:CA55`, or `$0D:CB96` on a stage whose `$0552` is set), then
the shake. It moves the fighters too — their x and y are integrated here,
gravity included. Positions are 8.8; a fighter's x is fields `0x1f`–`0x21`.

**The world is 512 px wide**: a fighter's x stays in 16–495 (`$0D:C88F`), the
camera's x (`$0570`, 8.8, whole px in `$0571`) in 0–255 over a 256-px
screen, and it starts at 128, y at 0 (`$01:8B84`). A round puts the two
at x `C0` and `140` (screen 64 and 192), y 200 (176 above the arena,
`$0552`), the one on the left keeping the left (`$01:8B2E`). Screen x = x − `$0571`
(field `0x03`), screen y = y − `$0574` (field `0x07`).

**Horizontally the camera does not centre** — it is pushed. A fighter whose
screen x is in the outer 64 px (< 64 or ≥ 192, `$0D:C87F`) and who moves
toward that edge scrolls it by his own dx; one in the middle moves it not
at all. Both at one edge and moving toward it: the faster; at opposite
edges: the larger dx if they move the same way, else the sum. The camera
stops (and a fighter walking out is held at the old edge) when one fighter
would leave by one side while the camera moves that way or the other is at
the far side. A fighter is then kept within 16 px of the screen's edges,
snapped back once more than 6 px past (`$0D:C7C4`). A whole pixel scrolled
calls `$00:BC94` (the stage's columns `?`).

**Before that, each fighter's dx for the frame** (`$0D:C8F0`): vx, or the
shove (fields `0x88`/`0x8c`) while one runs. Two bodies pressed together
(field `0x97` bit 7) and moving into each other both get the average of
their vx; a shove then stands in for its body's. Bit 7 is cleared and set each frame by the push (`$2A:80ED`, `$2A:8112`), and in Tornado Hip from close stayed set for as long as his blow's box stayed on the opponent (bit 6, `$2A:8188`), though their bodies had parted, so a run at vx 4 goes 2 a frame after each hit; from afar, where the bodies had not met, it does not `?`. **A shove into the screen's edge** (x < camera + 17, or ≥ camera
+ 240) passes to the other fighter, reversed and added to his dx, for the
frames it had left — unless the shoved one has no health, field `0x25` bit
2, or a move in the bit table `$0D:CA35` (moves `11`–`16`, `29`–`32`, `7e`).

**Vertically it follows the higher fighter, by an eighth** (`$0D:CA55`):
target = (200 − (min y, at least 0, rounded down to 8)) / 8, so 0–25 px up;
`$0585` steps toward it 1 px a frame and the camera's y is `−$0585`. It does
not move while either fighter has field `0x27` bit 0 (cleared on landing;
set by a few special handlers, `$0F:A72B`, `$0F:EC84`, `$20:9BD4`, `$20:D2E3` … — which moves `?`).
`$0552` comes from `$00:BA4E` by stage id (`$054E`): set for stages 3–8 and
16, which scroll vertically by the horizontal rule instead (`$0D:CB96` `?`).

**A stage id is an arena and its lighting.** `$00:BBE0`, 9 bytes per id:
the arena's tiles (a resource), a palette (the lighting), its packed maps,
the BG mode and map width, and the arena's number. The lighting also picks
the fighters' palette (`$01:82B5`: `0x40` + 16 × character +
`$01:8304`[id], a record at `$09:8000` — Goku's `0x40`… are `0xB0000` +
32 each), kept in field `0x17`; player two, the same fighter as player
one, takes the next one (`$01:82F2`; ours `altPalettes`, `@alt` sheets). `$01:8316` loads it into both of
the player's OBJ palettes. The loader (`$00:B683`) and the S-CPU's own packing:
`src/rom/stage.ts`, `src/rom/lzss.ts`; `npm run rom -- stage` draws them
flat. What each shows is read off that drawing:

| arena | ids: day, evening, night | mode | scroll (`$00:BFB3`) | shows |
|---|---|---|---|---|
| 0 | 0, 1, 2 | 1 | `D7` | the tournament's gate and court (天下一武道会 on the roof) |
| 1 | 3, 4, 5 | 2, vertical | `E9` | the sky over the clouds, a lookout far off |
| 2 | 6, 7, 8 | 7, vertical | `FF` | a planet's map from above, clouds — not drawn whole |
| 3 | 9, 10, 11 | 1 | `D7` | a domed palace — Kami's Lookout `?`; ours `palace` |
| 4 | 12 (lighting `6`, ours `embers`) | 1 | `D7` | burning ruins; ours `ruins`, its silhouettes left out on purpose (`combat.md`) |
| 5 | 13, 14, 15 | 1 | `D7` | rocky plains; ours `plains`, its silhouettes left out on purpose (`combat.md`) |
| 6 | 16 (lighting `4`) | 2, vertical | `E9` | a crater with violet lightning |
| 7 | 17 (lighting `4`) | 1 | `D7` | a dark sky, rocks and water; ours `shore`, its silhouettes left out on purpose (`combat.md`) |

**How a stage's layers scroll.** Every stage gets the same HDMA
($00:B783): channel 2 writes BG1HOFS and channel 3 BG2HOFS, indirectly,
from three blocks of lines — 31 lines from `$7A` / `$7E`, then 64 from
`$055C` / `$0566`, then the rest from `$0560` / `$056A` (tables `$00:BA93`,
`$00:BBB0`). The second block grows by the camera's rise each frame, so
its lower edge stays on world row 95 (`$00:BFD7` rewrites its count, for
the `D7` stages). Both layers' vertical scroll is the camera's y, shake
included (`$7C`, `$80`). Then each arena's own handler, by stage id
(`$00:BCB5`), sets those values from the camera's whole-pixel x (`$0560`):
arena 0's (`$00:BCD9`) puts the camera's x in `$7A`, `$0560`, `$0566`,
`$056A` and half of it plus 64 in `$055C` — BG1's middle block, its sky,
moves at half speed, centred at x 128; the rest moves with the camera.
Nothing writes `$7E` (zeroed at `$00:96F4`), so BG2's top 31 lines do
not scroll — unseen, since the HUD is an opaque band over exactly those
lines. The values are the S-CPU's, in WRAM (`tools/re/shoot-stage.lua`,
arena 0 at night). Each arena's set-up by number:
`$00:B867` (arena 0's, `$00:B877`, starts `$0560` at 128).

**Arena 0's layers**: BG1 is the sky (tile rows 0–11) and the bushes
(12–16), all low priority; BG2 is the building and the floor — its roof
(rows 0–11) high priority, the rest low. So, back to front: BG2's low
tiles, BG1, the roof. The fighters are drawn over the bushes and the sky;
over the roof too `?` (their OAM priority is not read). The roof carries 天下一武道会: arena 0 is the tournament.

**The other arenas' layers**, by handler (`$00:BCB5`, by stage id), x the camera's whole-pixel x, 0–255; set-up by arena `$00:B867`: 3, 4, 5, 7 as arena 0's:

| arena | handler | BG1 | BG2 |
|---|---|---|---|
| 3 | `$00:BE6B` | x | x / 4 + 96 |
| 4, 5, 7 | `$00:BEAA` | x | x / 2 + 64 above screen line 159, 2x from there |
| 6 | `$00:BD73` | x | x / 2 + 64 |

`$00:BEAA` writes `$7E2814`, the count of BG2's middle HDMA block, as `80`: 128 lines rather than 64, so the sky and its rocks stay at half speed all the way down and only the silhouettes (BG2 rows 23–27) go double, wrapping round the 512-px map. `$00:BFD7` rewrites BG1's count only, so that line is the screen's, not the world's. Tiles: all low priority but those silhouettes, high, so in front of BG1. BG2's sky on 6 and 7 fills only columns 8–55, what x / 2 + 64 can show. Fighters' sprites are nearly all OAM priority 3 in the snapshots, so in front of every layer `?`.

**An arena's palettes step by themselves** (`$00:C15F`, by stage id `$00:C182`, not while `$30B0` bit 7 is set); none on 0 and 3. Each writes 16 colours to one BG palette in the colour buffer (`$00:B2F9`), from a table of 32-byte steps:

| arena | palette | steps at | steps | held, frames | starts at (`$00:B6CF`) |
|---|---|---|---|---|---|
| 4 | 4, 5, 6 | `$0A:C5C7` | 16 | 4, on `$74` | 0, 8, 12 |
| 5 | 4, BG2's clouds | `$9D:8080`, `8500`, `8980`, by lighting | 32 | 16, hit pauses too | not set: what it was left at |
| 6, 7 | 2, 3, 4 | `$9D:8E40` | 16 | `$00:C41F`[step] + 1 | 0, 4, 10 |
| 6 | 5, 6 | `$9D:9040` | 14 | 4, on `$0577` `?` | 0, 5 |
| 6, 7 | 7 | `$9D:9200` | 8 | 6 | 0 |

**The shake is `$E3`** (`$0D:C558`): bit 15 on, bits 8–11 a pattern, the low
byte frames. Each frame it counts down and adds `$0D:C593`[pattern][frames
left] to the background's scroll (`$7C`, the Mode 7 centre `$0562`, `$80`)
— but not to `$0574`, so **the stage shakes and the fighters do not**. The
offset is from that frame's camera, not cumulative. Entries 1–15 of each
pattern (entry 0 is never read), played from frames − 1 down to 1 — by the
low 4 bits only, so a longer shake goes round again:

| pattern | at | 1 … 15, px |
|---|---|---|
| 0 | `$0D:C59B` | −1 +1 −2 +2 −1 +1 −2 +2 −1 +1 −2 +2 −1 +1 −1 |
| 1 | `$0D:C5BB` | −2 +2 −3 +3 −2 +2 −4 +4 −2 +2 −3 +3 −2 +2 −2 |
| 2 | `$0D:C5DB` | −2 +2 −4 +4 −2 +2 −4 +4 −2 +2 −4 +4 −2 +2 −2 |
| 3 | `$0D:C5FB` | −2 +4 −6 +4 −2 +4 0 +2 −4 +6 −4 +2 −4 +6 −4 |

The knockdown's bounce sets `8108` (`$0D:EC34`): pattern 1, 7 frames,
−4 +2 −2 +3 −3 +2 −2. Others: `8208` (`$0F:A51A`), `8220` (`$10:CBFB`),
`8008` (`$20:8D26` …) — whose `?`.

**The throw** (`9d`, → + X — the button word `1740`, `$0D:F15F`; its command row `25 10 40 00 2f 9d 30
00`). Byte 6 of a command row, when not 0, is the move the **opponent**
is put in as the command starts (`$0D:EF05`) — `30` for the throw:
held. Its conditions (`25 10 40`): both on the ground, the opponent not
down or dizzy, not reeling, and within the thrower's grab range of him
standing still — 42 px for Goku (`$0D:F96F`), unless he is in a move of
the list his own character gives (`$0D:F931`; Goku's `a8 9c 9e`). The script begins with command `80`: ten 2-byte pointers, one
per roster character, then the thrower's own steps (`$01:8813`). Each
frame the engine sets the opponent's drawing from the entry for the
opponent's character, read in step with the thrower's script
(`$01:86D3`) — a parallel track whose show steps name the opponent's own
drawings; move `30` plays no script of its own (`$01:85FD`). Goku throwing
Goku: thrower `69` 10 frames, `6a` 10, sound `07`, `6b` 32; thrown `17`,
`18`, `20`. Each frame `$0D:DE9A` puts an opponent in move `30` at the
thrower's whole-pixel x and y plus `$20:82A5`[opponent's character][the
thrower's step], x mirrored when facing left — for Goku (+24, 0),
(+22, 0), (−32, −32). The handler (`$20:81E3`): every frame both
fighters' burning ends; frame 1 the opponent gets its own palette back and
turns to face the thrower; frame 20 the opponent says `30` and is
thrown (`$0F:B321`): 40 damage (less defence, `$0D:D12E`), 3 off the
stun gauge (dizzy, `1d`, if it runs out; KO, `1c`, at 0 health), else
move `1b` — the knockdown — at vx 2.5 away and vy −8.0; frame 21 it faces
the thrower's way. `$0F:B321` moves him by its facing argument `$04`: bit 6
set, vx is −`$06` (`$0F:B3BC`). Goku gives his own turned (`EOR #$40`), so
the body goes over his back; Vegeta's `9d` gives his own (`$20:93FD`), so
he flies ahead, still facing Vegeta as frame 1 turned him. Recorded, Goku throwing Vegetto (`tools/re/log-throw.lua`):
held at x −34 then −32 from the thrower's (mirrored), y unchanged; let go on
the move's frame 20 at −16 behind, vy −8.00, +0.46 a frame, vx 2.5 — a peak
74 px up; the camera rises 10. Goku against Goku starts 32 px up, so flies
higher. Frame 0 — the script has run out — ends the move
(`$0F:9FA3`, as `handler.ts` already knows) and sets field `0x27` bit 1
`?`.

## The HUD

BG3, 2 bits a pixel, loaded by `$00:C430`: tiles from resource `0x0F` at
VRAM `$3000` (`$0510` = 3), a 32×32 map packed at `$00:A441` for `$3800`
(`$050D` = `$38`), palette record `0x0F` from colour 0 — `npm run rom --
hud` draws it as loaded; the export cuts it for the game
(`src/rom/hud.ts`, ADR 0032). Rows 0–3 are the band seen in
play: the ornament, the round gauges, two yellow bars, 気 between them, a
number at each end ("100" in the map; the fight writes the health). Rows
4–23 hold red segmented bars of falling length `?` (a gauge's steps,
picked by scroll?). For game modes `4`, `9`, `14`, `16` (`$DD`) the map's
priority bits are cleared from row 2 on. Then `$00:C4A5` writes each
fighter's name — 9 tiles from `$00:C511` by character — into the map's
copy at `$7F:70CC` / `$70E2`.

**Health on the HUD** (`$00:C57D`, every frame): field `0x64` steps 1 a
frame toward the health (`0x60`) — the HUD shows `0x64`, so a blow drains
it rather than cutting it. Its number is three digits ($00:9A4F), each
two tiles tall, tile `0x3E` + 2 × digit over the next (`$00:C5FC`), at map
row 2, column 1 (player two: column 28). Its bar ($00:C62D) is ten tiles
from column 5 (player two: 17, mirrored): `v` = shown health / 2 — at
least 1 while any is left, less 1 from 2 up — filling a 5-px cap, eight
8-px tiles and a 5-px cap, so 74 px is full: a fight starts at 400 and
the bar only moves below 150 — the number is the health (owner, and
`shoot-stage.lua` screenshots). Its colour 2 is set every frame
(`$00:C5CE` → `$00:C6DE`, called from `$0E:8366`; CGRAM `$0114`, player
two `$011C`): yellow `37FF` from 81 up, and below a 12-frame cycle of the
game's frame count `$74`, 3 frames each — `000C`, `37FF`, `0ABF`, `00DC`
(dark red, yellow, orange, red), both bars in step.

**The round dial** beside each number (`$00:C71C`): field `0x66` picks
it — tile `0x17` + 3 × the value at row 2, column 4, and the next two
below; player two's at column 26, mirrored. Charging turns it (`$0F:A020`,
"Charging ki refills health" above).
Behind the band the screen is black in play, though BG3's colour 0 is
clear there — channel 0's window table (`$00:BBBA`, 30 lines first) is
the likely cause `?`.

## The buttons

**The player's buttons pick a move in `$0D:FEC8`** — the move ids are
numbers in that code, the same for every fighter; which button picks which
is the table in `src/rom/buttons.ts`. Pressed buttons are fields `0xE8` /
`0xE9` (the pad's low and high byte), held directions `0xED`. The S-CPU reads
the pads at `$00:96BB`: `$4218` held into `$6C`, pressed into `$70`; `$421A` into
`$6E` and `$72`. On the ground
Y and B have a close and a far move: close when the gap between the two
fighters (field `0x20`) is under the attacker's own line (`$0D:C4A1`), two
bytes per fighter at `$3D:9EDB` — Goku 44 for Y, 48 for B. A recording
agreed: close Y at 41 px, far from 53. The CPU keeps lines of its own for
deciding what to do (`$0D:F7F6`, `$0D:F95B`, `$0D:F96F`).

**A jump leaves the floor after its first step**: move `06`'s step 0 (2 frames in its script) holds y 200 and vy 0, then step 1 has vx 2.25, vy −10.25 (`log-hits.lua`, Vegeta, 2026-11-02, where step 0 lasted 5 frames — the recording's frames, not the game's `?`) — a command that ends in ↑ (`a9` ↓ ↑ Y, `9e` ↙ ↗ Y) is read on the ground meanwhile. **In the air** a jump's handler (`$0F:9EB1`, from move `05`'s `$0F:9F60`
and its kin) asks the command table, then the buttons, unless field
`0x25` bit 3 is set. Y or B there picks `96` / `97` when vx's high byte is
0 and `98` / `99` otherwise (`$0D:FF77`), keeping vx and vy, but only
while field `0x31` is clear: the jump attack's handler (`$20:BABA`, the
same for the whole roster) sets it as its script runs out (`$0F:B16D`),
and landing clears it (`$0D:CB47`) — one attack per jump, and the air
specials ask for it clear too. As the script runs out the fighter goes
back to move `05` at a step and frame of his own (`$0F:B190`, by
character: Goku step 4 at 34, Vegeta step 2 at 28 — both past the step's
end, so the script's last pose, the fall, is what shows). Landing, in the
attack or after it, is move `3b` and sound `0c` (`$0F:9FB8`; not for
character 6).

**Where a move can start another**: `$0F:9EB1` reads the command table
(`$0D:EDF8`), then the buttons (`$0D:FEC8`), unless field `0x25` has `08`;
SEC once one starts. Idle, walking and the crouch (`00`, `01`/`02`, `03`)
call `$0D:C455` first — with the carry clear, an opponent behind starts
the turn, `41` — then it, then `$0D:F983` (charging, B + Y held), then
`$0D:F9BD` (the directions: walk, crouch, jump, the dash at `$0D:FA68`).
The stand-up (`04`, `$0F:9F4E`) calls `$0F:9EB1` alone: commands and
buttons, no turn, charge, guard or dash. Others call it too — the landing
`3b`, the dash `0a`/`0b`, a block from frame 4 (`0d`, `0f`), lying `1f`
while `f0` is 0, the air reel `1a` once landed, a jump in the air.
`$0D:F9BD` with no direction held sets idle (`00`; the crouch's `03` stands
up, `04`), so a block (`0d`, `0f`, `$0F:A081`) is over at frame 4 unless
something is held. The landing (`$0F:A451`) reads the directions only
while ↑ is held — a jump. Lying `1f` with field `f0` set goes into move
`40` instead, `f0` 300, gravity off (`$0F:A35E`; what sets it `?`).
With `f0` 0 it turns to face and reads `$0F:9EB1` only on a step past the byte
of the fighter's entry at `$0F:A3B4`: 2, 2, 5, 5, 1, 2, 4, 2, 2, 6 by the
roster's order — Gohan from step 6, his frame 33.
`npm run rom -- entries` lists the states playing such a move that lack
an entry for one of his commands. **The table is read from its end**:
`$0D:F588` points Y at the last row's byte 4 — ground `8C` (so row `88`,
the air's first, is read on the ground too), air `3C` from `+88`, mode
`7C` from `+C8` — and `$0D:EF31` steps back 8 bytes a row, so of two
commands met the later row's starts (ADR 0060).

**A move that reads the next one while it plays** (Vegeta's `a4`,
`$20:97c7`, from frame 8; `a5`, `$20:9885`, from frame 1): each frame the
handler saves the move's state (move, step, frame, flags, vx, vy into
`f4`–`fe`), runs the command reader `$0D:EDF8` and puts the state back, so
nothing the reader finds starts. Only its own move + 1 counts, in `f0`, and
then it stops reading. As the script runs out, `f0` set starts move + 1
(`$01:8518`), else the move ends (`$0F:9FA3`). No hit is needed. Ours: a
transition's `queued` (ADR 0049).

**A special started** from the command table (`$0D:F11E`) sets the move,
stops the fighter (`$0D:D7A0`: vx, vy and the shove to 0) and arms the
blow (`$0D:D8A2`). Height moves in one place for both (`$0D:CA55` →
`$0D:CAD4`), which skips both the move and gravity while vy is 0 — so a
special begun in the air hangs until its handler sets vy.

**Special moves come first** (`$0D:F085`): a command table of 0x150 bytes
per fighter at `$3D:9EEF` (offsets `$0D:F5CF`) — 0x88 on the ground, 0x40
in the air, the rest for mode `$0552` — the fight above the arena `?`
(the owner's memory; `$0552` also picks the other vertical camera,
`$0D:CB96`) — in 8-byte rows, scanned last row
first: bytes 0–2 its **conditions** — masks over flags the game rebuilds
every frame into fighter fields `0x4C`–`0x4E` (`$0D:F650`), each bit read
in `src/rom/conditions.ts` and named by `port` (Saiyan Meteor's `41`: on the
ground, health 80 or less) — byte 3 the move's **cost**,
byte 4 a sequence, byte 5 the move. The cost comes off the health as the
move starts, never below 1 (`$0D:EED7`) — none in training (`$1A02 = 3`)
or while `$1B15` is set. Goku's: the large ki blast `a9` 5, the
Kamehameha `aa` / `ab` 10, the same above the arena (`d2` 5, `d3` / `d4`
10), everything else 0. The move behind health 80 or less is each fighter's
ultimate, open while his bar is red (owner). A sequence (`$0D:F2E6` + 2 ×
number, words in bank `$0D`) is a button word, then directions **newest
first**, ended by `0000`, as the pad's bits facing right: B `8000`, Y `4000`,
A `0080`, X `0040`, R `0010`; → `0100`, ← `0200`, ↓ `0400`, ↑ `0800`. Goku's
Quadruple Kick, `a5`: `8002 0100 0500 0400 0600 0200` — ← ↙ ↓ ↘ → + B. The
button word's low bits (`02`, `08`) and the windows the matcher reads from
`$6002` / `$6006` / `$600A` are not read yet. The pad's history is a ring
in BW-RAM at `$63D0` (+`$1E0` for player two), 240 frames, `$600C` /
`$600E` the next slot: each game frame, hitstop too (`$0E:829C`, before
the hitstop test), the buttons **newly pressed** that frame (`$70`, pad
and not last frame's, `$00:96BB`; fighter field `0xEA`, turned to his
facing) — the held ones (`0xEE`) go to a twin ring at `$6010`. The
command's button (its word `& C0C0`: B, Y, A, X) must be among the
**newest 5** entries (`$0D:EE7C`), so a press counts for 5 frames.

**The rest of the sequence** (`$0D:F15F`) is read back in time from that
entry; each word must be found within a window of the one after it, the
search going on from where the last one matched. The windows are set as a
fight starts (`$0E:8093`): `$6002` 12, `$6006` 24, `$600A` 48 (`$6000` /
`$6004` / `$6008` the same, not read here `?`). A direction word, by its
low bits:

- none — the held ring's whole word **equals** it within 12: exactly that
  direction, and no button held then;
- `0002` — the same within 24;
- `2000` — any of its directions held within 12;
- `0001` — a charge: any held within 12, then held 48 frames on end
  (skipped while field `0x26` bit 4 is set `?`);
- `0004` — a button word mid-sequence: newly pressed within 12 (`0002`:
  24).

The button word's own low bits: `0008` — the direction held at the press
must equal its `0F00` bits, or with none its `0030` (R / L — Driving
Elbow, Side Slash); `1000` — any of its `0F30` held. Either refuses the
command while guarding (moves `0e` `10` `12` `73`) or in a move from `90`
whose field `0x26` bit 5 is set and whose blow has gone (`$0D:F1B4`).
`$0D:F05C` is character 6's alone: his move `0e` waits 480 frames
(field `0x35`).

A blow of a multi-hit move takes the record covering its first active
step; the records change a step before each kick's hit box ends (ADR 0023).
Double Punch (`a7`, `$20:8727`) stands until frame 6, slides at vx 2.0
until 44 (`$0D:D7A0` stops it), re-arms at 32, and raises dust
(`$0D:DE6C`) on every 4th frame of the game (`$74 & 3`) from frame 1 to 43;
its second blow is a `1e`. `1e` plays as `1b` does (`$0F:A217`) but leaves
field `0x96` alone until frame 64, the bounce — hittable in flight, where a
blow's airborne bits apply (a light or heavy one: `1a`). While the move is
`1e` gravity is the word of the fighter's entry at `$0D:CB33`, not field `0x86`
(`$0D:CB12`): `62`, `5E`, `62`, `5A`, `62`, `68`, `5C`, `6A`, `6E`, `5A` by the
roster's order, in 256ths — Gohan 0.38 against his 0.5.
Side Slash (`a8`, `$20:83BB`, by step through `$20:83D1`) sends the
mover behind the opponent (`$0D:D8D5`) through step 0, stands through step
2, and on frame 28 turns to face him (`$0D:C455`) and sets vx to a 32nd of
the way to 8 px short of his x, in whole px (`$20:8400`) — kept to the
end, frame 68, so it carries him ¼ past that point (ours: a state's
`approach`, `src/entity/approach.ts`). Its blow, at 44, is
`0x0020`: move `19`.
Slash Down Kick (`ac`, in the air, `$20:8771`) hangs where it was begun
for 16 frames (A special started, below), then turns gravity off and dives
at vx 5.5, vy 5.5 to the floor; landing is `3b`
and `0c` (`$0F:9FB8`), and only from frame 16 is it looked for. Once its
blow has connected, hit or blocked — field `0x25` bit 7, which arming sets
(`$0D:D8A2`) and contact clears (`$2A:8190`, `$2A:83CB`) — it sets `b1`
(`$20:87BC`): stopped (`$0D:D7B1`), then on frame 1 gravity back, vx 2.0
backward, vy −7.0; vx 0 at 24, landing looked for from there. Its blow is a
knockdown either way (`0x0240`).
The teleports (`9c` toward, `9e` away; `$20:8530`, `$20:8560`) move 16 px
a frame forward / back on frames 19–25 and stop at 26 — 112 px. The rest
is the drawings': `48` is empty, so he is unseen for those 7 frames, and
from 8 to 36 the drawings carry no hurt box, and no push box while he is
gone, so blows and the opponent's body pass him by.
Large Ki Blast (`a9`, `$20:810A`, 5 health) shows the ki blast's pose and
spawns object `0/04` at 12, 40 px ahead and 56 up; the upward Kamehameha
(`ab`, `$20:8116`, 10) loads resource `51` on frame 2 and spawns `0/02` at
18, 24 ahead and 72 up. `0/04` flips its frame every 4th frame of the game
(`$0F:B81D`), `0/02` steps palette records `0x130` + n every 4 (`$0F:B7D8`);
both are gone after 80 frames (`$0F:B80F`, `B7CA`) and become `a/02` where
they hit. Their speeds (3, 0 and 3, −3), `0/04`'s tiles — resource `47` at
`$6800`, which `a9` does not load — and both palettes (OBJ palette 0 =
`0x27B161`, the ki blast's) are from the recording (`logs/objects-goku.*`);
so is `ae`'s `0/08`, normal Goku's hair (owner), in OBJ palette 6 =
`0x27B161`. Its code (`$0F:B8F2`) puts it on him every frame and shows
the frame his drawing names — `a0`, `a1`, `a2` give 0, 1, 2 (the
recording's 80, 8 and 36 frames are how long he showed them) — and frees
it when his drawing's low bits reach 3 or he leaves `ae`; ours: the
spawn's `follows` (`src/fx/follow.ts`).
A recording is kept per fighter as `logs/objects-<name>.txt` / `.bin`.

Saiyan Meteor (`ad`, `$20:8988`, health 80 or less) charges to frame 36
(sound `19` every 8th frame of the game), vanishes at 48 (drawing `48`)
and closes at 16 px a frame each frame of step `0c` until within 40 px,
then jumps to frame 128 and stops; its blow at 146 does nothing itself.
Ours: `meteor`'s `rush` and `arrived` (`src/entity/approach.ts`), opened
by `health:80`; `meteor_scene` plays `ae` whole with its sparks on the
steps (ADR 0045) and a `seize` (ADR 0046).
Connecting on step `11` puts the opponent in `30`, stopped and behind,
and the mover in **`ae`** (`$20:8A29`, picking its frame by `LDY $44 /
CPY`, the frame a word): frame 1 untouchable (`0x96` = `f0`), holds the
opponent once at (+40, 0) (`$20:8AE3`), turned to face him, in `30`;
frame 2 the opponent in `47`, resource `51` loaded at `$6C00` / `$7C00`.
`47` is a script of flinches whose frame 331 holds drawing `22`, lying,
until it is let go — the blow at the end; what follows it in the script
(`21` and `22` in turn every 4) does not play in the scene. Ours ends the
animation there (`HELD_TO_THE_END`, `src/rom/animation.ts`).
Nine blows follow, each with a hit spark the script puts out itself
(`a/00`, spawn counters 0–8) and sounds `07` `09` — none lands: `30` set
the opponent's field `0x96` to `70` and a new move leaves it. Frame 274:
up at vy −7, gravity off, the opponent says `30` and is sent up (vy high
byte `f8`), burning, hitstop `0x8a`; 200 and 306 draw a ball (`b1` kind
2), 306 spawns object `00/08`, 394 speaks line `01` and aims the ball at
the opponent (`$0D:D98A`, `$0D:DB49`: fields `f2`/`f4`, ×4 next frame);
590 back to a jump's fall (move `05`, frame 21, vx 2.0 back). Every frame
runs `$20:8CCE` — the opponent's falls: dust, `0d`, bounces at vy −3 and
−1.5, the stage shaken — and `$20:8D93`, the ball by field `f1`: it flies,
holding the move's frame (`DEC $44`), until y 200; the stage shakes and
the effect grows by 2 a frame to `0x70` (`$30C4`); then `$0F:F1BC`,
`$0F:F1F3` until it answers — two frames, a shake of pattern 1 in them
before pattern 3's — `$37` = `24` and 60 frames of `$0F:F241`;
then `$37` = `21`, `22` and the damage — the throw's own `$0F:B321`:
118 (`0x76`, less defence), move `1b`, vy −4.0. The ball is `b1` kind 2
(the charging ball's circle): from 200 at 24, −36, its radius by the
move's frame from the table at `$20:8F7D` (7 down to 1, 15 down to 8 —
a flicker) while field `fc` is set (`$20:8F5E`), cleared at 274 with the
effect; from 306 at 0, −112, growing 1 a frame to 63 while he shows
drawing `a0` (`$20:8F22`). Kind 5, the explosion, is drawn the same way
(`$2A:A3A3`), growing 2 a frame from the ball's radius to `0x70`. In
flight the radius is `$20:8E63`'s by the move's frame & 3 — a frame held
while it flies, 394, so `49` (73) throughout. From
274, every 4th frame of field `fd` to 32, `$20:8F8D` puts an `a/02` on
the opponent, 28 px up — frames 276 to 304. Ours: the state's `ball`
list, `seize.bursts` and `seize.finale` (ADR 0047). The band (`$0F:F1BC`):
kind 4 at size 2 from the camera's x to + 0xFF at y `0xC6`; `$0F:F1F3`
opens it 4 px each side once, then thickens it 16 a frame until its size
is `0xC0`, and answers — the light filling the screen before the white.
While white, `$0F:F2A0` asks for `2c` every 64th frame of `$74`.

**Galactic Gunfire** (Vegeta's `ae` → `af` → `b2`; handlers `$20:9B66`,
`$20:9D29`, `$20:9DB6`) runs three moves, putting out both fighters'
burning every frame (`$10:C0CA`, `$10:C0DF`). `ae`: blows pass him by; at
1 the opponent is seized into `30` and stopped, at 2 resource `4F` loads,
to 34 he is held by `$0D:DE9A` from `$20:9C4D` (the next step's offset on
10, 18 and 34), at 18 vy −9, at 35 both are stopped where they are; once
the script ends the opponent goes into `4a` and he into `af`. `4a`
(`$0F:A4B7`, every fighter's) falls at vy 2 to the floor — dust, `0d`, a
shake of pattern 2 for 8 — bounces at vy −4, lands again and lies
flinching (drawings `2a` / `28`) into `4b` (`$0F:A560`), which holds its
frame 157 for as long as it is in it; on its frame 40, lying, `4a` sets
the other's field `0x4b` to his `0x4a` + 1 (`$0F:A545`). `af` stops him at
1, and its script holds drawing `9a` (`f0`) until that frees it, then puts
out 18 shots, `1/0e` and `1/0f` by turns, every 8 frames, then `b2` 18
more, faster; each falls at `b0`'s vy 8 and becomes `a/02` at y `B8`
(`$0F:BE95`) or where it touches a body (`$2A:8F9E`, `8FC0`) — never the
pinned one, whose `0x96` bit 6 the objects' loop skips (`$2A:81C7`); its
blow is "other" for 0. `b2` from 150: a ball (`b1`
kind 2) at 0, −88 grows 1 a frame for 40 frames while frame 150 is held
(field `f2`); from 192 it falls 4 px a frame to y 200 (`$30BE`), then at
225 it is kind 5 growing 2 a frame for 28, gone at 232, `$0F:F1BC` and
`$0F:F1F3` until it answers, `$37` = `24` and 120 frames of `$0F:F241`,
then `$37` = `22`. At 264 he falls at vy 4 and throws the opponent where
he lies (`$0F:B321`): 150 less defence, 6 off the stun gauge, move `1b`,
vx 2.5, vy −5; lands, frame 272, ends.

**The game's `$37`** asks for a screen effect, run once through the table
at `$0E:8387` (`$0E:836B`), most of them back to `04` when done: `1c`
keeps BG palettes 2–7 (`$0D:DF40`) and fades them a sixteenth a frame
down to 6/16 (`$0D:DF64`), `1f` back up to 16/16 (`$0E:85C4`), `24` keeps
them at `$7E:0300` and turns them white, `21` does the same for 16 frames
(`$38`) — the Kamehameha's white screen — and `22` puts them back; `1c`,
`24` set `$30B0` bit 7 and `21`, `22` clear it `?`. `16` whitens too: `a/18` alone asks for it, on its first frame, if the defender is in `1b`, `1c`, `75`, `77` or `7e` (`$0F:E234`); `a/02` and `a/17` have no such code.
Saiyan Meteor asks `1c` at 200, `1f` at 274, `24` as the ball lands, then
`21` and `22` in one frame — so `21` never runs. While white, `$0F:F241`
puts out an `a/02` every 4th frame of the game in a free slot, 60 frames.
Ours: a state's `screen` (`src/screen.ts`).

Quadruple Kick walks forward: vx 2.375 at frames 14, 26, 48, 70 and 1.25 at
18, 32, 54, 76, kept until changed (nothing slows it), re-armed at 26, 48,
70 — `goku`'s `quad_kick` states copy it as `velAt`.

**Each fighter's moves by id**: inputs as the command table has them
(`npm run rom -- port <id> --fighter <name>`), names from the owner's move
lists. The rows `c8` and on are the same moves above the arena (`mode`).

| move | Goku | Vegeta |
|---|---|---|
| `9c` | Teleport Towards — ← ↓ ↙ Y | Jumping Knee Slash — → ↓ ↘ B |
| `9d` | the throw — → + X, in grab range (The throw, above) | the throw — the same |
| `9e` | Teleport Away — ← ↓ ↙ B | Jumping Bomb — ↙ ↗ Y |
| `9f`, `a0`, `a1` | ↓ ↘ → / → ← → / ↓ ↙ ← + X — not in the move lists: blows that send him to another part of the arena (Which reaction) | the same |
| `a2` | Double Kick — → + B | Driving Elbow (3D) — R + Y |
| `a4` | Jumping Knee Slash — → ↓ ↘ B | Sliding Kick — ↓ ↘ → B |
| `a5` | Quadruple Kick — ← ↙ ↓ ↘ → B | Rushing Knee — ↓ ↘ → B, only from `a4` |
| `a6` | Abiseh Geri, a spinning kick — ↓ ↙ ← B | Cross Punch + Jump Kick — ↓ ↘ → B, only from `a5` |
| `a7` | Double Punch — ↓ ↘ → Y | Energy Dash — ← ↙ ↓ ↘ → Y |
| `a8` | Side Slash (3D) — R + B | — |
| `a9` | Large Ki Blast — → ← → A | Bakuhatsu-Ha — ↓ ↑ Y |
| `aa` | Chou Kamehame-Ha, charged — ↓ ↙ → A | Renzoku Energy Dan — ↓ ↘ → A |
| `ab` | Kamehame-Ha, upward — ← ↙ ↓ ↘ → A | Energy Field, in the air — ↓ ↙ ← Y |
| `ac` | Slash Down Kick, in the air — → ↓ B | Final Flash, charged — ↓ ↙ → A |
| `ad` | Saiyan Meteor, the ultimate — ← ↙ ↓ ↘ → ↗ Y | Big Bang Attack — ← ↙ ↓ ↘ → A |
| `ae` | — | Galactic Gunfire, the ultimate — ↑ ↓ Y, within 64 px of a grounded opponent |
| `b1` | — | Vertical Ki Blasts, in the air — ↓ ↙ ← A |

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
| 2 | also: chip on guard (`$0D:CFD1`), `0x40` = byte 3 / 16, else `0x20` = byte 3 / 8 — byte 3 as it stands, no attack or defence, straight off health, and a KO when it empties it; none while `$1B15` is set or `$1A02 & 0F` is 3 `?`. Goku's specials carry it, his normals do not; the Kamehameha's heads `/ 8`, the ki blast none. `0x80` read for the attacker's own move `?` (`$0D:DC8B`) |
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
(`$0D:C4C1` reads the word at byte A). Byte 0 is defence; then 8.8 words
at bytes 1 / 3 the walk forward / back, 5 / 7 the dash, 9 / `0B` the
jump's vx forward / back × 1.5 (`$0D:FC99`, `FD3F`: ↑ → or ↑ ← is move
`06` and word 9 the way he faces, `07` and `0B` the other), `19` the
jump's vy, `1D` gravity — `src/rom/attributes.ts`. Knockback is one table
for everyone (`$0D:D68A`).

**Which reaction** (`$0D:D29C`–`D353`). Grounded (field `0x23` ≥ `0xc8`),
bits of bytes 0–1 as one word: `0x0004` `$D622` (stopped dead, then the
heavy reel — `16`, crouching `14`; ours `halt`), `0x0008` light,
`0x0010` heavy (`$D356`, `$D382`: by the defender's field `0x97` bit 0 another reel — standing `14`, crouching `18`, knockback 3 for heavy; recorded, Suki Combo on a stander: `14` on the blows whose spark is 14 px higher. `$2A:8E00` sets the bit when `$DC` is 0 or 3, clears it otherwise: which pair of boxes met `?`), `0x0020` → move `19` (ours `trip`; `$D60A`: knockback `0f`, 2.0 back
and −4.0 up; blows pass it by from frame 0; it lands with dust and `0d`,
no bounce, and gets up after 12 frames — `$10:AEB6`), `0x0040` knockdown (move `1b`),
`0x0080` → move `42`/`43`, `0x0400` → move `1e` (`$D3BB`, ours `high`), `0x0800` `$D670`,
`0x1000` `$D540` (move `1b` on knockback 5, ours `down`); `0x0001`, `0x0002`, `0x0100` and `0x0200` are not read
there. `0x0080` (`$D558`, the jump attacks') is a long light reel: `42`
standing, 24 frames of the light reel's drawing, `43` crouching
(`$0D:D7BA`), knockback index 6. **A body in `1e` hit again** goes back into `1e` whatever the blow (`$0D:D25D`): field `0x7b` counts the hits, and from the third (`0x7b` ≥ 3) it is the knockdown `1b` instead; any move but `1e` and `30` clears it (`$01:8529`). A recording of Vegeta's `9c` on Goku: all three blows `1e`. Airborne, bits of byte 1: `01` → move `1a` (`$D616`, knockback
index 16: a tumble that ends in the jump's fall pose, then landing as a
jump does, `3b` and `0c`, turned to face — `$0F:A1E0`), `02` knockdown, `04` → move `1e`, `08` `$D670`. Then byte 2 bits 0–2 for both
(`$D3F3`, `$D46E`, `$D4D4`): the blows that send the defender to another
part of the arena — Goku's `9f`, `a0`, `a1` set bits 0, 1, 2. Each: a
blow that empties the health is a KO (`$D687`); otherwise `$0D:E158`, by
the arena's part (`$DD`) and the direction (0, 1, 2), says whether the way
is open. Open: the game's state `$37` becomes `4C` (bit 1: `45`, the
defender turned), `$0502` / `$0500` are set, and the defender takes move
`21`, `23` or `25`. Closed — or in the modes `$1A02` / `$30B0` say
(`$30B0` bit `40`; `48` when `$1B15` is clear and `$1A02` is neither 0 nor 2) — a knockdown, `1b`,
with knockback `12`, `05` or `04`; above the arena (`$0552`) `$D5C0`
instead.

**Where a blow sends him** (`$0D:E158`, by `$DD`, 0 in a fight, `$00:CB31`): the stage id it gives goes to `$0550`, carry set for a closed way. With `$DD` 0 it reads `$054E`, and only the day's ids have ways; every other stage is closed `?` (not played). "Faces left" is the attacker's field `0x12` bit 6; recorded: Goku facing right on the tournament, `a0` → the ruins. Direction 1 is the only one along the ground:

| from | 0 (`9f`) | 1 (`a0`) | 2 (`a1`) |
|---|---|---|---|
| tournament `00` | right half `06`, left `03` | faces left `0d`, else `0c` | closed |
| ruins `0c` | right half `06`, left `03` | faces left `00`, else `0d` | closed |
| plains `0d` | right half `03`, left `06` | faces left `0c`, else `00` | closed |
| palace `09` | closed | faces left `03`, else `06` | closed |
| sky `03` | `09` | `06` | right half `00`, left `0d` |
| planet `06` | `09` | `03` | right half `0c`, left `00` |

`06` is closed instead while `$1B15` is set `?`. Recorded (`tools/re/runs/sender-a0.json`): the defender is `23` for 156 frames, through a screen of blue curved bands, the attacker `45` for 143; on the new arena the defender lands at 320 and slides to 330, then gets up (`1b`, `1f`), the attacker running in to x 193; no health lost. Facing left (P2's): the plains, the defender at 192 → 179, the attacker in from 512 to 312.

**The journey's screens** (`$37`, recorded for `a0`): `45` the defender flies off the old arena at 8 px a frame (`$01:8A0E`, field `0x02`), the old stage still shown; `C6`, `C7` load the new one (`$00:B667` with `$0550`); `46` to `48` the screen of blue curved bands: colour windows (`$2130` = `10`, colour math only inside them), `$01:8E6D` pointing HDMA channel 1 at `$2126`–`$2129` through one of four indirect tables a way (`$01:8FD0`, 7 bytes each: leftward `$9008`, `$9388`, `$9708`, `$9A88`, rightward `$9E08`, `$A188`, `$A508`, `$A888`; 4 bytes a line, 127 lines then the rest `1FC` on), by `$1600` & 3 (`$01:8962`: 3 the first, 0 to 2 the next), and the first turning them inside out (`$2125` `A0` ↔ `F0`, `$212B` `0` ↔ `4`); the fixed colour 6, 6, 15 off a screenshot `?`. Fit against recorded screens: 97–100%; `4A`, `4B` the new arena, the defender flying in at 8 a frame to x `41` or `C0` (`$01:8BB3`), held 40 frames by field `0xF0`, then vy 4 and down. Recorded `9f` from the tournament: the defender `21` for 134 frames, then both arrive from below in the sky, `44` / `74`, and fly (`60`). Up and down (`4C`, `$01:8CA4`, `$01:8D17`) fly by y instead, to `-C0` or `1C0`, and arrive at y `140` / `1A0` (vy −15) or `-8` / `-20`, as `1b` and `05`.

Light is move `15` (`13` when field `0x97`
bit 0 is set), heavy `16` (`14`); `$0D:D7BA` turns them into `17`/`18`
`?`. Hitstun is that move's script — light 14 frames, heavy 26 — not a
number in the record.

**Knockback is per reaction, not per blow**: `$0D:D708` with a reaction
index sets field `0x8c`, the push speed `0x88` (8.8 fixed point, turned by
the attacker's facing) and vy from a table of 6-byte entries at `$0D:D68A`.
Light (index 2) pushes 2.0 px/frame, heavy (3) 3.0, knockdown (4) 2.0 and
−4.0 up, the high knockdown `1e` (`0c`) 0.75 and −7.5 — `14` (0.75, −6.0)
for Vegeta's `9c` and fighter 4's `a4` (`$0D:D3BF` compares the attacker's move with his script set, field `0x41`: `019c`, `04a4`), `13` (0.5, −8.0) for `a3` — the long light reel (6) 2.0 for 10 frames, in the air (16) 2.0
and −6.0 up. A reel's handler (`$0F:A14C`) never calls `$0D:EC5F`, so its push **keeps its whole
speed for the entry's frames**, outside hitstop: 16 px for light, 36 for heavy, as recorded. The
moves that do call it (`$0F:A283`, `$0F:A338`, `$0F:E9D3`, `$0F:EA8A`, `$10:AF7A`, `$10:B031`,
`$20:A464`) slow it by 0.25 a frame; whether a block's (`0d`, `0f`) holds too is not recorded away from an edge `?`. `0x8c` takes the entry's first word — 8 light, 12 heavy, 48 in
the air, 64 down or dizzy — the frames a push of that speed lasts, and
counts down outside hitstop. A blow sets hitstop (`$30B2`) to `0x8a`.

**Bodies** (`$2A:80ED`, every frame from `$00:8DEA` but in hitstop):
slots 0 and 1 of the drawing's box record, the body and the head, placed
by x, y and the draw offset (`$2A:87DE` / `886A`), tested in the plane —
body/body, head/head, then each against the other's (`$2A:89D0`: the signs of `a.x1 − b.x2` and `a.x2 − b.x1` differ, so player one's right edge on player two's left counts, the reverse does not; ours counts both; in the air `$2A:8B1A` compares their heights first, so bodies overlap all the way down and part on landing `?`). The
first pair that touches gives the overlap along x; each fighter moves half
of it away from the other, within 16 px of the screen's edges
(`$2A:8AFB`), and field `0x97` bit 7 is set on both. Skipped while either
has field `0x96` bit 7 set (`$2A:80F5`; a script's `96`) — pinned's `4a` /
`4b` set `f0`, so the body lying under Galactic Gunfire is never pushed.

**Health** starts from the ENERGY option, 400 by default (`$1AC9` /
`$1ACF`, per side), or 80 or 999 in other modes (`$01:8150`, `$01:826F`).
Training is mode `$1A02 = 3`, where damage is zeroed. One bar on screen
holds health and ki, but firing a ki blast leaves `0x60` alone — ki is
another field, `0x62` or `0x64` `?`.

## A KO and the round's end

**The blow that empties health** (`$0D:D0D0`, from the blow's routines at
`$0D:CF9F` / `CFC6` and `$0D:D0AD`): effect `0a`, then `$0D:D10C` — the
loser's voice `31`, health set to 0, and, if `$30B0` bit 1 is clear, sets it
and queues `83` to the sound driver (`$00:DF40` → the queue at `$C7`, the
music `?`). Then knockback by reaction 1 (`$0D:D708`) and move `1c` (`7e` in
`$0552`'s mode).

**While `$30B0` bit 1 is set the fight runs at half speed**: on every odd
frame (`$74` bit 0) the frame loop (`$0E:821C`) skips the fighters, the
objects and the rules, and only draws.

**`1c`** — Goku's handler `$10:AF8E`, Vegeta's `$0F:A297` — keys on the
script's step (its table shorter than the script, which holds at step 7):
0 holds frame `0x20` while rising; 1, on landing, dust (`a/0d`,
`$0D:DE6C`), effect `0d`, a bounce of a quarter of the landing vy, up to
2.0 (`$0D:EC12`), and frame `0x40`; 2–3, on landing, dust, `0d`, vy −1.5,
frame `0x64`; 4–5, on landing, dust, `0d`, stopped, frame `0x88` — and in
Goku's alone `$30B0` bit 1 cleared, full speed again (`$10:B022`); 6 on
slows vx and the shove by 0.25 a frame (`$0D:EC5F`) and from frame `0xA8`
(168) calls `$0D:EBB8`: field `0x28` bit 5 — lying done — `$30B0` bit 1
cleared, and behind the other (`$0D:D8D5`). Vegeta's half speed lasts
until then.

**The round ends** (`$0D:EA89`, every frame, unless either fighter is in
`fb`, `3e` or `82`, or the object slots' type bytes, ORed, have bits 7 and
6 both set — a live object with bit 6 `?`): the loser lying
done and the other in `00` (`60` in the mode) — or both lying done — puts
both in **`fb`** (`$0F:B263`, run from player two's slot): frame 1 loads
resource `34` at `$6B00`, frame 2 puts **the announcement** in slot 0
(`$0D:EB45`, the table at `$0D:EB88`: `a/1f` at x 128, y 80 on the
screen, its frame 1 for a KO, 0 for both down). Once slot 0 is empty, the
one with health left gets `3e` (`82` in the mode) — none: `$30B0` bit 5,
a draw.

**The announcements** (`$0F:E0D7` by animation; `npm run rom -- object a 1f
34@6b00 80` draws them): `a/1e` (`$0F:E7C9`) is the round's start: READY
drops in from the top to y `0x58`, past it to `0x5C` and back (`$0F:E837`,
a tick each), effect `4d` on tick 1; FIGHT! and effect `3a` on tick 64;
gone on 96, both fighters into `fa`. `a/1f`
(`$0F:E857`): frame 0 DOUBLE K.O., frame 1 K., frame 2 K.O.; effect `09` on
tick 1, from frame 1 the next on tick 24 with `09` again, gone on tick 80.

**`3e`, the winner's pose**, is each fighter's own: Goku's (`$20:80D6`)
loads resource `51` at `$6C00` and `$7C00`, puts out object `0/07` — his
hair, which the pose's drawings lack — and loops its last part; `0/07`
(`$0F:B8CD`) shows frame step − 3 of his move and is gone once he leaves
`3e`, in OBJ palette 0 (`0x27B161`). Vegeta's (`$20:9257`) loads palette
own + `0x98` (field `0x17`) on frame 1 — record `0xE8` by day, his hair
black where the drawings paint it in the aura's colours 12–13. Goku's
loads the hair's palette too on frame 2: record own + `0x130` (`$20:80EF`).
Both count field `0x70` (`$0D:EBCC`) and at 304 clear `$0580`, which lets
`$0D:CEC5` end the round.

**`82`, the winner's pose above the arena** — `fb` gives it in `$0552`'s
mode instead of `3e`: Goku's (`$20:81D9`) leaps with a fist up, says line
`03`, holds drawing `40`, and bobs all the while (`$0D:C40A`: field `0x10`,
the draw offset, 0 to −6 px and back, a pixel every 4 frames of its
counter `0x16`, 48 round); Vegeta's (`$20:9272`) says line `10` and loops
from frame 8. `3f` is set only by the sequencer in bank `$02`
(`$02:DD8B`) — the story `?`, not a fight.

**`3c`, the fighter's intro**, is played on the screen before the fight
(scene `$32` = 6, run by bank `$02`): both fighters take it on the same
frame (`$02:A242`, `$02:A254`), at world x `0xC0` and `0x140`, but the scene
holds each on frame 0 and runs him in turn (`$01:8382`): recorded, player one
110 frames in, player two 33 after he stands (`$1A21` to `0x21`), his field
`0x07` off the screen until then; a button skips the scene (`$1A73`). Gohan's
(`$20:A478`) on frame 1 glows (his palette + 8), on `11` takes his own back and
`0x117` into OBJ palette 4 / 5 and shows himself in it (field `0x15`, `8` / `A`),
`2/06` staying in his own, on `2E` back to palette 0 / 1. From 16 to 52 his own drawings (`be`–`c3`) are dust, and his body is `2/06`: back to front his sprite, `2/06`, `2/05` (OAM snapshots); the script's `hold` on 58 lasts 13 frames, recorded for both sides. Goku's (`$20:8058`) turns Super Saiyan: effect
`29`, object `0/05` on its step 2 — his black hair, `$0F:B828`: frame step
− 2, gone from step 6 or out of `3c`, at his place — line `32` at 65, and
from frame 65 effect `19` every 8th frame of the game; on frame 2 it loads
resource `51` at `$6C00` / `$7C00` and palette record `0x118` (`0x27B161`)
into OBJ palette 4, player two's 5 (`$01:89DE`). 161 frames, then the
script ends. Vegeta's (`$20:920D`): effects `1b` at 32 and `2f` at 68, his
aura flickering (`d2` / `ca`), then holds `36`; 132 frames. In scene 6
only, from frame 69 until step 20 his x stands 16 px behind where he
began. The fight then starts with `a/1e` over both standing (`$0D:EB45`
with 0, `$0E:8155`): READY, FIGHT!, then `fa` — 2 frames keeping the
drawing — and the fight.

## Another fighter

Every per-fighter table is reached through a pointer table of **ten 3-byte
entries, one per fighter** — the roster, read by `src/rom/roster.ts`
(`npm run rom -- roster`), named from the HUD's names (`$00:C511`): Goku,
Vegeta, Gohan, Gotenks, Vegetto, Piccolo, Freeza, Cell, Mr. Buu, Buu — an
eleventh name, 魔人ブウ, stands in for Mr. Buu's in some modes. The
script-table index (field `0x41`) is the character too. Found 2026-10-29 by
searching for pointers to Goku's tables:

| what | pointer table | Goku's entry | `FighterTables` field |
|---|---|---|---|
| layouts, by drawing | `0x487d2` | `$09:880E` | `layouts` |
| drawing → its tile resource | `0x487f0` | `$09:8A54` | `tileSets` |
| boxes, by drawing | `0x151aa5` | `$3B:8000` | `boxes` |
| animation scripts, by move | `0x88de` (`$01:88DE`) | `$0C:AA15` | `scripts` (the index) |
| resource loaded at VRAM `$6800` | `$01:848B`, 2-byte ids | `0x47` | — |

The **tile-resource table holds a 2-byte resource id per drawing** (`0x012f`
is resource `0x12f`), 0 for a drawing not used; each fighter's sit in his
own page — Goku `0x1xx`, Vegeta `0x2xx` … Buu `0xAxx`. A resource's record names its palette too
(Goku's: `$16:8000`, the `0xb0000` PalMod lists). The fighter-block field
`0x41` holds the script-table index, `0x00` the character.

A new fighter's tables are `fighterNamed(rom, "vegetto")`; what they
lack is `objects` — his objects' pictures and timing, read from their
types' code by the reader to come (`plan.md`).

### Vegetto

Handlers from `$20:C687`. **Shooting Kick** (`aa`, `$20:C758`): vx 1 to frame 28, then on frame 34 (`$20:C1B2`) (opponent's x ± 8 − x) / 32 whole px. **Low B** (`95`) slides at vx 4 from 9, losing 0.5 a frame from 28 until the step at 37.
**His throw** (`9d`, `$20:CED3`) strikes twice: frame 29 (`$20:CF1F`) 0 damage, move `1b`, vx 1.5, vy −8, no sound, holding him no more on that frame; frame 61 (`$20:CF47`) his voice `30`, 34 damage, stun 4, `1b`, vx 6, vy −1, with `a/17` on him at +16, −28 by the thrower's facing. Field `0x96` is `f0` throughout.
**Intro** (`3c`, `$20:D90C`): below frame 97 his palette is his own + `0xAE`, black hair: one colour of `0x12E` differs from `0x80`; from 97 his own, and sound `19` every 8th frame. Recorded, he stands from 195 and the scene takes him out of `3c` at 208, 35 frames before its script ends, with silence after. Ours stops the sound at 208 and plays the script out, or READY would cover the last copy's ring. A lighting moves a whole palette by one amount: evening +2, −2, −8, night −4, −4, 0 in 5 bits.
**Big Bang** (`af`, also `d4`, `d5`): on frame 7 the handler (`$20:D0D6`) finds the slot of `4/02` and sets bit 7 of its `+4` (`$20:D0DD`): the flash over his hand is drawn upside down, up from its y. Bit 7 of the `b0`'s own attribute byte is not this: it asks for the player's palette (`$01:87A2`). No other fighter's handler does it.
**Slashdown Kick** (`a8`, `$20:CC0D`): from 16 it dives at vx 5, vy 5; once its blow has connected (field `0x25` bit 7 clear) it stops, re-arms and becomes `a9` (`$20:CC68`). There on 1 gravity off, vx −5, vy −5, each gaining 0.375 a frame to 15; stops on 16; on 20 vx 6.5, vy 6.5 and the second blow; lands into `3b`.
**Moves `50` and `51`** the opponent plays here are each fighter's own, and hold at their own frame: `50` at 262, Mr. Buu's 260; `51` at 28, Vegetto's 32, Gotenks's 34. Past the hold most `50`s run on into their `51`.
**Elbow Dash** (`a7`) raises `a/0D` under him while `0x7D` is not 0, on frames with `& 3` = 2.
**Galactic Juggle** (`b0`, then `b1`, `$20:D28E`, steps by field `f0`, table `$20:D2B0`), frames of `b1`: the opponent `30` at +23, then `51` at +38 from 48. The script's three `a/00` at 52, 60, 84. On 85 (`$20:D38B`) he is thrown as `50`, vy −17, his voice `30`, 0 damage. At 117 (`$20:D3C9`) he is over the mover, at 150 he stands at y 70 and rises 4 a frame, `$37` = `24` (white, to 269); kind 4 from 150: x −12 to −5, bottom y 88; `4/05` draws nothing, rises at vy −4 and goes at frame 120 (`$0F:C4BE`). While it rises (step 3, `$20:D44D`) a countdown from 8 that a pause stops: at 3 `$37` = `21`, `22` (the white off), at 0 `$30B2` = `82`, `$37` = `24`, and `$20:D7B8`: `a/00` at x −8, y − `f1` (`f1` from 0x78, 0x20 more each), sound 09. Frames 159, 168 … 240; on 150 the same with `8A`. Its top rises 2 a frame the countdown runs. The mover jumps on 295, vy −15, is put at y 0 on 312 and falls at gravity 0.5 to 5.5, vx rising 0.125 a frame to 2.875; the opponent is kept at −32, 0 from 313, +16, −64 from 335, +32, 0 from 339. On 341 the mover goes back at vx −1, vy −4, gravity 0.125 to 2.375; the opponent falls at vx 8, vy 16, gravity 0.47 to the floor at 346, lying. Kind 5 there, with sound `2f` (`$20:D669`): radius 1, 4 more a frame to `0x70`, then 8 less (`$20:D674`, `$20:D697`). On 391 kind 4: x ±32 about him, from the floor up 11 a frame to `0xC1`, narrowing from 14 frames in, gone at about 35; and the throw (`$20:D72E`): 127 less defence, stun 10, `1b`, vx 2, vy −11.

### Freeza

Objects from `$0F:CFC4`. **His ki blast** is his own: `6/02`, vx 4, gone at 40 (`$0F:CFC4`), `a/02` where it hits; every other fighter's is `a/03`, vx 3. His landing plays no `0c`, from a jump or a move (`$0F:9FC2` skips it for character 6); lying down after a bounce still does (`$10:AF6A`).
**Double Leg Kick** (`a4`, `$10:B61D`): vx 1 and behind on step 0, stands on step 6, on frame 32 (`$10:B67E`) (opponent ± 8 − x) / 32 whole px, turned to him.
**↓ + B** (`95`, `$10:B1B0`) and **↓ ↘ → X** (`9f`, `$10:B4A3`): vx 4 from frame 21 and frame 4. Stopped by contact; missing, `95` runs to the script's end (60 px), `9f` stops 4 frames on (16 px). **→ ← → X** (`a0`): vx 2 from 20 to 38 (36 px), stopped by contact.
**His throw** (`9d`, `9e`): the opponent is in `30` from `9d`'s first frame, standing where he was in the drawing he had; held at the table from `9e`. Field `0x27` bit 0 from `9e`'s frame 1 (`$10:B27F`), and on **Explosive Grab** (`aa`, `$10:B804`).
**Evil Energy** (`a6`, `$10:B733`) hangs, and at the script's end goes on at fields `0x80`, `0x82`, the speeds it came in with, in `05` from frame 56 (`$0F:B1EC`). `6/0d` 18 frames; `6/0e` moves itself 2 forward and 2 down a frame and is gone at his step 3 (`$0F:D274`); `6/13`, at y `C0` or more (`$0F:D414`), becomes `6/0f` at y `C8` and puts out `6/10` in another slot: both strike, 32, and stay. `6/0f` is the ring and a pillar, `6/10` a pillar after 20 frames.
**Ground Wave** (`a7`): `6/08` runs through a hit pause, goes when he leaves `a7` or `cd`, and at y `C8` becomes `6/09`, at vx 3 along the floor (`$0F:D106`), for good.
**Kienzan** (`a8`, `$10:B788`): vx −1 from 32, +1 from 36, 0 from 40. `6/06`, 80 frames: when `$74 & 7` is 0, vy ∓2.12 toward 32 px over the opponent's feet, 0 within 16 (`$0F:D086`), as Yuudoh does every 4th.
**Death Ball** (`ab`, `$10:B978`): vx −1 from 29, +1 from 35, 0 from 41. **Kishin Ha** (`a5`, `$10:B6C5`): −1 from 8, +1 from 12, −1 from 16, 0 from 24; `6/14` runs through a pause, stays on a hit, and goes with the move or after 12 frames.
**Jasenkoh** (`ad`, `$10:BA2B`) dives from 9 at 4.5, 4.5; connecting, it becomes **`ae`** (`$10:BAB2`): gravity off, stopped, each speed losing 0.5 a frame from 2 to 7, stopped on 8, on 9 at 4.5, 4.5 again, blow armed on 12, frame 13 held until it lands: `0c` and idle, no `3b`.
**Flaming Headbutt** (`af`, `$10:BB55`): every frame the palette of `$10:BC84`, a record for 3 frames then the next, the other pair for player two in a mirror. From 41 vx −2 and field `0x10` + 2, once, until the script's next step writes it at 43; from 46 vx +2 and field `0x10` − 4 (its value 2 to −2, recorded), until 51; from 50 vx 6. Frames 58 to 73 go round while the blow is armed, up to 32 frames in all (field `F0`, `$10:BC16`); once it connects he stops where he is and the script plays on. The opponent's `20` (`$0D:D670`, `$0F:A203`) turns him by field `0x14` on four frames in eight of `$74` (rising, two lone frames; from the script's `flip` on, four together, since it writes the field every frame), burning, at his own gravity, vy −13: lands with dust and `0d`, bounces at a quarter of his speed (`$0D:EC12`), lands again with dust and `0c`, and lies in its last drawing for 60 frames (`$0F:A22D`), as `1b` does. Ours does neither: `combat.md`.
**Jubaku Ha** (`ac`, `$10:B9D4`): `6/15` draws nothing: a kind 2 ball, 1 larger a frame to 16 (`$0F:B6B2`), which goes if he leaves `ac` or `d2` before it moves. On frame 146 the handler finds its slot and gives it vx 2; then nothing but a hit or the screen's edge ends it. It puts the opponent in his own `37` wherever Freeza then is: for 128 frames a ball of radius 56 or 57 by `$74 & 1` at (0, −48) (`$0F:A417`), then he throws himself: 80, stun 5, `1b`, vx 2, vy −4, `$37` = `16`, with `a/18` at (0, −40) and burning.
**Intro** (`3c`, `$10:B06C`): records `F0`, on steps 11 to 18 `F1`, `F2`, `F3`, `F0`, `F4`, `F5` (absolute, not by player), own at the end. Not cut by the scene. No charge sound.

### Cell

Handlers from `$10:C0CA`, objects from `$0F:C5CB`. His move-loaded tiles are `0x4E` (and `0x4C` under them); type `a`'s `21`, `22`, `23` draw from the shared `0x30` at `$6500`, `0x31` at `$7500`.
**His throw** (`9d`, `$10:C316`): `a/17` at +48, −96 on frame 29, as he is let go, and its copy 6 frames on at +54, −104 (recorded).
**Giga Shoulder** (`a2`, `$10:C4E5`): behind on step 0, on frame 30 (`$10:C534`) (opponent ± 8 − x) / 32 whole px, turned to him, until 62, where it stops.
**Psychic Lift** (`a6`, `$10:C60E`): step 1 holds until the opponent's y, one less a frame from `C8`, is under `0x78` (`$10:C661`). On frames 34 and 62 his voice `30` and `a/01` on him at a place by character (`$10:C73B`), facing his way; the throw on 90, 43 less defence, stun 6, `1b`, vx 2.5, vy −8. The hold is 82 frames, and his track's steps wait through it: it has no step of its own there (`THROWER_WAITS`, `held.ts`).
**Cell Junior** (`a8`, `$10:C763`): `7/03`'s frame field is its state too (`$0F:C61D`). 0, vx −3, vy 3, kept 16 px inside the screen on the side it falls to, until y `C8`; 1, 2 frames still, then vx ±2 by facing, vy −4; 2, in the air until y `C8`; 3, 2 frames still, then 2 again. In the air it runs `$0F:CBE4` and `$0F:E4EB` both, so it moves twice a frame with gravity `0x78` once: 4 px a frame forward, up 34 px, 17 frames. Palette `F6`, `F7` by `$74 & 4` (`$0F:C6B2`). Becomes `a/17`, burning.
**Energy Burst** (`a5`, `$10:C5C1`): on step 3 his drawing is at y −9 or −8 and his palette his own or own + `0x48` by `$74 & 4`; own again on 53. `7/07` and `7/08` stay on him, frames from tables `$0F:C883` (27 entries) and `$0F:C8E4` (32), then gone.
**Negative Arrow** (`a9`, `$10:C7B8`): hangs; at the script's end vx, vy from fields `0x80`, `0x82` and move `05` at frame `1B`, step 2, as Freeza's Evil Energy (`$0F:B1F8`). `7/06` flies at 3, 3; at y `C8` (`DF` above the arena) it goes 8 px down, plays `0a` and becomes `a/02` (`$0F:C7F6`).
**Chou Kamehameha** (`aa`, `$10:C811`): the head at +72, −61 as the script says; recorded, `a/16` stands at +24 and the band starts at +30, where Goku's and Gohan's do, whatever the script's `b0` says.
**`7/04`** stays at his y − 47, x ∓ 3, 3 frames of 6, gone. **`7/05`** is gone at 80, its frame by `$74 & 4`.
**`$2A:8B92`**, the gate before a blow: no hit on a move `90`–`F9` on its frame 0; a body in `1e` cannot be struck from its step 2 (the bounce), nor at y `B8` or more. `7A` counts down for any other move, read no further `?`. Called at `$2A:8167`, `81CE`, `8233`, `8298`, for fighters' boxes `?`. Before it `$2A:8155` asks `$44` ≥ 2: a move's first two frames cannot land.
**Kind 4 at `$30BA`** (`$2A:A78D`, one per player): word 0 on, `2` left, `4` middle y, `6` right, `A` half the height; the drawn top stops at y `1E`, under the HUD. `$10:CD44` puts its middle at `C8` − half, so it stands on the floor.
**Bakuretsu Rush** (`ac`, `$10:C929`), **Tri Eruption** (`ad`, `$10:CB1A`): own + `0x48` on 18 and 30, record `14B` on 22, own on 34; field `0x96` `70` to 42. `ac`: vx 2 from 42, dust every 4th from 42 to 164, re-arms on 58, 74 … 138, stops and re-arms on 164, shake pattern 2 for 32 on 167. On 167 its pillar at +38 (field `F2` half width, 1 more a frame to 16, half height 8 more a frame to `78`), shown on odd counts of `F0`, 16 frames; the script holds on 170, then the width comes down 1 a frame and it is gone 32 frames in, then the script goes on. `a/22` goes when `$44` is past `AA`. `ad`: the same pillar from 59, not flickering, its height coming down 8 a half a frame: gone at 31, then the next at +70 and +102, each with its set of four `a/23` 32 px further on (recorded: the `b0`s name the same place), at the release of the last. A hit spends the set: of four over one body one strikes (recorded). A set is up 32 frames. Each set plays `3c`, in both players' scripts, which is `3a` shifted for player two (`$0D:D852`), so the same sound `?`; `a/23` struck sounds `0a` (recorded, `13` on player two), not a melee blow's `09`, though it stays.
**Intro** (`3c`, `$10:C1D6`): records `148` on 1, `149` on 64, `14A` on 68, `14B` on 72, own + `9C` on 100, own + `9E` on 104, own on 108; field `0E` is 0 or −1 by `$74 & 1` while the step is under 8. No charge sound.
**Win** (`3e`, `$10:C28D`): from 57 to 120 his drawing rises a quarter pixel a frame from −8, then bobs a pixel every 4 frames of `$74` 7 up, 14 down, 14 up …; holds at 272.

### Buu

Handlers from `$10:D0FF`, objects from `$0F:D9FA`. A move's `$30,X` holds the sequence of the command row it read last (`$0D:EE31`). His command table overruns the ground's area: Disk Tackle's row, condition ground, is the first of the air's.
**Throw** (`9d`, `$10:D307`): on frame 1 he stands at the opponent's x and y and holds him there; the opponent's voice `30` on 6, 18, 30. At the script's end `$0F:B321` (58, `1b`, 2.5, −7) and himself `1a` from frame 0, back at 2, −8.
**Matamol** (`b6`, `$10:D8EB`): behind on step 0; on frame 30 (opponent ± 8 − x) / 32 whole px, turned to him, until step 19 at 62.
**Earth Stab** (`af`, `b0`, `$10:D5B7`): `af` is `b0` from its first frame. On 14 `9/08` stands at x + 32 + 32 × (`$30` − `1D`), so 32 by Y, 64 by B, 96 by A, on his floor, tiles `08`, palette 4 or 5 (his own), sound `08`. Step 2 holds until the spike clears `F1`, 24 frames (`$0F:DCE2`, table `$0F:DCEE`). Then, with fewer than three out and `b0`'s command met on that frame, step 1 at frame 14 again; else the hold is let go.
**Kantsu** (`b5`): `9/09`, 80 frames, frames 0, 1 by `$74 & 4`; it costs 5.
**Buu Burn** (`b3`): `9/04` at 3, −3, 80 frames, palettes `105`, `107`, `108`, `109` frame by frame while `$74 & 4`. Beside it `9/06` (no box): tile base 0, his drawing's tile set `a46`, 22 frames from table `$0F:DBF1`, while he is in `b3`, `f4`, `f5`; it outlives a hit of `9/04`.
**Energy Sphere** (`b4`, `$10:D6A5`): `F0` is set for good once A is off. On 28 and 40 with `F0` set: frame 52, counter `10`; else all his slots are cleared and the next stage's `b0`s fire. Balls `9/17`–`19`: blows 50, 65, 80, drawn effect kind 2 by `$0F:B6B2` at radius `E`, `16`, `26` + 1, 2, 2, 1 by `$74 & 3`, gone if he leaves `b4` while vx is 0. From 61 to 75 the handler sets the ball at x, y by table `$10:D7B4`; on 76 vx ±4. Sparks `9/0e`–`16` stand at a fixed offset from slot 0 unflipped, frames by tables `$0F:DD4D` … `$0F:DF9D`, frame 0 of some empty as a delay; gone when slot 0 is no ball.
**Disk Tackle** (`b2`, `$10:D845`): vx 6 on 8, 0 on 36; a connecting blow from 8 to 35 sets `1a` at frame 8, vx −1, vy −8.
**Slashdown and Horizontal Blast** (`d2`, `d1`, `$10:DF85`): hang 40 frames, then `05` with `80`, `82`. `a/20` flies at 3, 3, gone at 53; at y `C8` sound `08`, y `C0`, `a/02` (`$0F:E2B0`). A hit makes it `a/01`.
**Floater** (`a9`, `$10:D46C`): hangs and bobs (`$0D:C40A`, by character at `$0D:C3D3`) until a button. Frame 6 with no direction, 22 at the walk's speed with one, turned to him; sound `21` when `$74 & 3F` is 0. A button's air move starts at vx ±4 by the pad, vy `82` / 4.
**Putty Uppercut** (`b7`, `b8`, `$10:D9A1`, `$10:DA49`): a blow from step 2 to 5 on an unguarded body: `b8`, the opponent `59` in drawing by character (`$10:DB0E`), held by step (`$10:DB18`) at +64, −16; +48, −16; +32, −63 (Vegetto +24, −55). On 48 four `a/21` around him, on 88 flying at ±3 (`$10:DD2B`). On 94 `$37` = `16`, `$0F:B321` (100, `20`, 1.5, −10), burning. On 100 `9/01`, a piece of him, at 0.5, −8, gravity `0x78`, its V and H flipped every 8 by `$74`; on his floor it crawls to him and within 24 px is gone and sets his frame to `E9` (`$0F:DB3E`). As the opponent lands `$0F:B321` again (0, `1b`, no speed), sound `3a`, and kind 6 at his x: a column from y `C7`, top up 8 a frame to the camera + 32, half width `20` from then 1 less a frame. At 1 it is off and the move ends.
**Charge** (`0c`, `$10:D155`): the glow on frame 1, the shout once though the script goes round, sound `17`; each pass starts at frame 0 of the script, and the first end puts out `9/00`, a ring of dots from his tile set, on him, frames 0 to 4 at 4.
**Intro** (`3c`): no handler, no palette, no sound but his line; the script's 155 frames.
**Win** (`3e`, `$10:D1C1`): back to frame 7 at the script's end.

### Piccolo

Handlers from `$20:D96E`. **Sonic Kick** (`9e`, `$20:DC1B`): goes behind on step 0, stands still, on frame 36 (`$20:C1B2`) (opponent − 8) / 32 px a frame, turned to him, to the script's end.
**His throw** (`9d`): the camera stays (field `0x27` bit 0, his from frame 1, the opponent's from the launch until he lands); from frame 30 the opponent's field `0x14` is `c0`, so he hangs upside down from (−16, −120) for 4 frames (`$20:DAE1`, the only move that writes it); goes behind from frame 30, launched on 34 at step 3's place, still facing Piccolo's back: `$04` is his facing turned (`$20:DA73`), so the body flies the way it looks. At the end field `0x27` bit 1 (`$20:DB5C`, as Goku's `$20:820B` and Gotenks's `$20:BC08`): the next move's start flips him (`$01:85BF`), so with the body behind him there is no `41`.
**Bukuuh Kyaku** (`be`, `bf`, `$20:E6D6`): as Gohan's: `30` where he is, drawings by step from `$20:E79E` (y `C8` or more) or `$20:E7B2`, the only damage on `bf`'s end (40), Piccolo back as `1a` at vx −1, vy −7.
**High and Low Mystic** (`a5`, `ae`, `$20:E06E`, `$20:E169`): a blow at the end of each of `a5`, `a6`, `a7`, reaching further: still armed, the next (past the third, `aa`, `b3`); landed, the same place drawn back, + 3. `a8`–`aa`, `b1`–`b3` go down to the first, field `0x96` `20`, so they strike nothing. In the hit pause of a blow of any of the three, ↓ ↙ ← Y / B is the move 6 past it: `ab`, `ac`, `ad`, `b4`, `b5`, `b6`. Those draw him back 6 frames each, held at +96, +72, +48, then `9d` (recorded from three distances).
**Regeneration** (`b7`, `$20:E264`): field `0x96` `28`; a blow's hit box touching its own from frame 8 to 39, armed, not on the striker's list `$2A:86D1` (X and his 3D move; the parrying moves are listed at `$2A:8692`: his `05b7` and Vegetto's `04b0`, Galactic Juggle), sets `0x28` bit 4 (`$2A:8640`, both players' `0x96` `f8`, `$30B9` = 9, an `a/06` and sound `09`). The handler puts him in `30`, keeping the drawing he has, and itself in `b8` (`$20:E2A7`). `b8` holds frame 2 (`f0`) until the arm `5/09`, in his own colours (recorded: the script's palette 4 holds his record `0x90` here), thrown at (19, −52), vx −2, vy + 0.47 a frame, bounces once at vy −3, lies 16 frames and clears it (`$0F:CB68`). He is then at `$20:E397` by character in drawing `$20:E383`, at `$20:E3BF` from frame 64, and the blow, 38, `1b`, vy −4, lands at frame 72: frame 117 of the scene.
**Shocking Stunner** (`b9`, `ba`, `$20:E4EB`): the object `5/0b` opens `ba` on him (`$2A:9275`): `30` at +24, −48 in drawing `$2A:9354` by character, for 111 frames, flashing in palette records `0x113`, `0x114` by `$74 & 7`, then 20 damage, `1e`, or `1b` when field `0x7B` has counted three.
**Beam Cannon** (`bc`, `$20:E3F3`): its ball is at (14, −64), radius 9 from frame 12, 13 again at 20 and at 32, and the handler takes 1 off it every frame (`DEC $30C4`, the only move that does; the rest grow theirs), gone at 45. Its picture (recorded, a shot a frame) follows every third frame, nothing for three frames after each start, radius + 1.5 px: 13, 7, nothing, 19, 13, 7, nothing, 21, 15, 11, 9, 5 px wide from frame 16 on. Released by 20 / 32 / 44, the counter is `18` / `10` / `00` and the frame jumps to 44. From 49 the handler looks for the object its level names by `f0`, which `$0F:CA6A` also steps round as the object's palette: so the head is not yet out, the frame jumps past 60 and the shot goes out 26 / 38 / 50 frames in, skipping `90`. It goes on jumping between 124, 128 and 132 until the head is gone, and the pose lasts about 24 more. The heads `5/05`–`07` stay on a hit, a melee spark each, strike again 14 frames on, are not held by a pause, and go with the move (`$0F:CB4D`). Kind 4's band stands at (48, −58).
**Gekiretsudokan** (`bd`): `5/02` at his belly, a frame every 4 of its timer, gone at 27 (`$0F:CA4A`), its timer not stopped by a pause; `5/03` from frame 28, two frames by `$74 & 4`, 80 frames.
**Yuudoh** (`bb`): `5/0a` closes on the opponent's height, every 4th frame vy 2.12 either way toward 32 px over his feet, 0 within 16 (`$0F:CC45`), and between those it keeps its vy: out at 52 px up, it falls 8 px and flies level (recorded).
**Aerial Assault** (`a2`, then `a4`, `$20:DC93`, `$20:DCEC`, steps by field `f0`): 130 damage. Frames, the hit's pause out: 0 the opponent `53`, drawn at `$20:DF97` once the pause is over, as Piccolo stays on `6e`, his arm out, until then; 15 he rises 3 a frame to 40, then 1 a frame as Piccolo does, a half from 104; 30 Piccolo jumps at vy −10, at his top 1 a frame; 103 falls at vy 4; 128 the opponent thrown at vx 4.5, vy −7, stopped 15 frames on; 154 a kind 2 ball from 24, less 1 every 2 frames down to 12 (`$20:DE65`); 179 five `5/0c`; they stop within 8 px of the opponent + `$0F:CE86` (`$0F:CD29`), 64 frames past the last of them they fly at him at 3 (`$0F:CDFE`), and become `a/02` within 24, 16; then the damage and `1b` (`$0F:B321`). His x moves 8 by the push, in steps at 33, 60, 95. Field `0x27` bit 0 from frame 1, until he lands. The arena dims from about frame 144 (6/16, recorded; what asks for it not found) and goes white as they land (`$37` = `23`, `$0E:87FA`, BG palettes 2–7) until `22` at the move's end, back at full light.
**Intro and win** (`3c`, `3e`): palette own + `0xC0` from frame 1, each ending in a held pose and a line. `3c` is cut 298 frames in.

### Gohan

Handlers in `$20:A3F4`–`$20:BDF8`. His own objects' tiles are resource `0x46`,
there from the fight's start at `$6800` and `$7800`, a player each; an object's
slot shows player two's tile base `0x100` up.

| move | what | input |
|---|---|---|
| `9d` | the throw: holds 32 px ahead in one drawing (`$20:A6F2`, the table `$20:A716`, not a track), lets go at 30 | → + X |
| `9f`, `a0`, `a1` | as Goku's: blows to another part of the arena | ↓ ↘ → / → ← → / ↓ ↙ ← + X |
| `a2` | Rushing Uppercut | → + Y |
| `a4` → `a5` | Knee Slasher; connected, hit or block, it becomes `a5` (`$20:A778`) | ← (charge) → B |
| `a6` | Zankuu Kyaku | ↓ (charge) ↑ B |
| `a7` | Bakuretsu Punch | ← (charge) → Y |
| `a8` → `a9` | Bukuuh Kyaku: a hit holds the opponent in `30` where he is, both hanging, for `a9`'s 73 frames, its drawings by step from `$20:AA72` (y `C8` or more) or `$20:AA86`; the hit's pause on `a9`'s frame 1, already in those poses (recorded, on a block on `1a`'s 22 too); the contact's spark, then six fire (the counter passes the last four spawns, recorded), the only damage is the throw on its end (32 less defence, `1b`, 2.5 / −7, his way, no sound). A block, and that end, sends him back as `1a` from frame 21, vx −1.5, vy −7 (`$20:A994`, setting the move gives gravity back, `$01:853F`), on the script's `hold` of drawing 9 from frame 24 until he lands. A defender with field `0x25` bit 2 is not held `?` | → ↓ B, in the air |
| `aa` | Triangle Illusion (3D): Side Slash's way, turning on 33 | R + B |
| `ab` | Renzoku Energy Dan | ↓ ↘ → A |
| `ac` | Kamehame-Ha: let go before 20 small, before 36 medium, fired from 32 | ↓ ↙ → A |
| `ad` | Masenko, object `2/03`: flies at `b0`'s vx 3 / vy −3 unchanged, no gravity | ← ↙ ↓ ↘ → A |
| `ae` | Rushing Suki Combo, health 80 or less: a palette run to white from frame 1 (`0x140`, `141`, `144`, `141`, `140`; player two `142`, `143`, `144`, `143`, `142`, 4 frames each, `$20:B3CC`); to frame `88` a blow that lands lights a kind 2 ball at its spark, radius 16, 2 more a frame, gone at 32 (`$20:B624`, `$20:B45B`); at `8F` he leaps, sound `3a` at `91` on the defender's side (`$20:B4E0`), and a last blow that lands stands a kind 4 column over the spark, 64 wide, `+0A` `6D` at line `5C`, 2 less a side each frame (`$20:B558`, `$20:B5C0`) | → ↘ ↓ ↙ ← → B |

`9e` and `b1` have scripts and handlers, but no button or code of his was found
to start them `?`.

## How it was found

A blow the script arms does not move him in front: through Ultra Headbutt, its hit
included, `$30B0` says player two (`front=` in a run's log). Only `$0D:D8A2` does.

Health (field `0x60`) is a word: Gotenks's 400 is `0190`. In practice a blow takes
none of it, and an ultimate's "health 80 or less" does not hold: Volleyball goes out
at 400 `?`.

`tools/re/` — Mesen 2 Lua scripts, run from Debug → Script Window with *Allow
access to I/O* on; each writes into `logs/`.

| script | answers |
|---|---|
| `run.lua` | what `npm run original` puts before `record-fight.lua`: a save state and both pads, no window (ADR 0074) |
| `record-fight.lua` | **start here**: both fighters, camera, hitstop, sounds asked for, voices' samples and object slots, every frame anything happens, into a new `logs/fight-<n>.txt` |
| `record-ram.lua` | every RAM region and the pad, once per frame — find a value by what was pressed |
| `log-dma.lua` | every DMA, beside the sprite id — where graphics come from |
| `trace-tiles.lua` | every ROM read the SA-1 makes while it fills the tile buffer, in order |
| `trace-anim.lua` | every ROM read around a change of move, step, drawing or tile set |
| `log-moves.lua` | which move id each action picks, with the pad and velocities — runs at full speed |
| `dump-vram.lua` | VRAM, palettes and OAM every few frames — which resource each tile on screen came from |
| `log-objects.lua` | every change to the ten object slots — an object's frames, timing and speed |
| `log-hits.lua` | both fighters' move, step, health and stun on every change, with what the hit code sets — what a blow cost |
| `log-palettes.lua` | every palette change, every frame, with both fighters' moves — what a palette swap steps through and for how long |
| `log-oam.lua` | every sprite in OAM while an object of one type is up — what the game draws, frame by frame |

Measured on Goku (2026-10-28, training mode): walk 1.5 px/frame forward and
1.25 back; jump −9.86 px/frame with gravity 0.469; hitstop 8 frames; the
defender's reaction to a close Y, 21 frames.
