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
— says it in the data. What the code does, per move, is listed beside
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

**Which fighter is drawn over the other** is one bit for the pair, `$30B0`
bit 0 (`$00:812E`): clear, player one's sprites go into OAM first and so
in front; set, player two's. Arming a blow (`$0D:D8A2`) puts the mover in
front; `$0D:D8D5` puts him behind — Side Slash's handler (`a8`, the 3D
move, `$20:83DF`) and `$0D:EBB8` call it, the latter from `$0F:A358` (a
reaction, from its frame 168 `?`) and `$0F:A9E3`. Every object slot
(`$3300`–`$3390`) goes into OAM before both (`$00:80E8`), so in front of
them. Ours: `Fighters.inFront` (`src/match/fighters.ts`), and a state's
`behind` for `$0D:D8D5`; effects and
bolts are added to the stage after the fighters, so in front as well.

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
`$0F:BAE5` names for it (0 for five, 1 for five), with no end of its own.

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
Type `1` by animation at `$2A:8EC7`: `1/04`–`06` → `a/02` (`$2A:8F0B`),
`1/0b`–`0d` → `a/02` / `17` / `18` and burning (`$2A:8F2D`–`8F77`).

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
down sets the game's `$37` to `16` (`$0F:E261`) — what that does is not read.
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
so it plays at 8000 samples a second — line 0 lasts 0.85 s, as its clip
`080` does. `src/rom/lines.ts` decodes them; a fighter's are the ids his
scripts' `a1` name.

**The Kamehameha's hit lights the defender up** (`dump-vram.lua`,
`log-palettes.lua`): the burning above, and BG palettes 2–7 turn white for
16 frames. While the beam is out the thrower's object palette changes
every 4 frames (palette records `0x130`–`0x133` through `$01:84EF`, above).

The export makes each object Goku spawns a spawn entity (ADR 0018); which
ones, with their recorded timing, is `objects` in `src/rom/cartridge.ts`.
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

**Which clip is which id, compared** (`npm run samples`, 2026-10-30): the
sound chip's RAM (`tools/re/dump-spc.lua`; sample directory at `$1A00`,
effects in samples `10`–`19`, `1e`, `1f`, `22`, `23`) decoded at the
pitch each request played it (`log-dsp.lua`) and correlated with our
clips. A sound is a sample at a pitch: `06` and `07` are both sample `17`.
A sound whose pitch slides is compared along its slide, frame by frame as
the recording played it (`npm run samples -- --sweep`): at one pitch the
hit matched the ki shot's clip, which is what the owner heard. The
Kamehameha's shot is `0a` from its script, and the sound lasts while the
beam flies: a strike (`16` @ `03EB` with `14` @ `0785`, 10 frames), then a
rising rush (`15`, `021F` → `05DF`) over a long low tone (`14` @ `03F9`).
Its hit is a ki blast's — `0a` and `30` on the defender's side, other
voices, so the shot sounds on (recorded from afar, the spoken line
over). The explosion object (`$0F:E1A9`) asks for no sound.

| id | sample @ pitch | clip, likeness | the next |
|---|---|---|---|
| `05` | `17` @ `0A0D` | `003` 0.99 | 0.32 |
| `06` | `17` @ `06B3` | `004` 0.99 | 0.53 |
| `29` | `18` @ `1C38` for 7 frames, then @ `0EF3`, ~0.95 s | `021` 0.41 | 0.11 |
| `07` | `17` @ `0504` | `005` 0.99 | 0.25 |
| `0c` | `16` @ `02EF` | `010` 0.86 | 0.49 |
| `0d` | `16` @ `029D` | `011` 0.80 | 0.56 |
| `32` (Goku) | `1f` @ `03F6` | `045` 0.92 | 0.11 |
| `33` | `22` @ `03F6` | `058` 0.82 | 0.21 |
| `09` / `12` | `14` sliding `0785` → `0613` over 30 frames | `007` 0.41 | 0.17 |
| `0a` / `13` | `14` @ `0785` for 16 frames, then @ `03F9` | `008` 0.31 | 0.21 |
| `19` | `18` @ `0237`…, looped | none `?` | — |

`06` and `07` had been one clip off (`003`/`004` for `004`/`005` — `005`
is no jump: the original plays nothing when Goku jumps, as far as the
code shows); the bank now
names them by id (`swing_06`, `swing_07`, `hit_09`), and `goku_old` keeps
the old names. The sound test plays its number as the id, unchanged below `0x50`
(`$00:D213`, number in `$19A6`) — but the clips of our capture are numbered
by where the silences fell, not by the sound test, so a clip is **not** an
id: matching them by an offset gave a wrong hit sound. A melee hit plays
`09` (`$0D:D1B7`) and the defender's own `30`; a projectile's, `0a` and `30`
(`$0D:D1E6`). The export puts each script's `a0` on the animation step it
begins (`sfx`); `"rom"` in a `sounds.json` is which ids are matched — by the
code that plays them, since a clip's number says nothing:

| id | played by | ours |
|---|---|---|
| `05` | Side Slash's script, as he steps into the depth | `swing_05` |
| `06` / `07` | a punch's / a kick's script (`06` for Goku's near B too) | `swing_06` / `swing_07` |
| `09` | a melee hit (`$0D:D1BC`) | `hit_09` |
| `0a` | a projectile's hit, a blocked projectile (`$0D:CF6D`, `D1E9`); the Kamehameha's shot (`aa`'s script) | `burst_1` |
| `0b` | the ki blast fired (script) | `blast_1` |
| `0c` | landing from a jump (`$0F:9FB8`) | `land_1` |
| `0d` | a body hitting the floor (knockdown handler `$0F:A217`) | `land_2` |
| `17` | a blocked melee blow (`$0D:CF55`) | `block_1` |
| `19` | charging ki, every 8 frames (`$0F:A044`) | `charge_1` |
| `25` | charging the Kamehameha (`aa`'s script) | `charge_2` |
| `29` | a teleport's script, as he vanishes | `teleport_29` |
| `30` | the defender's voice, on every blow taken (`$0D:D1C3`) | the fighter's `voice_hurt` |
| `31` | the voice at KO (`$0D:D10C`) | — |
| `32` | an attack's shout (the ki blast, specials) | the fighter's `voice_shout` |

**A fighter's voice is two samples** the chip is given as a fight loads
(`$00:98EC`): by character × 9 at `$00:DD48`, a pointer to player one's
sample directory (8 bytes for `$1A78`), player two's (`$1A88`), and the
samples (for `$4000`, player two's `$5600`) — each a byte count and an
address, then the bytes. The first is the cry of a blow taken (`30`), the
second the shout (`32`), both at pitch `03F6`. Goku's are `$15:8000`, the
same bytes as `spc.bin`'s; player two in that dump was Vegetto (character
4). `src/rom/voice.ts` reads them; `31`, the KO, is not read.

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
(`$0F:A072`, Goku's `0x48` by day) — and the own palette again at the
end; not built.

`90` stops the script; `c0 v` sets fighter field `0x96` to `v`: bit 6
and blows pass the fighter by (`$2A:81C7`, `$2A:8291` skip him) — the
knockdown `1b` sets `70` from its first frame, `1e` from 64, getting up
`1f` too, and Jumping Knee Slash `40` for its first 16 frames; bits 4–5
(Quadruple Kick's `20`) are not read `?`. A new move leaves the field as
it was (`$01:8518`). `port` prints where it changes; `80` is the opponent's track (The throw, below).
`src/rom/script.ts` reads every command a Goku script uses.

## The camera

`$0D:C542`, once a frame: the horizontal camera (`$0D:C61B`), then the
vertical (`$0D:CA55`, or `$0D:CB96` on a stage whose `$0552` is set), then
the shake. It moves the fighters too — their x and y are integrated here,
gravity included. Positions are 8.8; a fighter's x is fields `0x1f`–`0x21`.

**The world is 512 px wide**: a fighter's x stays in 16–495 (`$0D:C88F`), the
camera's x (`$0570`, 8.8, whole px in `$0571`) in 0–255 over a 256-px
screen, and it starts at 128, y at 0 (`$01:8B84`). Screen x = x − `$0571`
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
(field `0x97` bit 7 `?`) and moving into each other both get the average of
their vx. **A shove into the screen's edge** (x < camera + 17, or ≥ camera
+ 240) passes to the other fighter, reversed and added to his dx, for the
frames it had left — unless the shoved one has no health, field `0x25` bit
2, or a move in the bit table `$0D:CA35` (moves `11`–`16`, `29`–`32`, `7e`).

**Vertically it follows the higher fighter, by an eighth** (`$0D:CA55`):
target = (200 − (min y, at least 0, rounded down to 8)) / 8, so 0–25 px up;
`$0585` steps toward it 1 px a frame and the camera's y is `−$0585`. It does
not move while either fighter has field `0x27` bit 0 (cleared on landing;
set by a few special handlers, `$0F:A72B`, `$0F:EC84` … — which moves `?`).
`$0552` comes from `$00:BA4E` by stage id (`$054E`): set for stages 3–8 and
16, which scroll vertically by the horizontal rule instead (`$0D:CB96` `?`).

**A stage id is an arena and its lighting.** `$00:BBE0`, 9 bytes per id:
the arena's tiles (a resource), a palette (the lighting), its packed maps,
the BG mode and map width, and the arena's number. The lighting also picks
the fighters' palette (`$01:82B5`: `0x40` + 16 × character +
`$01:8304`[id], a record at `$09:8000` — Goku's `0x40`… are `0xB0000` +
32 each), kept in field `0x17`; player two, the same fighter as player
one, takes the next one (`$01:82F2`). `$01:8316` loads it into both of
the player's OBJ palettes. The loader (`$00:B683`) and the S-CPU's own packing:
`src/rom/stage.ts`, `src/rom/lzss.ts`; `npm run rom -- stage` draws them
flat. What each shows is read off that drawing:

| arena | ids: day, evening, night | mode | scroll (`$00:BFB3`) | shows |
|---|---|---|---|---|
| 0 | 0, 1, 2 | 1 | `D7` | the tournament's gate and court (天下一武道会 on the roof) |
| 1 | 3, 4, 5 | 2, vertical | `E9` | the sky over the clouds, a lookout far off |
| 2 | 6, 7, 8 | 7, vertical | `FF` | a planet's map from above, clouds — not drawn whole |
| 3 | 9, 10, 11 | 1 | `D7` | a domed palace — Kami's Lookout `?` |
| 4 | 12 (lighting `6`) | 1 | `D7` | burning ruins |
| 5 | 13, 14, 15 | 1 | `D7` | rocky plains |
| 6 | 16 (lighting `4`) | 2, vertical | `E9` | a crater with violet lightning |
| 7 | 17 (lighting `4`) | 1 | `D7` | a dark sky, rocks and water |

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
the thrower's way. Recorded, Goku throwing Vegetto (`tools/re/log-throw.lua`):
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
`0xE9` (the pad's low and high byte), held directions `0xED`. On the ground
Y and B have a close and a far move: close when the gap between the two
fighters (field `0x20`) is under the attacker's own line (`$0D:C4A1`), two
bytes per fighter at `$3D:9EDB` — Goku 44 for Y, 48 for B. A recording
agreed: close Y at 41 px, far from 53. The CPU keeps lines of its own for
deciding what to do (`$0D:F7F6`, `$0D:F95B`, `$0D:F96F`).

**In the air** a jump's handler (`$0F:9EB1`, from move `05`'s `$0F:9F60`
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

**The crouch and the stand-up ask for commands too**: their handlers
(`03`, `$0F:9F35`; `04`, `$0F:9F4E`) call `$0F:9EB1` as idle does, so a
special rolled through ↓ comes out of a crouch.

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
in BW-RAM at `$63D0` (+`$1E0` for player two).

A blow of a multi-hit move takes the record covering its first active
step; the records change a step before each kick's hit box ends (ADR 0023).
Double Punch (`a7`, `$20:8727`) stands until frame 6, slides at vx 2.0
until 44 (`$0D:D7A0` stops it), re-arms at 32, and raises dust
(`$0D:DE6C`) on every 4th frame of the game (`$74 & 3`) from frame 1 to 43;
its second blow is a `1e`. `1e` plays as `1b` does (`$0F:A217`) but leaves
field `0x96` alone until frame 64, the bounce — hittable in flight, where a
blow's airborne bits apply (a light or heavy one: `1a`).
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
so is `ae`'s `0/08`, normal Goku's hair (owner): frames 0, 1, 2 for 80, 8 and 36, in OBJ palette 6 = `0x27B161`.
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
`$0F:F1F3` until it answers, `$37` = `24` and 60 frames of `$0F:F241`;
then `$37` = `21`, `22` and the damage — the throw's own `$0F:B321`:
118 (`0x76`, less defence), move `1b`, vy −4.0. `$37`'s values, and
`$20:8F22`, `8F5E`, `8F8D`, are not read.
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
| `9f`, `a0`, `a1` | ↓ ↘ → / → ← → / ↓ ↙ ← + X — not in the move lists `?` | the same |
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
(`$0D:C4C1` reads one). Byte 0 is defence; then 8.8 words, of which the
recorded ones match: walk 1.5 forward and 1.25 back (words 0–1), jump
−9.86 (word 12), gravity 0.469 (word 14). The rest are speeds not
identified yet.

**Which reaction** (`$0D:D29C`–`D353`). Grounded (field `0x23` ≥ `0xc8`),
bits of bytes 0–1 as one word: `0x0004` `$D622` (stopped dead, then the
heavy reel — `16`, crouching `14`; ours `halt`), `0x0008` light,
`0x0010` heavy, `0x0020` → move `19` (ours `trip`; `$D60A`: knockback `0f`, 2.0 back
and −4.0 up; blows pass it by from frame 0; it lands with dust and `0d`,
no bounce, and gets up after 12 frames — `$10:AEB6`), `0x0040` knockdown (move `1b`),
`0x0080` → move `42`/`43`, `0x0400` → move `1e` (`$D3BB`, ours `high`), `0x0800` `$D670`,
`0x1000` `$D540`; `0x0001`, `0x0002`, `0x0100` and `0x0200` are not read
there. `0x0080` (`$D558`, the jump attacks') is a long light reel: `42`
standing, 24 frames of the light reel's drawing, `43` crouching
(`$0D:D7BA`), knockback index 6. Airborne, bits of byte 1: `01` → move `1a` (`$D616`, knockback
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
instead. Light is move `15` (`13` when field `0x97`
bit 0 is set), heavy `16` (`14`); `$0D:D7BA` turns them into `17`/`18`
`?`. Hitstun is that move's script — light 14 frames, heavy 26 — not a
number in the record.

**Knockback is per reaction, not per blow**: `$0D:D708` with a reaction
index sets field `0x8c`, the push speed `0x88` (8.8 fixed point, turned by
the attacker's facing) and vy from a table of 6-byte entries at `$0D:D68A`.
Light (index 2) pushes 2.0 px/frame, heavy (3) 3.0, knockdown (4) 2.0 and
−4.0 up, the high knockdown `1e` (`0c`) 0.75 and −7.5 — `14` (0.75, −6.0)
for `9c`'s step 1 and `a4`'s step 4, `13` (0.5, −8.0) for `a3` — the long light reel (6) 2.0 for 10 frames, in the air (16) 2.0
and −6.0 up. The push **slows by 0.25 every frame** until it stops
(`$0D:EC5F`, which slows vx the same way) — 9 px in all for light, 19.5
for heavy. `0x8c` takes the entry's first word — 8 light, 12 heavy, 48 in
the air, 64 down or dizzy — the frames a push of that speed lasts, and
counts down outside hitstop. A blow sets hitstop (`$30B2`) to `0x8a`.

**Bodies** (`$2A:80ED`, every frame from `$00:8DEA` but in hitstop):
slots 0 and 1 of the drawing's box record, the body and the head, placed
by x, y and the draw offset (`$2A:87DE` / `886A`), tested in the plane —
body/body, head/head, then each against the other's (`$2A:89D0`). The
first pair that touches gives the overlap along x; each fighter moves half
of it away from the other, within 16 px of the screen's edges
(`$2A:8AFB`), and field `0x97` bit 7 is set on both. Skipped while either
has field `0x96` bit 7 set `?` (a script's `96`).

**Health** starts from the ENERGY option, 400 by default (`$1AC9` /
`$1ACF`, per side), or 80 or 999 in other modes (`$01:8150`, `$01:826F`).
Training is mode `$1A02 = 3`, where damage is zeroed. One bar on screen
holds health and ki, but firing a ki blast leaves `0x60` alone — ki is
another field, `0x62` or `0x64` `?`.

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
| `log-palettes.lua` | every palette change, every frame, with both fighters' moves — what a palette swap steps through and for how long |
| `log-oam.lua` | every sprite in OAM while an object of one type is up — what the game draws, frame by frame |

Measured on Goku (2026-10-28, training mode): walk 1.5 px/frame forward and
1.25 back; jump −9.86 px/frame with gravity 0.469; hitstop 8 frames; the
defender's reaction to a close Y, 21 frames.
