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

## A fighter blocks in the middle of their own attack

`src/entity/entity.ts` · noticed 2026-08-16 · annoying

The same root as the hitstun one fixed that day, and the half that stayed: guard
is resolved at the moment of contact from `holdingBack`, and an attack state
ranks 0, so a fighter who holds back and presses light blocks whatever arrives
while their own punch is out. A trade becomes a block, and a counter-hit is
unreachable — which is a real loss, because the counter-hit is the reward for
whiff-punishing rather than mashing.

To see it: hold back on P1, press light, and have the blow met by P2's. The
recording says `blocked` on a fighter who was swinging.

Not fixed with the reaction case because the rule wants a boundary decided
rather than guessed: `onHit` marks an attack, but "no guard while attacking"
also has to say what happens during recovery, and during `land` and `getup`.

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
