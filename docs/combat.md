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

Burst Limit's layout, on an Xbox pad and on the keyboard as emulators lay a
pad out (owner, 2026-11-24; `inspiration.md`). Which key is which is
`input/layout.ts`'s, and nobody else's.

| button | pad | key | what it does |
|---|---|---|---|
| move | d-pad, left stick | arrows | walk, jump (↑), crouch (↓) |
| **Guard** | A | `Z` | held, a stance that blocks; tapped at the right moment, vanishes (§5) |
| **Ki** | B | `X` | the ki blast; forward + Ki is the kamehameha, back + Ki the ← ↙ ↓ ↘ → one, down + Ki the ultimate |
| **Attack** | X | `A` | the rush: pressed again, walks the string one blow further |
| **Smash** | Y | `S` | ends the string, at any depth, with a heavier blow |
| **Charge** | LB | `Q` | held, fills the ki meter |
| **Boost** | RB | `W` | held with a move that charges, has the whole charge at once, for ki |
| **Strike** | LT | `E` | the original's X, for its senders, until they are ours |
| **Throw** | X + Y | `A` + `S` | Attack and Smash together, the opponent in reach (`grab`), ahead of either alone, for every fighter (owner, 2026-11-26); the other a frame or two late turns the A1 or Smash just begun into it (`throwIn`) |

The other trigger, Start and the grab and taunt of Burst Limit have nothing
yet. Attack and Smash play `rush_1` and `smash` from standing, the
original's standing blows (`data/template/`); the rest of what the
cartridge's fighters do is still the original's own moves (`plan.md`),
Strike and Ki being its X and A, until it is reworked to these rules. Where the original's charge (Y + B) refills health, its one
pool, ours fills the **ki** meter, and a special costs ki rather than health:
its command row's price, and it does not come out without it. The meter holds
60 — six levels of 10, the HUD's six bars, so a cost of 5 or 10 is half a
level or one — and every fighter starts a fight with 30 (owner, 2026-11-24).

**The rush is a tree.** Attack walks one line, and a direction + Smash
branches off it at any depth into the ender that direction names — the
player picks the end, the depth does not (owner, 2026-11-26). Smash alone is
Smash alone, in the rush as standing:

```
A → A → A → A
↓   ↓   ↓   ↓
→S  →S  →S  →S     S1
←S  ←S  ←S  ←S     S2
↓S  ↓S  ↓S  ↓S     S3      (S alone: Smash, anywhere)
```

A direction is a choice: one held out of habit picks for him, on purpose — a
direction means what he asks for, not where he walks (owner, 2026-11-26).

**A fighter has a rush only once the owner accepts how it plays** (owner,
2026-11-24); until then Attack is one blow. Goku's is the Quad Kick's four
kicks with an ender at each depth, Freeza's three of the original's standing
blows (`rush.test.ts` holds them to their picks); Gohan's, accepted too, his
Bakuretsu's four punches. **A fighter brought over** takes his senders for
his Smashes where they fit (owner, 2026-11-26): the up sender for Smash
alone, the side one for S1, the down one for S2 — Gohan's is a dive from the
air, nothing a charge can stop on, so his S2 is, to try, his Strike's
backhand (`b_9a`, frames 110 to 114), charged gathered, its wind-up cut to 5:
the role is S2's, the stun, only the way in his (owner, 2026-11-26) — and
his S3 the Rushing Uppercut. Gohan's Smash alone is the Zankuu Kyaku, a
leaping kick he charges crouched as the original starts it (`stopOn` in his
`rush.json`: a charge may stop on a pose earlier than the last). **Each press is
one blow**, each seen whole, Attack's stepping forward — A4 too, or it falls
short — and every S thrown where he stands: a press made any time
during a blow is kept until its cancel opens (`StateMachine`, `cancelable`),
rush_1 and rush_2 are a `flinch`, and `npm run chains -- goku` shows the
windows. A rush is three picks, one animation a slot, each a whole blow a
fighter can stop on, since he cannot know another press is coming — judged
by eye, as no field of an animation says it; the step and the windows are
computed from the picks (`combat/rushSlots.ts`). The cartridge's own whole
blows are few — a special's parts end mid-motion — so a fighter has **basic
blows** cut from his longer animations, an ultimate's quick run first, each
closed by his stance (`basics.json`); the panel lists them first. The debug panel tries
player one's under his readout (`ui/rushPicks.ts`, the scene's `rush1`,
taken by the running fight in place: `Scene.take`) and shows each link's margin, and plays the whole rush faster or slower — its
tempo, 70% to 150% (`rushTempo.ts`), tried before a blow's own speed goes
into its recipe as `slow`; the bar above the game scales every blow's
hitstop the same way, tried before `data/hit-types.json` is changed; it keeps
nothing — an accepted rush is its picks in his `rush.json`, and `npm run
states` makes the rest. Which blow stands where is still to choose.

**How each end of the rush is taken is a rule, the same for every fighter**
(owner, 2026-11-25); only the animations are his. A4 and S1 send him off (`knockback`), S2 floors him (`down`), S3 lifts
him (`launch`) for a ki follow-up — provisional, as `EFFECTS`
in `combat/rushSlots.ts` says; the panel tries another effect on any slot.
Goku's S3 cancels into back + Ki, his upward Kamehameha, and every A and S
of his into forward + Ki, from the frame its hit box is gone (owner,
2026-11-25); Gohan's the same, his S3 into back + Ki, his Masenko (owner,
2026-11-26). A slot's own ways out stay through a new pick.

**A direction + Smash asks for an ender wherever Smash is pressed** (owner,
2026-11-25), for every fighter: forward + S is S1, back + S is S2 (swapped
2026-11-26), down + S is S3 — standing, crouching (over the crouching Smash) and at any depth of
the rush, where Smash alone is Smash (`AIMS`, `combat/rushEntries.ts`). The
direction counts alone, so down-back + S crouching is still the crouching
Smash. It wins over a command of the cartridge on → + S: Goku's Double Kick
and Vegetto's Forward Kick have no way in. A depth's window is timed by its
own ways on, Attack and before A4 every ender; Smash alone, and anything off
A4, may not be a combo (`npm run chains`). Every fighter has S1–S3; all but Goku's and Gohan's are the
standing Smash, the crouching one and the crouching Attack until picked, and
their Attack, still one blow, does not lead into them yet.

**S1, S2 and S3 charge while Smash is held** (owner, 2026-11-26), Goku's first
(`charge` in his `rush.json`, `combat/smashCharge.ts`, which holds the
numbers). S3 lifts him higher each level; S1's tap still staggers him, and
from the first level it sends him off (`sendoff`): flat, in the pose of a
body sent to another arena but kept in this one, further each level. S1's
kick stays out longer and drives him forward on it, raising dust, faster and
further each level (`lunge`). S1 and S3 end a combo; S2 opens the next:
Goku's is his down sender's kick (`b_a1`, frames 108 to 110 and 5 as `ma1`
has them, its wind-up cut from 18 frames to 6 to combo off the rush, and
no hop), driving him a little way forward, raising dust (`lunge`); its tap only staggers him, Goku's (his `rush.json`), and from the first level he is stunned (`crumple`):
pushed back — the less the harder, least where it breaks a guard
(`pushes`) — into the light reel's pose and held there, with no pause on the
blow and nothing on the art, so he who struck goes on at once
(owner, 2026-11-26: a pose held alone, a loop and a slow motion all looked
wrong) — longer each level, open to a new rush, then on his feet again — once a combo,
the second floors him (`oncePerCombo`) — and its top breaks a guard
(`breaksGuard`): the answer to a guard and to a charge braced against blows.
Below, S3 stands for any. He stops on the wind-up's last pose and lets go when Smash does —
nothing else he presses counts — or by himself at the top: a tap is the
plain S3, which lifts him low so he is soon down; held longer it is one of
three levels, each worth more and lifting higher, the top whitening the
screen. Each level begins with a flash, and he blinks into his `charge`
colours from there, faster each level; the second begins with Saiyan
Meteor's ball charging too, the only sound of it. Begun while the opponent is still reeling from a hit
(the `combo` trigger) it starts at the first level and reaches the second in
a few frames, so a charged S3 can end the rush; held past that the combo is
his to drop. It can be blocked. The first level is free and each past it
costs 5 ki; where he cannot pay for the next he lets go at once, with the
level he has — every charge so (`ki:N`). Once stopped in the pose he cannot be stopped: every
blow is blocked where he stands for 5 ki, the charge going on, pushed back as
a block is, and lands once he has too little — a throw takes him, and the
push may leave the blow short (`braces`, `entity/block.ts`).

**Boost (RB) held with a move that charges has the whole charge at once**
(owner, 2026-11-26), for what the charge costs and a bar more. The rule, one
for every move (`entity/boost.ts`): the move's own charge — its states, so its
drawings, ball, flashes and sounds, nothing of the boost's own — plays to its
top fast, the button held for him, in 18 frames whatever it takes by hand,
while the opponent, his hitstun and every bolt stand still and the arena's
art dims; it ends as he leaves the charge, the bar paid then. A freeze of
both broke the flow; one that leaves him moving does not. A move says only
where its charge begins and how long it takes by hand (`boosts`) and which
states are the charge (`charging`): the enders' are made so
(`combat/smashCharge.ts`), the Kamehamehas' are in `specials.json`. Without
the ki the move goes at once uncharged — standing, crouching, in the rush,
or breaking off the ki charge.

**Goku's Smash alone is his up sender's hop** (owner, 2026-11-26; `m9f`,
his `overrides.json`): he crouches, hops forward on the blow and lands into
`land`, sending nobody anywhere. It charges as the enders do, and lifts him
at every level (`lift`): its blow takes him along (`carries`), flying as Goku
does, so the two stay level the whole way, higher each level. Once his blow
is spent he has a jump's moves (`inputsOf` `jump_fall`): the air Attack and
Smash and the dive — no chain of the air's own (owner, 2026-11-26). Lifted,
he is a reaction of the lowest rank, so a blow in the air juggles him. An ender new to a rush takes only Smash's
blow — its cost, sounds and type — never how it moves (`rushSlots.ts`).

**In the air** (owner, 2026-11-26), forward + S is the fighter's dive: the
cartridge's → ↓ + Smash move — Goku's Slash Down Kick and its kind — or the
nearest he has: Cell's Negative Arrow and Gotenks's Air Dive (→ ↓ + Attack
there), Mr. Buu's Butt Drop (↓ + Smash). Vegeta has none, and Smash alone in
the air stays the jumping blow.

**A1 has a close version, A1c**, thrown instead when the opponent is within
the fighter's `closeRange.attack` — Goku's knee where his kick would reach
past (owner, 2026-11-25). It leads on as A1 does; a fighter without one
throws A1 at any range.
**Down + Attack is a sweep** (owner, 2026-11-26), every fighter's: the
crouching Smash's low kick (`crouch_b`, `m95`), not the crouching Attack's
uppercut, which nothing leads to; the air has one attack and one smash. There is no depth to step into, so down is **crouch**, and up is
**jump**.

**Guard is a stance, not a direction.** A blow is blocked only in a state marked
`guarding` — the stance and the blockstun it leads to — or one that
`braces`, which blocks where he stands for ki (a charged ender). It blocks high
and low alike; crouching only lowers the hurt box, so a high blow misses a crouching
body because the boxes miss.

**Specials are the cartridge's commands** while the port stands (ADR 0050); how
ours are asked for comes with the rework, one move at a time (owner,
2026-11-24), each in place of the cartridge's command:

- **Forward + Ki**: every fighter's ↓ ↙ → Ki move — the Kamehameha and its
  kind, or what the fighter has there instead.
- **Back + Ki**: every fighter's ← ↙ ↓ ↘ → Ki move (owner, 2026-11-25) —
  Goku's upward Kamehameha, Big Bang, Death Ball, Masenko and their kind.
- **Down + Ki** is the **ultimate**: the move the cartridge kept for health 80
  or less, now for any health at 30 ki. Cell has two: Bakuretsu Rush on
  down + Ki, Tri Eruption with Charge held as well. Vegeta's Galactic
  Gunfire keeps its 64 px and its start just off the ground.

**Goku and Gohan ask for nothing by the cartridge's commands any more**
(owner, 2026-11-26): a motion of more than one direction is not ours. A is the
chain, S and Ki take a direction; what is left of his moves — the Knee
Slash, Double Punch, Spin Kick, the senders, Large Ki Blast, Side Slash, the
teleports, and Gohan's alike — stays as states nothing leads to, their
animations' stock. Vanish
comes for every fighter without an animation of its own. The others keep
their commands until each is brought over.

A direction counts only alone: down-forward or down-back + Ki is none of them, and plays the ki
blast. Where a command of the cartridge also ends in that direction and Ki,
the command wins (`inTableOrder`, `rom/entries.ts`). One thing about it is settled
(owner, 2026-10-31): directions count in the order they were **pressed**, so a ↙
held through ↓ ← → is not also ← ↓ →.

**A command on the ground is still read just after takeoff** — for the
cartridge's fighters, whose commands are the original's (ADR 0050): for
`TAKEOFF_GRACE` frames off the floor (`input/command.ts`) both tables are
read. The original's jump stands 2 frames on the floor and reads the
ground's only there, so Galactic Gunfire's ↑ ↓ Y had to follow ↑ within a
frame; ours leaves time to roll it (owner, 2026-11-03). Only a jump state
with an entry for the move lets it out.

**Ki is its own meter**, filled by holding Charge. A state that spends
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
| long | `lo` | the original's jump attacks: the light reaction's pose held 24 frames |
| high | `hi` | the original's high knockdown (move `1e`): thrown steeply up, hittable until it lands |
| trip | `tr` | the original's short knockdown (move `19`): no bounce, up again 12 frames after landing |
| halt | `ha` | the original's heavy reel stopped dead, no push (`$0D:D622`) — Saiyan Meteor's opening blow |
| crumple | `cr` `cl` `cx` | pushed back and stunned on his feet, the light reel's pose held, no pause on the blow, 40, 55 or 70 frames, open to a new combo, then standing; once a combo — a charged S2 |
| lift | `lf` | taken up along with the attacker, level with him the whole flight (`carries`), down flat on landing — Smash alone, charged or not |
| sendoff | `so` | thrown flat across the screen; off its edge he bounces back, a little health and a thud, no burst yet, and can be hit on the way (`wall_bounce`) before he lands and lies — a charged S1 |

In conversation a blow is written as its code plus **any frame of the move** —
`fl30 fl39 la187` — and `npm run which` says what that points at.

**An animation is the cartridge's move**, named by its id (ADR 0017), and one may
serve several blows. It always plays through; a pose held longer is another
animation, not a field on the blow.

## Chaining

**The first frame a fighter can act takes what he asked for** (owner,
2026-11-24): a state entered on a frame reads the buttons, directions and
commands on that same frame (`StateMachine.entered`), so a move ending loses
no frame before the next and the buffer keeps a press its whole window.

- **Link** — the attack finishes, control returns, the defender is still in
  hitstun. It falls out of hitstun against recovery; nothing builds it.
- **Cancel** — the attack is interrupted by the next one, through the
  `cancelable` trigger: from the frame its last hit box is gone — the last
  frame, if it is drawn to the end — up to its `cancelBy`, so the swing is
  seen whole and the next blow follows it rather than lands on top of it
  (owner, 2026-11-24; `cancelWindow` in `combat/swing.ts`). Its button,
  pressed any time in the blow, is kept until then, not for the buffer's 12
  frames. A miss gets the
  same window as a hit, so a string goes on whether it lands or not — an
  experiment; what punishes a whiffed string is still open.

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

**Off while the port stands** (owner, 2026-10-29): `comboLimits: false` in
`data/rules.json` switches off this and the relaunch budget (§4) for both
sides, so the cartridge's numbers can be compared with the original's.

### 4. Relaunch

A blow whose type may lift or floor a body that is already helpless spends from
a budget (`RELAUNCH_LIMIT`, `combat/combo.ts`). Past it the blow still hits and
hurts, but the victim keeps falling on the arc they were on. Only a *re*-launch
counts: the opener lands on someone in control of themselves.

### 5. Vanish — a counter, not an escape; and a chase

**The chase is built** (owner, 2026-11-26): while the opponent flies off a
charged S1 (`sent_off`, `chaseable`), RB pressed (`pressed:boost`) spends a bar
and he vanishes — not drawn, no effect or sound yet — comes out past the
opponent on the side he flies to, as far as his S1 reaches, facing him,
while the opponent stands still, and throws his S1's first level again,
sending him back: up to three times a combo (`chased:N`), the opponent bounced
from side to side, then on to the wall. Made with every S1 that charges
(`combat/smashCharge.ts`). The sendoff spends no relaunch: a throw across,
not a lift. Its flight is drawn as a body sent to another arena, which has
no boxes; it stands in the heavy reel's body (`boxesOf`), or nothing could
hit it.

**The counter is not built yet.** Guard tapped just before a blow lands teleports behind the
attacker, for ki; early, or without the ki, it is an ordinary block. From
neutral, walking, crouching, guarding, blockstun and the air — **never** from a
reaction or from one's own attack, so it never breaks a combo, and scaling and
the relaunch budget stay the only things that end one. In the corner it lands
behind and swaps sides; against a projectile it lands behind the shooter.

### 6. The corner

Being backed against the wall is meant to be dangerous, but escapable.
**Knockback that cannot be spent on the defender is spent on the
attacker**: a shove into the screen's edge passes to the other fighter,
reversed (`combat/corner.ts`, the original's `$0D:C8F0`, ADR 0081) — except
from the standing reels, which the original keeps at the wall too. The same
principle `push.ts` uses when one body is pinned.

### 7. Reaction rank

Flinch 1 < stagger 2 < knockdown 3 < on the floor 4, and **a blow never lowers
the rank the defender is already in** — it still lands and hurts, and the
victim keeps doing what they were doing. An equal rank re-enters, which is what
a combo is. Rank is compared after the air version is chosen, so a flinch on a
falling body becomes a juggle. Nothing forces rank 4, and a fighter on the floor
is `invulnerable`.

### 8. Fatigue

Hits taken, counted (owner, 2026-11-24): every hit counts one — a blow, a
shot, a throw, a scene's last blow — and a blocked one none, as the
original's does; nothing wears it off (`combat/fatigue.ts`). The twentieth
spends him, and the count starts again. Simpler than the original's stun
gauge, where each blow takes its own amount and the gauge refills, and it
leaves blocking alone: a guard that wears out is a guard break (`plan.md`).

Spent, he goes the original's way, in place of the hit's reaction: he
**collapses** (`1d`), thrown up and away, bouncing twice and lying
untouchable; gets up; and stands **tired**, bent over (`40`), for 300 frames,
where any blow ends it. Pressing buttons there shortens it in the original,
three frames a frame; not yet in ours. A KO goes first: a hit that empties his
health does not count.

## How the engine plays a blow

What the engine does today, in the order a blow happens. A field's exact
meaning is its declaration in `src/entity/states.ts`; why it is shaped so is
in `adr/` (0003, 0013, 0014, 0019, 0035).

- **The state.** A state plays one animation and leaves only by a transition
  in its data (ADR 0013). A blow is a state with a hit type and its own damage
  (ADR 0019); a move the cartridge cuts into parts is a state per part.
- **Contact.** A hit box overlapping a hurt box lands once per swing. The
  defender's `defence` comes off the blow's damage, then the combo scales it
  (§3). The type names the reaction; the defender's state may redirect it by
  `ifAirborne` / `ifCrouching`, and a stance blocks into its own `guard`, the
  file's `onGuard` otherwise. A body hit again in a reaction that says
  `ifHitAgain` goes where that says for its first few blows.
- **The pause and the stun.** Hitstop freezes both fighters and every bolt;
  hitstun then runs on the defender (§1).
- **The spark** stands at the leading edge of the boxes' overlap for a melee
  blow (`impactPoint`, `combat/hit.ts`) and at its middle for a bolt — ours,
  not the cartridge's, which puts it between the boxes' centres. A blow that
  says `hitLight` leaves light where it landed (`combat/hitLight.ts`).
- **The shove.** A reaction's `shove` starts at its speed and loses 0.25 px a
  frame (`combat/knockback.ts`); one that reaches the screen's edge passes to
  the attacker (§6). An attack's `launches` replaces the launch of the
  reaction it sends into.
- **Bodies.** Two fighters are kept apart by their drawings' `push` boxes —
  body and head, each against each, in the air too — half the overlap each
  (`combat/push.ts`). A drawing without them, and a held body, push nothing.
- **In the air.** A state's `air` sets vx, vy and gravity on named frames, the
  move's handler's order (`entity/air.ts`); `velAt` does the same on the
  ground.
- **Spawns.** A state `fires` a bolt or puts out an effect (ADR 0014): a bolt
  has a `foe`, its own blow and the fields its object's code gives it
  (`outlivesHit`, `rides`, `endsWithMove`, `burstsAbove`, `landsAs`); an
  effect rides its owner by `follows`.
- **Holding the opponent.** `grab`, `seize`, `finale`, `frees` and `throwsFoe`
  move the other body from the holder's state (ADR 0035).
- **A parry** is the defender's own move: a state with `parry` turns an armed
  blow whose hit box touches his back on the striker, unless the striker's move
  is on his fighter's list (`match/parry.ts`, read by `src/rom/parry.ts`).

## Movement

The walk is a bob — the sheet has no walking legs — so the fighter really moves
by **dashing**: a slow dash that is free and a fast one that costs ki. Neither
is built. The dash will decide how the corner and spacing play.

**The dash is forward or back tapped twice and held**, the taps up to 12
frames apart (`input/doubleTap.ts`). It took the original's hop's gesture, and
the hop is gone (owner, 2026-11-24); its button went to the charge, RB to the
boost (owner, 2026-11-26).

## Where the fight happens

**One arena floor, no fight above it** (owner, 2026-10-31). The original's
blows that send the opponent to another part of the arena (Goku's `9f`,
`a0`, `a1`) are wanted, with the flight between the two — but not the ones
that send him up, into a fight in the air: there is no fight in the air,
and there will be none (owner, 2026-11-03; again 2026-11-07, after an estimate
of what the original's flying arenas and moves would take: the arenas 1, 2 and 6
stay out). Its winner's pose, `82`, is
one of two the winner strikes at random; not Gohan's, which does not fit on the
ground (owner, 2026-11-04: off for now, `plan.md`).

**A sender's ways are ours, built on the cartridge's** (owner, 2026-11-07;
`src/arena/ways.ts`). Up (↓ ↘ → X) leads from every floor to Kami's palace;
sideways (→ ← → X) goes round the floors — plains, tournament, ruins, shore —
the way the attacker faces; down (↓ ↙ ← X) leads from the palace to the
tournament or the plains, by the half he stood in. Every other way is closed,
and the blow is only its knockdown. A lighting goes along where the arena has it. Sent up, both come in from below the new
floor; sent down, from above (owner, 2026-11-07; ADR 0081). The debug scene's
"arena change" switch (`J`) closes every way while it is off.

**A body in flight keeps one way round** (owner, 2026-11-06). The cartridge
turns the opponent of Flaming Headbutt upside down as he falls and mirrors him every
few frames (`rom.md`). Ours keeps him one way round, head up, on purpose.

**A body being lifted keeps quiet** (owner, 2026-11-06). The cartridge gives Psychic
Lift's victim his voice at each of the two bursts and none at the throw (`rom.md`).
Ours gives him one, at the throw.

**No arena has black shapes in front** (owner, 2026-11-07). The cartridge draws
silhouettes over the foreground of arenas 4, 5 and 7 at double speed (`rom.md`).
Ours leaves them out on all three.

## Where it is going

Once every fighter is ported (the owner, 2026-11-04): close to Budokai 3 and
Burst Limit, much simplified. A vanish attack, strings joined up — a combo, a
launch, a vanish and on — an aura mode. Inspired by them, not copied: a mix
with the owner's own ideas ([`inspiration.md`](./inspiration.md) says what
those games do). None of it is settled in detail; what comes first:
[`plan.md`](./plan.md).

## Open

- What punishes a string thrown at nothing.
- `stun` — a blow that holds the opponent long enough for something else; and a
  hit type for ki blasts.
- Deferred, not rejected: an offensive vanish after one's own smash, a throw, an
  aura burst, transformation, a taunt, and forward/back variants of the
  rush.
- The CPU, and whether a second human ever plays — the second decides how
  forgiving the scaling has to be, which is tuning, not structure.
- What a first playable game is: which fighters, arenas and modes, and whether
  a story mode or local two players come first.
