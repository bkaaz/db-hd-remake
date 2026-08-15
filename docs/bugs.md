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

## A light hit rescues someone who is already being knocked down

`src/entity/states.ts` · noticed 2026-08-15 · annoying

Uppercut, then jump and land a light kick on the rising body: instead of
continuing to the floor, the opponent switches to `hurt_air`, recovers and
lands on their feet. The knockdown is cancelled by the weaker blow.

Same cause, second symptom: `downed` has hurt boxes, so a fighter lying on the
floor can be kicked, and stands up into the standing `hurt` mid-lie-down.

A reaction is chosen from the blow and from whether the defender is airborne;
nothing asks what the defender is *doing*. Being helpless outranks being hit
lightly, and no state can say so today.

## A held direction sticks after the window loses focus

`src/input/keyboard.ts` · noticed 2026-08-14 · annoying

Hold `→`, switch tab or click away, come back: Goku keeps walking right and
nothing stops him but tapping the key again. The browser delivers no `keyup`
to a window that is not focused, so `held.right` is never cleared.

Fix is a `blur` listener that clears every held direction. Attack buttons need
nothing — they disarm themselves every frame.
