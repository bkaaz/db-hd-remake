# 0064 — A round opens and ends in modules of its own, behind debug switches

**Status:** accepted 2026-11-17 · consolidates 0064, 0066, 0067, 0068, 0073 and
0089 (2026-11-03 – 2026-11-07), which it replaces · there is no second round yet

`Opening` (`match/opening.ts`) puts both fighters into their intros on the arena
at once; READY drops as each intro's first state ends, and no button or KO
counts until FIGHT! is gone. `Round` (`match/round.ts`) forces a fighter at zero
health into his KO, half-speeds the scene to the floor, announces it, and puts the
winner in one of his win poses at random; the debug scene then offers X to fight
again. Each is behind the debug scene's switch (`I`, `K`).

**Rejected:**

- **The KO decided where a blow lands** — throws and seizures cut health without a
  blow, and a fighter would need to know a switch the scene owns.
- **A screen of its own before the fight**, or **the intros one after the
  other** as the original takes them — the owner wants both on the arena; the one
  who waits stood idle for nothing.
- **The win pose by arena**, as the original — the arena it needs will not exist.
- **The opening inside `Round`** — the start and the end share nothing but the
  screen.
- **Any button to fight again** — one held through the pose would start the next
  fight at once.
