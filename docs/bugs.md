# Known bugs

Things that are **wrong**, written down the moment they are noticed — by
whoever notices, owner or Claude, without asking and without fixing them on the
spot. Noticing and fixing are separate acts: a fix smuggled into unrelated work
is a fix nobody reviewed.

This is not a queue. A line here says "this is broken", not "do this next" —
[`plan.md`](./plan.md) stays the only place that says what to work on. A bug
becomes work when it is put there or when someone just fixes it.

**A fixed bug is deleted from this file**, in the same change that fixes it.
Unlike `plan.md` this file also grows, so it needs the other half of the rule:
if a line has been here a long time, either it is not really a bug or it is
worth an entry in `plan.md`.

Newest first. One entry is: what you see, where, and how to make it happen.
Severity in plain words — *cosmetic*, *annoying*, *breaks play*, *loses work* —
because a number would only need translating back.

---

## Some throws may cry out once too often `?`

*Sound, Vegeta, Gotenks, Buu, Mr. Buu.* Freeza's throw had a voice at the launch that `$0F:B321` does not play: the reaction's own sound, which `launch.quiet` skips. These four lack `quiet`, and a quick search of their recordings found no sound on the frame they let go; Goku, Gohan, Piccolo and Cell have one there. Not compared one by one.

## Jubaku Ha has one frame with no ball and no dome

*Cosmetic, Freeza.* The shot is gone on the frame it hits and the scene's light is drawn from the next; in the recording the slot's last frame is followed at once by the opponent's `37`.

## Flaming Headbutt does not dip as he leans back

*Cosmetic, Freeza.* `$10:BBCB` and `$10:BBED` move his drawing 2 px a frame down from frame 41 and up from 46 (field `0x10`, `$10:BB55`), and nothing resets it before the script's end. Ours has no drawing offset by frame; the logs' `sy` do not show this field, so it was not measured.

## Kishin Ha's spark sits higher than the original's

*Cosmetic, Freeza.* It lands a frame early (a blow's box, below), on the object's first box where the original's is on its second; the spark is about 10 px over the original's. Not looked into further.

## The Kienzan looks at the opponent's height on its own frames

*Cosmetic, Freeza.* `$0F:D07D` asks when the game's count `$74 & 7` is 0, so its first look falls anywhere in its first 8 frames; ours fixes it at 9.

## Mr. Buu's Oyatsu Kosen has errors and was never checked

*Annoying `?`, Mr. Buu (owner, 2026-11-06).* Oyatsu Kosen, hold ↓ for 3 seconds, then ↑ + B. Which errors he did not say: ask him before fixing. For later.

## Gotenks's ghosts look at the opponent's height every frame

*Cosmetic `?`, Gotenks, approved.* They share Yuudoh's code (`$0F:CC45`), which only looks every 4th frame, and so overshoot a little; ours settle sooner. `aim.every` in `gotenks_ghost` would do it. Not played against the original.

## Regeneration's arm keeps its daylight colours in every light

*Cosmetic, Piccolo, evening and night.* The arm is his own palette (`piccolo_5_09`, record `0x90`), and a spawn has no sheet per lighting, so by evening and night it does not match his body. From the code; only the day was played.

## Piccolo's counters can be entered later than in the original

*Cosmetic, a kinder window.* The original asks in the hit pause alone. Ours also asks in the rest of the blow's state: pressed 5 to 9 frames later than the original allows, it still comes out. From `npm run original` and the same pad in ours, at three distances. Dropping `connected` + `command:` from `StateMachine.update` would close it, and Gotenks's Omaenanka with it.

## Goku and Gotenks turn after their throw with a move of its own

*Cosmetic, approved fighters.* Field `0x27` bit 1 at their throw's end (`$20:820B`, `$20:BC08`): the next move's start flips them, with no `41` (`$01:85BF`; recorded: Goku's). Ours plays `turn_round`, 6 frames. Piccolo has it (`flipsOnLeaving`).

## The camera rises where the original's stays

*Cosmetic `?`, a few moves.* `$0F:A72B`, `$0F:EC84`, `$20:9BD4` and `$20:D2E3` set field `0x27` bit 0, which stops the camera following vertically; ours rises there. Piccolo's throw has it (`stillCamera`). Which moves they are is not read.

## Vegetto's Galactic Juggle is a parry too

*Annoying `?`, Vegetto.* `$2A:8692` names `04b0` beside Piccolo's `05b7`: a blow touching his `b0` should turn into `b1`, as Regeneration does (ADR 0077). Ours plays it by connecting only. He is approved, so it is not changed.

## A hit box only touching a hurt box lands in the original

*Cosmetic.* `$2A:89D0` counts an edge on an edge from one side. Low Mystic's third reach from where a round opens touches Goku's body exactly: it lands in the original and misses here (`npm run moves -- piccolo --far`). For every fighter, so not changed. The same routine asks `$44` ≥ 2 (`$2A:8155`): a move's first two frames cannot land, ours can.

## Gotenks's discharges are blended into what is behind them

*Annoying, Gotenks, his intro (`3f`).* `gotenks_discharge` has `adds`, so it is added to
the arena and to his body and comes out as a pale smear. The original's is solid and always
in front of him: each pixel is its own colour plus the fixed colour of its row, never what
lies under it (OBJ palettes 4-7 take the colour math; `$2131`'s source there is the fixed
colour, which is also the intro's blue gradient). To see it: intro switch on, `?p2=gotenks`.

## Goten and Trunks keep their daylight colours in every light

*Annoying, Gotenks, his win (`3e`), evening and night.* The handler loads field `0x17` + `0xE8`,
`0xF0`, `0xF8` (`$20:B903`), so the records follow the lighting: `0x15A`, `0x162`, `0x16A` by
evening, `0x15C`, `0x164`, `0x16C` by night. `fades` and `palette` in `ownObjects.ts` name the
day's alone, and `gotenks_goten` has no sheet for another light. His intro's `run0` and `run1`
are own + `0xC9` and + `0xC5` (`$20:B96C`), fixed the same way; by evening + `0xC9` is `0x13B`,
which our reader cannot follow `?`. From the code: no evening state of the original was played.

## Moves that go behind the opponent are drawn over him

*Annoying, a few.* A handler's `$0D:D8D5` puts the mover behind. Left without `behind`: Mr. Buu's throw (`behindAt`, as Piccolo's), and by hand Goku's Saiyan Meteor and Vegeta's Galactic Gunfire. The last may be the entry below on
the body he throws `?`. `npm run rom -- port <move>` says "goes behind the opponent".

## A drafted run does not stop by the opponent, and flies at the wrong speed

*Breaks play, drafted fighters `?`.* A handler may end a run under a distance and
keep the speed of the jump after it in `$F0` / `$F2` (Gotenks's `a8`, `$20:BC95`;
`b4`, `$20:C313`). The reader sees neither: the draft runs the whole step, carries
the run's speed into the air, and misses a landing's slide. Gotenks is corrected by
hand; to check on each fighter's run: the report's "vel" after a "jumps to move frame".

## The reels have a second pose we never show

*Cosmetic, every fighter.* A heavy or light blow picks its reel by the defender's
field `0x97` bit 0 (`$0D:D382`, `$0D:D356`): in `logs/fight-6.txt` Rushing Suki
Combo's blows go `16`, `14`, `16`, `14` on a standing body, by how high the spark
is. Ours always plays `m16` and `m15`. What sets the bit is not read.

## A block pauses two frames too few

*Cosmetic.* The original's `$30B2` reads `8a` on a blocked blow and `88` on this
hit (`logs/fight-3.txt`: Rushing Uppercut and Bukuuh Kyaku), 10 frames against 8;
ours pauses a block as long as the hit type says.

## The port report gives a move speeds that belong to the move it leaves for

*Cosmetic — the report only.* `npm run rom -- port a9 --fighter gohan` prints
`speed: vel 0, 0: 1.5` for `ma9`, but that vx is set after the handler's move
`1a` (`$20:A994`), so Gohan hangs still through `a9`. `ownJumps`
(`src/rom/parts.ts`) drops the frame jump of that shape; speeds still count.

---

## The body Vegeta throws in his ultimate is not in front of him

`vegeta`, "meteor" — Galactic Gunfire (`ae`/`af`) `?` · noticed by the
owner 2026-11-03 · cosmetic `?`

The body he throws should be in front of Vegeta (owner). Whether "in front"
is drawn over him or placed ahead of him is not yet asked `?`.

## Goku's hair in his winning pose has its daylight colours in every light

`goku`, his winning pose (`3e`) by evening or night · noticed 2026-11-03
· cosmetic

`goku_hair_win` is drawn in palette `0x27B161` alone. `3e`'s handler loads
record own + `0x130` into the hair's palette (`$20:80EF`, `$01:84EF`):
`0x170`/`0x171` are `0x27B161`, but `0x172`/`0x173` are `0x27B1E1`, so in
the lightings whose own record is `0x42`/`0x43` the hair should be in
other colours. Saiyan Meteor's `goku_hair_normal` may share it `?`.

## The KO's blow says both voices

`goku`, `vegeta`, a blow that empties health with the KO switch on ·
noticed 2026-11-03 · cosmetic

The blow enters its reaction first — and its `voice_hurt` — and the round
forces the KO after the blows, with `voice_ko`, in the same frame: both
voices start together. The original skips the reaction at zero health
(`$0D:D0D0`) and says only the KO's.

## Saiyan Meteor turns the opponent round after the explosion

`goku`, Saiyan Meteor (`ad`) landed · noticed by the owner 2026-11-01 ·
annoying

After the ball explodes the opponent ends up facing the wrong way, for
no reason seen yet. Where the turn happens — the `seize` release, the
reaction it lets him go into, or the landing after — is not known `?`;
a recording (`L`) of the move landing would say.

## A charge does not take over a punch begun a frame before

`goku`, A then S a frame apart · noticed 2026-10-30 · annoying

In the original, Y pressed a frame before B starts the far Y (`92`) for one
frame, and the charge takes over (`tools/re/log-charge.lua`). Ours plays the
punch and no charge: only idle and walking look for A + S. Whether the
normals' handler checks for Y + B all through or only at their start is not
read.

## Goku's black-haired drawings are missing part of the hair

`assets/sheets/goku.png`, drawings `26`–`2a` and `2f`–`34` · noticed 2026-10-28 · cosmetic

The hair is cut flat at the top and some strands look too thin. These are the
transformation drawings, and every script that shows them (moves `3c`, `3e`)
issues a `b0` just before — which spawns an object that draws the rest of
the hair, from resource `0x51` in the palette at `0x27B161` (confirmed against
a VRAM snapshot, `rom.md`). The overlay is exported now, as the spawn
`goku_hair`; nothing plays it yet (`plan.md`).
To see it: `npm run rom -- frame 29`. The work to fix it is in `plan.md`.

## `npm run anim` only knows how far a move reaches sideways

`src/sprites/boxes.ts:110` · noticed 2026-08-23 · annoying

`reach` measures the silhouette horizontally, and `activeIndex` and `hitBox`
are both built on it. Everything a move does vertically is invisible to it, and
it fails three ways, none of them announced as a guess:

- **A tie picks the earlier frame.** 44 and 45 share a rect and an anchor, so the
  hit box landed on `punch_air`'s wind-up.
- **A vertical blow gets no box at all.** `arm_sweep` (71-73) sweeps up and over,
  nothing extends, and the box came back `FALLBACK`.
- **A vertical blow picks the wrong frame entirely.** For `knee` (112-114) the
  widest silhouette is 112, the standing prepare, so the box was offered on the
  frame before the move starts.

All three had to be placed by hand, and re-running the script undoes them.

Reproduce: `npm run anim -- goku_old probe --frames 112,113,114 --kind attack --dry-run`
and read which step is starred.

Worth deciding with the fix: whether `--active N` is enough, or whether reach
should be measured as distance from the anchor in both axes — the second would
have got all three right without a flag.

## Save never tells you it saved

`tools/entity-editor/src/main.ts:192` · noticed 2026-08-22 · annoying

`wireSave` puts the result in the status bar and then calls `render()`, which
sets `statusEl.textContent` unconditionally from the sheet's dimensions and
counts (`main.ts:336`). The message is overwritten in the same tick, so
"Saved data/entities/goku_old/frames.json" never appears — the bar just snaps back to
`720x2304px · 180 frames · …`. An error message from a failed save is lost the
same way, which is the half that matters.

To see it: press Save on the Sprites tab and watch the status bar.

Not fixed here because the ordering is not the whole question: `render()` owns
that element, so either it learns to leave a transient message alone or the
message belongs somewhere that is not the status bar. The new "Apply to sheet"
button sidesteps it by not calling `render()` — nothing in the editor's state
changed, only the disk — which works but is a second convention, not a fix.

## Re-running npm run anim throws away every box that was adjusted by hand

`scripts/anim.ts` · noticed 2026-08-22 · loses work

The script keeps existing *timings* when the frame list is unchanged, and says
so — but it rebuilds `boxes` from the silhouette every time, unconditionally. A
hit box widened in the editor, a hurt box nudged off the hair, a push box drawn
by hand: all replaced on the next run, with nothing printed to say they were
there.

It is live on data shipped today. `punch_knee`'s hit box is hand-set to 12x7
because the derived one was a 3px artefact (see the entry below), and its steps
are a hand-made four-step split. `npm run anim -- goku_old punch_knee --frames
187,188 --kind attack` puts back the 3px box and the three-step shape, and only
the timing reset is mentioned.

Until it is fixed, treat re-running the script on a tuned animation as
destructive and check `git diff` afterwards.

The fix has a shape: the script already knows which boxes it derived (hurt, and
the placeholder hit), so it can keep anything it did not put there — a push box
always, and a hit box whose geometry no longer matches what the derivation would
produce. That last test is the awkward half and is why this is written down
rather than done.

## A new frame's anchor lands in the middle of its rectangle, not under its feet

`tools/entity-editor` · noticed 2026-08-22 · annoying

Cutting a frame puts the anchor at `round(w / 2)` — every frame on the sheet has
it there. The rectangle follows the widest limb, so a pose with an arm out gets a
wider rect, a centre further from the body, and a fighter who slides sideways
when that pose plays. It cost four of the seven new frames:

| frame | feet, against the held crouch |
|---|---|
| 182 | aligned — drawn on the crouch's own legs |
| 183 | +6 px |
| 184 | +7 px |
| 187 | +5 px |
| 188 | −3 px |

Nothing errors, and it is invisible in the editor: each pose looks right on its
own, and only playing them in sequence shows the drift. The owner found it by
noticing Goku move during an attack whose legs do not move.

The fix is computable, which is what makes this worth writing down rather than
correcting by eye. Correlating the bottom sixteen rows of a frame against the
stance it belongs to gives the offset exactly — 95–100% coverage on all five
crouching frames, because the legs really are the same pixels. That could be a
script (`npm run anchor -- goku_old 187,188 --like 18`) or a button in the editor;
either beats nudging until it looks still.

Two things to know before fixing it. Boxes are stored **relative to the anchor**,
so moving one must move them with it, or the hurt boxes come off the body. And
the reference stance differs per pose: crouching frames align to 18, standing
ones to an idle frame, so the tool has to be told which.

## npm run anim measures the hit box against the wrong limb

`scripts/anim.ts` · noticed 2026-08-22 · annoying

The hit box is derived from how far the active frame reaches **beyond the
others**, which assumes the striking limb is what reaches furthest. On a
kneeling attack it is not: `punch_knee`'s wind-up (187) has a knee out at
`y=64`, further forward than anything in the strike except the fist, so the
comparison came back 3 px wide against 11 for the standing punch. Measuring
inside the arm's own rows instead gives 6 px of extension and a 12x7 fist —
the same fist size the standing punch measures.

Nothing errors. The printed table looks ordinary and the move is simply almost
impossible to land, which is the same silent shape as the depth-frame problem
the skill already warns about.

To see it: `npm run anim -- goku_old probe --frames 187,188 --kind attack --dry-run`
and read the hit box against `punch`'s.

The fix is to compare within a band of rows rather than across the whole frame
— the striking limb's own rows, taken from where the active frame reaches
furthest. Left alone for now because it wants a rule about which band, and one
crouching attack is not enough evidence to choose it. Meanwhile the number is a
placeholder like every other hit box, and the report says when it looks wrong.

## Keying starts off on a sheet that is already partly transparent

`tools/entity-editor/src/main.ts:213` · noticed 2026-08-21 · annoying

Loading a sheet asks whether the image contains *any* transparency and answers it
for all 180 frames: if yes, `bgKeyEnabled` starts false. That is the right answer
for a fully keyed sheet, which every fighter's now is — and the wrong one the
moment new poses are appended to `goku_old.png` on the rip's background colour, since
the control that would key them starts switched off.

To see it: append anything opaque to `assets/sheets/goku_old.png` and load it — the
"transparent" checkbox is clear and the new rows keep their background.

Nothing is lost and there is a one-click way out: the eyedropper sets
`bgKeyEnabled = true` unconditionally (`sheetView.ts:88`), so picking the
background colour turns keying back on, and `rebuildKeyed` only ever touches
pixels with `a > 0` — the already-transparent ones are left alone. The fix, if
one is wanted, is to drop the all-or-nothing question at load and let the eyedropper
be the whole interface.

## A press dies on the frame the move ends

`src/input/buffer.ts` · noticed 2026-08-16 · annoying

The machine reads the buffer once per frame and the buffer is ticked afterwards,
so a press with one frame of life left is aged out by the very frame that
returns control — and the state entered on that frame only looks at its input on
the next one. Seven frames of an eight-frame window are usable, and the eighth
is precisely the one a player aiming at "as soon as I can act" will hit. From
the recording: press on 00098, `punch → idle` on 00105, and the same line says
`EXPIRED unused`.

Found while measuring why 25 of 33 light presses in one session went unused, and
it survived two attempts at the other cause. The jab shrank from 25 frames to
12, and the second recording still lost the press: **hitstop is added to an
attack's remaining animation, not taken out of it**, so a blow that lands leaves
6 frozen frames *plus* the 8 the jab still has to play. At a window of 8 the
press expired on the very frame it would have been spent. `BUFFER_FRAMES` is 12
now and the jab links, which is tuning around the defect rather than fixing it.

The fix that makes a buffer feel like its number is to let the state entered on
a frame evaluate its own transitions that same frame. That touches "at most one
transition per frame" in `states.ts`, which is deliberate, so it wants deciding
rather than doing.

## A held direction sticks after the window loses focus

`src/input/keyboard.ts` · noticed 2026-08-14 · annoying

Hold `→`, switch tab or click away, come back: Goku keeps walking right and
nothing stops him but tapping the key again. The browser delivers no `keyup`
to a window that is not focused, so `held.right` is never cleared.

Fix is a `blur` listener that clears every held direction. Attack buttons need
nothing — they disarm themselves every frame.

- **Buu's `buu_9_12` and `buu_9_0e`: guessed timing.** Their `animations` say frames 0 to n at 4 each,
  from the draft; the code holds each frame for what a table says and has an empty frame last, as
  `buu_9_15` does (`$0F:DD4D` and the tables after it). Which table is whose is not read yet.

- **Objects that may outlive the original's.** `mr_buu_8_06` (Mr. Buu's X) is up 21 frames against the
  recording's 15, `cell_7_07` 42 against 29. Both end with the thrower's move as their code says; any
  timer of their own is not read. `cell_7_02`, `cell_a_22` and `cell_a_23` are in the same
  position, ending with the move alone.
- **Buu's Energy Sphere objects end with the move.** `buu_9_15`, `buu_9_12` and `buu_9_0e` live as long as
  the sphere `9/17`–`19` in the original (`$0F:DFB6`), which is not ported.

- **14 objects leave the wrong thing when they land.** The draft gave every object the same small
  explosion; `$2A:8E31` says most of these stay and leave a melee blow's spark, and some explode bigger.
  The list is `NOT_YET` in `src/rom/objectHit.test.ts`, and it tells which is which. Vegeta's own
  `vegeta_energy_field`, `_energy_dash`, `_ground_flare` and `_jumping_bomb` stay, but sound like an
  explosion and name no spark, so they leave `spark_1`: not compared with the original yet.
- **Mr. Buu's Y stands longer after landing.** Its object counts through the hit pause in the original
  (`8/08` does not test `$30B2`) and is gone 15 frames out; ours stops with every bolt during a pause,
  so it stays about 7 frames more. `Projectiles.update` pauses them all.
- **`npm run moves -- <fighter> --only <name>` with no such case overwrites `report.txt` with "0 of 0".**
  `--report` writes it again. Names are `c.name` as `moveCases` gives them: `y`, `aa`.
- **Some objects fly unseen: their sheets hold no pixel.** They still fly and strike. Cell's `cell_a_21`,
  `_a_22`, `_a_23` and Buu's `buu_a_20` take tiles from the wrong place, as Kakusan's did: type `a` draws
  from the shared `0x30`/`0x31` (`npm run rom -- vram logs/objects-<name>.bin`). `buu_9_06`
  and `buu_9_08` are blank too, cause not read; they may be drawn effects, as Energy Field's `mr_buu_8_12` is (`rom.md`), which stays blank on purpose. The list is `DRAWS_NOTHING` in
  `src/rom/objectTiles.test.ts`. A spawn already exported is kept, so `animations.json` has to go first.
- **Kakusan's three land too close together from near.** The original's come 14 and 23 frames apart and
  the opponent goes 90 px over its reel; ours land one straight after the other's pause and he goes 39 px
  (`logs/moves/mr_buu/ab.*`). From afar it agrees (`--far`). Why is not read: the middle ball sits 1 px into
  his body for five frames after the first pause before it strikes, at the same gap and on the same frame of
  its own (ball and box confirmed by `$2A:8D63`'s mean). His `$7A`, `$26` and `$96` stay clear, so it is not
  `$2A:8B92`'s gate. The low ball's wait is geometry: it strikes once his shove stops at the screen's edge.
- **Mr. Buu's Energy Field's blow is gone after its first hit.** The original's object stays with its blow disarmed, puts `a/02` out in another slot, and is armed again 60 frames later (`logs/moves/mr_buu/af.orig.txt`, f199 and f259). Ours bursts, as `objectHit` reads it, so a second touch never lands. The circle is the state's and goes on.
- **Mightiness Bomber: a ball whose thrower is hit while it charges vanishes at once.** Not compared with the original: it may shrink. After a hit the original also has more `a/17` / `a/18` slots, 14 and 20 frames on; ours shows one burst. Not read.
- **Cell's `cell_7_03` should set the defender burning**, as `objectHit` reads it; ours does not. It is on `NOT_YET` for its explosion too.
- **The small and middle Kamehameha and Final Flash may whiten the screen and should not `?`.** `kame_s`, `kame_m`, `vegeta_final_flash_s` and `_m` have `hitFlash`, but they become `a/02` and `a/17`, and only `a/18` asks for the white (`$0F:E234`). Measured on Mightiness Bomber's three levels: only the largest whitens. Not measured on the Kamehameha itself; the owner has approved it as it is.
- **Two 3D moves may stop short from afar, as Mr. Buu's Flying Bomber did.** Their handlers hold the code that measures the distance (`rom.md`), but ours walk at a fixed speed: Cell's Giga Shoulder (`a2`, `$10:C552`), Buu's Matamol (`b6`, `$10:D978`). Not played; `port` does not report it. `npm run moves -- <fighter> --far` shows each.
- **Sender `a1` and Planet Attack from afar are off by the report**, not looked into (`npm run moves -- mr_buu --far`).
- **Kakusan's second shot lands 5 frames after the pause in the original, at once in ours.** Near: the opponent reels 72 frames and 90 px there, 50 and 39 here; from afar they agree. The distance stays 22 px through those 5 frames, and fields `0x26`, `0x7A` and `0x7B` of the defender do not explain it (recorded). Gotenks's Renzoku looks the same `?`.
- **Gohan's and Freeza's intros show `run0` … by day on an evening or night arena**, as Vegetto's did: the original plays intros on their own screen, by day, so those records have no other lighting. `relitRun` in `src/rom/arena.ts` could work them out. His `glow` marks follow the lighting since Vegetto's fix.
- **A blow after a connection lands 3 frames early:** Elbow Dash's second, 14 frames after the first where the original's is 17. The state's first frame runs out inside the hit pause, and the blow's box is early too (next entry). Other follow-ups likely share it `?`.
- **Low B from close: the two bodies part the other way.** The blow lands 3 frames early (below), so Vegetto is 4 px further along when Goku falls on him, and turns round where the original's stands up.
- **A blow's box is out a frame early in ours, and gone a frame early.** A state's step has advanced by the time `landBlow` looks: Flying Bomber's box, the original's script frames 50 to 57, is 49 to 56 here. A blow reached only on its last frame misses: Flying Bomber from about 168 px, where the original just lands. For every fighter; not changed, it would move every blow by a frame.
- **Mr. Buu's Tornado Hip lands one blow from afar where the original lands two.** Its first lands at 67 px in the original and at 29 px here (`logs/moves/mr_buu/a4-far.*`), a round later. Touching edges did not change it; the box out a frame early, above, is the likely cause, not confirmed.
- **`npm run moves` cuts the defender's stretch at his first idle.** Goku's Double Kick (`a2`) lands two blows in both games, with a moment of idle between them in the original's, so its report reads `≠` on a second reel the original also has.
- **Bodies push apart in the air in ours, on landing in the original.** Mr. Buu's Y and B in the air: the original's bodies overlap all the way down and part by 20 px on the frame he lands, ours part before he lands (`y-air`, `b-air`; `$2A:8B1A` compares their heights, not read). Their final gap differs by 1 to 3 px. For every fighter.
- **Other fighters' charges may be Goku's too.** Mr. Buu's was: the wrong palette (`$0F:A072`, the glow, is called from only some handlers), Goku's sound and pose, none of his steam. By character the sound is `46` for 8, `17` for 9 and `19` for the rest (`$0F:A02E`). Check each, with his objects (`npm run rom -- spawns`, move `0c`).
- **Oyatsu Kosen's and Buu Breath's objects leave no spark, but their sound is a guess.** `burst_0a` stayed on them; the recordings' sounds on that frame were not read apart. Buu's damage in Oyatsu Kosen is the old guess, 80.
- **Other fighters' ultimates: the final explosion does not cover both fighters (owner, 2026-11-05).** Mr. Buu's Buu Breath now keeps the band on through the white (`lit`, `$0F:F158`). Saiyan Meteor, Galactic Gunfire and the rest to be checked and given the same.
- **Other fighters' wins and intros may run past a held pose, as Mr. Buu's did.** Their scripts' `hold` steps (`npm run rom -- move 3e`, `3c`) were played through in ours; check each against a recording. `select-vs` opens a round only after 2 more presses, about frame 2225; health goes in after that (`healthAt`).
- **Mr. Buu's own `82` is not ported** (the handler walks him off the screen, then `8/14`, `8/15`). Not shown: no arena has it yet, and on a floor it is not played (owner).
