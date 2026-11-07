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

## Buu's leg coming out of the ground is in the wrong palette

*Cosmetic, Buu, evening and night (owner, 2026-11-07).* Earth Stab's `buu_9_08` is drawn in his own palette (OBJ palette 4 or 5), so in the original it follows the lighting as his body does; ours has a day sheet alone. By day it is right. Seen on `raw/states/fight-buu.mss`, a night arena.

## Mr. Buu's Oyatsu Kosen has errors and was never checked

*Annoying `?`, Mr. Buu (owner, 2026-11-06).* Oyatsu Kosen, hold ↓ for 3 seconds, then ↑ + B. Which errors he did not say: ask him before fixing. For later. Its objects, and Buu Breath's, leave no spark, but their sound is a guess: `burst_0a` stayed on them; the recordings' sounds on that frame were not read apart. Buu's damage in it is the old guess, 80.

## An object keeps its colours on an evening or night arena `?`

*Cosmetic, seen on Gohan's intro.* His dust stays bright white by night beside a body in that lighting's colours. Not checked whether the original lights objects by arena, or for how many objects it shows.

## Regeneration's arm keeps its daylight colours in every light

*Cosmetic, Piccolo, evening and night.* The arm is his own palette (`piccolo_5_09`, record `0x90`), and a spawn has no sheet per lighting, so by evening and night it does not match his body. From the code; only the day was played.

## Goten and Trunks keep their daylight colours in every light

*Annoying, Gotenks, his win (`3e`), evening and night.* The handler loads field `0x17` + `0xE8`,
`0xF0`, `0xF8` (`$20:B903`), so the records follow the lighting: `0x15A`, `0x162`, `0x16A` by
evening, `0x15C`, `0x164`, `0x16C` by night. `fades` and `palette` in `ownObjects.ts` name the
day's alone, and `gotenks_goten` has no sheet for another light. His intro's `run0` and `run1`
are own + `0xC9` and + `0xC5` (`$20:B96C`), fixed the same way; by evening + `0xC9` is `0x13B`,
which our reader cannot follow `?`. From the code: no evening state of the original was played.

## Goku's hair in his winning pose has its daylight colours in every light

`goku`, his winning pose (`3e`) by evening or night · noticed 2026-11-03
· cosmetic

`goku_hair_win` is drawn in palette `0x27B161` alone. `3e`'s handler loads
record own + `0x130` into the hair's palette (`$20:80EF`, `$01:84EF`):
`0x170`/`0x171` are `0x27B161`, but `0x172`/`0x173` are `0x27B1E1`, so in
the lightings whose own record is `0x42`/`0x43` the hair should be in
other colours. Saiyan Meteor's `goku_hair_normal` may share it `?`.

## Gotenks's discharges are blended into what is behind them

*Annoying, Gotenks, his intro (`3f`).* `gotenks_discharge` has `adds`, so it is added to
the arena and to his body and comes out as a pale smear. The original's is solid and always
in front of him: each pixel is its own colour plus the fixed colour of its row, never what
lies under it (OBJ palettes 4-7 take the colour math; `$2131`'s source there is the fixed
colour, which is also the intro's blue gradient). To see it: intro switch on, `?p2=gotenks`.

## Other fighters' ultimates: the final explosion does not cover both fighters

*Cosmetic, Goku's Saiyan Meteor, Vegeta's Galactic Gunfire, others `?` (owner, 2026-11-05, 2026-11-07).* The thrower stays in his own colours through the white. Mr. Buu's Buu Breath keeps the band on through it (`lit`, `$0F:F158`); the rest is not checked.

## Saiyan Meteor turns the opponent round after the explosion

`goku`, Saiyan Meteor (`ad`) landed · noticed by the owner 2026-11-01 ·
annoying

After the ball explodes the opponent ends up facing the wrong way, for
no reason seen yet. Where the turn happens — the `seize` release, the
reaction it lets him go into, or the landing after — is not known `?`;
a recording (`L`) of the move landing would say.

## The body Vegeta throws in his ultimate is not in front of him

`vegeta`, "meteor" — Galactic Gunfire (`ae`/`af`) `?` · noticed by the
owner 2026-11-03 · cosmetic `?`

The body he throws should be in front of Vegeta (owner). Whether "in front"
is drawn over him or placed ahead of him is not yet asked `?`.

## A drafted run does not stop by the opponent, and flies at the wrong speed

*Breaks play, drafted fighters `?`.* A handler may end a run under a distance and
keep the speed of the jump after it in `$F0` / `$F2` (Gotenks's `a8`, `$20:BC95`;
`b4`, `$20:C313`). The reader sees neither: the draft runs the whole step, carries
the run's speed into the air, and misses a landing's slide. Gotenks is corrected by
hand; to check on each fighter's run: the report's "vel" after a "jumps to move frame".

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
