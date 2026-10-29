---
name: port-move
description: Port a move of the cartridge's goku into states — a normal, a special, a multi-hit blow — faithfully, from the ROM. Use when the owner asks to bring over a move from the original (by name, by input, or by move id), or to check a ported move against the original.
---

# Porting a move from the cartridge

Faithful first, changed later (owner, 2026-10-29): copy what the cartridge
says, guess nothing, and say where it is silent. `goku` has our combo rules
off (`comboLimits: false`) so his numbers can be compared with the original.

## 1. Find the move

`docs/rom.md`, The buttons, lists every move a button or a command picks.
Not there? Ask the owner — never pick a move id by its poses alone.

## 2. Read its report

```bash
npm run rom -- port a5
```

It gives, per **part** of the move's animation (`ma5`, `ma5_2`, … — one per
blow, ADR 0023; one per spawn, ADR 0018): the blow's frame, hit type, damage
and stun; the speed the handler sets (`vel`, `velAt`); the sounds and spawns
with their frames; where the handler re-arms the blow. Frames count from the
part's start, as a state's do. The input is the command table's.

If the animation parts are missing, `npm run rom -- export` first.

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
