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

## First: an explicit `hitstun`

A reaction lasts exactly as long as its animation — a number chosen so a pose
reads well, quietly deciding whether combos exist. Combos need the defender's
helplessness tuned **independently of how many frames the pose takes**; that
difference against the attacker's recovery *is* the combo. Hitstop does not
enter into it, because freezing both sides equally leaves frame advantage
unchanged, which is why it is symmetric.

**It is the first piece of [`combat.md`](./combat.md)** — the three scalings,
the smash limit and everything after them are tuning on top of it.

*Honest note on why, since the first answer was wrong.* The recording showed the
medium string was not a true combo, and this was written up as hitstun being
three frames short. It was not: re-entering a reaction did not restart its
animation, so a second blow never refreshed anything (fixed 2026-08-15, and
there is now a test for the timing). The data was always fine. Hitstun is still
next, but as a foundation rather than a repair.

*Done when:* a blow says how long it holds the defender, independently of the
reaction's animation, and the chain timing test reads that number instead of the
animation's length.

**The concrete target, measured.** The string is four links as of 2026-08-15
and its middle links use a softer reaction (`hurt_chain`, 1.0 rather than 1.4),
which took the tightest margin from 3 sprite px to 13 — so hitstun is no longer
holding anything up. What it buys is the *ability to tune* helplessness at all:
today a reaction lasts exactly as long as its animation, so the only way to make
a link land later is to redraw a pose.

Note what the tests cannot do here: the distance test compares the *per-link*
growth (7.2 px) against reach, and the real constraint is the **cumulative** gap
from wherever the two were standing. That is a property of a match, not of the
data, so it belongs in a recording rather than in a test.

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

**The fight is a scene** as of 2026-08-15, and so is the character select, which
is the first real transition the `Scene` interface has carried. `main.ts` is
boot, the clock and one switch that turns a request into a scene. The `?anim=`
preview was deleted rather than converted: the editor previews animations, and
the scene's only remaining job was proving the interface with a second
implementation — which the select now does for real.

**Next: the character select, and two different fighters.** They are one job,
not two: `FightScene` still builds both bodies from a single `EntityDef`, and a
real pairing needs two defs and two `Audio`s, because a voice belongs to a
fighter. `p2` is accepted and warned about today. The select screen is the first
thing that can ask for a pairing, so it is what forces the fix — and it is also
the first **real transition**, which is the part of the `Scene` interface that
has never been exercised.

The roster gets its own file, `data/roster.json`, laid out as the grid rather
than a list: the arrangement is authored, not alphabetical. It names the whole
intended roster; **what exists in `data/entities/` decides what is selectable**,
so adding a fighter is adding a directory and their slot was reserved from the
start. The cost of that is a typo looking exactly like "not built yet", which
the slot showing its own name makes visible enough.

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
known gap. The standing guard is **28 and nothing else**: 11–13 was listed here
as the standing guard and is in fact Goku exhausted (owner, 2026-08-15), so the
guard is a single frame held on contact, which is all it ever needed to be.
Options for the crouching one are recorded in `decisions.md`.

*Open:* whether a low blow needs its own reaction. Frame 76 is a hit to the
stomach, so the sprite exists — the question is whether the fight reads better
with it, or whether high/low is a distinction that costs a reaction per fighter
and buys little.

## The moveset: name what is on the sheet, then build it

**The current attacks are placeholders and will be redone**, so nothing about
their timing, their button, or their 12–16 frame active windows is worth
preserving or retrofitting separately — that work folds into this.

**The button scheme gives the list its shape.** Four buttons, exactly
FighterZ's: **Light, Medium, Heavy, Special** — strength, not limb, so which
animation is a punch and which a kick is the character's business, not the
player's. Three stances × three strengths is **nine normals**, plus what S does
in each, plus specials. That is what we are looking for on the sheet, rather
than "some punches and some kicks".

**Animations are named for what the pose is** — `punch_hook`, `kick_roundhouse`
— with a number only to separate two that really are alike. A name like
`punch_3` encodes the order we happened to find frames in, which is a fact about
the sheet and not about the blow, and it makes `states.json` unreadable without
a second window open. Stance is part of the identity where it binds the move:
`kick_crouch`, `kick_air`.

**The sheet is fully catalogued** as of 2026-08-15 — 180 frames, 44 groups,
nothing unnamed. What it holds beyond the normals already built: a kick out of
the background, a ki bolt and two Kamehamehas, a hop-and-lunge jump attack, a
teleport, a throw, a thirteen-frame SSJ3 ultimate, a victory pose, and effect
sets for the beam, an explosion and the Super Saiyan crackle.

**What it does not hold is a clean set of nine normals.** The strengths do not
come labelled, so the remaining work is a judgement call rather than a lookup:
deciding which pose is Goku's L, which his M, which his H, in each of the three
stances — and which of the leftovers become specials.

Two gaps the catalogue turned up and neither is in `combat.md`: **a throw**
(137–139, and it is the honest answer to blocking costing nothing) and **a turn**
(153 is the only front-facing fighting-form frame, so an animated turn is
possible where today facing flips in one frame).

*Done when:* every slot in the L/M/H/S table names an animation, and what is
left over is either assigned to a special or explicitly parked.

## Buttons and chains

**The scheme is settled and described in [`combat.md`](./combat.md)** — Light,
Medium, Heavy, Special, cancel upward only, guard on back. What is left here is
the work.

**The engine needs one thing before a chain can be authored:** a trigger for
"the attack I am in has connected", since a chain continues on a hit or a block
and never on a whiff. `Entity.spent` already knows the answer at the right
moment; nothing else is missing, because a chain is an ordinary path through
the state machine — attack state → `pressed:X` → next attack state.

**The four attack buttons in `input/` are the old punch/kick/heavy pair** and
have to become L/M/H/S. Small, but it touches every attack state's trigger.

*Open, and worth deciding before an editor UI is built:* the owner wants to
author combos in the editor. `states.json` is already the definition of a chain
— a second "combos" structure would be a second source of truth to reconcile.
The likely right answer is a chain-shaped **view** of the states, not a new
format. Deferred by the owner, not dropped.

## The repo has no LICENSE

The code and the tools are the part of this repository that is actually ours,
and nothing says on what terms anyone may read or use them. Wanted: a licence
for the code, plus one line making explicit what the README already implies —
Dragon Ball and its characters belong to their owners, the sprites are not
distributed here (BYOA), and the project is non-commercial and unaffiliated.

Not a legal opinion, and worth a few minutes of the owner's own judgement:
mechanics, control schemes and combo systems are not what copyright covers, so
naming FighterZ or Budokai as influences in the docs is ordinary attribution
rather than a risk. The exposure that exists is the sprites and the characters,
which BYOA and non-commercial status already address as well as a fan project
can.

*Done when:* a LICENSE file exists and the README says what it covers and what
it does not.

The state machine already expresses all of this: a chain is attack state →
`pressed:X` → next attack state. What it lacks is a trigger for "the attack I am
in has connected", and `Entity.spent` already knows the answer.

*Open, and worth deciding before an editor UI is built:* the owner wants to
author combos in the editor. `states.json` is already the definition of a chain
— a second "combos" structure would be a second source of truth to reconcile.
The likely right answer is a chain-shaped **view** of the states, not a new
format.

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
  done. **Promoted from optional by the button scheme:** `S` is the ki blast,
  so a character with no motion inputs has no specials at all.
- **A remapping screen.** All four attack buttons are wired to the ZSNES
  defaults; nothing lets a player change them.
- **A camera**, and a stage. Round rules and a second player belong to Stage 3
  in `roadmap.md`.
