# 0017 — A fighter's animations are the cartridge's moves, one per move, cut into parts

**Status:** accepted 2026-11-17 · consolidates 0017, 0018, 0023, 0028, 0043 and
0045 (2026-10-28 – 2026-11-01), which it replaces · 2026-11-24: the export no
longer owns them — it writes beside, and our files are by hand from the port's
end (tag `port-end`)

`npm run rom -- export` made `frames.json` and `animations.json` whole: one
animation per move id, named `m` + two hex digits (`m92`), its steps the move's
script with its sounds (`sfx`) and boxes. A move is **cut into parts** —
`m9b`, `m9b_2` — wherever a state must begin: where it puts out an object, where
each further blow begins or is re-armed, where its handler jumps to another
step. A move that holds the opponent stays whole, its objects on its steps.
`src/rom/parts.ts` is the one place that cuts. Since the port's end the export
writes them under `logs/rom/data/`, as every reading of the cartridge into
`data/` does: ours are edited by hand and in the editor, and what the export
says is taken over by hand (`diff -r data logs/rom/data`).

**Rejected:**

- **Names for the pose** — nobody knows what most of the 256 moves are; a guessed
  name looks settled. `m92` is the one name RAM, `npm run dis` and `rom.md` share.
- **A hand-kept map from id to name** applied by the exporter — a second source
  for what the ROM identifies.
- **One state per move with `rehit`**, **a field that jumps its frame**, or **damage
  per hit inside a state** — each part has its own record and its own blow, and a
  state names one.
- **A delay on `fires`** instead of a cut — the original's timing in a second place.
- **Cutting by hand in `animations.json`** — derivable from the handler.
- **The export writing over ours after the port** — an animation edited or added
  for a mechanic would be lost.
