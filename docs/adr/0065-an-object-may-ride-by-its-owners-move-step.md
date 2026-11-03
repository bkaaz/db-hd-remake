# 0065 — An object may ride by its owner's move step

**Status:** accepted 2026-11-03; adds to 0048

`follows: { "step": n }` on a spawn's attributes (`src/fx/follow.ts`):
the frame is the owner's step in his move's whole script less n — the
steps of the move's earlier parts (`m3e`, `m3e_2` …) counted in
(`moveStep`) — and it is gone once his animation is no part of the move it
went out in. Goku's hair in his winning pose, `0/07` (`$0F:B8CD`: his
`$46` − 3, killed when his `$40` is not `3e`). The spawn is put on its step
(`SpawnDef.onStep`), so it cuts no part.

**Rejected:**

- **Riding by drawing, as `"pose"` does** — here the drawings happen to
  follow the steps one to one; the code reads the step.
- **Gone with the animation it went out in** — the move's last part loops
  after a frame jump, and the original keeps the hair through it.
