# Combat

**The fight we want: simple, readable, and dynamic the way Dragon Ball is.** A
player should be able to say why a blow landed and why a string ended. This
file says what the rules are; it is edited, not appended to, and
[`plan.md`](./plan.md) is the only list of what is next. Why the engine is
shaped as it is lives in [`adr/`](./adr/).

**The context.** Long, showy exchanges are wanted. The expected opponent is the
CPU, which does not exist yet, but every rule is symmetric and built as if a
second human may sit down — a design that holds against a person also plays
well against the CPU, and the reverse is not true.

## The buttons

| button | key | what it does |
|---|---|---|
| **Attack** | `A` | the rush: pressed again, walks the string one blow further |
| **Smash** | `S` | ends the string, at any depth, with a heavier blow |
| **Ki** | `X` | the ki blast; forward or back + Ki is the kamehameha |
| **Guard** | `Z` | held, a stance that blocks; tapped at the right moment, vanishes (§5) |
| **Strike** | `D` | the original's X — only the cartridge's `goku` uses it so far |
| **Dash** | `C` | with forward or back, the original's dash (its L/R) — `goku` only |

The table above is `goku_old`'s. The cartridge's `goku` plays the original's
own moves for now (`plan.md`): A, S, D and X are its Y, B, X and A, with no
strings between them, until it is reworked to these rules. Holding A and S
together charges, as the original's Y + B does — and, as the original's,
the charge refills **health**, the one pool the original has; our ki meter
is left alone for now, to stay near the original while it is ported, and
will change (owner, 2026-10-30).

**The rush is a tree.** Attack walks one line, Smash branches off it at every
depth and ends it, and Smash alone is a move of its own:

```
A → A → A → A
↓   ↓   ↓   ↓
S   S   S   S      (and S alone, from neutral)
```

What each place holds is `npm run chains -- goku_old`; it also lists the moves with
no place yet. Crouching has its own shorter rush; the air has one attack and
one smash. There is no depth to step into, so down is **crouch**, and up is
**jump**.

**Guard is a stance, not a direction.** A blow is blocked only in a state marked
`guarding` — the stance and the blockstun it leads to. It blocks high and low
alike; crouching only lowers the hurt box, so a high blow misses a crouching
body because the boxes miss.

**Specials are motion inputs** (`motion:qcf` and friends, `input/motion.ts`). A
motion is matched loosely — ↓→ counts as a quarter circle — and a short window,
not a strict shape, is what keeps false positives rare. The order is the
order the directions were **pressed** (owner, 2026-10-31): a ↙ held through
↓ ← → is not also ← ↓ →, so Final Flash and the Big Bang come out apart;
the original's exact sequences were the stricter way not taken. A direction plus a
button is a move of its own, ordered before the plain one in `states.json`.

**Ki is its own meter**, filled by holding Attack + Guard. A state that spends
it says so with `cost`, and a move nobody can afford does not come out.

## A blow is an animation plus a hit type

A blow is authored as **which animation** and **which hit type**. The animation
gives the poses, the boxes and the timing; the type gives everything that
happens to whoever is hit — the reaction and its numbers. What the blow
costs is its own `damage`, on the state. Types are one table shared by every
fighter, `data/hit-types.json`, and a state may not override a type's number:
a blow that needs another reaction is another type.

| type | code | what happens to the opponent |
|---|---|---|
| flinch | `fl` | held where they stand, for the next blow |
| stagger | `st` | stays standing, pushed far back |
| knockback | `kb` | flies away and bounces |
| launch | `la` | lifted into the air, to be juggled |
| slam | `sl` | driven into the floor |
| light | `li` | the original's light reaction: 14 frames, held where they stand |
| heavy | `he` | the original's heavy one: 26 frames, pushed further |
| down | `dn` | the original's knockdown: thrown up and back, then the get-up |

In conversation a blow is written as its code plus **any frame of the move** —
`fl30 fl39 la187` — and `npm run which` says what that points at.

**Animations are named for the pose, never for the role.** One pose may serve
several blows, and two animations may share sprites when they differ in timing
(`kick_high` and `kick_high_hold`). An animation always plays through; a pose
held longer is a second animation, not a field on the blow.

## Chaining

- **Link** — the attack finishes, control returns, the defender is still in
  hitstun. It falls out of hitstun against recovery; nothing builds it.
- **Cancel** — the attack is interrupted by the next one, through the
  `cancelable` trigger. On a hit or a block, up to the attack's `cancelBy`; on a
  miss, once the last hit box is gone, for a window as long as a hit's
  (`missWindow` in `combat/swing.ts`). A string therefore goes on whether it
  lands or not — an experiment; what punishes a whiffed string is still open.

**A link is a true combo only if** `hitstun ≥ window + start-up of the next
blow`, counted from the frame the blow landed, at the blow's depth in the
string, where scaling (§3) has shortened the hitstun. The window is the worst
case because the player decides when to press. `npm run chains` prints every
link with its margin, and `npm test` refuses one that does not hold.

- **Design a string from its last link**, where scaling has taken the most.
- **A move's place is decided by its start-up**, not only its look: a slow
  move cannot sit inside the rush, because no link's hitstun covers its wind-up.
- **A move never cancels into itself.**
- **The hit box is out for the active frames and no longer; the pose is held
  through recovery.** Recovery is what a whiff looks like and what makes it
  punishable.

## The rules the engine enforces

### 1. Hitstun

How long the defender is helpless, in frames, set by the blow (its type) — never
by the length of the reaction's drawing, which holds its last frame or is cut
off. Frame advantage is `hitstun − the attacker's remaining recovery`. Hitstop
does not eat hitstun: it freezes both fighters equally. Knockback is a
reaction's `vel` for as long as the hitstun lasts, so every reaction names its
own horizontal push, and a blow turns the fighter it lands on toward the one
who threw it. A reaction ranked above zero cannot guard.

### 2. The combo counter

One integer on the defender (`combat/combo.ts`): up by one per blow taken, back
to zero on entering any state of rank 0 — any state that is not a reaction.
Everything below reads it.

### 3. Scaling

Each blow in a combo is worth less than the one before it, in **damage** and in
**hitstun**, down to a floor (`combat/scaling.ts`). Damage scaling keeps a long
combo from being a round; hitstun scaling ends a ground loop by itself, because
the defender eventually recovers before the next blow. **Launch** scaling — each
lift raising less — is not built yet.

**Off for `goku` while he is ported** (owner, 2026-10-29): the attribute
`comboLimits: false` switches off this and the relaunch budget (§4), so the
cartridge's numbers can be compared with the original's. On again when the
fight is reworked.

### 4. Relaunch

A blow whose type may lift or floor a body that is already helpless spends from
a budget (`RELAUNCH_LIMIT`, `combat/combo.ts`). Past it the blow still hits and
hurts, but the victim keeps falling on the arc they were on. Only a *re*-launch
counts: the opener lands on someone in control of themselves.

### 5. Vanish — a counter, not an escape

**Not built yet.** Guard tapped just before a blow lands teleports behind the
attacker, for ki; early, or without the ki, it is an ordinary block. From
neutral, walking, crouching, guarding, blockstun and the air — **never** from a
reaction or from one's own attack, so it never breaks a combo, and scaling and
the relaunch budget stay the only things that end one. In the corner it lands
behind and swaps sides; against a projectile it lands behind the shooter.

### 6. The corner

Being backed against the wall is meant to be dangerous, but escapable.
Knockback dies at the wall today, so pressure there never ends. The rule to
build: **knockback that cannot be spent on the defender is spent on the
attacker**, the same principle `push.ts` uses when one body is pinned.

### 7. Reaction rank

Flinch 1 < stagger 2 < knockdown 3 < on the floor 4, and **a blow never lowers
the rank the defender is already in** — it still lands and hurts, and the
victim keeps doing what they were doing. An equal rank re-enters, which is what
a combo is. Rank is compared after the air version is chosen, so a flinch on a
falling body becomes a juggle. Nothing forces rank 4, and a fighter on the floor
is `invulnerable`.

## Movement

The walk is a bob — the sheet has no walking legs — so the fighter really moves
by **dashing**: a slow dash that is free and a fast one that costs ki. Neither
is built. The dash will decide how the corner and spacing play, and a double
tap is new logic in `input/buffer.ts`, not just an animation.

## Open

- What punishes a string thrown at nothing.
- `stun` — a blow that holds the opponent long enough for something else; and a
  hit type for ki blasts.
- Deferred, not rejected: an offensive vanish after one's own smash, a throw, an
  aura burst, transformation, fatigue, a taunt, and forward/back variants of the
  rush.
- The CPU, and whether a second human ever plays — the second decides how
  forgiving the scaling has to be, which is tuning, not structure.
