# Plan — the work queue

**This is the only queue in the repo.** What is next lives here and nowhere
else. [`roadmap.md`](./roadmap.md) describes the wider arc,
[`entity-editor.md`](./entity-editor.md) records how the editor got here, and
neither lists work to do.

**Finished items are deleted from this file**, in the same change that finishes
them. The file only ever shrinks, so it cannot drift: a stale line is simply a
line somebody forgot to remove. What a finished item leaves behind:

| | where |
|---|---|
| **why** it was done that way | `decisions.md` (newest first — grows) |
| **when** | git history |
| **what** the format now is | `data-format.md` and friends |

**Detail decays with distance.** The next items are broken into slices with a
*done when*; later ones are one line. Detail written for work three weeks out is
detail that gets rewritten before it is read.

**The order is the point.** A–D build **one complete exchange** — a hit that
costs something, has weight and is visible — before any move is multiplied.
Four buttons × three stances is twelve attacks, and re-tuning how a hit feels
afterwards would mean redoing all of them. **A–F and I are done**: a blow names how it
is taken, pushes the defender back, pauses the game on contact and leaves a
spark where the boxes met, all four attack buttons are wired, and a
heavy kick puts a fighter on the floor.

---

> **One exchange is complete.** Everything below multiplies it.

## G. Crouch, and crouch attacks

Frames settled: 17 is the way down, 18 the held crouch, and the crouching kick
is 52–53 — all built. **A crouching guard is not on our sheet** and is the first
known gap; the standing guard is 11–13. It blocks nothing today, because
blocking does not exist as a state. Options are recorded in `decisions.md`.

*Open:* whether a low blow needs its own reaction. Frame 76 is a hit to the
stomach, so the sprite exists — the question is whether the fight reads better
with it, or whether high/low is a distinction that costs a reaction per fighter
and buys little.

## H. Air attacks

Frames settled: the air kick is 46–47. The flying kick (48–49) is a special and
is **not** part of this item.

## J. Sounds

---

## Not yet ordered

Real work, carried over from the checklists this file replaced. It gets slotted
into the sequence above when its turn comes, rather than living in a second
queue.

- **Attributes + health** (was phase C): HP and damage per attack, the shared
  health/Ki bar, walk speeds moved out of `states.json`. Hits currently cost
  nothing.
- **Blocking**, and blockstun. Not in A–J above; the exchange being built is an
  unblocked one.
- **Commands / input buffer / motion recognition** (was phase E) — the
  prerequisite for specials, and for combos before that. **Hitstop currently
  eats inputs:** the loop clears the attack edge every frame while a frozen
  `update()` returns before reading it, so a button pressed during the 6-frame
  pause is lost — and that pause is exactly when a player presses the next
  attack, having just seen the hit land. Without a buffer the combo failures
  will look like a timing problem rather than a swallowed press.
- **An explicit `hitstun`.** Today a reaction lasts as long as its animation,
  which is enough while there is one reaction. Combos need to tune how long the
  defender is helpless independently of how many frames the pose takes — that
  difference against the attacker's recovery *is* the combo. Hitstop does not
  enter into it: freezing both sides equally leaves frame advantage unchanged,
  which is why it is symmetric.
- **A remapping screen.** All four attack buttons are wired to the ZSNES
  defaults; nothing lets a player change them.
- **A camera**, and a stage. Round rules and a second player belong to Stage 3
  in `roadmap.md`.
