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

## An object in a palette of its own keeps its colours on an evening or night arena `?`

*Cosmetic, seen on Gohan's intro.* His dust stays bright white by night beside a body in that lighting's colours. An object in its thrower's palette follows the lighting (`lit`, ADR 0087); this one is drawn in record `0x117` (`gohan_intro_a`), and whether the original lights such an object by arena is not checked.

## Goten's and Trunks's first fade keeps the day's colours

*Cosmetic, Gotenks's win, evening and night.* The first fade's record by evening, `0x13B` (own + `0xC9`, `$20:B903`), and by night and in the ruins are no ROM address our reader follows `?`: the objects show the day's `shimmer1` for those 2 frames. His own runs are relit (`introPalettes`, `rom/arena.ts`).

## The original jumps where it should start Galactic Gunfire

*Annoying, the tools.* `npm run moves -- vegeta --only ae --close` plays a jump and an air move in the original, at health 80; ours seizes. The original reads commands on the jump's 2 frames on the floor alone, so ↓ Y has to follow ↑ within them (`input/command.ts`, `TAKEOFF_GRACE`); the case's pad holds ↑ for 3. No recording of the move to compare with until a case presses it that fast.

## `npm run rom -- export --fighter goku` writes Goku as another fighter

*Loses work, the tools.* It takes the path for the generated fighters: `goku/animations.json` loses his spawns and changes shape, and his sheets in `assets/` are rewritten. Goku is exported by `npm run rom -- export` alone; nothing refuses the other.

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
