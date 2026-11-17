# 0014 — A spawn is an Entity, told only its target

**Status:** accepted 2026-11-17 · consolidates 0007, 0014, 0025, 0048, 0054,
0056, 0062, 0065, 0078, 0079 and 0080 (2026-08-14 – 2026-11-07), which it replaces

Everything a state brings into the world — a spark, a ki blast, a beam's head,
the hair of a win — is an **`Entity`**, so the loader, animations, boxes and the
validator need nothing new, and a spawn with a hit box lands its blow through
the same `landBlow()` as a fighter. A **bolt** (it hits) is built with a
position, a facing and one `foe`, and its blow is written on its own states. An
**effect** (it never hits) rides its owner by `follows`. What either does every
frame is read from its object's code, not guessed from a recording. Its fields
are declared in `src/entity/states.ts` and `src/fx/follow.ts`; how it plays:
`combat.md`.

**Rejected:**

- **`effect`, `attachment` and `projectile` as three types.** A thing that grows
  and strikes without moving is a lie under any of them.
- **A bolt holding its owner** — it could then ask about him, and the next feature
  grows along that back-reference. It is told how far its head has flown, and only
  for a beam's band.
- **A bolt's blow kept on the throw** — splits one blow across two files.
- **Hitstop sparing bolts** — a shot travelling through the pause advertises it.
- **A bolt ending with its thrower's state** — a move is cut into several states
  and the cartridge tests the move's ids.
- **A general "becomes another object when…"** — a second state machine; each
  case is one field.
- **One mechanism for bolts and effects** — every spark would be a projectile.
