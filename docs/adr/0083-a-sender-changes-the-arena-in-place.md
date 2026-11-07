# 0083 — A sender changes the arena in place

**Status:** accepted 2026-11-07 · its cut superseded by 0084, 2026-11-07

A state's `sends` names the way its blow takes the fight; the owner's graph in
`src/arena/ways.ts` says where that leads from each arena. The blow decides as
it lands whether a way is open, so an open one costs no health, as the
original's journey does; one that would empty his health stays the KO. Once its
pause is over the scene swaps the backdrop on the same `Stage`, relights both
fighters and puts them where the original does (`arena/travel.ts`). Every arena
of the graph is loaded with the scene, so a change never waits on a fetch.

**Rejected:**

- **A new scene for the new arena.** Its request would carry health but drop
  the combo, the round's state and the recording, and the original keeps all
  of those through the change.
- **Loading the arena on the blow.** The cut would wait a fetch in mid-fight;
  the flight will hide one, the cut cannot.
- **The original's sky and planet above the floors.** There is no fight in the
  air (`combat.md`); the palace is the way up.
