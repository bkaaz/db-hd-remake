# Combat — the system we are building toward

This file describes **the fight we want**, the way
[`game-overview.md`](./game-overview.md) describes the 1996 game. It is not a
queue — [`plan.md`](./plan.md) is the only one — and not a decision log;
[`decisions.md`](./decisions.md) holds the reasoning behind each choice as it is
settled. What lives here is the shape, so this conversation does not have to
happen twice.

Everything below is judged against one brief, settled 2026-08-15: **the fight
should be dynamic, the way Dragon Ball is dynamic.**

## Where it comes from

The combat system is ours. Hyper Dimension binds us on the roster and the
sprites and nothing else — the owner dislikes the original's fighting, and that
is a main reason this remake exists.

| layer | reference | what we take |
|---|---|---|
| **rules** | Dragon Ball FighterZ | the combo skeleton: one counter, three scalings, a hard cap on re-launches, and a teleport escape that costs a resource |
| **flow** | the Budokai games | strings you flow through rather than execute — a low barrier to looking good |

**We take an architecture, not frame data.** No number in this file or in the
data is FighterZ's; theirs is undocumented to us and every value here is ours to
tune. Presenting a guessed constant as a reference game's would be inventing a
source.

What we deliberately **leave**: 3v3 and assists, Sparking Blast, the Dragon
Balls, Dramatic Finish. Open rather than rejected: a homing dash (very Dragon
Ball, but it is a movement system, not a combat one) and how many levels the ki
resource has.

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

### 2. The combo counter — one integer, on the defender

Starts at zero, increments on every blow taken, and **resets when the defender
recovers control or settles on the ground**. It drives everything below, so the
whole system has exactly one piece of state to reason about and one place to
inspect when a combo does something surprising.

### 3. Three scalings

| scaling | what it does | what it prevents |
|---|---|---|
| **damage** | the fifteenth hit takes off a fraction of the first | a long combo being a whole round |
| **hitstun** | each successive blow holds for less | corner loops — the defender eventually recovers before the next blow lands, so the combo ends *itself* |
| **launch / gravity** | each successive lift raises less | endless juggling — the victim falls out |

The reason to prefer curves over per-move budgets is not elegance, it is the
scale of the authoring ahead: three curves in one file, versus a juggle cost to
be filled in on each of several hundred moves that do not exist yet. The second
kind of system does not get finished.

### 4. Smash — the hard limit that scaling cannot give

Scaling is soft: it makes a fourth uppercut weak, never impossible. Some things
should be impossible. A blow may be marked as able to **re-launch or re-knock
down**, and only a fixed number of those may land in one combo. Past the limit
such a blow still hits and still hurts — it just does not lift or floor the
victim again, who keeps falling on the arc they were already on.

This is the answer to "an uppercut cannot juggle forever", expressed as a rule
about re-launching rather than as a counter of uppercuts, so it holds for every
launcher anyone adds later.

### 5. Vanish — the escape, and why it is not the limiter

A teleport behind the opponent, bought with the resource, on a well-timed input
while guarding (owner's request, 2026-08-15).

It is **not** what stops infinite combos, and the distinction cost one wrong
turn already: an escape is a resource, resources run out, and a system whose
only floor is a resource has no floor — a player out of ki would be juggled to
death regardless of skill. Every working fighter layers a structural limit that
is always on (§3, §4) with a situational escape. Vanish is the second kind.

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
uppercut into an uppercut juggles: that is precisely the hole §4 exists to
close, and it is still open.

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

**Light, Medium, Heavy, Special — FighterZ's scheme, taken whole.** Strength
rather than limb: which blow is a punch and which a kick is the character's
business, not the player's. Guard stays on back, which is what FighterZ does and
what we already do.

**S is the ki blast and the default chain ender, not a special-move button.**
Real specials are motion inputs, so command recognition is a prerequisite for a
character having anything beyond normals rather than a later luxury.

The scheme hands the moveset its shape — three stances × three strengths is
**nine normals**, plus what S does in each:

|          | L | M | H | S |
|---|---|---|---|---|
| standing | · | · | · | ki blast |
| crouching | · | · | · (launcher) | |
| air | · | · | · | |

**The chain rule comes with it, and it is one sentence: you may cancel into a
stronger button, never a weaker one.** `L → M → H → S`. An ordering, not a table
of permitted transitions — which is why it survives a character gaining a fifth
kick variant. Switching mid-chain lands at the same depth or deeper, never back.

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

## Open

- **The resource.** Shared health/Ki bar (what the original did) or separate.
  It is coupled to Vanish: if escaping costs health, escaping while nearly dead
  is impossible — either the best thing in the design or a death spiral. Decide
  the resource before the escape.
- **Whether Vanish also escapes an ongoing combo**, not only guard pressure.
- ~~**Whether a downed fighter is hittable at all.**~~ Settled 2026-08-15 by
  consequence: `downed` and `getup` are rank 4 and nothing forces rank 4, so
  they cannot be interrupted. Wake-up invulnerability without a special case.
- **The CPU.** Everything above assumes an opponent; a large unbuilt system.
- **Whether a second human ever plays** (Q8). It does not change the structure —
  that is the point of designing for it — but it decides how forgiving the
  scaling curves have to be, and that is a tuning pass, not a rewrite.

## What depends on what

Not a queue — `plan.md` decides what happens when. But the dependencies are
fixed: **hitstun** comes before anything that scales it, and **reaction rank**
is independent of all of it and already fixes two known bugs. The counter and
its three scalings come as one piece, because a counter nothing reads is dead
weight. Smash, strings, corner knockback and Vanish each stand alone afterwards.
