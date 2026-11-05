# 0075 — A fighter is checked move by move against the original

Status: accepted 2026-11-05 (the owner away, asked to check the roster alone). Extends ADR 0074.

`npm run moves -- <fighter>` plays every command, the four buttons (close, near, far,
crouching, in the air), the jumps, the dash and the charge from one pad in both games, against a
standing Goku, and reports what differs: moves in order, frames, how far each went. `src/rom/moveCheck.ts`.

He is player one in Mesen, because practice's player two reads no pad, and two in ours, because only two
has a timeline; a round opens the same way round the middle, so x is mirrored. A frame on which nothing
moved is the SA-1's slowdown, left out of the count, and the timeline waits on it.

**Rejected:** comparing frame for frame (a part cut differently, a slowdown and a blow a pixel away would
all read as differences); keeping a state per pairing by hand (the first run keeps `raw/states/fight-<fighter>.mss`);
a fight in ours driven by keys (seconds of latency, CLAUDE.md).
