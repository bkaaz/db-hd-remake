# 0038 — A fighter's states are generated: the common states, his overrides and specials

**Status:** accepted 2026-11-17 · consolidates 0038, 0051, 0060, 0069 and 0070
(2026-10-31 – 2026-11-04), which it replaces · 2026-11-24: the common states
are a file of their own, Goku is generated like the rest, and the cartridge
no longer writes any of it; the command entries go ahead of a special asked
for by a press

Every fighter's `states.json`, Goku's too, is written whole by `npm run
states` from our files alone (`src/rom/compose.ts`): the common states
(`data/template/states.json`) on his animations, his `overrides.json` laid on
them — where his common states differ, field by field — and his
`specials.json` merged in: his specials, and the common states he plays
differently, named in `replaces` with a fingerprint of the common state his
copy was last checked against — a change to it that passes his copy by is
named by `npm run states` and fails a test until accepted. All of it is by
hand. A state's command entries stand in the order of his `commands.json`, its
last row first, as the cartridge tries them (`inTableOrder`), ahead of every
transition that asks for a button, a special asked for by a press among them.
`compose.test.ts` fails while a file is out of date.

The cartridge is a report: `npm run rom -- states` prints where its numbers
differ from ours and writes nothing. The overrides were written once from what
it laid on at the end of the port (git tag `port-end`); `draft` still gives a
new fighter's first `specials.json`.

A new mechanic comes in through data and is off without it, so the port's
rules stay playable as they stand.

**Rejected:**

- **Inheritance at run time** (MUGEN's `common1`) — no file shows a state whole, to
  the game, the editor or a log.
- **Goku's own file as the template** — no change could be his alone, and his
  specials stood among the states everyone shares.
- **The cartridge's numbers laid on at every run** — a number changed on purpose
  was put back, and a test failed for it.
- **Carrying over what the template did not make** from the old `states.json` —
  the file would be the generator's input and output, and a deleted special
  comes back.
- **An override replacing a whole state** — a change to the common state would
  pass him by; `replaces` is for a state he plays differently, and says so.
- **The common state's whole text kept beside each copy** — 58 states nobody
  edits, to show what git already does (`git log -p`).
- **Any special overriding a common state of its name** — a typo would silently
  drop a common state; `replaces` says so on purpose.
- **The engine sorting command entries as it loads** — the file would say one
  order and the game play another.
- **Keeping two sets of rules alive** — every engine change would have to hold in
  both.
