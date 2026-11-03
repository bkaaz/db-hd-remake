# 0062 — A bolt ends with its thrower's move, not his state

**Status:** accepted 2026-11-03; supersedes 0054's `endsWithMove` line

`endsWithMove` is `true` or a list of move ids (`src/match/thrownIn.ts`).
`true` keeps the bolt while its thrower plays any part of the move he was
playing as it went out (`mab`, `mab_2` … — the move read off the
animation's name); a list names the moves, Final Flash's head
`["ac", "b5"]`. The cartridge tests the move, two ids each: Energy Field
`ab` / `d2` (`$0F:BB51`), Ground Flare `a9` / `d3` (`$0F:B9C0`), the head
`ac` / `b5` (`$0F:BE66`) — the second of a pair is the move above the
arena, or the hold the move turns into.

**Rejected:**

- **The state, as 0054 had it** — a move cut into parts (ADR 0023) or
  followed by its hold leaves the state while the cartridge keeps the
  object; Final Flash spans three states.
- **A list of states** — the states are ours and get renamed; the move ids
  are the cartridge's.
