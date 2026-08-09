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
afterwards would mean redoing all of them.

---

## A. Impact — a hit that costs something

Today a hit swaps the defender's animation and nothing else. This makes it an
event with a direction and a magnitude.

- **A1 — the attacker names the reaction.** New field `onHit: "<state>"` on an
  attack state; the engine forces *that* state on the defender. The defender's
  top-level `onGotHit` stays as the fallback for attacks that name nothing.
  Reaction names become a small shared vocabulary every fighter implements
  (`hurt_light`, `hurt_heavy`, later `knockdown`) — the validator can only check
  the attacker's own entity for now, which is fine while both fighters are Goku.
  *Done when:* Goku's punch names a reaction and the dummy plays it.
- **A2 — a second reaction, `hurt_heavy`.** Needs a frame; if it is not among
  the 45 already described, describe that small range first (`add-animation`
  skill), do not guess the pose.
  *Done when:* two visibly different reactions exist and an attack picks one.
- **A3 — knockback.** The reaction state moves the defender backwards. Start
  with plain `vel` on the reaction state — facing is toward the attacker, so
  negative X is away, and no new machinery is needed. *Open:* whether that reads
  right, or whether it wants an impulse plus friction (a new attribute).
  *Done when:* a heavy hit visibly separates the fighters, and push collision
  still keeps them out of each other.

## B. Hitstop — a hit that has weight

- **B1 — freeze both entities for a few frames on contact.** Animation and
  movement both stop. *Open:* where the number lives — a `hitstop` field on the
  attack state (heavy hits want more) falling back to an entity attribute.
  *Done when:* a hit bites, and the number is tunable in one place.

## C. Catalogue pass over the attack region (~frames 32–60)

- `npm run sheet` over the range, owner names the poses, `descriptions.json`
  grows. Done before twelve attacks get built, not during.
  *Done when:* every frame in the range has a line, and the `?` guesses are
  settled for the frames an attack will actually use.

## D. Hit spark — a hit you can see

- **D1 — source the effect sprites.** Goku's sheet carries only some of them, so
  a standalone effects sheet has to be found. BYOA rules apply: it goes in
  `assets.manifest.json` + `npm run fetch-assets`, never into git.
- **D2 — `fx_hit` as its own entity**, `data/entities/fx_hit/` with its own
  atlas. Bundling effect sprites into each fighter's atlas was rejected.
- **D3 — spawning.** The engine spawns it at the point of contact (centre of the
  hit ∩ hurt overlap); it plays one non-looping animation and removes itself.
  *Open:* whether an effect runs a state machine at all or is a simpler object.
  *Done when:* a landed punch produces a spark where it landed.

> **After D one exchange is complete.** Everything below multiplies it.

## E. Two attack buttons, two standing attacks

Which SNES buttons, and which two attacks, is settled when E starts — not
guessed from memory.

## F. Knockdown

A sequence, not a third hurt variant: fall → down → get up, each its own state.
Light and heavy share one shape; this one does not.

## G. Crouch, and crouch attacks

## H. Air attacks

## I. The remaining attack buttons

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
  prerequisite for specials.
- **The rest of the keyboard layout** and a remapping screen. Only SNES `Y`
  (keyboard `A`) is wired.
- **A camera**, and a stage. Round rules and a second player belong to Stage 3
  in `roadmap.md`.
