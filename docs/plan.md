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
afterwards would mean redoing all of them. **A–E are done**: a blow names how it
is taken, pushes the defender back, pauses the game on contact and leaves a
spark where the boxes met — and there are two attacks on two buttons.

---

> **One exchange is complete.** Everything below multiplies it.

## F. Knockdown

A sequence, not a third hurt variant: start of going down → fall → landed →
get up, each its own state. Light and heavy share one shape; this one does not.
Frames are already confirmed and in the catalogue (77–81).

## G. Crouch, and crouch attacks

Frames settled: the crouching kick is 52–53. The neutral crouch and a crouching
guard are still `?`, in the `crouch_low` group (11–13, 17–18).

*Open:* whether a low blow needs its own reaction. Frame 76 is a hit to the
stomach, so the sprite exists — the question is whether the fight reads better
with it, or whether high/low is a distinction that costs a reaction per fighter
and buys little.

## H. Air attacks

Frames settled: the air kick is 46–47. The flying kick (48–49) is a special and
is **not** part of this item.

## I. The remaining attack buttons

`kick_heavy` (frames 37–39) is already built and unused, as are `hurt_heavy` and
`fx_hit_heavy` — a heavy attack on a third button lights up all three at once.

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
- **The rest of the keyboard layout** and a remapping screen. Only SNES `Y` and
  `B` (keyboard `A` and `Z`) are wired.
- **A camera**, and a stage. Round rules and a second player belong to Stage 3
  in `roadmap.md`.
