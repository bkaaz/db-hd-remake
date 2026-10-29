# Glossary

Words this project uses constantly and defines nowhere else. Half of them are
the genre's, half are ours — `cancelBy`, `rank`, `relaunch` mean what *this* repo
says they mean, and no external glossary would tell you.

**One line per term, plus where the real explanation lives.** If an entry needs
a paragraph it belongs in [`combat.md`](./combat.md) and this file should only
point at it. A glossary that starts explaining becomes a second version of the
design doc and drifts away from it.

**Kept in sync with the implementation**: a term whose field or file is renamed
is renamed here in the same change.

---

**Active frames** — the stretch of an attack where its hit box is out, and the
only frames in which it can connect. Authored (2–4 frames), never inherited from
how long a drawing is held. → `combat.md` §1

**Blown** — the reaction that sends a body away backward in a low flight, into
a bounce (`blown_bounce`); what the rush's last smash does. → `combat.md` (The
buttons)

**Cancel** — interrupting your own attack with the next one instead of playing
it out. On a connection (hit or block) up to its `cancelBy` frame; on a whiff
for as many frames, once its last hit box is gone. Trigger: `cancelable`.
→ `combat.md` (Chaining), `combat/swing.ts` (`missWindow`)

**`cancelBy`** — the last frame of an attack at which a cancel may fire, counted
from entering the state and ignoring frozen frames. Absent means "until the
animation ends". → `states.ts`

**Chain (string)** — a run of attacks joined by cancels. It is not a structure
anywhere: it is a path through `states.json`, derived by `src/combat/chains.ts`
and printed by `npm run chains`. → `plan.md`

**Combo** — a chain whose links actually hold: the defender never gets control
back between the blows. The player's word for it, and the editor tab's name; the
docs and the code say *chain*, *link* and *cancel* when the distinction matters.
→ `combat.md`

**Defence** — an attribute taken off every blow a fighter takes, before
scaling; the cartridge's rule, so `goku` carries the original's raw damage
and defence 8. → ADR 0020, `rom.md` (Hit data)

**Depth** — how many blows landed before a link fires, by the **longest** route
into it. Scaling shortens hitstun as depth grows, so a string can hold at its
opener and break at its third link. → `combat.md` §3

**Frame advantage** — `hitstun − the attacker's remaining recovery`: who acts
first once a blow has landed. Plus means the attacker, minus means the defender,
and minus can be correct when the blow also pushes them out of range.
→ `combat.md` §1

**Guard** — a button and the stance it holds (`guard`, `guard_low`). A blow is
blocked only in a state marked `guarding`: the stance and its blockstun.
→ `combat.md` (The buttons)

**Hit type** — what a blow does to whoever it hits (`flinch`, `stagger`,
`knockback`, `launch`, `slam`) — every number of it but the damage, which is
the blow's own; written
`fl30` in conversation — code plus any frame of the move. A blow is an animation
plus a type. → `data/hit-types.json`, `combat/hitTypes.ts`

**Hitstop** — the freeze on contact, applied to **both** fighters for the same
number of frames, set by the blow's hit type. It is what gives a blow weight,
and because both sides freeze equally it changes nothing about who acts first.
→ `data/hit-types.json`

**Hitstun** — how long the **defender** is helpless after a blow, counted in
frames and set by the blow's hit type, not by the length of the reaction
animation. Everything about combos is arithmetic on this number. → `combat.md` §1

**Ki** — the meter, **separate from health** (settled 2026-08-23). Capacity is
`ki` in `attributes.json`; a state fills it at `ki` per frame and a move pays
`cost` once on entering. Filled by holding A+Z (attack + guard), and a move nobody can pay for
does not come out. → `combat.md` (The buttons)

**Ki blast** — the Ki button's normal (the old S): a bolt thrown across the stage. Two states, because
the throw is drawn in two parts, and the bolt is a spawn with its own
`states.json` — its damage and its speed are authored there, not on the throw.
→ `combat.md` (The buttons)

**Kamehameha** — forward + Ki, or back + Ki for the same beam aimed up: a charged
beam. Holding the button fills a level
(`charge` on the state) which scales the bolt it fires (`fires.size`), and the
pose is held until that bolt is gone (`spawnEnd`). The beam itself and the
charge sphere are not built — see `plan.md`. → `combat.md` (The buttons)

**Launcher** — a blow that lifts a grounded opponent into a juggle instead of
flooring them. The reaction is `launched`, the opposite end of the same axis as
**Slam**; the attack carries `relaunch`, so past the budget it still hits and
simply stops lifting. → `combat.md` §1, §4

**Link** — hitting again *after* your attack has fully played out, because the
defender is still in hitstun. Nothing is interrupted; the sum is
`recovery + next start-up ≤ hitstun`. → `combat.md` (Chaining)

**Motion input** — a **sequence** of directions completed inside a window, where
a `held:` trigger is one frame. Written the genre's way and always relative to
facing: **qcf** ↓↘→ (quarter circle forward), **qcb** ↓↙←, **dp** →↓↘ (dragon
punch), **hcf** ←↙↓↘→ (half circle). Ours are lenient about the diagonals — ↓→
is a qcf — so the name is the motion hands make, not the shape required. The
trigger is `motion:<name>`; **which ones exist is `MOTIONS` in
`input/motion.ts`**, never this line. → `combat.md` (The buttons)

**Move id** (`m92`) — the original's number for a move, fighter field `0x40`;
`goku`'s animations are named by it. → ADR 0017, `rom.md`

**Proration (scaling)** — every blow after the first is worth 10% less, in both
damage and hitstun, down to a floor of 20% and 50%. The counter lives on the
defender and resets when they get control back. → `combat.md` §3

**Rank** — how badly a reaction has taken control away: flinch 1, stagger 2,
knockdown 3, on the floor 4, and 0 for a fighter who is their own. A blow never
lowers the rank the defender is already in, an equal rank re-enters, and rank 0
is also what resets the combo counter; a reaction may never be `guarding`.
→ `combat.md` §7, `states.ts` (`reactionFor`)

**Relaunch** — a blow allowed to *re*-launch or re-floor a body that is already
being juggled. Marked on the attack (`relaunch`; `smash` until 2026-09-26), spent from a budget of two per
combo; past the budget it still hits and still hurts, it just stops lifting.
→ `combat.md` §4

**Rehit** — how many frames before a blow may connect **again**, while its hit
box is still out (`rehit` on the state). Absent means one swing lands once. It is
what makes a beam ten hits of one sprite rather than ten authored steps.
→ `combat.md` §1, `combat/swing.ts`

**Recovery** — the frames after the active ones, when the hit box is gone but you
still cannot act. What makes a whiff punishable. → `combat.md` §1

**Rush** — the string the Attack button walks, one blow per press; the Smash
button ends it at any depth. A tree, derived from `states.json` like any chain.
→ `combat.md` (The buttons)

**SA-1** — the cartridge's second 65816; it runs the fight and unpacks the
sprites, so the original's state is found in its I-RAM. → `rom.md`

**Shove** — a reaction's knockback as the cartridge does it: a speed on
entering that dies out by 0.25 a frame. Not `push`, which keeps two bodies
apart. → ADR 0021, `combat/knockback.ts`

**Situation flag** (`airborne`, `crouching`) **and its redirect**
(`ifAirborne`, `ifCrouching`) — how a defender's circumstances change the
reaction without any attack knowing about them. The flag marks the state, the
redirect hangs off the reaction, and an attack still names one `onHit`. The flag
also rides on the reaction, which is what makes it survive a string.
→ [ADR 0002](./adr/0002-the-defenders-situation-is-a-flag.md)

**Slam (spike)** — the knockdown a blow that comes *down* gives: `slam` drops the
body where it stands instead of lifting it, and its air redirect `slam_air`
drives an already-juggled body into the floor. The opposite end of the same axis
as an uppercut's launch. → `combat.md` (The buttons)

**Smash** — the Burst Limit button that ends a rush. Not a flag: a smash may or
may not carry `relaunch`. → `combat.md` (The buttons)

**Spawn** — anything a state brings into the world: a hit spark, an aura, a ki
blast. Not a kind of object — it is an ordinary `Entity`, authored in
`data/spawns/<name>/`, and *effect*, *attachment* and *projectile* are words for
how one behaves rather than three types. A state names one with `hitFx` (on
contact) or `fires` (on entering).
→ [ADR 0007](./adr/0007-everything-a-state-spawns-is-an-entity.md),
[ADR 0014](./adr/0014-a-bolt-is-handed-its-target.md)

**Startup** — the frames from pressing the button to the hit box appearing.
→ `combat.md` §1

**Vanish** — guard tapped just before a blow lands: a teleport behind the
attacker, for ki. From neutral, guard, blockstun and the air; never from a
reaction or one's own attack, so it counters and never escapes a combo.
→ `combat.md` §5
