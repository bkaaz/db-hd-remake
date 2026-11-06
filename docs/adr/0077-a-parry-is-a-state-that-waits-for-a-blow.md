# 0077 — A parry is a state that waits for a blow

Status: accepted 2026-11-06 (Piccolo's pass; the owner asked for what can be done alone). Extends ADR 0046 and 0075.

Regeneration is the cartridge's parry: two hit boxes touching while the striker's blow is armed turn it on him, unless
his move is on his fighter's list (`$2A:8640`, `$2A:86A0`). A state says so in `parry`, and `match/parry.ts` asks before
any blow is landed; `src/rom/parry.ts` reads the list and a test holds the data to it. `$2A:8692` names one more move,
Vegetto's Galactic Juggle, left as it stands and written in `docs/bugs.md`.

`npm run moves` plays what a parry needs and what a level needs: `--parry` gives the opponent a timeline (a mode's `p1`
now takes `does`, which turns the keyboard off for him), `--held` holds a blast command's button. A timeline's `free` runs
through a hit pause, as the original's scenario has, so a command entered in a pause is played at last.

**Rejected:** the parry as a reaction of the defender (it is the defender's own move, and has its own frames and boxes);
the list as a rule, "X and the 3D move" (a table read is a table a test can hold); playing the parry by poking the move
into memory (player two's pad answers in a fight state, so the original plays it for real); re-arming Beam Cannon's head
when its animation goes round (true of the small one alone: three levels recorded, each 14 frames, so it is `rehit`).
