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

## Mr. Buu's Oyatsu Kosen has errors and was never checked

*Annoying `?`, Mr. Buu (owner, 2026-11-06).* Oyatsu Kosen, hold ↓ for 3 seconds, then ↑ + B. Which errors he did not say: ask him before fixing. For later. Its objects, and Buu Breath's, leave no spark, but their sound is a guess: `burst_0a` stayed on them; the recordings' sounds on that frame were not read apart. Buu's damage in it is the old guess, 80.

## An object in a palette of its own keeps its colours on an evening or night arena `?`

*Cosmetic, seen on Gohan's intro.* His dust stays bright white by night beside a body in that lighting's colours. An object in its thrower's palette follows the lighting (`lit`, ADR 0087); this one is drawn in record `0x117` (`gohan_intro_a`), and whether the original lights such an object by arena is not checked.

## Goten's and Trunks's first fade and his intro's runs keep the day's colours

*Cosmetic, Gotenks, evening and night.* Their win follows the lighting now (`lit`, ADR 0087), but the first fade's record by evening, `0x13B` (own + `0xC9`, `$20:B903`), and by night and in the ruins are no ROM address our reader follows `?`: the day's stands in for those frames. His intro's `run0` and `run1` are own + `0xC9` and + `0xC5` (`$20:B96C`) and are exported for the day alone, the same way. From the code: no evening state of the original was played.

## A drafted run does not stop by the opponent, and flies at the wrong speed

*Breaks play, drafted fighters `?`.* A handler may end a run under a distance and
keep the speed of the jump after it in `$F0` / `$F2` (Gotenks's `a8`, `$20:BC95`;
`b4`, `$20:C313`). The reader sees neither: the draft runs the whole step, carries
the run's speed into the air, and misses a landing's slide. Gotenks is corrected by
hand; to check on each fighter's run: the report's "vel" after a "jumps to move frame".

## The original jumps where it should start Galactic Gunfire

*Annoying, the tools.* `npm run moves -- vegeta --only ae --close` (and `npm run original` with ↑ 1 ↓ 2 Y) plays a jump and an air move in the original, at health 80; ours seizes. Which of the pad's timing, the distance or a condition the command table holds is not read, so the move has no recording to compare with.

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
