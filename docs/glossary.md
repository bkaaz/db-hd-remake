# Glossary

Words this project uses constantly and defines nowhere else. Half of them are
the genre's, half are ours — `cancelBy`, `rank`, `smash` mean what *this* repo
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

**Cancel** — interrupting your own attack with the next one instead of playing
it out. Allowed only when the attack **connected** (hit or blocked, never a
whiff) and only up to its `cancelBy` frame. Trigger: `cancelable`.
→ `combat.md` (Chaining), `data-format.md` (`cancelBy`)

**`cancelBy`** — the last frame of an attack at which a cancel may fire, counted
from entering the state and ignoring frozen frames. Absent means "until the
animation ends". → `data-format.md`

**Chain (string)** — a run of attacks joined by cancels. It is not a structure
anywhere: it is a path through `states.json`, derived by `src/combat/chains.ts`
and printed by `npm run chains`. → `plan.md`

**Combo** — a chain whose links actually hold: the defender never gets control
back between the blows. The player's word for it, and the editor tab's name; the
docs and the code say *chain*, *link* and *cancel* when the distinction matters.
→ `combat.md`

**Depth** — how many blows landed before a link fires, by the **longest** route
into it. Scaling shortens hitstun as depth grows, so a string can hold at its
opener and break at its third link. → `combat.md` §3

**Frame advantage** — `hitstun − the attacker's remaining recovery`: who acts
first once a blow has landed. Plus means the attacker, minus means the defender,
and minus can be correct when the blow also pushes them out of range.
→ `combat.md` §1

**Hitstop** — the freeze on contact, applied to **both** fighters for the same
number of frames (`hitstop`, 10 on the chain kicks). It is what gives a blow
weight, and because both sides freeze equally it changes nothing about who acts
first. → `data-format.md` (`hitstop`)

**Hitstun** — how long the **defender** is helpless after a blow, counted in
frames and set by the blow (`hitstun`), not by the length of the reaction
animation. Everything about combos is arithmetic on this number. → `combat.md` §1

**Link** — hitting again *after* your attack has fully played out, because the
defender is still in hitstun. Nothing is interrupted; the sum is
`recovery + next start-up ≤ hitstun`. → `combat.md` (Chaining)

**Proration (scaling)** — every blow after the first is worth 10% less, in both
damage and hitstun, down to a floor of 20% and 50%. The counter lives on the
defender and resets when they get control back. → `combat.md` §3

**Recovery** — the frames after the active ones, when the hit box is gone but you
still cannot act. What makes a whiff punishable. → `combat.md` §1

**Startup** — the frames from pressing the button to the hit box appearing.
→ `combat.md` §1
