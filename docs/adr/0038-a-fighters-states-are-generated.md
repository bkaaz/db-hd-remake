# 0038 — A fighter's states are generated: the template and his own specials

**Status:** accepted 2026-11-17 · consolidates 0038, 0051, 0060, 0069 and 0070
(2026-10-31 – 2026-11-04), which it replaces

Every fighter but Goku has a `states.json` written whole by `npm run rom --
states`: Goku's states as the template (`src/rom/template.ts`) with Goku's
specials dropped, and his own `specials.json` merged in — his specials, and the
template states he plays differently, named in `replaces`. A first
`specials.json` is drafted from the cartridge's reports (`npm run rom -- draft`)
and is by hand after that. A state's command entries stand in the order of his
command table, its last row first, as the cartridge tries them (`inTableOrder`).
`fighterStates.test.ts` fails while a generated file is out of date.

**After the port, before the first change of mechanics** (`plan.md`, the common
part): the template becomes a file of its own and Goku is generated like the
rest; rules of the game leave the fighters' attributes; the generator stops
overwriting what the design then owns. A new mechanic comes in through data and
is off without it, so the port's rules stay playable as they stand.

**Rejected:**

- **Inheritance at run time** (MUGEN's `common1`) — no file shows a state whole, to
  the game, the editor or a log.
- **Carrying over what the template did not make** from the old `states.json` —
  the file would be the generator's input and output, and a deleted special
  comes back.
- **Any special overriding a template state of its name** — a typo would silently
  drop a template state; `replaces` says so on purpose.
- **The engine sorting command entries as it loads** — the file would say one
  order and the game play another.
- **Keeping two sets of rules alive** — every engine change would have to hold in
  both.
