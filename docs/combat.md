# Combat — the system we are building toward

This file describes **the fight we want**, the way
[`game-overview.md`](./game-overview.md) describes the 1996 game. It is not a
queue — [`plan.md`](./plan.md) is the only one. Gameplay reasoning lives here and
nowhere else; [`adr/`](./adr/) holds the architecture that carries it. What lives
here is the shape, so this conversation does not have to happen twice.

Everything below is judged against one brief, settled 2026-08-15: **the fight
should be dynamic, the way Dragon Ball is dynamic.**

## Where it comes from

The combat system is ours. Hyper Dimension binds us on the roster and the
sprites and nothing else — the owner dislikes the original's fighting, and that
is a main reason this remake exists.

| layer | reference | what we take |
|---|---|---|
| **rules** | Dragon Ball FighterZ | the combo skeleton: one counter, three scalings, a hard cap on re-launches |
| **controls** | Burst Limit, and Budokai 3 before it | four buttons — attack, smash, ki, guard — and strings that one button walks and the other ends (settled 2026-09-26, replacing FighterZ's L/M/H/S; see *The buttons*) |

**We take an architecture, not frame data.** No number in this file or in the
data is FighterZ's; theirs is undocumented to us and every value here is ours to
tune. Presenting a guessed constant as a reference game's would be inventing a
source.

What we deliberately **leave**: 3v3 and assists, Sparking Blast, the Dragon
Balls, Dramatic Finish. Open rather than rejected: a homing dash (very Dragon
Ball, but it is a movement system, not a combat one) and how many levels the ki
resource has.

**Burst Limit is 3D and we are not**, so two things change on the way over
(owner, 2026-09-26). Where it steps into the depth, we **crouch**. And up is
**jump**, so its up + button moves have no ground form here: in the air there is
one attack and one smash for now, because the sheet may not hold more.

**What is the foundation and what is later.** This is where we start, not the
whole of Burst Limit. Deferred, not rejected, and expected to come (owner):
the offensive Vanishing Attack (a smash followed up from behind, for ki), the
throw, Aura Spark and its pursuit, transformation, fatigue, drama pieces and the
taunt. The forward and back variants of every string (6XXX, 4XXX) wait with them.

**Ki comes back by charging**, as in Budokai 3, where Burst Limit refills it on
its own.

## The context that shapes the tuning

- **Long exchanges are wanted** (owner, 2026-08-15). Combos may be showy.
- **The expected opponent is the CPU, but multiplayer is not ruled out**
  (owner; see Q8 in [`open-questions.md`](./open-questions.md)). So the system
  is designed as if a second human will arrive, because the risk is lopsided: a
  design that holds up against a person also plays well against the CPU, while
  one tuned for the CPU alone — touch-of-death combos, escapes nobody needs —
  breaks the day somebody sits down at the other side.
- **Every mechanic is symmetric.** Both fighters get the same rules; what the
  CPU cannot yet *use* well is an AI problem, not a reason to build a mechanic
  for one side.
- **There is no CPU yet**, and it is a large separate system. Nothing here may
  quietly assume it exists.

## The parts

### 1. Hitstun — the axis everything multiplies

**Built 2026-08-15** (`hitstun` on the blow, `hitstun` in `attributes.json` as
the default, `stunEnd` as the way out of a grounded reaction). It arrived at 12
frames everywhere, which is exactly what every reaction animation happened to
last, so nothing about the fight changed on the day it landed — the point was
never a new number, it was that the number can now be chosen at all.

How long the defender is helpless, as **a number of frames on the blow**, not as
the length of whatever pose it plays. It joins `damage`, `hitstop`, `hitFx` and
`onHit` in the family that already exists: the blow decides how it is taken, how
long the game stops, what it looks like, what it costs — and now, how long it
holds.

```
combo = defender's hitstun − attacker's recovery
```

That is the whole definition. There is no "combo" field and no combo detector:
a combo is the arithmetic working out. Which is why hitstun is first — nothing
else here can be designed while a reaction lasts "as long as the artist made the
animation".

**Hitstun owns the state's length**, and an animation shorter than it holds its
last frame. The alternative — the animation deciding — is how a drawing ends up
setting frame data.

**What it bought, the day after** (2026-08-16): every attack used to be minus on
hit — the fighter who landed a blow recovered second. Light is +3 now, medium
+1, and `kick_high` is deliberately left minus because it pushes 62 px, further
than anything in the game reaches. Frame advantage and knockback were moved
together, since one is the other times the hold; every distance stayed where it
was while the frames changed completely.

Two things the build settled, neither of them obvious beforehand. **Hitstop does
not eat hitstun**: the clock ticks below the freeze check, like the input buffer,
because a pause that freezes both fighters equally must leave frame advantage
alone. And **knockback travels with hitstun**, since a reaction's `vel` applies
every frame it lasts — so tuning how long somebody is held also moves them
further, which is a coupling to remember when §3's curves arrive.

**Every knockback distance is derived from one that already means something**,
which is why none of them is a round number picked by feel. A light hit pushes
at exactly walking speed, so an opponent who walks straight back in neither
gains nor loses ground while taking it. A heavy travels one whole `pushWidth`
further, so the gap it opens fits a body. A knockdown goes further than a heavy
again — being floored should cost more ground than being staggered — and lifts
about a third of a fighter's height, which is clearly off the feet without being
a juggle. Retune by moving the thing the distance is measured against.

Blockstun is the same mechanism with its own number, and is deliberately not
built yet: `guard_hit` still ends with its animation.

**A blow turns the fighter taking it** (2026-08-23, `landBlow` →
`Entity.turnToward`). Knockback is facing-relative and no airborne state
recomputes facing — a fighter must not spin mid-jump — so a fighter hit after
crossing the opponent was thrown *into* the blow, and played the hurt animation
with their back to it. Turning them at the moment of contact is the one place
facing changes outside a `turn: true` state, and it is what the genre does
anyway. It applies on block too, because `guard_hit` pushes along the same axis.

**A reaction must name its own horizontal knockback, never inherit one.**
`juggle` shipped with `[null, -2.0]`, and a null keeps the axis: the speed it
kept was the victim's own approach, so a fighter who jumped *at* the opponent
was handed `jump_fwd`'s forward momentum and flew straight into the blow.
Nothing clears `vx` — not landing, deliberately, since a skidding body is still
skidding. `juggle` pushes `-0.67` now, the same as `hurt_chain`, whose airborne
form it is: the same reaction should push the same whether the body is standing
or in the air. Rank 4 is the exception, being the floor rather than the blow.
`entity/chains.test.ts` pins it for every reaction, so the next one cannot
arrive without a push.

**A blow that lifts needed one too, and its number comes from two places
agreeing.** `launched` (2026-08-23) puts a grounded opponent into the air and
leaves them there to be juggled, where `knockdown` would put them on the floor
and `hurt_chain` would leave them standing. The lift is 4.0, which is an apex of
**27 px — a third of a fighter's height**, the same yardstick a knockdown's lift
is measured against. Independently, it has to outlast the move that threw it:
`knee_rise` lands its blow around frame 7 and `knee_jump`'s box is gone by frame
22, so anything under 15 frames of hang time would drop the victim before the
follow-up arrives. 4.0 buys 27. **A launcher is worth checking both ways** — a
lift tuned only against the follow-up is a number that breaks when the animation
is retimed.

The attack carries `relaunch`, like every launcher: past the budget it still hits
and still costs health, it just stops lifting (§4).

**A blow may land more than once, and how often is on the blow** (2026-08-23,
`rehit` on the state, `combat/swing.ts`). Absent, a swing lands once per entry
into its state, which is every attack that does not set it. Set, the attack may
connect again that many live frames later, for as long as its hit box is out.

**It is a number on the blow and not steps in the animation**, which is the same
trade this file already refused once for the active window: a beam is one sprite
held for half a second, and ten hits must not mean ten authored steps. How often
a move hits and how it is drawn are different questions.

*A long active window is a defect when a move hits once* — it was standing in for
hitstop — *and it is the mechanism when a move hits repeatedly.* The window is
how long the move may keep connecting; `rehit` is how often.

Three things come with it, and none is the field's problem:

- **Every hit scales the next**, so a ten-hit beam ends at the 20% floor. Its
  per-hit damage is authored knowing that, never as `damage × hits`.
- **Every hit freezes for `hitstop`**, so the total is what should match a single
  blow's. `knee_jump` hits twice at 5 rather than once at 12, and the arc it
  stops is the reason (see `kick_axe` above).
- **`rehit` with `relaunch` burns the budget in two hits** and every hit
  after that is refused outright. The validator warns; a beam should simply not
  be a relaunch.

**A held blow cannot be answered by holding back** (2026-08-16, `guardable` in
`states.ts`): rank above zero is exactly "somebody else put me here", and a
fighter there has no guard. Without it every combo was escapable by holding a
direction, which would have made all three curves guard something that was never
inescapable to begin with.

### 2. The combo counter — one integer, on the defender

**Built 2026-08-15** (`src/combat/combo.ts`). Starts at zero, increments on
every blow taken, and **resets on entering any state of rank 0** — which is to
say any state that is not a reaction (§7). "Recovered control" therefore needs
no separate signal and no timer, and the count cannot drift out of step with
what the fighter is actually doing.

It drives everything below, so the whole system has exactly one piece of state
to reason about and one place to inspect when a combo does something
surprising. Nothing reads it yet but the `D` readout; the three scalings are
next.

### 3. Three scalings

| scaling | what it does | what it prevents |
|---|---|---|
| **damage** | the fifteenth hit takes off a fraction of the first | a long combo being a whole round |
| **hitstun** | each successive blow holds for less | corner loops — the defender eventually recovers before the next blow lands, so the combo ends *itself* |
| **launch / gravity** | each successive lift raises less | endless juggling — the victim falls out |

**Damage scaling is built** (2026-08-16, `src/combat/scaling.ts`): the opener is
worth all of itself, every blow after it takes ten per cent off the next, and the
floor is twenty. A blow that costs something never costs nothing — a free blow
still stops and still holds the victim, which would let a combo be extended at no
price. The seven-hit combo that took 78 of 100 health takes 52 now.

**Hitstun scaling is built** (2026-08-16, same file): the same ten per cent per
blow, but the floor is fifty rather than twenty, because a fifth of a reaction is
three frames and a pose nobody can read. It shortens the knockback with it — a
ground reaction moves for exactly as long as it holds — and that is on purpose.
What it buys: the jab is `hitstun: 17` and links into itself for real, three
times, and the fourth arrives after the defender is standing.

The reason to prefer curves over per-move budgets is not elegance, it is the
scale of the authoring ahead: three curves in one file, versus a juggle cost to
be filled in on each of several hundred moves that do not exist yet. The second
kind of system does not get finished.

### 4. Relaunch — the hard limit that scaling cannot give

**Built 2026-08-15** (`relaunch: true` on the blow, `RELAUNCH_LIMIT` on the counter; named `smash` until 2026-09-26, when Smash became a button).
Scaling is soft: it makes a fourth uppercut weak, never impossible. Some things
should be impossible. A blow marked as able to **re-launch or re-knock down**
spends from a budget of two per combo. Past the limit such a blow still hits and
still hurts — it just does not lift or floor the victim again, who keeps falling
on the arc they were already on, and the exchange ends itself.

This is the answer to "an uppercut cannot juggle forever", expressed as a rule
about re-launching rather than as a counter of uppercuts, so it holds for every
launcher anyone adds later.

**Only a *re*-launch is counted**, which is the word doing the work: the blow
that opens a combo lands on somebody who has control of themselves, and charging
it to the budget costs a string its own finisher — a combo opened with two
uppercuts could not end with a knockdown. So the sequence is launcher, then two
more lifts, then the fall.

**Why the hard limit still feels like a wall**: it ends a juggle by refusing a
blow, where scaling would have the body visibly falling out of one. Damage
scaling landed on 2026-08-16, so a long combo is no longer a round; the two that
would soften the *shape* of a juggle — hitstun and launch — are still unbuilt.
Raising the number is not the answer to "can we juggle more". The curves are.

Chain links that juggle are deliberately not relaunches: a juggle keeps a body up
where a relaunch puts it back down, and a string that spent the budget on its own
middle could not end with a knockdown.

**Where the genre puts a cap like this**, so the position is not re-argued:
Street Fighter charges each move its own juggle cost, Tekken raises gravity
through the combo and allows one screw, the Marvel/FighterZ line lets hitstun
decay until the victim simply falls out. In all three the hard cap is the *net*
under the curves and never the mechanism itself — which is exactly where ours
should end up once §3 is finished.

### 5. Vanish — a counter, not an escape

**Guard pressed at the right moment teleports you behind the attacker**, for ki
(owner, 2026-08-15; its reach settled 2026-09-26). Pressed just before a blow
would land, the blow finds nobody; pressed early, it is an ordinary block;
without the ki, it is an ordinary block too. How wide "just before" is — a
number of frames — is ours to tune.

| where you are | vanish? |
|---|---|
| neutral, walking, crouching, guarding | yes |
| **blockstun** — the way out from under a string you are blocking | yes |
| **in the air** | yes |
| in your own attack | **no** — it would make every attack cancellable into defence |
| in hitstun or any reaction (rank > 0, §7) | **no** |

**So it does not escape a combo**, and that is what keeps the arithmetic above
honest: nothing breaks a combo from inside, so scaling and the relaunch budget
(§3, §4) are the only things that end one. A resource-bought escape would have
been a floor with a hole in it anyway — a player out of ki would be juggled to
death regardless of skill.

Two cases the rule has to answer (owner, 2026-09-26):

- **In the corner** the teleport still lands behind, against the wall, and
  swaps sides — the natural way out of §6.
- **Against a projectile** it lands behind whoever threw it, however far away.

The offensive **Vanishing Attack** — following your own smash from behind — is
a different move and is deferred (see *Where it comes from*).

### 6. The corner

Two facts, and only the second is a defect.

**Bodies barely separate.** Push collision sets the anchors 30 sprite px apart
while attacks reach 28–44 px, so being pushed to body contact leaves the
defender comfortably inside every attack in the game. That is true in the middle
of the stage too. Body pushing was never what ended pressure — knockback is.

**Knockback dies at the wall.** A reaction's backward velocity moves the
defender; against the stage bound it moves nobody, and nothing transfers it to
the attacker, so pressure never ends. The rule that fixes it is one the code
already applies elsewhere: **knockback that cannot be spent on the defender is
spent on the attacker** — the same principle `separate()` uses when one body is
pinned and the other absorbs the remainder.

**The corner stays dangerous.** No fighter "solves" it; being backed against the
wall is supposed to be a punishment. Success is that a defender can get out, not
that pressure stops mattering.

### 7. Reaction rank — being helpless outranks being hit lightly

**Built 2026-08-15.** Orthogonal to all of the above, and not solved by any of
it: a reaction carries a rank (flinch 1 < stagger 2 < knockdown 3 < on the floor
4), and **a blow never lowers the rank the defender is already in**. A refused
reaction changes nothing — the blow still lands and still hurts, the victim just
keeps falling on the arc they were on. An equal rank re-enters, which is what a
combo is.

The alternative considered and rejected was a per-state redirect table naming
which reaction replaces which. It encodes a rule about severity as a table of
names, and grows with every fighter × every reaction.

Two consequences fell out rather than being designed. Nothing forces rank 4, so
a downed or getting-up fighter cannot be interrupted at all — **wake-up
invulnerability**, which settles one of the open questions below. And an
*equal*-rank blow can still relaunch a body that is still airborne, so an
uppercut into an uppercut juggles — which §4 closes, because rank has nothing to
say about it: knockdown replacing knockdown is an equal rank, and equal rank
re-entering is what a combo *is*.

**Severity is part of how a reaction is taken, not only which one it is.** Rank
is compared *after* the airborne redirect, so a reaction may name an air version
that outranks it: `hurt_chain` flinches a standing opponent at rank 1 and
becomes `juggle` at rank 3 against a falling one. Without that, a light chain
link cannot touch a body its own launcher put in the air — the string that
follows an uppercut connects, costs health and interrupts nothing. Only the
string has one (2026-08-15); a jab into a falling body still does not interrupt,
which keeps §4's hole as small as it can be until the limit exists.

## Movement, and why the dash belongs in this file

**It is always 1v1** (owner, 2026-08-15). No tag, no assists, no 2v2 or 3v3 —
which is why FighterZ's team layer is left behind rather than deferred.

**The walk cannot be fixed.** Goku's two walk frames hold the same wide stance
with the feet in the same place; only the arms and the body height change. It is
a bob, not a step, so walking reads as gliding whatever timing it is given —
the sheet simply has no walking legs.

**The sheet has dashes instead**, confirmed by the owner: 24 is the pose a dash
starts from, 25 is the forward dash, 26 is that same start pose again and 27 is
the backward dash. Two dashes, not a run cycle. They are the only frames where
the legs travel at all.

So a **dash** is not a nicety here, it is how this fighter moves. Three things
follow, and none of them are about animation:

- **A dash is a combat mechanic, not locomotion.** Dashing in becomes the main
  way to start offence, cancelling a move into a dash is a combo tool in its own
  right, and a fast dash flattens spacing — which will not hurt until beams and
  specials exist, and will hurt a lot then.
- **The fast dash costs the resource** (owner). That makes the slow one worth
  choosing — it is free — and ties movement to the game's economy, which is
  very Dragon Ball. It also means the fast dash **cannot be built until the
  resource exists**, while the ordinary dash depends on nothing.
- **The dash decides how the corner plays.** Everything in §6 assumes a distance
  that takes time to close. A dash shortens that time to almost nothing.

**Triggering it is not free.** A double tap is the genre's answer and the engine
has no notion of one: the input buffer records presses for attack edges, and
directions are only ever asked as `held:`. A double tap is new pure logic in
`input/buffer.ts` — cheap, testable, and worth knowing about before it is
mistaken for "just an animation".

## The buttons

**Attack, Smash, Ki, Guard — Burst Limit's four** (owner, 2026-09-26). This
replaces FighterZ's Light, Medium, Heavy, Special: **strength stops being a
button and becomes a place in a string.** Medium is gone and its key is the
guard.

| button | Burst Limit | what it does | key |
|---|---|---|---|
| **Attack** | X | the rush: pressed again, walks the string one blow further | `A` |
| **Smash** | Y | ends the string, at any depth, with a heavier blow | `S` |
| **Ki** | B | the ki blast; forward and back + Ki are the kamehameha — what the old **S** did, and below it keeps that letter | `X` |
| **Guard** | A | blocks while held; tapped at the right moment, vanishes (§5) | `Z` |

**The rush is a tree, not a ladder.** Attack walks one line; Smash branches off
it at every depth and ends it:

```
A → A → A → A → A
↓   ↓   ↓   ↓
S   S   S   S
```

It is built from the attacks that already exist, re-assigned rather than drawn —
the sheet was catalogued for exactly this. The graph is still derived from
`states.json` and still printed by `npm run chains`; only its edges change.
Crouching and the air have their own, shorter version: in the air, **one attack
and one smash** for now.

**Guard is a button, not back.** It blocks everything, high or low, standing or
crouching. **Crouching only lowers the hurt box** — a blow aimed high passes
over a crouching body because the boxes miss, not because of a rule. A real
high/low guard (down + guard for lows) was weighed and deferred: it is a
guessing layer Burst Limit barely has, and it can be added later on the same
button.

**Specials are still motion inputs**, and recognition exists as of 2026-08-23 —
see below — so what stands between here and a special is the move, not the
input.

**Forward + S is the kamehameha** (2026-08-25), and it is the first charged
move: holding S fills a level over `charge` frames, and what the level does is
scale what the move throws — `fires.size` is the multiplier at empty and at
full, applied to the spawn's drawing and to the boxes placed through it, so its
hit box grows with the picture. It is **size, not scale**: velocity is quoted in
sprite px per frame against the world's scale, so a charged bolt is bigger and
no faster.

**Back + S is the same beam aimed up** (2026-08-25). It is one bolt, not two:
how a projectile travels is a fact about the projectile, so both flights are
states in `data/spawns/kame_bolt/`, and the move names which one it wants with
`fires.state`. The climbing one is `airborne` with an upward `launch` — the only
kind of state whose velocity carries — over a `gravity` of 0, because a beam
that fell would be a thrown rock.

**A full charge lets go of itself** (`charged`). Holding past the top can add
nothing, and a button that stops mattering without saying so reads as the game
ignoring the player. Charge is a **dial, not rungs**: two states pretending to be small and
large would be two readings of one number. The firing pose lasts a second on its own
clock (2026-08-25, revised the same day): tying it to the bolt's flight held the
fighter still for as long as the shot took to cross the stage, which is a
different number every time and reads as being stuck. `spawnEnd` — the trigger
for "what I threw has left the world" — stays in the vocabulary and currently
has no user.

**The standing ki blast is built** (2026-08-24) and is the first thing that
spends ki: `cost` on the state, paid on entering, and a transition into a move
nobody can afford does not fire at all. What the bolt does when it arrives is
authored on the bolt — it is a spawn with a `states.json` of its own — so the
throw names no damage and no reaction. Everything about how it *hits* is the
uniform medium placeholder, like every other move (see the table below); what
is genuinely chosen is the cost and the speed.

**There are three kinds of input, and confusing two of them cost a session**
(2026-08-23). A **press** is an edge, buffered for twelve frames. A **held
direction** is a live condition — true only while the key is down, which is what
every `held:` trigger asks. A **motion** is a sequence of directions inside a
window, and until this date the engine had no way to see one: rolling ↓ → leaves
nothing behind for a live condition to read, so the launching knee could only be
thrown by *holding* down-forward. Nobody holds a quarter circle. `input/motion.ts`
keeps the short history a sequence is matched against; `motion:qcf` is the first
trigger built on it.

**The diagonal is not required**, and that is a decision rather than an
omission: `qcf` is down then forward, so ↓↘→ and ↓→ match alike. Requiring ↘ is
what makes a motion "not come out", which is the complaint the whole thing
exists to answer. The price is a false positive — crouch, stand, walk forward,
and inside fourteen frames that reads as a quarter circle — and **the window is
what keeps that rare, not the shape.** Fourteen is a little over the press
buffer's twelve, in that order on purpose: the motion has to still be true on
the frame the buffered press is spent.

**Stance is settled before anything reads a button.** `held:down → crouch_down`
is the first transition of every grounded neutral state, because it was not and
a diagonal read as walking: down-forward went to `walk_fwd`, and a button
pressed in the two frames that took spent itself on the standing move. The same
ordering is why down + a button gives the crouching attack at all. It costs one
frame on a crouch attack pressed from standing, which the buffer covers.

**A direction plus a button is a normal of its own, not a variant.** The first
one exists as of 2026-08-23: back + H is `kick_axe`, where plain H is
`kick_high`. It costs no new machinery — a `when` is a list that ANDs, so
`["held:back", "pressed:heavy"]` is a transition like any other, checked before
the plain heavy so it wins the press. This is where the moves the nine slots
cannot hold will go, and the price is that every such branch has to be ordered
by hand.

**`kick_axe` is thrown out of a hop, and that makes the ground its clock.** The
leg is raised and brought down from above, so the move is `airborne` and ends on
`landed` rather than on its own animation — which also means Goku can be juggled
out of it, the price the hop charges. The arc is derived like every other
distance here: it travels one `pushWidth` at a shade above walking speed, and
peaks 15 px up on frame 10, three frames before the leg comes down, so the chop
is always thrown on the way back to the floor.

**Its proportions are the original's** (owner, 2026-08-23): the wind-up is long
and the extended leg is brief. The hop and the raised leg hold 13 frames between
them, the chop is on screen for 7 — 4 of them active — because landing at frame
20 cuts the last step short. So the drawing does not decide how long the strike
is seen; the arc does, and retiming the hop retimes the pose with it.

**And it is the one attack whose hitstop is below its row** — 6 against the
heavy's 12 (owner, 2026-08-23). Two reasons, and the first is mechanical: the
freeze returns above the physics (`entity.ts`), so on an airborne attacker it
stops the fall as well as the drawing, and a heavy's 12 frames read as the body
hanging rather than as weight. The second is that this blow already sells its
impact by putting the opponent on the floor. **Charge an airborne attack's
hitstop against its arc, not only against its strength.**

**A blow that comes down puts the body down, and that needed a reaction of its
own.** `knockdown` lifts 64 px before the fall, which is right for an uppercut
and backwards for an axe kick, so `slam` and `slam_air` sit beside it. Both
numbers are derived rather than felt. On the ground the lift is 1.8, chosen so
the fall animation plays exactly once before `landed` fires — an apex of 5 px,
which is a body dropping rather than flying — and the push is one `pushWidth`,
so the victim lands at the attacker's feet: a downward blow trades range for the
spike. In the air the impulse is 6.2 *downward*, the speed a normal knockdown is
already travelling at when it hits the floor, so a spiked body arrives as hard
without the flight.

**The chain rule is the rush tree above**, and it replaces the one that stood
here — "cancel into a stronger button, never a weaker one", `L → M → H → S` —
which had no buttons left to order once strength moved into the string.

## Chaining: two different things worth naming separately

- **Link** — the attack finishes, control returns, the defender is still in
  hitstun, you attack again. Falls out of §1 for free, and is tuned by hitstun
  against recovery rather than built.
- **Cancel** — you interrupt your *own* attack with the next one, but only
  because the first connected. This is what makes strings, and it is where
  Budokai's accessibility lives: the same button pressed repeatedly walks a
  fixed chain, direction plus button branches out of it.

Cancels need exactly one thing the engine does not have: a trigger for "the
attack I am in has connected". `Entity.spent` already records it, at the right
moment, for the right reason. A string is then an ordinary path through the
state machine — attack state, `pressed:X`, next attack state — which is the
shape `states.json` already has.

### The table an attack is authored from

> **Its columns are the old buttons** (2026-09-26). The arithmetic below — the
> link, the advantage, `cancelBy` — survives the change of scheme unchanged; what
> changes is the axis: a row per *place in the rush* (early attack, late attack,
> smash) instead of per button. Rebuilding it is in `plan.md`. Until then, read
> L as an early rush blow and H as a smash.

**Settled 2026-08-16, and it is the foundation the moveset will be built on.**
An attack is not tuned move by move any more: it is given a strength, and the
strength decides its frames. Every number below was chosen against the two sums
this file already states — the link (`window + next start-up ≤ hitstun`) and the
advantage (`hitstun − recovery`) — and then checked with `npm run chains`.

| | **L** | **M** | **H** | **S** |
|---|---|---|---|---|
| key | `A` | `Z` | `S` | `X` |
| start-up | 4 | 7 | 9 | — |
| active | 3 | 4 | 4 | reserved: |
| recovery | 8 | 12 | 19 | no ki, |
| **total** | **15** | **23** | **32** | no motion |
| `hitstun` | 15 | 20 | 20 | inputs, |
| `cancelBy` | 8 | 12 | — (ender) | no specials |
| `damage` | 5 | 8 | 13 | yet |
| `hitstop` | 6 | 8 | 12 | |
| `onHit` | `hurt_chain` | `hurt_chain` | `hurt_heavy` | |
| advantage on hit | **+5** | **+5** | **−2** | |

> **The table is not what is in the data right now, and will not be until the
> calibration pass.** From 2026-08-23 the moveset is being authored ahead of its
> inputs: what a move *is* — which sprites, in what order, reading as what — is
> being settled first, and what it costs, what button reaches it and what it
> cancels into is being left until there is a whole roster of moves to weigh
> against each other. What a blow *costs* in that period is **one uniform
> placeholder**, the medium row — `damage`, `hitstun`, `hitstop`, `cancelBy` and
> the reaction, identical on every move — on purpose: identical numbers are
> visibly untuned, where a spread of guesses would read as frame data somebody
> chose. The animation's own timing is not part of that and never was: the owner
> sets it by eye in the editor, because how long a pose is held is a question
> about the drawing, and the placeholder only stands in for the arithmetic.
> The attacks built before it — `punch`, `punch_air`, `kick_mid`, `kick_high`,
> `kick_axe` and the crouching set — keep their real numbers; flattening working
> data to make a table look uniform destroys what it took recordings to find.
> **Delete this note when the calibration pass lands.**

**Cancel upward only**, `S` waits at the top for specials that do not exist, and
what the string is today is `A Z Z S` — `punch → kick_mid → kick_thrust →
kick_high`. Three rules go with it:

- **A rung may be repeated, but only with a different move.** A move cancelling
  into itself is a loop with extra steps; a second medium, or a crouching light
  after a standing one, is a different attack on the same step of the ladder.
- **There is no fixed number of blows** — that was a wrong turn on 2026-08-16.
  What a string can afford depends entirely on what it climbs *into*: a light
  costs 8 frames of worst case, a heavy 14. Four lights in a row hold with room
  to spare (+7, +6, +4, +3), while a string ending in a heavy runs out at the
  fourth. **`npm run chains` is the answer, not a number in anyone's head.**
- **Design a string from its last link**, where scaling has taken the most. If
  the end holds, the beginning holds.

**The ender floors an airborne body and spends a relaunch for it.** A blow may not
lower the rank the defender is already in (§7), so the heavy's air reaction has
to rank with a juggle rather than below it — below it, the blow lands, costs
health and does nothing. And because it lifts a body that is already helpless it
is marked `relaunch`, or an uppercut into a heavy into an uppercut would loop.

**Why the heavy is minus on hit and that is correct**: it pushes the defender
out of everything's range, so acting second costs nothing. Its reaction had to
slow down when its hold grew — knockback is `vel × hitstun`, so `hurt_heavy`
went from 5.2 to 3.1 px per frame to keep the push at the 62 it was tuned to.

**Two rules hold for every attack's animation**, whatever its strength:

- **The hit box is out for the active frames and no longer.** It used to be out
  for as long as the drawing was held — 12 frames on the uppercut, where the
  genre uses three or four — which is a drawing setting frame data.
- **The strike pose is held through recovery, without a hit box.** Recovery is
  supposed to be visible: it is what a whiff looks like and what makes it
  punishable. Hitstop had been hiding this, because a blow that lands holds its
  pose for ten frames and a blow that misses holds nothing.

*What this cost, and it is deliberate:* `kick_low` and `kick_finisher` are gone
from `states.json`. They were the middle of a four-link medium string — the same
rung four times, which is what the ladder forbids. `kick_thrust` came back as
the *second* medium, which is a rung repeated legally. The other two sprites are
untouched and unassigned; the moveset rebuild gives them a strength and a stance
(`plan.md`).

### The rule for authoring a string, and the field it is waiting for

**A link in a string is a true combo only if**

> hitstun of the blow ≥ (latest frame the cancel may fire) + (start-up of the
> next attack), both counted from the frame the blow landed.

Everything on the right is the *worst* case, because the player decides when to
press: cancel late and the next attack starts late. Hitstop does not enter the
arithmetic — it freezes both fighters equally.

**Today "latest" means the end of the animation**, since a cancel may fire any
time after the hit. So the length of the attack *is* the cancel window, and that
makes the attack's own frames the first place to look when a string will not
combo.

Measured 2026-08-16 on the medium string, and worth keeping because it is the
whole lesson: `kick_mid` ran 24 frames with a **12-frame active step** — a
hitbox out for a fifth of a second, where the genre uses three or four. That one
step was most of the cancel window: a cancel on the last frame put the next blow
31 frames after the first, which no sane hitstun on a medium can cover. With
hitstun 18 the recording showed the second and third blows landing on a defender
who had just stood up — `1 hits` at the end, no scaling applied, while the
string still *looked* like it was chaining.

The first fix was in the animation, not in the hitstun: the three chain kicks
are **4 active frames** now instead of twelve. Trimming alone made them 16
frames long, and then the whiff read as a flicker — hitstop had been hiding it,
because a blow that lands holds its pose for ten frames and a blow that misses
holds nothing.

That is the moment the field earned itself, so **`cancelBy` exists** (2026-08-16,
`states.json`): the last frame at which an attack may be cancelled. The pose can
now hang for as long as it looks right — the kicks run 22 frames again, with the
leg out and no hitbox — while the window stays where it was. Recovery being long
is a *feature*: it is what makes a whiff punishable.

The three kicks are `cancelBy: 14` against a hit that lands on frame 9, so the
worst case is five frames of window plus eight of start-up — fourteen frames,
against a hitstun of 22 that scaling leaves at 18 by the third link. A test in
`states.test.ts` does that arithmetic against the shipped data, at each link's
own depth in the chain, so the next set of numbers cannot quietly break it.

Two things that follow, and are easy to miss:

- **Scaling makes later links stricter.** The curve shortens each successive
  hitstun, so a window that holds for the first link may not hold for the
  fourth. That is the intended feel, not a defect — but it means a string
  should be checked at its *end*, not at its opener.
- **A string that drops is invisible.** The blows still connect and the
  animation still chains; the only tell is the combo counter resetting and the
  damage not scaling. Which is exactly what a recording shows and the screen
  does not.

### Ki, and the one state that fills it

**Built 2026-08-23.** A separate meter, `ki` in `attributes.json`, filled by
holding **A+Z** (attack + guard in the new scheme; the keys do not move) — `charge_start` drops into the pose, `charge` loops the flare.

**How much a state moves the meter is a field on the state** (`ki`, gained per
frame, spent when negative), not a rule in the engine. A `charge` the engine
knew by name would be a rule the data cannot see, and the first special will
want to name its cost the same way. Today exactly one state sets it, and a test
asserts that.

**It is held, not pressed, and that needed the keyboard to answer a new
question.** Attack buttons were edges only — a press arms one frame and disarms
itself — so two of them would have had to land on the same frame, and whichever
arrived alone would have spent itself on a punch. `held:light` and its three
siblings exist now beside the edges; the edge is untouched, so nothing
machine-guns.

**Charging is a stance, so it settles before any button is read** — the same
rule crouching already follows, and it sits directly after it in every grounded
neutral state. Crouching still wins: down is the first word a stance says. The
forgiving consequence is that pressing A a frame early throws a punch and then
drops into the charge when it ends, with both keys still down.

Nothing spends it yet. Vanish, the fast dash and the specials are what it is
for, and all three are still unbuilt.

## Open

- ~~**The resource.**~~ Settled 2026-08-23: **separate**, not the original's
  shared bar. The coupling that made it worth deciding first still holds and now
  reads the other way — Vanish costs ki, so escaping while nearly dead is
  *possible*, and the escape's floor is a resource you can refill rather than
  one you die of spending. What that costs us is the original's tension, where
  a special and a beating ate the same pool; it can come back as a second cost
  on the same button rather than as a shared bar.
- ~~**Whether Vanish also escapes an ongoing combo**, not only guard pressure.~~
  Settled 2026-09-26: **no** — never from a reaction, only from neutral, guard,
  blockstun and the air (§5).
- ~~**Whether a downed fighter is hittable at all.**~~ Settled 2026-08-15, in
  two halves. Rank 4 made `bounce`, `downed` and `getup` un-interruptible by
  consequence rather than by special case; the recording then showed the other
  half missing — a refused reaction still cost 14 health. They are now
  `invulnerable`, so nothing connects there at all.
- **The CPU.** Everything above assumes an opponent; a large unbuilt system.
- **Whether a second human ever plays** (Q8). It does not change the structure —
  that is the point of designing for it — but it decides how forgiving the
  scaling curves have to be, and that is a tuning pass, not a rewrite.

## What depends on what

Not a queue — `plan.md` decides what happens when. But the dependencies are
fixed: **hitstun** comes before anything that scales it, and **reaction rank**
is independent of all of it and already fixes two known bugs. The counter and
its three scalings come as one piece, because a counter nothing reads is dead
weight. Relaunch, strings, corner knockback and Vanish each stand alone afterwards.
