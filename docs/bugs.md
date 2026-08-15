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

## Every attack is minus on hit — the blow that lands acts second

`data/entities/goku/states.json` · noticed 2026-08-15 · annoying

Land anything and the defender recovers before you do. From the recording: a jab
connects on frame 274, the victim is free on 292, and Goku is still swinging
until 302. It holds for all six attacks — the recovery of every one of them is
longer than the 12 frames of hitstun it deals:

| attack | recovery | hitstun | advantage |
|---|---|---|---|
| `punch` | 21 | 12 | −9 |
| everything else | 16 | 12 | −4 |

The medium string hides it, because a chain link is a **cancel** — it interrupts
its own recovery, so recovery never enters the sum. A single blow has nowhere to
cancel to, and is therefore punishable by the person who just took it.

Now a one-field fix per blow (`hitstun`, added 2026-08-15) rather than a
redrawn pose — but it is tuning, and it is coupled: `hurt` slides 1.4 px a
frame, so a jab held for 22 instead of 12 pushes the victim 31 px instead of 17
and walks itself out of range. Frame advantage and knockback have to move
together.

## A held direction sticks after the window loses focus

`src/input/keyboard.ts` · noticed 2026-08-14 · annoying

Hold `→`, switch tab or click away, come back: Goku keeps walking right and
nothing stops him but tapping the key again. The browser delivers no `keyup`
to a window that is not focused, so `held.right` is never cleared.

Fix is a `blur` listener that clears every held direction. Attack buttons need
nothing — they disarm themselves every frame.
