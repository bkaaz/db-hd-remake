# 0086 — A journey up comes in from below

**Status:** accepted 2026-11-07 · supersedes 0084 on how a journey up arrives

Sent up, both come in from below the new arena's floor, thrown up at −15 —
the defender knocked down, the attacker in his jump — as the cartridge brings
them onto a floor's arena (`$01:8D46`, `$0552` clear); sent down, both drop in
from above, the attacker thrown up at −8 first (`$01:8D80`). The numbers are
`ARRIVAL` in `match/fighters.ts`; the defender rises in the template's
`rise_in`, the knockdown's pose without its cry, given once as the blow landed. A body still rising no longer lands on
passing the floor (`Entity.update`): nothing else ever rose from below it.

**Rejected:**

- **Both dropping in from above, both ways** (0084). The owner: they left the
  floor below, so they cannot fall from the sky onto the next one.
