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
| **why** it was done that way | `adr/` — one file per decision |
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

## Now: Goku from the cartridge

Everything below waits while this runs — the owner paused combat work on
2026-10-28 to try it. Why and how: [ADR 0016](./adr/0016-the-original-is-read-from-the-cartridge.md);
what is known so far: [`rom.md`](./rom.md). The tile format is done
(`src/rom/decompress.ts`), and so is every drawing: `npm run rom -- frames`.
The owner prefers static analysis to recordings (2026-10-28): `npm run dis`
reads the code, the emulator only confirms.

1. **What plays which script.** The step format is read (`rom.md`); the table
   or code that picks a move's script is not. Follow the move handler for far
   Y in `npm run dis` to where it starts a script. *Done when:* a move id
   gives its list of (drawing, frames held) without a recording.
2. **Into our format** — a sheet and `frames.json` from the cartridge, as a
   **new entity beside `goku`** (settled 2026-10-28); the old one is renamed
   and dropped only once the new one has proved itself.
3. **Moves and timings** — the list from step 1
   into `animations.json`, speeds into the states. *Open:* how much of the
   original's numbers to take before `combat.md` takes over.

> **One exchange is complete.** Everything below multiplies it.

## Next: Vanish

Settled 2026-09-26, described in [`combat.md`](./combat.md) §5.

1. **Vanish.** Guard tapped just before a blow lands teleports behind the
   attacker, for ki — from neutral, guard, blockstun and the air, never from a
   reaction or one's own attack. The window is a number of frames, and the
   pure part (was the tap early enough) ships with its tests. *Done when:* a
   recording shows a vanish out of blockstun, and a tap without ki blocks.
   Corner and projectile cases are settled in `combat.md` §5.

## First: what chains into what, derived — never written down

A chain is a **conclusion from `states.json`**, so it is computed, never
maintained by hand: a markdown table of links would be wrong within a day, and
twenty fighters would mean twenty of them.

`npm test` already refuses a link whose arithmetic does not work
(`states.test.ts`). What is missing is the *picture* — how much margin each link
has — which is the instrument for choosing the numbers in the item below, rather
than guessing them and waiting for a recording.

**One derivation, three consumers**, and the boundary matters more than any of
them: the graph is derived by a pure module in `src/combat/`, which the test, the
CLI and later the editor all import. `scripts/chains.ts` only prints.

| consumer | what it shows | when |
|---|---|---|
| **`npm run chains`** | every link: window, start-up, worst case, hitstun at that depth, margin | **done** 2026-08-16 |
| **editor** | the same, as a **graph** — columns by depth, edges labelled with the button and the margin | **done** 2026-08-16, read-only |
| **in-game move list** | rows a player can read — `A → Z → Z`, names and sprites, **never** a frame number and never the word `cancelBy`. Not a graph: players read strings as sequences, and a node-link diagram would be showing them our data model | when a screen exists to put it on — there is no pause menu and no title yet |

**The line that must hold:** a chain never becomes a file. It stays a *view* of
the states, or we have two sources of truth about the same thing. Different
fighters get different chains for free, because the graph comes out of their own
`states.json`.

The CLI, the shared module and the editor's graph all landed 2026-08-16
(`src/combat/chains.ts`, `tools/entity-editor/src/chainGraph.ts`), and
`states.test.ts` asserts on the same numbers both of them show. What is left is
the player's move list — and editing timings from the graph, which the editor
can already do for other sections and which nobody has needed yet.

*Done when:* a string can be tuned from the graph without opening the JSON.

## Then: launch scaling, the last of the three

Damage and hitstun scaling both landed 2026-08-16 (`src/combat/scaling.ts`): a
long combo is worth visibly less than a short one, and a ground loop now ends
because the defender recovers first. **Launch is the one left** — each successive
lift raises less, so the body falls out of a juggle instead of being refused a
hit. Until it exists the relaunch limit does that job alone, which is why it reads
as a wall rather than as a net under the curve.

It hangs off `Combo.lifts`, which already counts re-launches on the defender and
resets when they get control back. No new state should be needed; if the curve
wants some, that is the signal to stop and ask why. The one thing to look at
first is *what* it scales: `launch` is an impulse applied on entering a reaction
(`entity.ts`), not a per-frame velocity like `vel`, so the curve multiplies the
`vy` a state asks for — and whether it should touch `vx` with it is open.

*Done when:* a juggle ends because the body fell out of it rather than because a
blow was refused.

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
not two: `DebugScene` still builds both bodies from a single `EntityDef`, and a
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

**How a scene is chosen is settled** ([ADR 0008](./adr/0008-a-scene-is-what-its-parameters-say.md)): every scene is
built from a small serialisable parameter object, never from what the previous
scene left behind, and the URL supplies it —
`?scene=debug&p1=goku&p2=goku`. An unknown parameter is a loud error, not a
quiet fallback. The line that used to sit here — "convenience presets go in
`package.json`, not into a committed dev-state file" — was overruled on
2026-08-16 and is now the opposite: the debug scene's setups live in a committed
file, because restarting a dev server that has been up for days costs more than
a page reload (same ADR).

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

## Queued: a read-only `npm run check-sheet`

The sheet is hand-edited now, and a drawing session can leave pixels that are
off-palette or partly transparent without anything saying so — 32 of them
survived at the belt of frames 187/188 and were found by half an hour of
throwaway Python. The value is never the fixing: it is being able to ask "did
this session break anything" in ten seconds. Read-only on purpose — an automatic
nearest-colour snap is a guess at that distance, and the 1-bit alpha the palette
work depends on is exactly what a well-meaning fix would round away.

*Done when:* one command reports off-palette pixels and partial alpha per frame,
and changes nothing.

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
- **`/api/sfx` lives in the entity-editor plugin**, like `/api/sheet` — correct
  by precedent, but the plugin's name has stopped describing what it serves.
- **The input buffer** rode along in the same batch and has not been looked at
  since the day it was written.

*Done when:* the diff has been read end to end, the dead weight is gone, and
anything kept on purpose says why — here or in `adr/`.

## G. Crouch, and crouch attacks

Frames settled: 17 is the way down, 18 the held crouch, and the crouching kick
is 52–53 — all built. The standing guard is **28 and nothing else**: 11–13 was
listed here as the standing guard and is in fact Goku exhausted (owner,
2026-08-15), so the guard is a single frame held on contact, which is all it
ever needed to be. **The crouching guard was the sheet's first known gap and is
now closed** — the owner drew 182 rather than taking any of the three ways out
that had been recorded, and it is built and wired (2026-08-22).

Guard has no high/low since 2026-09-26 (`combat.md`, *The buttons*); crouching
only lowers the hurt box. *Open:* whether a low blow needs its own reaction. Frame 76 is a hit to the
stomach, so the sprite exists — the question is whether the fight reads better
with it, or whether high/low is a distinction that costs a reaction per fighter
and buys little.

## The moveset: name what is on the sheet, then build it

**The current attacks are placeholders and will be redone**, so nothing about
their timing, their button, or their 12–16 frame active windows is worth
preserving or retrofitting separately — that work folds into this.

**The button scheme gives the list its shape.** Burst Limit's four — Attack,
Smash, Ki, Guard (`combat.md`, 2026-09-26) — so what we are looking for on the
sheet is a rush string and its smashes in each stance, plus specials, rather
than "some punches and some kicks". Which animation is a punch and which a kick
stays the character's business, not the player's.

**Animations are named for what the pose is** — `punch_hook`, `kick_roundhouse`
— with a number only to separate two that really are alike. A name like
`punch_3` encodes the order we happened to find frames in, which is a fact about
the sheet and not about the blow, and it makes `states.json` unreadable without
a second window open. Stance is part of the identity where it binds the move:
`kick_crouch`, `kick_air`.

**The sheet is fully catalogued** — every frame has a description and every move
a group, in `descriptions.json`, which is where the counts live. What it holds
beyond the normals already built: a kick out of
the background, a ki bolt and two Kamehamehas, a hop-and-lunge jump attack, a
teleport, a throw, a thirteen-frame SSJ3 ultimate, a victory pose, and effect
sets for the beam, an explosion and the Super Saiyan crackle.

**What it does not hold is a labelled rush.** The remaining work is a
judgement call rather than a lookup: deciding which poses make Goku's string and
which his smashes, in each of the three stances — and which of the leftovers
become specials.

Two gaps the catalogue turned up and neither is in `combat.md`: **a throw**
(137–139, and it is the honest answer to blocking costing nothing) and **a turn**
(153 is the only front-facing fighting-form frame, so an animated turn is
possible where today facing flips in one frame).

**Every attack in the new set needs a `cancelBy`** — the field landed 2026-08-16
and only the three chain kicks use it. Without one the cancel window is the whole
animation, which is what silently stopped the medium string being a combo; the
arithmetic is in `combat.md` and a test in `states.test.ts` checks it against the
shipped data.

*Done when:* every place in the rush tree names an animation, and what is
left over is either assigned to a special or explicitly parked.

## Authoring combos in the editor

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

---

## Not yet ordered

Real work, carried over from the checklists this file replaced. It gets slotted
into the sequence above when its turn comes, rather than living in a second
queue.

- **What follows the hit types** (`combat.md`, *Open*): a `stun` type, a hit
  type for ki blasts — the projectile and how it is taken — and whatever
  punishes a string thrown at nothing.
- **Name the rest of the sound test.** The capture is cut into clips of which
  only a handful are identified — `data/audio/sound-test.json` says which — so
  the swings, the hit, the block, the jump, the landing, the crash to the floor
  and Goku's own grunt are real samples;
  `data/audio/sound-test.json` holds a `?` for every clip nobody has listened to
  yet. One known gap behind that: `hit_heavy` borrows the light
  hit's sample until a heavier one is named. Nothing here needs code — a clip
  number in `sounds.json` is the whole change.
- **The rest of what spends ki.** The ki blast pays for itself as of
  2026-08-24 (`cost` on the state, checked before the transition fires), so the
  machinery is there and used. Vanish and the fast dash are the two that still
  do not exist.
- **What the kamehameha is still missing.** The move fires and hurts as of
  2026-08-25; what is absent is everything between the hands and the bolt.
  Two pieces, in this order:
  1. **A spawn that lives as long as its state.** The charge sphere and the
     muzzle flash (frames 132-133) have to appear on entering a state and be
     taken away when it is left — today an effect plays its animation out and
     nothing can end it early. This is the `attachment` ADR 0007 named.
     The sphere is generated (`npm run fx`) and is the one effect allowed real
     alpha rather than dither: the original's is colour-math transparency, and
     a 100 px dithered ball reads as confetti.
  2. **The beam.** A band from the hands to the bolt's head, so its length
     changes every frame. Tiled from a one-column sprite, never a stretched
     one — a stretched pixel stops being square. It needs the owner's position
     each frame, which is the thing ADR 0014 refused a bolt; that ADR gets
     superseded rather than edited when this lands.
- **A KO.** Health floors at zero and nothing happens there — no defeat state,
  no round. `Entity.defeated` is there and unused. Round rules belong to Stage 3
  in `roadmap.md`.
- **Walk speeds out of `states.json`** and into attributes, with the rest of the
  tunable numbers.
- **Chip damage and a guard break.** Blocking exists and costs nothing, which is
  right while every attack is a normal; specials should chip, and holding guard
  forever should eventually fail. Both wait for specials.
- **The rest of the motions.** Recognition itself landed 2026-08-23
  (`input/motion.ts`, trigger `motion:<name>`) and `qcf` is wired to a normal to
  prove it. What is left is the other shapes and, with them, the leniency
  questions each one asks — a dragon punch that also accepts a quarter circle is
  a different game from one that does not. `MOTIONS` says which exist.
- **A remapping screen.** All four attack buttons are wired to the ZSNES
  defaults; nothing lets a player change them.
- **A camera**, and a stage. Round rules and a second player belong to Stage 3
  in `roadmap.md`.
