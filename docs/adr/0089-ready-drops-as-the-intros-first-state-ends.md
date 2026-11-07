# 0089 — READY drops as each intro's first state ends

**Status:** accepted 2026-11-07

READY waits for every fighter to leave his intro's first state (`roundStates.intro`),
not to stand: what follows it plays under READY and FIGHT!. Gotenks's
discharges (`intro_2`, his `3f`) are the one such state, and last 96 frames —
READY's own length (`match/opening.ts`, `GONE`) — so they end with FIGHT!,
where the original loops them until its fight screen comes in.

**Rejected:** waiting for him to stand (170 frames of discharges before READY:
the owner, playing Gotenks against Vegeta, waited for nothing); keeping 170
under READY (he would stand frozen for 74 frames of the fight).
