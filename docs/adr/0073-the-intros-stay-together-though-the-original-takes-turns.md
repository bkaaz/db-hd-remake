# 0073 — The intros stay together, though the original takes turns

**Status:** accepted 2026-11-04; corrects ADR 0067's reason, not its decision

ADR 0067 kept both intros at once because the original gives both `3c` on one
frame (`$02:A242`). That frame is true and the reason is not: the scene holds
each on frame 0 and runs him in turn (`logs/fight-7.txt`, `rom.md`). Both at once
stands all the same, by the owner's word: on the arena there is no screen coming
in to fill the waiting.

**Rejected, both tried in the game:**

- **One after the other, the original's 33 frames apart** — the one who waits
  stands in idle for no reason.
- **110 frames before the first** — the original's screen coming in, which the
  arena has not; it read as a fault.
