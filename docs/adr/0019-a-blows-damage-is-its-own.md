# 0019 — A blow's damage is its own, not its type's

**Status:** accepted 2026-10-29 · supersedes the part of 0015 that put
`damage` in the hit type; the rest of 0015 stands

`damage` is no longer a field of a hit type. Every state that names a `type`
sets its own `damage`, and the validator refuses one that does not — there is
no default for a typed blow to fall back on. The type still decides, alone,
how the blow is taken: `onHit`, `hitstun`, `hitstop`, `relaunch`.

The cartridge forced it: the original's damage is per blow (`rom.md`, Hit
data), while its reaction is one of a few kinds shared by every blow. A hit
type is that kind.

The overview the type table gave for free is `npm run blows`: every blow of
one entity in one table, its type spelled out beside its damage.

**Rejected:**

- **A type's damage as a default a blow may override.** Two places for one
  number — the question "where does this blow's damage come from" would need
  both files to answer.
- **A type per distinct blow** (one per record of the cartridge's table). Keeps
  0015 whole, but the table grows with every fighter and a type stops naming
  a kind of reaction.
- **One damage per type** (an average of the original's). Simple, and no
  longer the original.
