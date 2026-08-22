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

## Save never tells you it saved

`tools/entity-editor/src/main.ts:192` · noticed 2026-08-22 · annoying

`wireSave` puts the result in the status bar and then calls `render()`, which
sets `statusEl.textContent` unconditionally from the sheet's dimensions and
counts (`main.ts:336`). The message is overwritten in the same tick, so
"Saved data/entities/goku/frames.json" never appears — the bar just snaps back to
`720x2304px · 180 frames · …`. An error message from a failed save is lost the
same way, which is the half that matters.

To see it: press Save on the Sprites tab and watch the status bar.

Not fixed here because the ordering is not the whole question: `render()` owns
that element, so either it learns to leave a transient message alone or the
message belongs somewhere that is not the status bar. The new "Apply to sheet"
button sidesteps it by not calling `render()` — nothing in the editor's state
changed, only the disk — which works but is a second convention, not a fix.

## Keying starts off on a sheet that is already partly transparent

`tools/entity-editor/src/main.ts:213` · noticed 2026-08-21 · annoying

Loading a sheet asks whether the image contains *any* transparency and answers it
for all 180 frames: if yes, `bgKeyEnabled` starts false. That is the right answer
for a fully keyed sheet, which every fighter's now is — and the wrong one the
moment new poses are appended to `goku.png` on the rip's background colour, since
the control that would key them starts switched off.

To see it: append anything opaque to `assets/sheets/goku.png` and load it — the
"transparent" checkbox is clear and the new rows keep their background.

Nothing is lost and there is a one-click way out: the eyedropper sets
`bgKeyEnabled = true` unconditionally (`sheetView.ts:88`), so picking the
background colour turns keying back on, and `rebuildKeyed` only ever touches
pixels with `a > 0` — the already-transparent ones are left alone. The fix, if
one is wanted, is to drop the all-or-nothing question at load and let the eyedropper
be the whole interface.

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
