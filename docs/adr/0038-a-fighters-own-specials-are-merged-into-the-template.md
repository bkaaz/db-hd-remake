# 0038 — A fighter's own specials are merged into his template states

**Status:** accepted 2026-10-31

Another fighter's `states.json` is written whole by
`npm run rom -- states --fighter <name>`, from Goku's as a template, and the
template's specials are dropped (`src/rom/template.ts`). His own specials
are written by hand in `data/entities/<name>/specials.json` — the states,
and an entry per special naming the states it starts from and its input —
and the same command merges them in (`src/rom/specials.ts`), each entry
ahead of the plain press of its button. `states.json` stays one generated
file with two inputs; a name the template already makes, an entry to an
undefined state or from a state without that press stops the command.
Goku's `states.json` is still his own, by hand.

**Rejected:**

- **Carrying over what the template did not make** from the existing
  `states.json` — the file becomes the generator's input and its output,
  and a deleted special comes back from the old copy.
- **Writing specials straight into `states.json`** — the next run of the
  command wipes them, silently.
