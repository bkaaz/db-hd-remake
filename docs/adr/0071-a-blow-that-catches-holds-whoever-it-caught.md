# 0071 — A blow that catches holds whoever it caught

**Status:** accepted 2026-11-04

Bukuuh Kyaku (`a8` → `a9`, `rom.md`) is the first hold that follows a blow
rather than a grab condition. Its state is a `grab` with `caught: true`: taken
as the state begins, in any state of the defender and in the air, held where he
is. `a9`'s table names a drawing per step, one list for a body on the floor and
one off it, so `heldAnims` writes `m30_gohan_a9` and `m30_gohan_a9_air`
(`held.ts`, `STEP_HOLDS`). The way in is the transition `connected`, behind a new
trigger `blocked`, which `Swing` keeps. `1a` entered at 21 is the state field
`startsAt`.

The attacker's hit pause comes a frame into the state he leaves for, hit or
block, as a recording of the original shows: the blow says `catches`. The throw
of `a9` plays nothing, so its launch says `quiet`.

The blow keeps a type of ours (`light`) though the cartridge's reaction has none:
the hold takes him before it shows. `hits.test.ts` compares its damage alone.

**Rejected:**

- **`throwable` widened to every state** — it is what `grab:N` and the throws of
  the ground ask; a caught body is a fact about the blow.
- **Cutting `m1a` at 21** — `reel_air` plays it whole, in every fighter.
- **A hit type `other` in `data/hit-types.json`** — `draft` takes a known type as
  a blow to write, and the seven drafted fighters' unread reactions would become
  a blow of no meaning at their next draft.
- **The hold across `ma9` and `ma9_2`** — that cut was a jump of `1a`'s, not
  `a9`'s (`ownJumps`).
