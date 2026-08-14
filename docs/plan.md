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
afterwards would mean redoing all of them. **A–J are done**: a blow names how it
is taken, pushes the defender back, pauses the game on contact and leaves a
spark where the boxes met, all four attack buttons are wired, an uppercut puts
a fighter on the floor, there are attacks from standing, crouching and the
air, blows can be blocked, health comes off, and it all makes a noise.

---

> **One exchange is complete.** Everything below multiplies it.

## Now: code the owner can read, before there is more of it

The owner is reading this codebase for the first time, and `main.ts` was where
that stalled — 344 lines doing seven things. It is 120 now, and the body of the
fixed-step loop is four named calls.

**The reason this is worth finishing, and not just leaving as tidied:** the
fight is the only screen that exists today, so the loop body *is* the fight. A
title menu and a character select are coming, and at that point the loop cannot
be about fighting at all.

**Watch `match/fighters.ts`.** It is the one real new abstraction — the pair of
bodies and everything pairwise between them — and every future rule of combat
will want to move in. Its boundary is *the two fighters and nothing else*: no
HUD, no keyboard, no stage. It lives in `match/` rather than `combat/` because
it has to know `Entity` and therefore PixiJS, while `combat/` stays pure and
unit-tested.

**The fight becomes a scene.** A `Scene` with `step()`, `render()` and
`destroy()`; `FightScene` holds the modules above, and the `?anim=` preview
becomes `PreviewScene` instead of five `previewing ? … : …` branches. `main.ts`
then boots Pixi, makes the first scene and turns the crank — and stops growing
when menus arrive. Called `Scene` and not `Screen` because `app.screen` in
PixiJS is the view rectangle.

**How a scene is chosen is settled** (`decisions.md`, 2026-08-14): every scene is
built from a small serialisable parameter object, never from what the previous
scene left behind, and the URL supplies it —
`?scene=fight&p1=goku&p2=goku`. An unknown parameter is a loud error, not a
quiet fallback. Convenience presets go in `package.json`, not into a committed
dev-state file.

*Open:* how a scene *changes* to the next one — whether `step()` returns the
successor or that wants an event. Decide when the second scene exists, not
before. Two implementations are the point — one interface with one implementation
is a guess.

*Not yet, deliberately:* `TitleScene`, `SelectScene`, any transition machinery,
and an `EntityDef` cache. The cache earns its place when character select needs
the same fighters the match does; today nothing loads twice.

*Done when:* `main.ts` is boot plus the crank, and adding a scene does not touch
it beyond the first one.

## Queued: nothing checks that a `sound` or `hitFx` id exists

Found while splitting the sound bank, where twenty-one references were renamed
with only a count to verify them, and again while moving the spawns out of
`data/entities/` — both times the safety net was care rather than a check. The
state validator already proves every `anim` reference resolves; `sound`,
`hitSound`, `blockSound` and `hitFx` deserve the same. It is what would make the
next rename safe instead of nerve-racking.

*Done when:* an unknown `sound` or `hitFx` id is reported at load, the same way
an unknown animation is.

## Next: review and tidy the sound slice

**Before any new feature.** The sound work landed in one long sitting and grew
by trial: samples were named live, rejected, renamed, and the tools around them
were built while being used. It works, and it was committed *because* it works —
but nobody has read it back as a whole, and some of it is very likely redundant.

*Scope: the diff of the commit that carries this line.* Everything else waits.

Concrete questions already worth asking, so the review does not have to
rediscover them:

- **The synth spec under a sampled sound.** Five sounds keep `kind`/`freq`/
  `decay` that nothing will ever play again once the sample loads. Is a fallback
  that only covers the first few frames of a session worth a second definition
  of every sound? A voice already proves the format works without one.
- **Ids that share one file.** `swing_kick` and `swing_heavy` are both `004`,
  `hit_heavy` borrows `hit`'s `007`, `land_hard` and `land_settle` are both
  `011`. The reasoning was "separate events, separate ids, so one can change
  without the other" — sound, but it should be a rule stated once, not four
  local decisions.
- **Five files for audio**, now all under `src/audio/` except the CLI:
  `sounds.ts`, `playback.ts`, `split.ts`, `wav.ts` and `scripts/split-audio.ts`.
  The pure/browser split is right; whether the cutting tools belong beside the
  runtime is still open — grouping them by domain did not answer it.
- **`trimLeading` and `--blip` trimming.** Built because the first capture was
  hurried; the second needed none of it. Kept deliberately — confirm that is
  still the call, or delete it and keep only the dropping.
- **`docs/audio-capture.md`** still documents the browser route in full. It is
  the fallback nobody used. Shorten or keep?
- **`data/audio/`** is a new top-level directory beside `data/entities/`. Is a
  catalogue of 127 mostly-`?` slots the right shape, and does it belong there?
- **`/api/sfx` lives in the entity-editor plugin**, like `/api/atlas` — correct
  by precedent, but the plugin's name has stopped describing what it serves.
- **The input buffer** rode along in the same batch and has not been looked at
  since the day it was written.

*Done when:* the diff has been read end to end, the dead weight is gone, and
anything kept on purpose says why — here or in `decisions.md`.

## G. Crouch, and crouch attacks

Frames settled: 17 is the way down, 18 the held crouch, and the crouching kick
is 52–53 — all built. **A crouching guard is not on our sheet** and is the first
known gap; the standing guard is 11–13. It blocks nothing today, because
blocking does not exist as a state. Options are recorded in `decisions.md`.

*Open:* whether a low blow needs its own reaction. Frame 76 is a hit to the
stomach, so the sprite exists — the question is whether the fight reads better
with it, or whether high/low is a distinction that costs a reaction per fighter
and buys little.

---

## Not yet ordered

Real work, carried over from the checklists this file replaced. It gets slotted
into the sequence above when its turn comes, rather than living in a second
queue.

- **Name the rest of the sound test.** The capture is cut into 127 clips and
  eight are identified, so the swings, the hit, the block, the jump, the
  landing, the crash to the floor and Goku's own grunt are real samples;
  `data/audio/sound-test.json` holds a `?` for every clip nobody has listened to
  yet. One known gap behind that: `hit_heavy` borrows the light
  hit's sample until a heavier one is named. Nothing here needs code — a clip
  number in `sounds.json` is the whole change.
- **Ki, and the bar it shares with health.** The original spends one resource
  for both, so a special costs the same pool that damage eats. Health and damage
  exist now; the shared half waits for specials to exist at all.
- **A KO.** Health floors at zero and nothing happens there — no defeat state,
  no round. `Entity.defeated` is there and unused. Round rules belong to Stage 3
  in `roadmap.md`.
- **Walk speeds out of `states.json`** and into attributes, with the rest of the
  tunable numbers.
- **Chip damage and a guard break.** Blocking exists and costs nothing, which is
  right while every attack is a normal; specials should chip, and holding guard
  forever should eventually fail. Both wait for specials.
- **A crouching guard.** Standing blocking works; low blocking needs a pose our
  sheet does not have — see `decisions.md` for the three ways out.
- **Commands and motion recognition** (was phase E) — quarter-circles and the
  rest, the prerequisite for specials. The input **buffer** underneath them is
  done.
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
