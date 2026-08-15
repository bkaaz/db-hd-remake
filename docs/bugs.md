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

## Three quarters of the presses during a move are thrown away

`src/input/buffer.ts` · noticed 2026-08-16 · breaks play

Land a jab (**A**) and press **A** again to use the frame advantage: 25 of 33
light presses in one recording expired unused, and exactly one second jab ever
came out. The advantage is real — the log shows P1 free three frames before P2 —
and almost unreachable in practice.

Two separate causes, and the first is a defect rather than tuning.

**A press dies on the frame the move ends.** The machine reads the buffer once
per frame and the buffer is ticked afterwards, so a press with one frame of life
left is aged out by the very frame that returns control, and the state entered
that frame only looks at its input on the next one. From the recording: press on
00098, `punch → idle` on 00105, and the same line says `EXPIRED unused`. Seven
frames of an eight-frame window are usable, and the eighth is precisely the one a
player aiming at "as soon as I can act" will hit.

**And eight frames is short against these moves.** `punch` has 22 frames between
landing and recovering, 6 of them hitstop (which the buffer correctly does not
age). Pressing when you *see* the hit therefore always loses: the press must
arrive in the last 8 frames of the 16 that follow the pause.

The candidate fixes are a re-evaluation of the new state's transitions on the
frame it is entered (which is what makes a buffer feel like its number), a
longer `BUFFER_FRAMES`, and — separately — a shorter jab: 25 frames total for a
light attack is long, and its second step alone is held for 16.

## A held direction sticks after the window loses focus

`src/input/keyboard.ts` · noticed 2026-08-14 · annoying

Hold `→`, switch tab or click away, come back: Goku keeps walking right and
nothing stops him but tapping the key again. The browser delivers no `keyup`
to a window that is not focused, so `held.right` is never cleared.

Fix is a `blur` listener that clears every held direction. Attack buttons need
nothing — they disarm themselves every frame.
