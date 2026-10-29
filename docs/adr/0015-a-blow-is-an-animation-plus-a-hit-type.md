# 0015 — A blow is an animation plus a hit type

**Status:** accepted 2026-09-29 · replaces the per-strength table that stood in
`combat.md` from 2026-08-16 · `damage` superseded 2026-10-29 by 0019

A blow is authored as **which animation** plus **which hit type**. The type —
`data/hit-types.json`, one table for every fighter — decides the reaction and
every number that goes with it: `onHit`, `damage`, `hitstun`, `hitstop`,
`relaunch`. A state says `"type"` and sets none of those itself; the validator
refuses both an unknown type and a number beside one. What two blows of one type
may differ in stays on the state: `cancelBy`, the sounds, the spark.

`states.json` keeps the short form and is spelled out where it is read
(`withHitTypes` in `combat/hitTypes.ts`): the engine, the validator, `npm run
chains` and the editor's graph. The shape is the state's own, so nothing
downstream learned a new field.

**Rejected:**

- **A state overriding one of its type's numbers.** It is per-blow tuning back
  under another name; a blow that needs other numbers is another type.
- **The type as a property of the animation.** One pose serves several blows —
  `kick_high` holds the opponent inside the rush and throws them at its end.
- **A type or a blow overriding the animation's timing.** Two places would
  decide how long a blow lasts. An animation plays through; a pose held longer
  is a second animation on the same sprites, named for how it differs
  (`kick_high_hold`), never for its role.
- **Spelling types out in the dev server's `/api/entity`.** The editor saves
  what it loaded, and would write the long form back to disk.
- **The strength table in `combat.md`** (light / medium / heavy rows). It agreed
  with `states.json` only because people were careful; the numbers now live in
  data, once.
- **One-letter codes** for the shorthand (`F30`): they collide with the button
  letters, and slam, stagger and stun share an S. **A prefix** (`type_f`) was
  turned down as length. The codes are two lower-case letters (`fl30`).
