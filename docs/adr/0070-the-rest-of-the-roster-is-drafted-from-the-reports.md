# 0070 — The rest of the roster is drafted from the reports

**Status:** accepted 2026-11-04; extends [0038](./0038-a-fighters-own-specials-are-merged-into-the-template.md) and [0036](./0036-an-objects-look-and-timing-come-from-a-recording.md)

`npm run rom -- draft --fighter <name>` writes a first `specials.json` from what
`port` reports: a state per part, its blow, speeds and jumps, its cost and its
entries, a move another's blow leads to asked for from that move, and his own
normals in the template's place (`src/rom/draft.ts`). Move names are the FAQ's
(`moveNames.ts`). After that the file is by hand, as ADR 0038 has it; `--force`
writes it again. What a handler decides is left out, and said in
`docs/port-review.md`.

An object with no recording is drafted too, in `objects.json` beside it
(`draftObjects.ts`): its table's frames, 4 frames each, the first palette its
handler or code loads. A recording replaces it, through `OWN_OBJECTS`.

**Rejected:**

- **Reading every move of seven fighters by hand first** — Gohan's cost a whole
  session, and the owner tries every move afterwards anyway.
- **Waiting for a recording per fighter** — a move with a guessed object can be
  tried now; one with none cannot.
- **Keeping the draft as a generated file** — then a correction would need a
  place of its own, which is what `specials.json` already is.
