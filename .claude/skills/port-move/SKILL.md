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
code of his own and so are still to read.

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
`goku_ki` does. If the animation parts are missing, `npm run rom -- export`
first.

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
- the entry from `idle`, `walk_fwd`, `walk_back` (and wherever else the
  original allows it): a command is `["motion:…", "pressed:…"]`, placed
  before the plain press of the same button. A motion `input/motion.ts`
  lacks gets added there with a test.
- no swing `sound`: the export put the script's sounds on the animation's
  steps (`sfx`), and they play through the bank's `rom` matches. An id the
  report lists that no bank entry matches plays nothing — say which, never
  match one by clip number (`rom.md`). A state's `sound` is only for what
  no script plays (a jump, a landing).

## 4. Check

`npm test` — `src/rom/hits.test.ts` and `port.test.ts` hold goku's states
to the cartridge. Then `npm run blows -- goku`. Hand the owner one concrete
thing to try, and a recording (`L`) for anything about behaviour.

## What the report cannot tell yet

Which clip most cartridge sound ids are, the
original's reactions beyond light / heavy / down, a command's conditions.
All are in `docs/plan.md`, "First: porting a move without help" — say which
one a move ran into.
