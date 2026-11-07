---
name: port-move
description: Port a move of the cartridge's goku into states — a normal, a special, a multi-hit blow — faithfully, from the ROM. Use when the owner asks to bring over a move from the original (by name, by input, or by move id), or to check a ported move against the original.
---

# Porting a move from the cartridge

Faithful first, changed later (owner, 2026-10-29): copy what the cartridge
says, guess nothing, and say where it is silent. `goku` has our combo rules
off (`comboLimits: false`) so his numbers can be compared with the original.

## 0. Another fighter: what is left to read

`npm run rom -- todo --fighter <name>` — a move on code goku's states
already play is read (the states template copies it, his numbers by
script); the rest are listed by handler, one reading each, the ones the
whole roster runs first. `states --fighter <name>` says which copies run
code of his own and so are still to read. His own specials go into
`data/entities/<name>/specials.json`, never `states.json`: `states`
rewrites that whole and merges them in (ADR 0038).
After changing Goku's `states.json`, `states --all` brings every generated
fighter up to date; `fighterStates.test.ts` fails until it is run.

## A fighter's first draft

`npm run rom -- export --fighter <name>`, `commands`, then `draft --fighter
<name>` (ADR 0070) and `export` again for its objects, then `states`. His names
go in `src/rom/moveNames.ts` first. What the draft left out is printed one line
a move: it goes into `docs/port-review.md`. Correct `specials.json` by hand from
there, never `--force` once it has been corrected.

## How a fighter is ported: in batches (owner, 2026-11-02)

The owner's review is the slow part, so a fighter goes over in **batches**,
not one move per round: port everything the engine can already play, as
well as the cartridge says, errors and all; the owner tests and says what
to fix.

- **Stop only at a new mechanism** — a hit type, a reaction, a kind of
  transition or field the engine lacks — and at an object (its look and
  timing need a Mesen recording). Defer those; list them at the end.
- **One line per move** in the hand-back: what the script computed, what
  was guessed (`?`). It is what makes a large diff reviewable.
- **The dummy plays the batch.** Debug **mode 5** (`data/debug.json`) is
  Claude's: overwrite it with a timeline of the batch's inputs; never add
  modes. Mode 4 is the owner's: the dummy always blocks, never overwritten. The owner opens `?scene=debug&mode=5&p2=<fighter>`, presses `T`
  and records (`L`); `logs/session.log` is read for all moves at once.
- One commit per batch, on the owner's word.

## 1. Find the move

`docs/rom.md`, The buttons, lists every move a button or a command picks.
Not there? Ask the owner — never pick a move id by its poses alone.

## 2. Read its report

```bash
npm run rom -- port a5
```

It gives, per **part** of the move's animation (`ma5`, `ma5_2`, … — one per
blow, ADR 0023; one per spawn, ADR 0018; one per step a by-step handler
jumps to, ADR 0028): the blow's frame, hit type, damage and stun; the speed
the handler sets (`vel`, `velAt`); the sounds and spawns with their frames;
where the handler re-arms the blow; and, for a handler that runs by step,
what it does on each (`handler on step N`). What the handler does on no one
frame comes first, as `handler:` lines, under what it waits on — "from
frame 52", "when its object 0a/15 is gone", "while B + Y held", "every 8th
frame of the game". A test on a field nobody has named is said plainly
("when field f0 is 0"): find what writes the field, and name it in
`FIGHTER_FIELDS` once it is known. What the handler does to the other
fighter reads "the opponent …" — its voice, its turns, the throw's launch
with its numbers — and a hold (`$0D:DE9A`) prints where the opponent is
held, for every character it can be. Frames count from the part's start, as a state's do. The
input is the command table's.

A spawn's line carries its object's own blow (`$3D:9624`): the projectile's
states (`data/spawns/<name>/states.json`) take that type and damage, as
`ki_blast` does. If the animation parts are missing, `npm run rom -- export`
first.

## An object (a shot, a beam, an explosion): where each part comes from

- **What puts it out, when, what it costs** — the code: `port` (the `b0`
  spawns, their counters, the handler's choice of counter).
- **Its tiles and palette** — the code too: the move's handler loads the
  tiles (`$01:84B3`, in `port` as "loads resource 4f at $6c00" — P1
  `$6C00`, P2 `$7C00`); the object's own code loads its palette record
  (`$01:84EF`, a run stepped every 4 frames — `rom.md`). Not the
  resource's record palette: that matched once by chance.
- **Tile base 0 and no load**: the object draws from its thrower's own
  sprite — the whole tile set of the drawing up as it is put out, which
  holds tiles his drawing never shows (Vegeta's sprays). `objectTiles.ts`
  does it; any other base with no load counts on an earlier move's load,
  which only `OwnObject.loads` can say.
- **Its speed** — `b0`'s vx / vy (`npm run rom -- move`, `port`).
- **Its frames, how long each, loop, what it becomes** — read its code
  first: `npm run rom -- code <type> <anim>` names a frame table
  (`OwnObject.ticks`, `loop` if it wraps — then no recording is needed);
  a counter that wraps (`INC $02,X / CMP #n`) is `animations`, frames 0 to
  n − 1 — never the frames a recording happened to show (Final Flash's
  head lost one that way): a life that hit something is cut short, and one
  under slowdown is stretched. `code` prints how a frame is worked out: `$74`
  is the game's frame count, a long address a table to read, whose end the
  timer's `CMP` says (Freeza's `6/14` has four frames in it, gone after three).
  `dur` may be a list, one a frame, for a table of times;
  "becomes 0a/02" where its slot is rewritten (a floor test: `burstsAbove`).
  What it does on a hit comes from `objectHit` (`rom.md`), never a default: most
  standing objects stay and leave a melee spark. Only
  what the code will not give: a recording, one long session per fighter
  (`tools/re/record-objects.lua`, the list from `npm run rom -- spawns`),
  read back with `npm run rom -- objects`. `npm run moves -- <fighter> --objects`
  makes that recording, and `npm run rom -- recorded --fighter <name>` writes the
  palettes it shows into `objects.json`. Its `--frames` also takes the frames from
  the recording: only for an object whose code gave none.
- **A shared object** (type `a`: ki blast, explosions, dust, Kamehameha) is
  one spawn for everyone, named by what it is (ADR 0037); only its colours
  may be the fighter's.

## Before writing anything: the whole move, as the original plays it

Investigate first, implement after (owner, 2026-10-30) — the Kamehameha
showed every place a move hides behaviour. For each, find the code, or
record it (`tools/re/`) when the code will not give it up; write what you
found in `rom.md` before any state:

1. **Input and conditions** — `port` prints them: the command's input,
   what it `needs` (its conditions in words, `src/rom/conditions.ts`), what
   it `costs` and the move it puts the opponent in (a throw's hold).
2. **The script** — every command: `a0` sounds, **`a1` a spoken line**,
   `b0` spawns **and their counter** (which of several fire), `b1` drawn
   effects (ball, band), `c0`, offsets, flips.
3. **The handler** — speeds by frame, re-arms, **frame jumps** (`$44` set:
   a move that skips ahead when something happens), what it **checks**
   (an object still alive, a button still held) and the levels that gives.
4. **Each object** — its type's code by animation: frames and timing, how
   it moves, how long it lives and what ends it, the band or effect it
   feeds, **what it becomes when it hits** (`$2A:8E31`) or lands, and the
   copies an explosion makes of itself.
5. **The blow** — the move's or the object's record; what the hit sets on
   the defender (**burning**, a palette run, the screen) and **what ends
   it** (landing).
6. **Sounds and voices** — which id each place plays, matched by the code
   that plays it; the defender's voice on a hit.
7. **How it ends** — when the head is gone, when the pose holds, the
   recovery; the base's way in and out.

Then say what you could not find, and ask before guessing it.

## 3. Write the states

One state per part, chained by `animEnd`, the last back to `idle`:

- `anim` — the part; `type` and `damage` — the report's blow. A type the
  report names that `data/hit-types.json` lacks is a new type: stop and ask.
- `vel` / `velAt` — the report's speed, as given.
- the entry from `idle`, `walk_fwd`, `walk_back`, `crouch_down`, `crouch`,
  `stand_up` (`$0F:9EB1`; and wherever else the original allows it): a
  command is `"command:<move>"` — its input is the cartridge's, from
  `commands.json` (`npm run rom -- commands`, ADR 0050). Never a
  `motion:`: those are `goku_old`'s. Then `npm run rom -- entries`: no
  stand, walk or crouch state may be listed (`entries.test.ts` holds it).
  Where an entry goes is not yours to pick: `entries --order` (and
  `states --fighter`) puts the command entries in the cartridge's order,
  the table's last row first (ADR 0060).
- no swing `sound`: the export put the script's sounds on the animation's
  steps (`sfx`), and they play through the bank entry whose `rom` is that
  id — every effect of the original has one, on its file of the sound test
  (`docs/audio-capture.md`). A state's `sound` is only for what no script
  plays (a landing). An object's code may play its own
  (`npm run rom -- code <type> <anim>`: "plays sound 19"): give its state
  that id's bank name. A fighter's voices are `voice_hurt` (`30`),
  `voice_ko` (`31`), `voice_shout` (`32`) and his lines, in his own
  `sounds.json` (`npm run rom -- export`).

**What the engine already has for what handlers do** — reach for these
before asking for a new mechanism:

- a special starts stopped (`$0D:D7A0`): any `command:` entry does it;
- blows pass him by (field `0x96` bit 6) — the export cuts a part where it
  changes, so it is the part's state's `invulnerable`; bodies pass (bit 7,
  `port` prints "bodies pass") — `pushless`;
- a handler's frame jump to a step of its own is a part of its own; a
  script's `f0` hold released by the other body — `holdStep` + `freed`, the
  other's `frees` (ADR 0057);
- a command's own range for a grab-like move (byte 2 bit `20`) — `grab:N`;
  health 80 or less — `health:N`;
- hanging (vy 0 skips gravity, `$0D:CAD4`) — `air` with `gravity: 0`;
- a throw where he lies — `throwsFoe`; a ball thrown at the floor and the
  white — `finale` (ADR 0058), or a seize's (ADR 0046);
- moving at the opponent until close — `rush` (`until` to stop it);
- a move free again from a frame, as its handler calls `$0F:9EB1` (and
  `$0D:F9BD`) — `inputsOf` idle, `only: "buttons"` without the directions
  (ADR 0061; `npm run rom -- entries` counts it);
- a move that waits for a blow, with the list of what gets through — `parry`
  (ADR 0077); `npm run moves -- <f> --parry` plays it, `--held` a button's levels;
- a stay-on-hit object that strikes again — `outlivesHit`, `rehit`; one no pause
  holds — `throughPause`; several by one scene, each out, hovering and home — a
  state each with `launch`, `frames:` and `burstsAtEnd`;
- a held body in the cartridge's palette — a `grab`'s `shocks`; in a drawing of a
  table by fighter — a `seize` step's `draws` and `atBy`;
- an object rewritten on the floor as another that strikes — `landsAs`; a scene a shot opens that does not hold its thrower — a `seize`'s `free` (ADR 0078);
- a run that stops at contact — `stopsOnContact`; a move in the air that lets him go on as he came in — `savesFlight` and `resumesFlight`;
- a light on the floor ahead of him (`b1` kind 4) — `pillar`, and a set of objects with one blow between them — `sharesBlow` (ADR 0079); an object whose frame is its state — states of its own, its airborne ones moved twice a frame if its code calls `$0F:CBE4` and `$0F:E4EB` both (Cell Junior);
- a command's button naming a bolt's place — `fires.atBy`; sparks that keep their place beside a bolt — a `with`'s `around`; a state that gives a handler's sound on a frame — `soundsAt`; a script that goes round with its line said once — `fromTop` and `muted` (ADR 0080);
- an object gone when he leaves his move — `endsWithMove`, `true` or the
  move ids its code tests (ADR 0062).

## 4. Check

`npm test` — `src/rom/hits.test.ts` and `port.test.ts` hold goku's states
to the cartridge. Then `npm run blows -- goku`, and `npm run moves -- <fighter>
--only <move>`, which plays the move in the original and in ours and prints what
differs (ADR 0075). Hand the owner one move to try, the next only after he answers,
and a recording (`L`) for anything about behaviour.

## What the report cannot tell yet

The original's reactions beyond light / heavy / down, a command's
conditions.
All are in `docs/plan.md`, "First: porting a move without help" — say which
one a move ran into.
