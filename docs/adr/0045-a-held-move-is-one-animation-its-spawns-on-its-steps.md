# 0045 — A move that holds the opponent is one animation, its spawns on its steps

**Status:** accepted 2026-11-01 · narrows 0018 and 0023 for such a move

A move whose handler puts the opponent in the hold, move `30` — which
makes him untouchable (`70` in field `0x96`) — is exported uncut: its blows
cannot land, so a part per blow (0023) cuts nothing worth a state, and no
state fires its spawns (0018). Each `b0` it runs goes on the step it begins
as `spawns` — the spawn entity's name and its offset — and the engine puts
it out as the step begins. Saiyan Meteor's `ae` is 616 frames in one
animation, its nine hit sparks on their steps (`src/rom/parts.ts`,
`src/rom/animation.ts`). An object we do not export is left off, not guessed.

**Rejected:**

- **Nineteen states, as exported** — the hold, the launch and the damage
  hang off one frame count in the original; across state changes each
  would need carrying.
- **Spawns on steps for every move** — a state's `fires` already puts out
  the projectiles at the cut, and both would fire them.
