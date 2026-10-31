# 0036 — An object's look and timing come from a recording

**Status:** accepted 2026-10-31 · narrows ADR 0022 for objects: their logic
is still read from the code first

What an object shows — its frames, how long each is held, whether it
loops, how far it goes, what it turns into on a hit, which tiles and which
palette it is drawn from — is read off **one long recording per fighter**
(`tools/re/record-objects.lua`, in training: every attack that puts one out,
into the air and into the opponent), and turned into spawns by a script.
What the code is still read for: which move puts out which object and when
(the script's `b0`, its counter), what it costs, what the handler decides
(`npm run rom -- port`, `code`). The list of what to record comes from the
cartridge (`npm run rom -- spawns`).

**Rejected:**

- **Every object's timing from its code** (`objectCode.ts`) — the code
  reader reads the usual patterns (a timer and a step count, a flip on the
  game's frame count) but not a table of step lengths (`$0F:E2A9`), a frame
  taken from `$74 & 4`, or uneven steps; each is its own pattern, and some
  would stay hand-written anyway.
- **Hand-written `objects` in `cartridge.ts` per fighter** — what Goku has;
  each took snapshots matched by eye.
- **A recording per attack** — ten sessions for one fighter; one session,
  with a snapshot taken the first time each object frame is on screen,
  holds all of it.
