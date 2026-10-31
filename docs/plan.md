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

## Now: reading the cartridge by script

The owner, 2026-10-30: more than any one move, the tools — every structure
or routine read by hand becomes a reader in `src/rom/` with ROM-gated
tests, shown by `npm run rom -- port`, so the next move and the next
character are a script run, not disassembly read again. A question the
code can answer is never asked. The moves already verified against the
emulator (the Kamehameha, the knockdown, charging, Quadruple Kick, the ki
blast) are each reader's test; the throw (`9d`, `rom.md`) is the exam:
built from the report alone.

**What `rom.md` holds, and who reads it** (inventory, 2026-10-30):

| fact | read by |
|---|---|
| scripts' steps, sounds, lines, spawns and their counters, offsets, flips, effects (`b1`), `c0`, `90`, the opponent's track (`80`) | `script.ts`, the export |
| boxes, drawings, tiles, palettes, resources | `collision.ts`, `frame.ts`, `resource.ts` |
| a blow's record, an object's record | `hits.ts` |
| a handler's frames (pinned or bounded), speeds, re-arms, sounds, moves set, by-step jumps, the spawn counter; a routine's arguments in A and Y and its answer in the carry; shared code by character | `handler.ts`, `flow.ts`, `routines.ts` |
| a command's directions and button; the close lines | `commands.ts`, `buttons.ts` |
| stages, arenas, the HUD, lightings, sound samples | `stage.ts`, `arena.ts`, `hud.ts`, `brr.ts` |
| a command's conditions, cost and the opponent's move (bytes 0–3, 6) | `conditions.ts`, `commands.ts` |
| what the throw's launch and holding the opponent do | **by hand** |
| an object type's timing, life, speed, what it becomes on a hit, burning, copies | **by hand** (`objects` in `cartridge.ts`) |
| a fighter's attributes (defence, walk, jump, gravity) | **by hand** (`attributes.json`) |
| knockback by reaction (`$0D:D68A`), which reaction (`$0D:D29C`) | **partly** (`hits.ts` names the reaction) |
| the roster: which entry is which fighter, his tables | `roster.ts` |
| the sound driver, HDMA, the camera, the shake, burning's palettes | recordings or one-off — stays prose |

The roster is read (`src/rom/roster.ts`, `npm run rom -- roster`; any
reading command takes `--fighter <name>`). The readers left, in order —
each a slice, each shown in `port`:

1. **Handler calls with their arguments** — `ROUTINES` (`routines.ts`)
   grows an argument reader per routine; `port aa`, `1b` and `0c` read
   already. *Done when:* `port 9d` gives the launch (`$0F:B321`: damage,
   stun, vx, vy) and the hold (`$0D:DE9A` with `$20:82A5`) — what `rom.md`
   says of each.
2. **Object types** — timing, life, speed, on-hit, copies, read from the
   type's code by its usual patterns. *Done when:* the export writes the
   Kamehameha's and the ki blast's spawns without the hand-written
   `objects` in `cartridge.ts`.
3. **Attributes and knockback** — the export writes `attributes.json`'s
   numbers and the reactions' knockback. *Done when:* Goku's equal today's.
4. **The throw from the report alone** — the exam.

## Now: Goku from the cartridge

Everything below waits while this runs — the owner paused combat work on
2026-10-28 to try it. Why and how: [ADR 0016](./adr/0016-the-original-is-read-from-the-cartridge.md);
what is known so far: [`rom.md`](./rom.md). The tile format is done
(`src/rom/decompress.ts`), and so is every drawing: `npm run rom -- frames`.
The owner prefers static analysis to recordings (2026-10-28): `npm run dis`
reads the code, the emulator only confirms.

A move id gives its drawings and how long each is held, statically:
`npm run rom -- move 92`.

The hand-built fighter is `goku_old` now (`?p1=goku_old`); `goku` is the
cartridge's — drawings, animations and boxes written by `npm run rom -- export`,
states by hand after the original's moves — and plays by default. `goku_old`
stays: what we built that the original lacks will be brought over later.

Every move is an animation now, `m00`…`mff` (ADR 0017), written by the export.

`goku` plays (owner, 2026-10-29): walk, crouch and stand up, three jumps,
dash, four blows, guard, reactions, and the ki blast as a spawn (ADR 0018).
Its states are by hand in `data/entities/goku/states.json`; the original's
buttons are A S D X + C (`combat.md`, The buttons).

### First: porting a move without help

The goal (owner, 2026-10-29): Claude ports a whole move from the cartridge
— poses, blows, sounds, movement, input — on its own, faithfully; changing
how the fight plays comes after. Quadruple Kick showed where porting still
takes an investigation instead of a procedure. In this order:

1. **Objects without a recording** — an object's timing is in its type's
   code (`rom.md`); the Kamehameha's were read from it by hand and written
   into `objects.spawns` with the addresses. What is left: a reader like
   `handler.ts` for the usual animator, so the port report says it.
2. **Motions from the command table** — every sequence `rom.md` lists, as
   data, with the original's window: each direction within 12 frames of the
   next (`$6002`). `input/motion.ts` has the shapes in code and 14 frames
   for the whole motion, which a half circle barely fits.
3. **The original's reactions** — light, heavy and the knockdown are
   built; in the air (`1a`), crouching (`17`/`18`), dizzy (`1d`), and the
   choice between them as `$0D:D29C` makes it. The reactions brought from
   goku_old (`hurt_air`, `launched`, `blown` …) still land straight into
   `downed`.
4. **Which clip is which id** — now compared, not assumed: the chip's
   samples against our clips (`npm run samples`, `rom.md`, The sounds).
   `06` / `07` were one clip off and `09`'s clip is likely `008`; put the
   bank right, then compare what the first recording did not play — `30`
   for player one, `31` (KO), `0b`, the specials' own (`25`, `29`, `2d`,
   `38`…) — by recording them with `log-dsp.lua`. A jump plays nothing
   found so far.

### Next: around the arena

The camera, its shake and arena 0 are the original's (`rom.md`, The
camera); every size one value to change, not a hunt (owner, 2026-10-30) —
the game's screen and its scale are `src/view.ts` (ADR 0029), the camera
and its shake `src/camera/` (ADR 0030), arenas `src/arena/` (ADR 0031). *Open:* whether its 64-px push
band grows with a wider screen — decided when the screen is widened.

1. **The charge's glow** — the original swaps the fighter's palette for
   its own + 8 while charging (`rom.md`, Charging ki refills health): a
   variant sheet per lighting, as the lightings are (ADR 0026). The red
   bars below the HUD's band are not read either.
2. **A shove into the screen's edge passes to the attacker**, reversed, for
   the frames it had left (`rom.md`, The camera) — `combat.md` §6, the
   corner, decides whether it replaces what we have.
3. **Our tools around the game's screen** (owner, 2026-10-30) — the
   debug scene's panel, status line and notices laid out in the space
   around the scaled screen, and a picker there for the arena and the
   fighters: a choice rewrites the query string, which rebuilds the scene
   from its parameters (ADR 0008).
4. **Where the original starts a round** — the fighters' x and the
   camera's (`$0D:D7A0`, `$01:8B84`), read from the code. Ours start at
   35% / 65% of the world under a centred camera, which puts both in the
   push band, so the first step scrolls.

### Next: the Kamehameha, as the original's

The owner's test of the porting (2026-10-29): the **charged** one, `aa`
(↓ ↙ → + A) — the ball grows in the hands while A is held, and the beam's
size depends on how long. The one flying up (`ab`) waits. What the
cartridge does is in `rom.md` (`b0`'s counter, `b1`'s drawn effects):

Built: the charge, the ball, the three beams with their base and band
(ADR 0025), the explosion each head becomes, the pose held after it, the
base's way in and out, the band thinning away, the victim's fire (ADR 0027)
and Goku's line. What
still differs from the original:

- the charge fires as it decides; the original shows two more frames of
  the charging pose first (`$44` set to 42);
- the beam ends with the move in the original ($0F:E5FC), long after it has
  left the screen; with no stage or camera that showed it vanishing in mid
  air, so Goku holds the firing pose (`holdStep`) until the head hits or
  leaves the field (owner, 2026-10-29), and the recovery after it (8 frames
  of drawing `00`) is skipped;
- the white screen whitens an arena as the original does, not the debug
  grid (`Backdrop.whitens`); a player setting for its strength is worth
  considering (owner, 2026-10-29);
- the thrower's own palette changes every 4 frames while the beam is out
  (`log-palettes.lua`); the victim's fire and the white screen are built
  (ADR 0027);
- a big explosion that knocks its victim down sets the game's `$37` to `16`
  (`rom.md`) — what that does is not read.

### Then: the rest of Goku

1. **The rest of the buttons** — crouching Y / B (`m94`, `m95`) and the
   jump attacks (`m96`–`m99`) are not states of `goku` yet
   (`src/rom/buttons.ts`); their hit data is in the table already.
2. **The rest of the specials** — every move of Goku's command table
   (`rom.md`, The buttons); Quadruple Kick is built.
3. **The dash's recovery** — `0d` after the release (`m0a`'s third step), cut
   off today by the held-step rule in `src/rom/animation.ts`.
4. **The rest of the objects** — `goku_hair` is exported but nothing plays
   it: there is no pre-fight screen, and `fires` only takes a projectile.
   Moves cut at a spawn lose their loop (dizzy, `m26`–`m3a`).
5. **Player two's colours in a mirror match** — the same fighter on both
   sides takes the next palette (`rom.md`, A stage id); today both Gokus
   look alike.

*Open:* idle holds each pose 12 frames in its script but 13–14 in a
recording; which moves repeat or hold is listed by hand in
`src/rom/animation.ts` rather than read from the move handlers.

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
- **One set of hit types.** `light` and `heavy` are the original's two
  reactions, added beside our five rather than mapped onto them (owner,
  2026-10-29); decide which survive once `goku` plays more than three blows.
- **The original's stun and chip** (owner, 2026-10-29: later). Every blow
  carries a stun value that empties a gauge into a dizzy, and some chip on
  guard (`rom.md`, Hit data).
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
- **Round rules and a second player** belong to Stage 3 in `roadmap.md`.
