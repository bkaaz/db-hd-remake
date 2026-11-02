# 0052 — A body hit again in the high knockdown is lifted again

**Status:** accepted 2026-11-02

A reaction may carry `ifHitAgain` (`src/entity/hitAgain.ts`): a blow on a
body already in it sends it to `to` for the first `times` blows, then to
`then` — whatever the blow chose. The count is the entity's, cleared on
entering any state without the rule. Goku's and Vegeta's `reel_high` and
`high_fall` carry `reel_high` ×2, then `reel_down`: the original's `1e`
(`$0D:D25D`, field `0x7b`; `rom.md`, Which reaction), which is what lets
Vegeta's Jumping Knee Slash land all three blows (a recording, 2026-11-02).

An attack's `launches` replaces, by name, the launch of the reaction it
sends into (`$0D:D3BF`: his knee slash lifts −6.0, not −7.5).

**Rejected:**

- **The knee slash's later blows typed `high`** — the cartridge's record says
  knockdown; the rule is the defender's, and holds for any blow on `1e`.
- **Our relaunch budget (`Combo.lifts`)** — ours, off for the cartridge's
  fighters (`comboLimits: false`), and it refuses the blow rather than
  flooring the body.
- **A launch override on the blow's type** — the table is shared by every
  fighter; the original picks this by the attacker's move.
