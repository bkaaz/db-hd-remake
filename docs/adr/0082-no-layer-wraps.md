# 0082 — No layer wraps

**Status:** accepted 2026-11-07 · supersedes the wrapping in 0081

The only layers that outran their picture were the silhouettes at double speed,
and the owner left those out of all three arenas that have them (`combat.md`).
What is left never scrolls past its picture at the original's screen size, so
`ArenaBackdrop` is one sprite a layer again. A layer in `leftOut` is named in
`src/rom/arena.ts`, so the test still holds it to the whole stage.

**Rejected:**

- **Keeping the wrap for an arena still to come.** The flying arenas are not
  read, and a second sprite per layer is code nothing would run.
