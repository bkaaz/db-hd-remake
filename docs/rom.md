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

**A move loads its objects' tiles** (`$01:84B3`: resource A into OBJ VRAM
at word Y, Y `$6C00` for player one and `$7C00` for player two, through
`$00:B265`), drawn in that resource's own palette (its record) — Goku's
Kamehameha `0x32`, Vegeta's `ac` `0x4d` and his `ad` `a9` `ab` `b1` `0x4f`
(`npm run rom -- port`). `$01:84B3` loads tiles only; the record's palette
is the first of a run of 32-byte palettes OBJ palette 0 steps through while
the object is up — `0x27BD24`, `…44`, `…64` … `…A4` in Vegeta's recording,
`0x2ADE1C` … `…7C` for `0x32` — what steps it, how fast and how far is not
read `?`.

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
stopped during hitstop, and every 4 frames loads resource `0x130` + (frame
counter `$74` / 4 mod 4) over its tiles (`JSL $01:84EF`) — it shimmers by
swapping graphics. Type `1` jumps by animation through `$0F:B97E`; Vegeta's
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
`npm run rom -- object a 15 32@6c00 80` draws an object's frames to look at.

**What a projectile becomes when it hits** (`$2A:8E31`): by the hitting
object's type (`$92 & 0F` of the defender, table `$2A:8E4B`), then its
animation (`$93`, type `a`'s table `$2A:98EB`), the slot is killed and
rewritten as an explosion at the middle of the boxes' overlap (`$2A:8D63`):
the ki blast `a/03` → `a/01`; the Kamehameha's heads `a/13` / `14` / `15` →
`a/02` / `17` / `18`, and those set the defender burning (`$2A:99CC`: field
`0x26` bit 7, when `0x25` has bit 3). `a/18` and `a/17` copy themselves on
their step 1, 4–11 px away at random, while their `+0C` is under 2 / 1 —
three explosions and two (`$0F:E1A9`); all step through `$0F:E2A9`'s
6 8 3 4 3 3 3 frames and are gone. Recorded for all three (2026-10-30).
Type `1` by animation at `$2A:8EC7`: `1/04`–`06` → `a/02` (`$2A:8F0B`),
`1/0b` → `a/02` and burning (`$2A:8F2D`).

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
The Kamehameha says line 0 (`$13:D7D0`) on its first frame.

**The Kamehameha's hit lights the defender up** (`dump-vram.lua`,
`log-palettes.lua`): the burning above, and BG palettes 2–7 turn white for
16 frames. While the beam is out the thrower's own palette changes every 4
frames (resources `0x130`–`0x133` through `$01:84EF`) — which colours is not
read.

The export makes each object Goku spawns a spawn entity (ADR 0018); which
ones, with their recorded timing, is `objects` in `src/rom/cartridge.ts`.
Object slots: ten of 16 bytes at I-RAM `$3300`; each type's behaviour is its
own code in bank `$0F`.

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
| `06` | `17` @ `06B3` | `004` 0.99 | 0.53 |
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
| `06` / `07` | a punch's / a kick's script (`06` for Goku's near B too) | `swing_06` / `swing_07` |
| `09` | a melee hit (`$0D:D1BC`) | `hit_09` |
| `0a` | a projectile's hit, a blocked projectile (`$0D:CF6D`, `D1E9`); the Kamehameha's shot (`aa`'s script) | `burst_1` |
| `0b` | the ki blast fired (script) | `blast_1` |
| `0c` | landing from a jump (`$0F:9FB8`) | `land_1` |
| `0d` | a body hitting the floor (knockdown handler `$0F:A217`) | `land_2` |
| `17` | a blocked melee blow (`$0D:CF55`) | `block_1` |
| `19` | charging ki, every 8 frames (`$0F:A044`) | `charge_1` |
| `25` | charging the Kamehameha (`aa`'s script) | `charge_2` |
| `30` | the defender's voice, on every blow taken (`$0D:D1C3`) | goku's `voice_hurt` |
| `31` | the voice at KO (`$0D:D10C`) | — |
| `32` | an attack's shout (the ki blast, specials) | goku's `voice_shout` |

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

`90` stops the script; `c0 v` sets fighter field `0x96` to `v`, whose
reader is not found `?`; `80` is the opponent's track (The throw, below).
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

**Special moves come first** (`$0D:F085`): a command table of 0x150 bytes
per fighter at `$3D:9EEF` (offsets `$0D:F5CF`) — 0x88 on the ground, 0x40
in the air, the rest for mode `$0552` — the fight above the arena `?`
(the owner's memory; `$0552` also picks the other vertical camera,
`$0D:CB96`) — in 8-byte rows, scanned last row
first: bytes 0–2 its **conditions** — masks over flags the game rebuilds
every frame into fighter fields `0x4C`–`0x4E` (`$0D:F650`), each bit read
in `src/rom/conditions.ts` and named by `port` (Meteor Smash's `41`: on the
ground, health 80 or less) — byte 3 the move's **cost**,
byte 4 a sequence, byte 5 the move. The cost comes off the health as the
move starts, never below 1 (`$0D:EED7`) — none in training (`$1A02 = 3`)
or while `$1B15` is set. Goku's: the large ki blast `a9` 5, the
Kamehameha `aa` / `ab` 10, the same in the air (`d2` 5, `d3` / `d4` 10),
everything else 0. The move behind health 80 or less is each fighter's
ultimate, open while his bar is red (owner). Vegeta's, named by the owner:
`ac` Final Flash, a charged beam as the Kamehameha; `ad` the Big Bang,
shot upward. A sequence (`$0D:F2E6` + 2 ×
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
| `9d` | → + X, in grab range | the throw (The throw, above) |
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
