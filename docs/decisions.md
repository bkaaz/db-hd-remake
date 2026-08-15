# Decisions log

Decisions that are settled. Newest first.

## 2026-08-15 — Being hit again restarts the reaction

- **The medium string was not a true combo**, and the reason was not the one
  written down an hour earlier. The first recording showed the defender
  recovering three frames before the third blow arrived, and that was diagnosed
  as hitstun being too short. It was wrong.
- **`setAnim` returns early when the animation name has not changed**, which is
  right for a transition — `walk_fwd → walk_back` should keep one cycle running
  rather than stutter — and exactly backwards for a blow. Re-entering `hurt`
  from `hurt` left the reaction playing from wherever it had got to, so **the
  second hit refreshed nothing.** The log said so plainly: `P2 hurt 1/1 4f` at
  the moment of a fresh hit, where it should have read 12f.
- **A forced state restarts its animation; a chosen one does not.** That is the
  distinction the guard was missing, and it is the same one the rest of the
  engine already draws between transitioning and being made to go somewhere.
- **The rank rule said equal rank re-enters "because that is what a combo is".**
  It was right, and it had been silently failing to do it since the day it was
  written.
- **The data was always fine.** With the restart, the arithmetic works out with
  frames to spare: the attacker cancels one frame after the pause and spends
  eight on start-up, against twelve of flinch.
- **The chain now has a timing test as well as a distance one** — reaction
  length against `1 + start-up`, with the hit pause cancelling out of both
  sides because it freezes attacker and defender alike. It passes today and
  fails if the flinch is shortened by so much as a frame past the margin.
- **The recording's `gap` is reported in sprite px**, like every other distance
  in the project. It was screen px, which is the same number multiplied by a
  scale of 3 — unusable for the one question it exists to answer. Noted beside
  it that it is still not a *direct* comparison with reach, because a blow
  arrives at the defender's hurt box rather than at their anchor.
- Worth keeping: **the log found this on its first use**, and found it by
  printing a number nobody would have thought to ask for.

## 2026-08-15 — Two ways to see a chain, because they answer different questions

- **Scripted chain tests** (`src/entity/chains.test.ts`) drive the *committed*
  `states.json` frame by frame and assert the path: medium three times walks
  mid → high → low, a whiff stops it, no press stops it, the sweep chains into
  nothing. The state machine is pure, so this needs no browser and no owner —
  which is the difference between authoring a string and being able to check it,
  and being able to check it only by asking somebody to play.
- **A recording** (`src/log.ts`, `L`) writes what actually happened to
  `logs/session.log`, gitignored. It exists because the owner and Claude cannot
  see the same thing: one knows how it felt, the other knows why. Without it the
  gap is bridged by reading numbers aloud.
- **Events, not frames.** Sixty frames a second times two fighters is six
  hundred near-identical lines for ten seconds of play — unreadable, and it
  buries the causes in the data. A fight's interesting moments are discrete, and
  one combo attempt comes out as about twenty lines.
- **Every line carries both fighters and the gap since the last line.** The
  first draft printed one fighter per line with an absolute frame number, and
  the owner was right that it was near useless: reconstructing what the other
  body was doing meant scanning upwards, and "how many frames after the hit did
  the cancel come out" — which is nearly every question in a fighting game —
  meant doing arithmetic by hand. Both are now on the line that raises them.
- **Presses entering and leaving the buffer are recorded**, with a *spent* /
  *EXPIRED unused* distinction inferred from the frames left on them. That is
  the answer to "did the game eat my input", and the inference is guessy enough
  to be worth its own test — a wrong guess sends the reader hunting a bug that
  is not there.
- **On demand, not always.** `L` starts and stops, and starting discards the
  last one, so the file holds *what you just did* rather than four hours of
  noise. That is the only thing that makes it readable.
- **It describes, it never computes.** Everything recorded is something the game
  already worked out for itself. The rule has teeth: the trigger that fired a
  transition would have been nice to print, and reinstating a field to carry it
  would have broken the rule — so the line prints the target state instead,
  which identifies the transition anyway because two of them rarely share one.
- **The lines are made in `match/record.ts`, not in `Entity`.** That layer is
  what knows which body is P1; a body neither knows nor should, and naming one
  so a log line could print it would be the recording changing the game to suit
  itself. It spots things by comparing public state between frames, so nothing
  is added anywhere for it to read — and a blow logged with no state change
  after it *is* the signature of a refused reaction.
- **`landBlow` now returns what happened** instead of swallowing it. Driven by
  the recording, but a real gap regardless: `exchangeBlows` could not previously
  tell whether anything had occurred, and a hit counter will want the same.
- **Not covered:** how any of it felt. A recording says what the engine decided
  and never whether it was any good. Timing and feel stay with the owner; this
  only replaces the transcription.

## 2026-08-15 — A debug readout, and the combo counter it needed

- **`D` prints what the engine thinks about both fighters**: state, rank, the
  step and frames left in it, whether the current attack has confirmed, hit
  pause, health, horizontal velocity, what is alive in the input buffer, and the
  combo count. Plus the gap between them, once, underneath.
- **Two fixed columns, not text above each head** (owner's choice after the
  argument), **on by default**, and the pairwise gap dropped from the middle of
  the screen — it belongs in the recording, beside the blow it explains. Labels attached to a body earn their place when there are many
  bodies; with exactly two they only cost. Fighters stand 30–60 px apart during a
  combo — which is precisely when these numbers are read — so attached blocks
  would overlap and jitter exactly then, and swap sides on a cross-up.
- **Pairwise facts go in one place.** The gap belongs to the pair; printing it
  above both heads invites two copies of one number to disagree.
- **One `Entity.debug` getter rather than six public fields.** `spent`, the
  buffer, `freezeFrames` and `vx` are private and should stay that way; this is
  scaffolding and deleting `src/ui/debug.ts` plus that getter removes it whole.
  Nothing in the game may read it — a rule that needs one of those numbers gets
  its own name for it.
- **The combo counter was built properly rather than faked for the readout.**
  "Combo stats" described something that did not exist: `combat.md` §2 is one
  integer on the defender, and all three scalings will hang off it. Inventing a
  second one for a debug line is how two counters that disagree get born — the
  same mistake we talked ourselves out of over knockback.
- **It lives in `src/combat/combo.ts`, pure and tested**, because the scalings
  that will read it have to be testable. It counts hits and damage, and
  **resets on entering any state of rank 0** — so "recovered control" needs no
  separate signal and no timer: not being in a reaction *is* the reset, which
  means the count cannot drift out of step with what the fighter is doing.
- **A blow refused a reaction still counts.** A jab at someone already on the
  floor changes no state but did land, so the counting sits in `hurtBy` rather
  than beside the reaction.

## 2026-08-15 — Being helpless outranks being hit lightly

- **A reaction carries a `rank`** — flinch 1, stagger 2, knockdown 3, on the
  floor 4 — and **a blow never lowers the rank the defender is already in.**
  Both bugs this was written for are gone: a jab no longer rescues someone
  mid-knockdown, and a kick no longer stands a floored fighter up.
- **A refused reaction is `undefined`, not a re-entry.** The blow still lands,
  still costs health, still makes its noise; it simply does not interrupt, so
  the victim keeps falling on the arc they were already on. Re-entering the
  current state would have re-applied its launch, which is a jab relaunching a
  falling body — the opposite of the intent.
- **Equal rank re-enters**, because that is what a combo is: a second jab
  refreshes the flinch.
- **One number instead of a table** of which reaction may replace which. A table
  grows with every fighter times every reaction; an ordering does not, and the
  earlier per-state redirect proposal is now formally dead.
- **Wake-up invulnerability comes out for free.** Nothing forces rank 4, so
  `downed` and `getup` cannot be interrupted at all. That answers an open
  question in `plan.md` — whether a downed fighter is hittable — by consequence
  rather than by special case, which is the better kind of answer.
- **`bounce` is rank 4 on purpose**: once you have hit the floor, the exchange
  is over. That leaves re-launching possible only during the airborne knockdown
  itself, which is a short window and a genuine juggle.
- **Still unbounded, deliberately:** an equal-rank blow *can* relaunch a body
  still in the air, so an uppercut into an uppercut juggles. That is exactly
  what the smash limit in `combat.md` §4 exists to bound, and it is not built.
  Nothing here should grow into a second mechanism beside it.
- **`reactionFor` takes the defender's current state** rather than a bare
  `airborne` flag. It needed the rank as well, and the state carries both — one
  argument that says "here is the situation" beats two that each say a piece of
  it.

## 2026-08-15 — Touching the ground stops the fall, not the slide

- **The sweep's victim flew sideways fast and then crawled after the bounce.**
  Two things were deleting the speed and neither was visible: landing did
  `this.vx = 0`, and `bounce` then set `vx = -0.7` from its own launch. From 4.5
  to 0.7 in one frame.
- **The −0.7 was not wrong, it was orphaned.** `bounce` was authored for the
  uppercut, whose knockdown arrives at −1.0, so −0.7 is proportionate there. The
  sweep arrives at −4.5 and the same number is a cliff.
- **A `bounce_sweep` state was considered and rejected.** Splitting a role into
  two states is right when there really are two roles — it is why
  `kick_high_chain` and `knockdown_sweep` exist. Here there is one role and one
  number that *should have been derived from the incoming speed*. Copying a
  state to encode "how fast were you going" is the right field on the wrong
  axis, and the third launcher would want a third bounce.
- **So the engine stopped lying twice.** Landing zeroes only `vy`, because a
  body skidding at 4.5 px a frame is still skidding after its feet touch. And a
  `launch` component may be `null`, meaning *keep this axis* — `bounce` is now
  `[null, -2.4]`, which decides how high you come back up and claims nothing
  about how fast you were already travelling. Every launcher's skid now carries
  in proportion, with nothing authored per pair.
- **Side effect, accepted knowingly:** `land` is an airborne state with no
  launch, so a forward jump now keeps a little speed through its three-frame
  landing pose instead of stopping dead. It is a change nobody asked for and it
  reads as a small skid.
- **Not covered by a test**, and worth saying plainly: `launch` is applied in
  `entity.ts`, the PixiJS half that Vitest does not reach. The validator gained
  a shape check for the nullable form — which it had never had for `launch` at
  all — but the behaviour is the owner's to judge.

## 2026-08-15 — Knockback belongs to the role, not to the animation

- **The chain's third blow could not reach.** `hurt_heavy` pushes the defender
  62 sprite px over its 12 frames, and the longest reach in the whole game is
  44. Not mistuned — arithmetically impossible.
- **The cause was one state doing two jobs.** `kick_high` was both the standalone
  standing Heavy, which *wants* a big knockback so it creates space and is safe
  on block, and the middle link of a chain, which must not push the victim out
  of range of the next blow. Those are contradictory and no single number
  satisfies both.
- **So the roles split into two states over one animation** — `kick_high` keeps
  `hurt_heavy`, `kick_high_chain` takes the light reaction. This is the first
  time the animation/state split has actually been needed rather than merely
  argued for, and it arrived on its own.
- **Attacks now drift forward** (`vel: [0.4, 0]`, about 10 px across a swing).
  Net separation per link drops to ~7 px against reaches of 36–44. Known
  limitation: `vel` applies for the whole state, so the drift happens in the
  wind-up and the recovery too. Per-step velocity is the real answer and is
  deliberately not built — a constant drift is enough, and a mechanism invented
  ahead of a need comes out wrong.
- **The sweep gets its own knockdown.** `knockdown_sweep` sends further back and
  less up than the uppercut's, because a sweep should skid the opponent along
  the floor rather than lift them; `knockdown` is shared and stays as it was.
- **A test now owns this invariant** — for every chain transition, what the blow
  does to the distance is compared with how far the next one reaches. Crude, in
  that it ignores starting distance and the defender's width, but the number it
  catches was off by a factor of two. Reintroducing the bug fails it with
  "expected 62.4 to be less than 36".
- **What we did by hand here is what combo scaling will own** (`combat.md` §3):
  knockback that depends on where in a string a blow lands. Authoring it per
  link is right while there is one chain; it must not grow into a second
  mechanism beside the scaling when there are ten.

## 2026-08-15 — A press made during a hit pause is no longer thrown away

- **The buffer never received presses made during hitstop.** `update()` returned
  early on the freeze, and the four `buffer.press(...)` calls sat below that
  return. The buffer's own docstring names this exact case as the reason it
  exists, and it correctly does not age while frozen — but it cannot keep what
  it is never handed.
- **Recording moved above the freeze check; the tick stays below it.** The pause
  is precisely when a player, having just seen the blow land, reaches for the
  next attack, so it was the worst frame in the game to be deaf on.
- Found while building the first chain, which is not a coincidence: nothing
  before it asked the player to press a button during a hit pause.

## 2026-08-15 — The first chain is the original's own kick string

- **Medium pressed three times walks `kick_mid` → `kick_high` → `kick_low`**,
  which is the string the 1996 game already had (catalogue group `kick_string`,
  frames 34–42). Building our first chain out of a sequence somebody else
  already designed beats inventing one before we can feel any of it.
- **Its shape is why it works: mid, high, low.** The three blows differ by
  *height*, not only by force, which is what separates a string from pressing
  the same button three times.
- **`kick` and `kick_heavy` became `kick_mid` and `kick_high`.** The old names
  came from a placeholder button rather than from a pose, which the naming rule
  does not allow — and `kick_heavy` was about to read as "the heavy one" in a
  chain where it is the middle link.
- **The high kick is one animation behind two roles**: standing Heavy on its
  own, and the second link of the Medium string. First real use of the
  animation/state split we settled, and it cost nothing.
- **The string ends in a knockdown.** `kick_low` is a sweep, and putting the
  opponent on the floor terminates the combo by itself — so the first chain
  cannot accidentally loop while there is no scaling and no juggle limit yet.
- **No hitstun, deliberately.** A *cancel* skips the attacker's own recovery, so
  the advantage comes from the skipping, not from the length of the stun; the
  12-frame reaction is already far longer than a 4-frame startup. Hitstun is the
  tuning layer and is worth adding when there is something to tune.

## 2026-08-15 — A transition may require several triggers at once

- **`when` now takes a list as well as a string, and every trigger in it has to
  hold.** A chain link needs two facts at the same time — the attack connected
  *and* a button was pressed — and a transition could only test one.
- **A conjunction rather than a compound trigger per pair.** The alternative
  was inventing `confirmed:medium` and later `fwd:heavy`, which multiplies with
  the button count and again with every new pairing. Command normals (forward
  plus a button) want exactly the same mechanism, so it is built once.
- **`hitConfirmed` costs nothing to add**, because `Entity.spent` already knew
  the answer and already had the right meaning: it is set on a hit *and* on a
  block, never on a whiff — which is precisely the rule chosen for chains — and
  cleared on entering any state, so each link has to connect on its own.
- **`lastFired` became `pressSpent`.** Once several triggers can fire together
  there is no single "trigger that fired" to report, and the only caller wanted
  one thing from it: which button to spend out of the input buffer. It now
  answers that, by name, and the parsing lives with the module that knows how a
  trigger is spelled.
- The timing falls out of the loop order and is right by accident rather than
  by design, so it is worth writing down: blows are resolved after `update()`,
  and a connecting blow freezes both fighters for the hitstop. A cancel
  therefore becomes available on the first frame *after* the freeze, which is
  where a fighting game puts it.

## 2026-08-15 — The buttons become Light / Medium / Heavy / Special

- **`punch`, `kick`, `punchHeavy` and `kickHeavy` are gone** from the input, the
  trigger vocabulary and the data. Nothing outside `input/keyboard.ts` knows
  which key is which, so remapping stays a later, local change.
- **Keys are the `A S` / `Z X` square**, the keyboard stand-in for a pad's four
  face buttons, and it is read **by column**: `A` light and `Z` medium on the
  left, `S` heavy and `X` special on the right. Left lighter, right heavier is
  the rule this project already used when the buttons were punch/kick, and it
  puts Heavy on the right the way the pad does (FighterZ: □ L, △ M, ○ H, ✕ S).
  There is no single convention for translating a pad diamond onto four
  keyboard keys, so the tie is broken by what the project and the owner's hand
  already expect. A row of `A S D F` was tried first and rejected.
- **Uppercut moved to crouching Heavy.** Four attacks did not fit three standing
  slots, and the uppercut is the launcher — which is the crouching Heavy in the
  game we are taking the scheme from. It costs nothing mechanically: crouch is
  already its own state, so `pressed:heavy` there is an ordinary single trigger,
  not a direction-plus-button combination we cannot express yet.
- **Special does nothing yet, deliberately.** It is the ki blast, the ki blast
  is frames 54–55, and those are not built. An empty button is more honest than
  parking the uppercut there and moving it again later.
- This is the first of three slices toward a chain: buttons, then the mechanism
  (a conjunction in `when`, plus a `hitConfirmed` trigger), then the kick string
  itself.

## 2026-08-15 — Depth is a drawing, not a plane

- **The sheet has a whole second combat mode and we are not building it.**
  Goku's far-distance set is complete — a recede ramp, an idle, two deflects
  for batting ki bolts away, two dodges and two hit reactions — and the
  original's confirmed "send the opponent to the back of a stage" is what it is
  for. It has no place in a FighterZ-shaped design, which is strictly one plane.
- **The frames stay, the mode does not** (owner). Depth becomes presentation: a
  special may travel into the background, an attack may be *shown* that way, and
  none of it touches physics. `deflect_far` and `dodge_far` go in a drawer
  rather than a bin.
- **The trap this creates, and it is a real one:** hurt boxes are fitted to the
  sprite's silhouette by `npm run anim`. A frame drawn at 59 px instead of 85
  yields a tiny box low on the body, so a fighter mid-`kick_from_depth` would be
  nearly unhittable — an artefact of the drawing, not a decision, and the
  printed table looks normal while it happens.
- **So the working rule is: the depth frames are not used unless the owner asks**
  (owner, 2026-08-15). Not "used carefully" — treated as absent. They are for
  the cases where hit boxes do not matter, or for an explicit request. Written
  into the `add-animation` skill, which is what gets loaded when someone is
  choosing frames.

## 2026-08-15 — Four buttons by strength, and animations named for the pose

- **Light / Medium / Heavy / Special, exactly FighterZ's scheme** (owner). The
  earlier idea of punch / kick / special / ki is dropped: strength rather than
  limb, so *which* limb a blow uses is the character's business and not the
  player's. `punchHeavy` and `kickHeavy` go away with it.
- **The chain rule arrives with the scheme, and it is one sentence:** cancel
  into a stronger button, never a weaker one. An ordering rather than a table
  of permitted transitions, which is why it does not rot when a character gains
  a fifth kick. Switching mid-chain lands at the same depth or deeper.
- **Two consequences worth having seen in advance.** `S` is the ki blast and
  the default chain ender, *not* a special-move button — so real specials are
  motion inputs, and command recognition stops being optional. And the scheme
  hands the moveset its shape: three stances × three strengths is nine normals,
  which is a list of holes to fill rather than "some punches and some kicks".
- **Guard stays on back.** FighterZ does the same and so do we already, so the
  guard-button question is parked at zero cost. Reopen it if the AI struggles.
- **Animations are named for the pose** — `punch_hook`, `kick_roundhouse` — with
  a number only to separate two that genuinely resemble each other.
  `punch_1, punch_2, …` was considered and rejected: the number encodes the
  order frames happened to appear on the sheet, which is a fact about the sheet
  rather than about the blow, and `"anim": "punch_3"` cannot be read without
  opening a second window. Across characters the same number would mean nothing
  in common.
- **A state's name says its role, an animation's says its shape.** That split is
  what makes reuse work: one animation, several states, different damage and
  different reactions depending on where in a chain — or in a special — it sits.
  Stance is part of a move's identity where it binds it (`kick_crouch`,
  `kick_air`), because those are not interchangeable variants.
- **No `moves.json`.** The owner asked whether combos need their own definition;
  they do not. An animation is the pose, a state is the consequence, and a chain
  is a path through the states. A parallel structure would be a second source of
  truth to reconcile. If the repetition between chain links ever hurts, the cure
  is a `like` field on a state — built when it hurts, not before.

## 2026-08-15 — How long a pose is shown is not how long it can hit

- **Every attack on the sheet holds its hit box for the whole strike** — 16
  frames on the punch, 12 on the heavy kick, against the 2–4 a fighting game
  would use. That was not an oversight: the long active was standing in for
  **hitstop**, which did not exist when the first attacks were authored, and it
  was the only thing making a blow feel like it met something.
- **Hitstop exists now and does that job better**, because it only fires when
  the blow actually lands. The long active can go.
- **But the pose still has to be held**, or a whiffed swing is a flicker — and
  a whiff is exactly when nothing else is selling the move.
- **Both are true at once, because they are different questions.** One `dur`
  was answering them together. Two steps naming the *same* frame separate them:
  a short one carrying the hit box, a long one carrying none. The sprite never
  changes, so nothing looks different; only the window in which the attack
  connects gets shorter. **The engine already does this** — it is a change in
  data, not in code.
- **Starting values: 3–4 frames active for a light attack, 4–6 for a heavy**,
  the box on the first part of the strike rather than the tail. Guesses to be
  tuned. Attacks will get noticeably harder to land, which is the point: a
  12-frame window cannot be whiffed badly enough to be punished.
- Written into the `add-animation` skill, which previously argued *for* the long
  active. `npm run anim` still emits the old single-step strike; splitting it is
  a hand edit until the script is changed.

## 2026-08-15 — It is always 1v1, and movement is a dash rather than a walk

- **1v1, permanently.** No tag, no assists, no 2v2 or 3v3 (owner). FighterZ's
  team layer is therefore *rejected*, not deferred — which retroactively
  settles the "what we leave behind" row in `combat.md`.
- **Goku's walk cannot be made to look right, and that is a property of the
  sheet, not of our timing.** Frames 9 and 10 hold the same wide stance with the
  feet in the same place; only the arms and the body height change. It is a bob,
  so the character glides. Written into `descriptions.json` so nobody spends an
  afternoon retiming it.
- **Frames 24–27 are two dashes, not a run cycle** — 24 the pose a dash starts
  from, 25 the forward dash, 26 that same start pose again, 27 the backward
  dash. Confirmed by the owner. Worth recording *how* this was got wrong: read
  off the sheet they look exactly like the alternating upright/extended poses of
  a run cycle, and that reading was confidently wrong. The catalogue group
  `lunge` is gone, replaced by `dash_fwd` and `dash_back`.
- **A dash is therefore how this fighter moves**, not an extra. **The fast dash
  costs the resource** (owner) — which makes the free one worth choosing and
  blocks the fast one on a resource that does not exist yet. The ordinary dash
  depends on nothing.
- **A double tap is new input logic**, not an animation detail: the buffer
  records attack presses and directions are only ever read as `held:`.

## 2026-08-15 — FighterZ for the rules, Budokai for the flow

- **The combat system now has a shape**, written down in
  [`combat.md`](./combat.md) so it is not re-derived every session.
- **Dragon Ball FighterZ is the reference for the rules** rather than Budokai:
  it is a Dragon Ball game, two-dimensional, dynamic in the sense the owner
  means, and it already contains the teleport escape the owner asked for
  independently. Budokai stays the reference for *flow* — strings you fall into
  rather than execute.
- **We take an architecture, not frame data.** No constant in our data is
  FighterZ's; theirs is not documented to us. Every number is ours and is
  tuned by eye.
- **Long combos are wanted** (owner). The expected opponent is the CPU, but
  **multiplayer is explicitly not ruled out**, so the system is designed as if a
  second human will arrive. The risk is lopsided: a versus-sound design also
  plays well against the CPU, while one tuned for the CPU alone breaks the day
  somebody sits at the other side. Every mechanic stays symmetric; what the AI
  cannot yet use well is an AI problem. (An earlier draft of `combat.md` leaned
  too far into single-player and was corrected the same day.)
- **The escape was demoted and a structural limit restored.** The earlier
  reasoning — that a teleport turns infinite juggling from a physics problem
  into an economy one — was half right and shipped nothing. An escape costs a
  resource, resources run out, and a floor made only of a resource is not a
  floor. Soft scaling and a hard cap on re-launches are always on; Vanish is
  situational on top.
- **The corner was diagnosed properly rather than patched.** Push collision
  separates anchors by 30 sprite px while attacks reach 28–44, so bodies pushing
  apart never ended pressure anywhere on the stage — knockback did. At the wall
  knockback is spent against the bound and nothing carries it to the attacker.
  The rule to add is the one `separate()` already uses for pinned bodies.

## 2026-08-15 — The combat system is ours; only the presentation is Hyper Dimension

- **The owner does not like the original's combat, and that is a main reason
  this remake exists.** So gameplay is deliberately *not* faithful. What stays
  from Hyper Dimension: the sprites, the roster, the look. What does not: how
  fighting works.
- **The brief is a feeling, not a spec — "the fight is dynamic, the way Dragon
  Ball is dynamic."** Every mechanical decision below serves that and is judged
  by it.
- **Reference point: the Budokai games on PS2** — combo strings you flow
  through rather than execute — with other modern fighters open as inspiration.
  Nothing is copied wholesale; they are a direction, not a specification.
- **Wanted concretely, named by the owner:** a teleport behind the opponent on
  a well-timed input while guarding. It is not a garnish — an escape that costs
  a resource is what makes long combos survivable, and it turns "can someone be
  juggled forever" from a physics problem into an economy one.
- **The shared health/Ki bar is reopened.** It is a fact about the original, not
  an inherited requirement. It now couples directly to the teleport: if escaping
  costs health, escaping while nearly dead is impossible, which is either the
  best thing about the design or a death spiral. Decide the resource before the
  escape.
- **Consequence for `game-overview.md`:** its confirmed facts describe the 1996
  game. They are context now, not requirements. Only the roster and the sprites
  still bind.

## 2026-08-15 — Being in the air is the reaction's business, not the attack's

- **A fighter hit mid-jump snapped to the floor.** `reactionFor` knew the blow
  and the defender's default and nothing about where the defender was, so an
  airborne body was forced into `hurt` — a grounded state — and `update()` did
  what it does for grounded states: `y = groundY`, in one frame.
- **The redirect hangs off the reaction, `ifAirborne`, not off every attack.**
  The alternative was an `onHitAir` beside every `onHit`. There are three ways
  to be hit and there will be dozens of attacks, so that is the wrong axis:
  a blow that knocks you over knocks you over whether or not you were jumping.
  What being airborne changes is the pose and the impulse, and both belong to
  the reaction. Every existing attack got its air version without being touched.
- **One hop, and only on a forced entry.** A redirect that chains is a loop
  waiting to be authored, and a state a fighter *chose* to enter was never the
  problem. Both are pinned by tests.
- **Light hits do not knock down; heavy ones do** (owner's call). A light air
  hit is a flinch on frame 77 that returns to `fall` and lands normally, so
  jumping stays worth doing; `hurt_heavy_air` and `knockdown_air` end on the
  floor through the existing `bounce → downed → getup` tail.
- **The air variants reuse the `knockdown` animation** rather than duplicating
  it. The catalogue already records 77 as "the start of taking damage while
  airborne" and 78 as the fall — the sprites for being hit out of the air *are*
  the knockdown sprites. What separates the three is the `launch`, which is
  exactly what an impulse is for: from the ground you must be lifted, in the
  air you are already up and only need sending back.
- The launch numbers are guesses to be tuned in the editor. Nothing about them
  is Hyper Dimension frame data.

## 2026-08-15 — A falling body becomes solid before it lands

- **Push collision was off for the whole jump**, both ways: `pushApart`
  returned early if either fighter was airborne. The rule was there so a jump
  could carry you over the opponent rather than being blocked by them, and for
  the rise it is the right rule.
- **On the way down it is not.** A falling Goku sank into the opponent, could
  come out the far side, and the push that returned at touchdown arrived as a
  snap — the whole overlap undone in one frame.
- **Push now asks `solid`, not `airborne`:** on the ground always, in the air
  once `nearGround`. Passing over someone still works, because that is decided
  high up where nothing is solid; the last stretch of the fall lands you
  against them instead of inside them.
- **Reusing `landCue` rather than adding a second distance.** It already means
  "close enough to the floor to act like you are on it" — that is what cues the
  landing pose. One number, tuned once, and the pose and the body agree about
  when the jump is effectively over. A separate threshold is easy to add later
  if they turn out to want different values; two knobs that always move
  together are not.
- The width was never the issue: a push body is one fixed `pushWidth` around
  the anchor and is deliberately not per-frame (`src/combat/push.ts`), so no
  animation can be "narrower" than another.

## 2026-08-14 — The sheet stays visible on every tab

- **A tab was going to switch the whole workspace**, hiding the canvas wherever
  a tab did not draw to it, so States and the sound tabs could have the width
  instead of sitting in a 340px column beside half a screen of nothing.
- **Dropped, because the canvas is not idle when a tab does not own it.** On
  Animations you pick a frame by clicking its sprite and press `＋anim`; the
  sheet is a live picker there, not decoration. That leaves only States and the
  two sound tabs, where the gain is comfort rather than a defect — and a cramped
  panel is not worth a layout that changes under you as you move between tabs.

## 2026-08-14 — Everything a state brings into the world is an Entity

- **A spark, an aura and a ki blast are one mechanism, not three.** They differ
  in four properties that vary independently: whether the thing has its own
  position or borrows its owner's, whether it moves, whether it has hit boxes,
  and what ends its life — the animation, the owner's state, or its own logic.
- **`effect`, `attachment`, `projectile` are vocabulary, not types.** They name
  the three combinations we expect to author most, and they are worth having in
  conversation and later as presets in data. They are **not** three code paths.
  The first draft of this had them as distinct kinds; a spawned attack that does
  not move but grows and damages killed that — under three types it is "a
  projectile that does not move", which is a name that lies. Naming things after
  how they look instead of what they are made of was the mistake.
- **A spawn is an `Entity`, and that is already true.** No `states.json` means
  one animation and gone — exactly what `fx_hit` does today. A `states.json`
  means a life of its own: a ki blast that grows, strikes and fades is three
  states. The loader, animations, boxes and validator need nothing new, because
  a spawn is not a new kind of thing.
- **The art and the behaviour are separate.** `data/spawns/<name>/` says what it
  looks like; the state that spawns it says how it behaves. The same discharge
  art can be attached in one move and fired in another, so baking the behaviour
  into the asset would force two copies of one drawing.
- **`data/spawns/`, not `data/fx/`.** "Fx" means decoration, and a ki blast deals
  damage — the name would start lying at the first projectile. "Spawn" names the
  one thing all of them share: something else brings them into the world.
  `npm run fx` and `src/fx/generate.ts` keep their name, because they describe
  how the *art* was made (generated rather than ripped), which is another axis.
- **If it is on the fighter's sheet, it is an animation, not a spawn.** Goku's
  aura is drawn into his sprites, so it needs no machinery at all. Build nothing
  for what the artist already merged.
- **What still has to be added, when the second kind exists and not before:** an
  `owner` (whose facing and whose side the spawn takes, so a blast does not hurt
  the fighter who threw it), a `follow` flag, and an exception so hitstop does
  not freeze a spawn along with the two fighters.
- **`landBlow()` already takes any `Entity`,** not a fighter, so a spawn with hit
  boxes becomes an attacker in the existing exchange rather than needing a
  second collision path.
- **From MUGEN we take the shape and refuse the interface.** That a helper could
  grow, attack and follow was the good part. The bad part was the unlimited
  conversation with its parent — reading its variables, driving its state, ids
  to keep track of. The limit belongs on what a spawn may say to its owner, not
  on what it may do by itself: it takes position, facing and side, and nothing
  else passes between them.
- **`Effects` is not renamed yet.** It correctly describes what exists today —
  decoration, spawned and forgotten. Renaming it to `Spawns` before an
  `attachment` exists would be naming something unbuilt, the same mistake we
  avoided with scenes. The rename happens in the change that adds the second
  kind.

## 2026-08-14 — No constants file; a value lives with its only user

- **There is no `constants.ts` and there should not be one.** Nearly every value
  in this codebase is already where it belongs: `BAR_HEIGHT` in the HUD,
  `EDGE_MARGIN` in the stage, `ATTACK_EVERY` in the training fixture,
  `SPARK_MAX_STEP` in the effect generator. Collecting them centrally would move
  each one away from the only code that gives it meaning, and a constants file is
  usually just the cupboard for values with no home. These have homes.
- **The rule instead:** a value lives beside its only user; a shared home is for
  what two modules must *agree* on.
- **By that rule exactly two values are shared today, and neither is a tuning
  knob** — both define a unit. `FRAME_TIME = 1/60`, because everything the game
  knows about time is counted in frames: animation steps, hitstop, the eight
  frames of input buffer. And `SCALE = 3`, the conversion between a sprite pixel
  (what the data is authored in) and a screen pixel (what the world is measured
  in). They stay in `main.ts` and are handed down, which is already how `SCALE`
  travels.
- **`SCALE` is entangled with Q7** — the open question about a logical
  resolution — and is not settled here. Whatever answers Q7 owns it.
- **`ENTITY = "goku"` was never a constant.** It is a scene parameter, and the
  URL decision above takes it out of the file altogether. That closes Q11 without
  a separate conversation, which is what "later questions fall out of earlier
  ones" is supposed to look like.
- **`boot()` being long is a symptom, not a cause, so it is not being fixed
  now.** Around sixty of its ninety-five lines are *building a fight*, and those
  move into `FightScene` for free when scenes arrive. Restructuring it first
  means restructuring it twice.

## 2026-08-14 — A scene is what its parameters say, and the URL says them

- **Every scene must be constructible from a small, serialisable set of
  parameters** — `{ scene: "fight", p1: "goku", p2: "goku" }` — and never from
  objects the previous scene happened to build. This is the whole decision; the
  rest follows from it. Getting straight to the scene you are working on is then
  not a feature anyone has to add, it is a consequence: if a character select can
  describe a fight in a few values, so can anything else.
- **Being able to jump into a scene is a constraint on the scene interface, not a
  tool bolted on later.** A `FightScene` that needs whatever `SelectScene` left
  behind cannot be entered any other way, and no later trick fixes that. So the
  rule lands before the first scene exists, not after.
- **The state and its source are different questions.** The parameter object has
  to exist regardless; the URL is merely one thing that fills it. That is why
  "URL or a state object" was a false choice — it is one state type with several
  possible sources, and today there is one source.
- **The URL is that source.** `?scene=fight&p1=goku&p2=goku`. It survives a
  reload, differs per tab, can be pasted to someone else, needs no rebuild, and
  the repo already does this for one animation with `?anim=`.
- **An unknown or invalid parameter is a loud error, never a quiet fallback to
  the default scene.** Everything in a URL is a string, so `p1=gokú` is the
  realistic mistake, and silently running the default would send someone
  debugging the wrong thing. Same instinct as `validateStates`.
- **A committed dev-state file was rejected as the primary source** for one
  reason: it is global and commitable. Two tabs cannot hold two scenes, and a
  modified file sits in `git status` waiting to ride along with an unrelated
  commit. A dev entry point that can be shipped by accident is a bug with a
  delay on it.
- **Convenience lives in `package.json` instead** — `npm run fight` opening a
  prepared URL, the way `npm run editor` already opens the editor. Committed,
  memorable, and a command rather than game state.
- **The file comes back if a scene needs more setup than a URL holds
  comfortably** — "start at 10% health to test a KO" is the shape of that. It
  slots in as a second source without reworking anything, because the state type
  is already the interface.
- **A player can therefore skip the menus by typing a URL.** Accepted: this is a
  non-commercial fan project, not a thing with a front door to guard.

## 2026-08-14 — A voice has an owner; a punch does not

- **One sound bank for the whole game**, `data/audio/sounds.json`. Impacts,
  swings, blocks and landings belong to nobody: nothing in clip 007 is Goku's,
  and the next nine fighters would each want their own copy of the same thing.
  The bank needs no adjective — there is no second one, so nothing is marked
  "shared" and no `common/` directory exists to become a junk drawer.
- **Ids name the sound, not the role, and the bank holds variants to choose
  from.** `swing_1`, `swing_2`, `swing_3`; a state picks one. A name that says
  who will use it is a guess that ages — `swing_kick` was played by kicks *and*
  by heavy punches. **Correction to the first version of this entry:** it
  claimed the three id pairs sharing a file (004, 007, 011) were duplicates that
  would collapse. They are not. Each pair differs in gain and character, so
  merging them would have made heavy blows quieter, and they share a clip only
  because nobody has yet listened to the 107 unnamed ones. Under the variant
  model they are simply two entries that point at one file for now — which is
  what the model is *for*. Numbers are append-only; `swing_7` may never be
  renumbered, because `states.json` names it.
- **A `label` carries the meaning that numbered ids gave up** — "swing, leg —
  heavier" — read by a person and, later, by a picker in the editor. Words alone
  were rejected as ids: at three variants a category runs out of adjectives and
  starts arguing with itself over which of two is "deeper". This is also the rule
  sprites already follow:
  numbered frames, with `descriptions.json` saying what each one is. For sound
  the catalogue is `data/audio/sound-test.json`, which stays separate from the
  bank: it says what all 127 clips *are*, the bank says which ones the game
  *plays* and how loud.
- **A fighter's voice stays with the fighter**, in
  `data/entities/<name>/sounds.json`, holding voices and nothing else. Ownership
  is fake for a punch and real for a grunt, so one rule for both would be
  convenient rather than true. Practically: the bank stays small and stable
  while voices grow with the roster, and adding a fighter stays "add a
  directory" instead of also editing a global file.
- **This does not break "an entity is a directory"** — that rule never meant an
  entity contains its content. Goku's sprites live in `assets/sheets/goku.png`;
  `frames.json` says which rectangles of that shared sheet are his. A
  `sounds.json` naming which clips of the shared `assets/audio/sfx/` are his is
  the same pattern, not an exception to it.
- **One id space, two files, and the validator rejects a collision.** An entity
  defining an id the bank already has is an error, not a silent override. That
  removes the only real hazard of splitting them: nobody has to remember which
  file wins, because both winning is impossible.
- **Effects leave `data/entities/`** for `data/fx/<name>/`, keeping their shape —
  a directory of `frames.json` and `animations.json`. A spark genuinely is that;
  it just never was a fighter, and only lived among them for want of anywhere
  else to put it.
- **What would overturn the voice half of this:** finding that the original
  reuses voice clips across the roster. Then a voice has no owner either and
  everything belongs in the bank. Unknown today — 107 of the 127 clips have
  never been listened to.

## 2026-08-14 — Directories say what a file is about, not how it runs

- **`src/` is grouped by domain** — `entity/`, `combat/`, `input/`, `audio/`,
  `sprites/`, `fx/` — because the question someone actually asks of an unfamiliar
  tree is "where is the sound", not "what can run in Node". Twenty flat files had
  stopped answering either.
- **The rejected alternative was grouping by layer** (`game/` for PixiJS, `core/`
  for pure runtime logic, `authoring/` for build-time). It makes the testability
  rule visible in the tree and is worse to read: it splits `audio/` across three
  directories and puts a WAV codec next to a state machine because both happen to
  be pure. Reading the code won.
- **What that costs**: the tree no longer shows that PixiJS is confined to three
  files, or that some modules never reach the browser. Both are written down in
  `CLAUDE.md` instead. A test that enforces them mechanically is a good idea and
  is *not* built — it would have been new behaviour inside a commit whose whole
  value was containing none.
- **`scripts/` holds CLI entry points and nothing else.** One file per `npm run`
  command, and nothing in the repo imports from it — so the codecs it used to own
  (`png.ts`, `wav.ts`) moved to the domain they serve. What is a command and what
  is a library is now visible from the path.
- **The editor was left alone** apart from `plugin.ts` → `server.ts`, which
  separates the one Node file from eleven browser ones. It gets its own review.

## 2026-08-13 — The thud belongs to hitting the floor, not to the blow

- **A sound sits on the state that names the moment**, never on the attack that
  caused it. The crash of a body landing is on `downed`, which is entered on
  `landed` from whatever put the fighter in the air. Throws, heavier blows and
  whatever comes after all inherit it by transitioning into the same state; none
  of them has to remember to play a sound.
- **The same rule sorts the two kinds of landing.** Coming down from a jump
  enters `land` and sounds soft; coming down from a knockdown enters `downed` and
  sounds hard. The distinction is which state you were in, not which move hit.
- **The validator now warns about an airborne state with no `landed` or
  `nearGround` transition.** That is the one mistake the next launcher will make,
  and its symptom — a fighter stuck airborne at ground level, silent — looks like
  an engine bug rather than a missing line of data.
- **A voice and an impact are different events at different times:** the grunt is
  on `knockdown`, at the blow; the crash is on `downed`, at the floor. Wanting
  both *at once* is what would force `sound` to take a list, and nothing needs
  that yet.

## 2026-08-10 — Sound effects come from the game's own sound test

- **Better than any rip.** The archives have voices and music but no impacts;
  the game's options menu plays every effect cleanly, alone and in order. That
  is a *better* source than a rip, not a worse one — no music underneath, no
  overlap.
- **One recording, one script.** Record a single pass through the whole sound
  test, then cut it on silence: `npm run split-audio`. Recording each effect by
  hand would mean thirty takes, and doing them again the moment the levels turn
  out wrong. A pass plus a script makes a better recording cost one command.
- **The splitter works on a running window, not on single samples**, because a
  waveform crosses zero constantly and per-sample tests would shatter every clip
  into fragments. It also refuses to cut at a clip's *own* quiet moment — an
  impact and its tail are one sound — which is what `gap` is for.
- **Clips are levelled to a common peak by default.** Sound-test captures come
  out at wildly different levels, and levelling at the cut means `gain` in
  `sounds.json` stays a creative choice rather than a correction for a
  recording.
- **Capture is the emulator's own audio recorder**, not the browser's. Mesen
  writes a WAV of what the APU produced: no microphone, no system mixer, no
  resampling, and no feedback loop to get wrong. Capturing a browser tab still
  works and is written down as the fallback, but it is a worse copy of the same
  thing.
- **The menu blip is filtered by shape, not by ear.** A sound test is walked
  with the cursor and the menu answers every press, so the recording holds two
  sounds per effect. Name one copy of the blip and every copy goes — dropped
  where it stands alone, trimmed off the front where it ran into an effect. The
  fingerprint is level-independent, because capture levels drift; and where the
  two truly overlap the clip is *reported*, not trimmed, since a wrong cut costs
  the attack of the effect, which is the part that matters.
- **Pauses in the recording are worth more than any amount of cleverness.** The
  first pass was hurried and 79 clips came out fused to the blip; a second,
  slower pass produced zero. The trimming stayed, because it costs nothing to
  keep and the next recording may be hurried too.
- **The tools are committed, their output is not.** A recording of the game's
  audio is the game's audio, however it was captured; it goes to
  `assets/audio/`, which is gitignored, exactly like the sprite sheets.

## 2026-08-10 — Sounds are synthesised, because there was nothing to rip

- **No usable source.** The Sounds Resource has the game but refuses automated
  reads, and what is downloadable elsewhere (Zophar) is the SPC *music*, not the
  effects. Pulling the samples out of the ROM is the same class of job as
  Mesen-S for missing sprites — worth doing, not worth blocking on.
- **So a sound is a spec, not a recording**, synthesised at runtime from a few
  numbers in `sounds.json`. The same answer as the hit spark, and for the same
  reason: being able to make something that fits is worth more than waiting for
  a file. `file` is reserved so real samples can replace the synth later without
  a single state changing.
- **Plain Web Audio, no dependency.** What a fighter needs is "play this short
  noise now, several at once, with a little pitch wobble" — a few dozen lines,
  like the PNG encoder.
- **Pitch wobble is not decoration.** Without it a run of hits sounds like a
  stuck key rather than a fight, so `vary` is a first-class field and the pitch
  calculation is pure and tested apart from playback.
- **Three fields on the blow:** `sound` (the swing, on entering the state),
  `hitSound` and `blockSound`. That makes seven things a blow decides, all in
  one family — how it is taken, how long the game stops, what it looks like,
  what it costs, and how it sounds landing, swinging and being blocked.
- **A missing sound is silent, a malformed one is reported.** Sound is the last
  thing added to a move and the first forgotten, so an unknown id must not
  crash; but a spec with a zero gain fails *quietly*, which is worse, so
  `validateSounds` runs at load beside the state validator.
- **The audio context starts lazily**, because browsers refuse to play before
  the user has interacted. A missing first punch beats a console full of
  autoplay warnings.
- **Honest limit: I cannot hear any of this.** The mechanics are testable — what
  fires when, that the wobble spreads — but whether it sounds right is entirely
  the owner's call, unlike the spark, where the pixels could be inspected.

## 2026-08-10 — An input buffer, because hitstop was eating presses

- **The bug, predicted and then fixed:** a button was only read on the exact
  frame it went down, and a frozen entity returns before ever looking at its
  input — so a press made during the six frames of hitstop was thrown away. That
  is the worst moment to lose one, because the pause is exactly when a player,
  having just seen the hit land, reaches for the next attack. Without this,
  combos would fail in a way that looks like bad timing rather than a swallowed
  input.
- **A press lives 8 frames**, which is longer than the default hitstop on
  purpose, so even a buffer that *was* aged through the pause would survive it.
- **The buffer is ticked below the freeze check**, so a paused fighter does not
  age it at all. Standing still cannot eat a press.
- **A press is spent when it fires a move.** `StateMachine` now records which
  trigger caused the change (`lastFired`), and the entity consumes the matching
  button — otherwise one press could start a second move when the first ended
  with the window still open. Reporting the trigger was chosen over changing
  what `update` returns, which would have churned the runner's whole test suite
  for no gain.
- **It lives in `Entity`, not in the input layer**, so every fighter gets one:
  the dummy, and a second player when there is one.

## 2026-08-10 — Blocking is decided at contact, not held as a stance

- **There is no guard state to stand in.** Holding away from the opponent is
  already `walk_back`, so a blocking stance would compete with walking for the
  same input. Instead the engine asks, at the moment a blow connects, whether
  the defender is holding away — and if so the blow is blocked. This is also how
  the genre has always worked: the guard pose only ever appears on an attack
  that actually arrives, never as something you stand around in.
- **`onGuard`, the mirror of `onGotHit`.** One top-level field naming the block
  reaction; a fighter without it simply cannot block. Both count as entry points
  for the unreachable-state check, since neither is ever transitioned into.
- **No blocking in the air.** A jump-in that can be blocked for free removes the
  reason to jump in at all.
- **A blocked blow costs nothing** and only pushes — about a third of what a
  light hit gives back. Chip damage belongs to specials, which do not exist:
  a block you cannot afford to hold is not a block.
- **The dummy needed to swing, and that is a fixture, not an AI.** You cannot
  practise blocking against someone who never attacks, but the answer is not to
  start writing an opponent. `T` toggles a plain timer that throws each of the
  four attacks in turn, so every reaction, spark and knockback can be seen. It
  is labelled as a test fixture in the code, deliberately: a half-built AI is
  the kind of thing that survives for years. The real answer is a second player
  on the same keyboard, which is Stage 3.
- **The guard animation is a reaction, not a loop.** The looping three-frame
  stance was built first and thrown away the same hour: with no stance to stand
  in, an idling guard has nobody to play it.

## 2026-08-10 — Health and damage: the fourth thing a blow decides

- **`damage` on the attack state**, falling back to a `damage` attribute —
  exactly the shape `onHit`, `hitstop` and `hitFx` already have. Four fields,
  one idea: the blow decides how it is taken, how long the game stops, what it
  looks like and what it costs. The entity-wide fallback exists so an attack
  that forgets to state its worth still costs something, rather than silently
  being free.
- **100 health, and a round is about a dozen good hits.** Light attacks take 6–8
  (punch 6, kicks 7–8), the heavy kick 12 and the uppercut 14 — so roughly 16
  jabs or 7 uppercuts. Deliberately not a faithful figure: Hyper Dimension's own
  values are undocumented, like every timing in this project.
- **Health floors at zero and nothing happens.** No KO state, no round, no
  reset — those are Stage 3, and inventing half of them now would mean redoing
  them. `Entity.defeated` exists so the engine has somewhere to ask later.
- **Bars drain toward the centre**, which is how fighters have drawn them since
  the arcades: the gap between the two is the score, readable without reading a
  number. Colour flips to red under 30%.

## 2026-08-09 — Air attacks: one state, reachable from every airborne state

- **The air kick (46–47) is a normal attack state with `airborne: true`** and no
  `launch`. Without a launch it inherits whatever velocity the jump had, so
  kicking carries the arc instead of stalling the fighter in mid-air — the same
  property that lets a take-off hand its momentum to the airborne state.
- **Reachable from all seven airborne states**, and placed first in each so it
  can be thrown right up to the moment the landing pose takes over. A fighter
  who cannot attack on the way down has half a jump.
- **It exits three ways**, in this order: `landed` (straight to idle, in case
  the attack is still running at touchdown), `nearGround` (hand over to the
  landing pose), then `animEnd` (fall for the rest of the arc). The first two
  exist so the attack can never hold a fighter through their own landing.

## 2026-08-09 — One sheet stays ours; a fuller rip was measured and rejected

- **A second, much larger rip exists** (Sprite Database, 1043×5179 against our
  720×2304 — 3.3× the area, and it includes the black-haired base form we barely
  have). Measured rather than guessed: a single sprite on it uses 18 colours,
  so it is a clean native rip, and its palette values match ours exactly, which
  means the same poses are pixel-identical between the two.
- **That made migration cheap in principle, and it was still refused.** Because
  the sprites match pixel for pixel, a script could have hashed each of our 219
  frames, found it on the new sheet and rewritten every frame id, carrying
  anchors, boxes and hand-tuned durations across; `states.json` refers to
  animations, not frames, so it would not have been touched at all.
- **The reason for refusing is what the rip bakes in:** drop shadows and effects
  are painted into the sprites. Neither can be subtracted. A shadow welded to a
  frame cannot be put under a fighter who is in the air, and an aura welded into
  a pose cannot be switched off — which is the opposite of the direction this
  project has taken, where effects are separate entities we generate ourselves.
- **So: one sheet, the one we have.** Gaps are filled another way rather than by
  swapping the foundation. Swapping it would also have to happen *before*
  authoring animations, not after twenty-two of them.
- **First known gap: the crouching guard.** Three ways out, none chosen yet
  because nothing is blocked — blocking does not exist as a state at all:
  rip the pose from the ROM with Mesen-S (already the documented gap-filler, and
  it yields sprites free of both shadow and effects, since those are separate
  OAM objects); compose it from the standing guard's torso and the crouch's
  legs, where the **recipe** is committable even though the pixels are not; or
  simply ship standing-only blocking first.
- **The composite is sound engineering at the wrong scale for now.** The hard
  part is the seam, not the cut, and it cannot be judged until the tool exists.
  At one frame, drawing it by hand wins; at five or more across the roster, the
  script pays for itself.

## 2026-08-09 — A state must mean the same thing however you entered it

- **Bug: a knockdown never left the ground.** `launch` was applied on one of the
  two ways into a state — the transition the machine chooses — and not on the
  other, the reaction the engine forces on a fighter that has been hit. A
  knockdown is *only* ever forced, so its impulse was dead code from the moment
  it was written.
- **The fix is the general one**, not a line added in the second place: both
  routes now run a single `enterState()` — animation, spent flag, landed latch
  and launch together. A state that behaves differently depending on how you
  arrived is a trap that would have been re-sprung by the next field added to
  `StateDef`.
- **Not unit-tested**: entry lives in `Entity`, which needs PixiJS. The pure
  half (`StateMachine.force`) was already correct; what was missing was on the
  rendering side. Worth remembering as the reason this slipped past a suite that
  covers the state machine well.

## 2026-08-09 — Attacks hold their striking frame, and come back the way they went

- **The house shape for an attack**, set by the owner and now generated by
  `npm run anim`: wind-up 4 → mid pose 4 → **striking frame 12** → the mid pose
  again, 4. About 24 game frames.
- **The striking frame is held rather than flashed past.** It is the pose the
  move is read by. The previous default gave it 2 frames, which is long enough
  to collide and too short to see.
- **Mechanical consequence, not just a look:** the hit box is out for 12 frames
  instead of 2, so an attack is far easier to land and commits its owner for
  much longer. One hit per entry into the state still holds, so nothing
  multi-hits by accident.
- **The recovery is a repeat of the frame before the strike**, not a cut to
  idle — the move steps back out through its own mid pose. Since it is a repeat,
  the script appends it instead of asking for it every time: `--frames 37,38,39`
  produces `37 38 39 38`.
- **That append is what keeps hand-tuning safe.** The generated frame list now
  matches what the owner has on disk, so re-running `anim` to recompute boxes
  recognises the list as unchanged and **keeps** the tuned durations. Before
  this, every rebuild reset them.

## 2026-08-09 — Four buttons, and everything built finally has a user

- **The full diamond is wired**, ZSNES defaults: top row punches, bottom row
  kicks, left column light, right column heavy. SNES `Y`/`X` = punch/uppercut
  (keyboard `A`/`S`), SNES `B`/`A` = kick/heavy kick (keyboard `Z`/`X`).
- **Brought forward, ahead of crouching and air attacks.** Six things had been
  built with nothing to trigger them — the `kick_heavy` animation, the
  `hurt_heavy`, `knockdown`, `downed` and `getup` states, and the
  `fx_hit_heavy` effect — and the validator was reporting four unreachable
  states. One item gave all of them their first user and, more to the point,
  made them *visible*: none of it could be judged while it existed only in
  files. Crouching and air attacks lost nothing by waiting; they depend on none
  of it.
- **Reactions are graded by the blow, which is what `onHit` was for:** punch and
  kick → `hurt`, **uppercut → `knockdown`**, **heavy kick → `hurt_heavy`**. The
  heavy attacks also ask for the bigger spark through `hitFx`.
- **Which way each heavy blow sends you follows the blow's direction.** An
  uppercut travels upward, so it lifts: its knockdown peaks at **64 px** — about
  four fifths of a fighter's height — over 41 frames of air, and 41 px back,
  deliberately more vertical than horizontal. A heavy kick travels sideways, so
  it shoves: **62 px** of ground, on the same rule the other two knockbacks use —
  light is one walk speed, heavy is light plus one body width, this is light plus
  one and a half. The first arrangement had the two the other way round and read
  wrong; the first numbers then had the kick sliding too far and the lift too
  shallow, both settled by eye against these shapes.
- **The uppercut is frames 50→51**, the pair the owner confirmed. Note its
  derived hit box is only 4 px wide: the script measures how far the active
  frame reaches *forward*, and an uppercut travels upward, so this is one to
  redraw by hand rather than a bug in the derivation.
- **The validator now reports no problems at all** for the first time since
  reactions were added.

## 2026-08-09 — Knockdown: a sequence, built on the jump's machinery

- **Three states, not a third hurt variant.** `knockdown` (off the feet, in the
  air) → `downed` (flat on the floor) → `getup`. Light and heavy share one
  shape — a pose held for a while — and this does not; it has phases with
  different rules, which is what states are for.
- **It reuses `launch` + `airborne` + `landed`**, the jump's machinery, rather
  than inventing a second way to be in the air. The fall pose simply holds after
  the animation ends, because the state has no `animEnd` exit: the arc decides
  when it is over, not the animation's length. Same argument as the jump's.
- **Numbers derived from the ones we had.** `launch [-2, -4]` with `gravity 0.3`
  peaks at 27 px — about a third of a fighter's height, clearly off the feet
  without being a juggle — stays airborne ~27 frames and travels ~53 px back.
  That is deliberately further than a heavy hit's 46.8 px: being knocked down
  should cost more ground than being staggered.
- **Nothing causes one yet**, so the validator reports `knockdown`, `downed` and
  `getup` unreachable. That is one fact reported three times, not three
  problems: reachability walks from the entry points, so an unreachable state
  hides everything behind it. It clears the moment an attack names it.

## 2026-08-09 — Two buttons: one trigger per button, not a generic "attack"

- **`pressed:attack` became `pressed:punch` and `pressed:kick`.** A generic
  attack trigger stops meaning anything the moment there is more than one
  button, and renaming was cheap while exactly one attack existed. Triggers are
  named for what the button *does* rather than for the SNES key it sits on
  (`Y`, `B`), because `states.json` is read by people, not by the pad.
- **Layout follows the ZSNES default and the usual diamond:** SNES `Y` = punch
  (keyboard `A`), SNES `B` = kick (keyboard `Z`). Top row punches, bottom row
  kicks; the heavy versions take `X` and `A` when they arrive.
- **Both attacks ask for the same reaction** (`onHit: "hurt"`). The kick is the
  *basic* one — the owner's naming, matching the sheet — so `hurt_heavy`,
  `fx_hit_heavy` and the `kick_heavy` animation all stay built and unused until
  a heavy attack exists. The validator says so out loud, which is correct.
- **Frames came from the catalogue, not from a guess:** basic kick 34→35→36
  (36 extended, hip height), heavy kick 37→38→39 (37 wind-up, 38 the delivery,
  39 extended). Hurt boxes fitted to the silhouette by `npm run anim`; timings
  and hit boxes are the usual generic skeleton for the owner to tune.

## 2026-08-09 — Effects are generated, not ripped — and the rules that keep them native

- **No hit spark exists to rip.** Sprite Database's complete listing for the game
  is ten character sheets, an "Ending" sheet and two backgrounds; The Spriters
  Resource blocks automated reads but searches surfaced only characters,
  portraits and backgrounds. A separate **objects/effects sheet** does exist
  (ripped by `Locke_gb7`) — auras, beams,
  explosions, smoke — but it has no small impact flash for a basic hit, so it
  is not carried in the manifest: we ship pointers only to sheets we use.
- **So we draw our own, with a script** (`npm run fx`, `src/fx/generate.ts` pure +
  tested). Not a stopgap: being able to make effects that fit the game is worth
  having on its own, and the owner's judgement is that the original's effects
  are the weakest part of its art, limited by the hardware rather than chosen.
- **Four rules keep generated art from reading as "modern engine glued onto 1996
  sprites"** — the mismatch is never the shape, it is the softness:
  **one pixel is one sprite pixel** (drawn on a small integer grid, scaled up
  nearest-neighbour); **no antialiasing and no alpha ramp** — every pixel is one
  palette index or nothing; **the palette is the game's**, sampled from the
  ripped effects sheet so it cannot drift; and **edges are dithered, not
  blended** — the same checkerboard the SNES used to fake sprite transparency,
  visible on Goku's own frames 0, 2, 82 and 83.
- **Seeded, so regenerating never silently changes the art.** The script owns the
  whole entity — atlas *and* `frames.json` / `animations.json` — because it knows
  where every pixel went; there is no sheet to frame and no editor round-trip.
  Effects are therefore derived like the atlas: gitignored, rebuilt by command.
- **Size came from the screenshots, not from taste.** The dither in the
  background gives the capture's scale away (3×), which puts the original's
  flash at ~18 sprite px — about a quarter of a fighter's height. Light and
  heavy sparks are the same generator at two reaches, matching the two reactions
  an attack can already ask for.
- **First attempt was too lacy** — a wide dither band ate the silhouette and it
  read as confetti. The reference is a solid white blob with a thin yellow
  fringe, so the dither is now half a pixel wide and the bright frames are white
  through the body, with yellow only at the rim.
- **A spark is not a small explosion, and the difference is timing and colour
  rather than shape.** The second attempt had the silhouette right — the mask
  pulled straight off a screenshot is a solid irregular white mass ~20 px across
  — and still read as a detonation, because it bloomed from nothing, cooled
  through orange and ended as a ring, over 15 game frames. A spark instead
  arrives at most of full size, stays white, thins into rays and is gone in 8
  frames (~130 ms). One parameter carries most of the look: `taper`, how sharply
  an arm narrows — low values bulge into an explosion, high values pull out into
  rays. Its tail must **thin**, not shrink: a small dense blob reads as an
  object stuck to the fighter.
- **The spark arrives at full size and goes out — it does not grow.** A growth
  phase was tried and dropped, for a reason specific to this engine rather than
  to taste: **hitstop freezes effects too**, so the first frame is held for the
  entire pause — the exact moment the player is looking at the impact. A spark
  that bloomed spent that moment showing its smallest, dimmest frame and only
  flashed once the freeze was over, which is backwards.
- **Second reason: a long spark drifts away from what it hit.** The effect is
  pinned where it spawned while knockback slides the defender off it — 16.8 px
  over a light reaction. At 10 game frames the tail hung visibly beside the
  fighter; at 6 the drift is about 5 px. Heavy knockback (46.8 px) would have
  made it worse.
- **What survives from growing is the opening.** It empties from the middle
  outwards and widens slightly as it disperses, which is the part that read
  well; the bloom is what went. Consequence for testing: it covers **fewer**
  pixels as it opens, so anything about its size must be measured on the
  outline, not on a pixel count.
- **Variety comes from baked variants, not from transforming the sprite.** Four
  sparks are drawn squashed along different axes and the engine picks one per
  hit, so a combo does not look like the same stamp printed repeatedly. The
  tempting shortcut — one sprite, rotated and scaled at spawn — was rejected:
  a pixel rotated by anything but a right angle stops being square, which is
  precisely the tell we spend the rest of this entry avoiding. Squashing is
  therefore a **change of coordinates inside the generator**, applied before the
  shape is rasterised, so every variant is native to the grid.
- **Angles are spread evenly, not drawn at random.** With four variants random
  angles clump and half of them look alike; an even spread guarantees each reads
  as a different direction of impact. The randomness belongs at the moment of
  the hit, not in the art. The spread covers 180°, because a squash axis repeats
  every half turn.
- **A squash axis alone was too subtle**, so each variant became a character of
  its own: size, ray count, how flat, and — the one that changes the read most —
  whether it has a middle at all (`open`, which eats the core and lifts the
  shell, so a variant can be a ring from its first frame rather than only
  becoming one as it dies).
- **The whole method is written down as the `add-effect` skill**, not left in
  this log. There will be many more effects, and the expensive knowledge is the
  procedure — measure the reference off a screenshot, mind that hitstop holds
  frame 0, bake variety instead of transforming sprites — plus the three ways
  the tests here have already been wrong.
- **Squashing may not stretch** (values above 1 are clamped): the sprite grid is
  sized for `reach`, so a stretched burst would silently lose its tips in the
  atlas.
- **A random horizontal mirror doubles the variety for free**, and unlike a
  rotation it is exact — it moves whole pixels and resamples nothing. Four
  variants therefore give eight distinct-looking impacts.
- **An effect's animations are interchangeable variants** as far as the engine
  is concerned; it picks one at random. Adding a fifth spark is a data change,
  with no code to touch.
- **Both generators are kept in code, but only sparks are generated.**
  `explosion` is wrong for a punch and right for a ki blast, so the function and
  its tests stay; no entity is written for it until something spawns one, because
  dead data costs more than a missing line. The tests pin the three properties
  that separate the two — arrives at size, never uses the orange half of the
  palette, stays short.
- **An effect is an entity with no states** — one animation, played once, then
  destroyed. No new class was needed: `Entity` already runs animation-only when
  it has no state machine, which is exactly what an effect is. It has no input,
  no opponent, no physics and no boxes.
- **The spark goes where the boxes met**, so `connects()` grew into `contact()`,
  which returns the overlap rectangle instead of a yes/no. Spawning on either
  fighter's anchor would put the flash at their feet — the difference between a
  hit *landing* and a hit merely *happening*.
- **But not at the *middle* of the overlap** — at its **leading edge**
  (`impactPoint`). A fist box is narrow and sits entirely inside the body it
  strikes, so the overlap *is* the fist, and its centre falls on the attacker's
  forearm: the spark looked stuck to the puncher instead of happening to the
  fighter being hit. The far edge is the deepest point the blow reached, which
  is where a fist meets a body. Height still comes from the overlap's middle.
- **Sparks were half the size they should have been.** The measurement was
  right (~20 px, a quarter of a fighter's height) but only the *heavy* effect
  got it; the light one — the one a punch actually spawns — was drawn at 14.
- **Which effect is the blow's choice too**, via `hitFx` on the attack state,
  next to `onHit` and `hitstop`. Three fields, one idea: the blow decides how it
  is taken, how long the game stops, and what the impact looks like.
- **Hitstop freezes effects as well.** A spark that kept animating through the
  pause would be the one thing on screen giving the freeze away.
- **A test that could not fail was rewritten.** The first "ragged edge" test
  passed against a version with dithering removed *and* arm lengths made
  uniform. It now counts the notches dither leaves in the outline, which
  separates cleanly. A second test, for uneven arm lengths, was **dropped rather
  than shipped**: measured spread was 0.44 against 0.33 for uniform arms, i.e.
  inside rasterisation noise — a threshold there would pin an accident.

## 2026-08-09 — Hitstop: both fighters stop dead, and the blow sets for how long

- **A connecting hit freezes *both* fighters**, not just the one taking it.
  Freezing only the defender lets the attacker keep walking through the moment
  of contact, which reads as the blow passing through rather than landing.
- **The freeze is total** — animation, movement and state changes all stop, so
  the pose the hit landed on is the pose held still. Halting movement while the
  animation ran on would just be a stutter.
- **Push separation is suspended too.** It runs every frame regardless of state,
  so without an explicit guard "frozen" would have meant *everything except the
  push* — true only by accident, and quietly wrong the day pushing changes.
- **The number lives in two places, deliberately:** `hitstop` as an entity
  attribute is the default, and an attack state may override it, because a
  heavier blow wants a longer pause and that property belongs to the blow rather
  than to either body. Same shape as `onHit`.
- **6 frames (100 ms) is a bounded guess, not a derivation**, and is written out
  in `attributes.json` rather than left to the engine default so it is visible
  where you would look to tune it. The bounds it sits between: below ~4 frames
  the pause stops registering at 60 FPS, and above half the 12-frame reaction it
  eats the reaction it is supposed to punctuate. Like all our timings, generic
  fighting-game feel — not Hyper Dimension frame data.
- **Validated as a frame count** (a number, zero or more). Zero is legal and
  means an attack that deliberately does not pause.

## 2026-08-09 — Impact: the blow names the reaction, and pushes you back

- **`onHit` on the attack state names a state on the *defender*.** The blow
  decides how it is taken, which is what separates a jab from a smash; the
  alternative — the defender inspecting what hit it — puts the knowledge in the
  wrong place and grows with every attack in the game. The defender's
  `onGotHit` survives as the fallback, so `onHit` overrides a default rather
  than replacing the mechanism, and an attack that says nothing still produces
  a reaction instead of silence.
- **Reaction names are a shared vocabulary** (`hurt`, `hurt_heavy`, later
  `knockdown`) implemented per fighter. The validator can therefore only check
  the attacker's own states, so an unknown name is a **warning**, not an error —
  and `onHit` targets count as entry points when hunting unreachable states,
  because nothing ever *transitions* into a reaction.
- **The precedence lives in one pure function** (`reactionFor`), so the rule is
  stated once and tested, rather than being an `??` buried in the render loop.
- **Light and heavy share their first frame.** Goku's 74 alone is a flinch;
  74 → 75 continues that same flinch into a real recoil. Two animations that
  begin identically read as one reaction of two magnitudes, which is what they
  are — and it is the owner's reading of the sheet, not the two-separate-poses
  guess that preceded it. Frame 76 (a blow to the stomach) is left unused: a
  high/low distinction costs one reaction per fighter across the roster and buys
  nothing until attacks exist that must hit low. Revisit at crouching.
- **Knockback is plain `vel` on the reaction state**, not new machinery. Facing
  is toward the attacker in a reaction, so negative X is away — the existing
  facing-relative rule already means "backwards" without a special case.
- **Both numbers are derived from numbers we already had**, in one go rather
  than guessed and re-guessed: a **light** hit pushes at exactly walking speed
  (1.4 px/frame), so an opponent who walks straight back in neither gains nor
  loses ground during the reaction; a **heavy** hit travels one whole `pushWidth`
  (30 px) further than the light one, so the gap it opens fits a fighter.
  Over the 12-frame reactions that is 16.8 px against 46.8 px.
- **The slide is linear and stops dead** when the animation ends. An impulse
  plus friction was considered and deferred: it needs a new attribute and
  grounded momentum, and constant velocity over 200 ms may well read fine.
  Revisit by feel, not in advance.
- **Hitstop is deliberately not part of this** — it is the next item, and
  bundling it would hide which of the two changes produced the feel.

## 2026-08-09 — One queue: `docs/plan.md`, and finished items are deleted

- **The work queue is a single file, `docs/plan.md`.** Three documents were
  listing work — the `roadmap.md` checklists, the phase table in
  `entity-editor.md`, and `CLAUDE.md`'s "Next:" line — and all three had drifted:
  jumping and push collision were shipped and still sat unchecked, and the "next
  step" pointed at phase D2, which had been done *and* partly dropped.
- **Finished items are deleted, in the same change that finishes them.** A file
  that only shrinks cannot drift; a stale line is just one somebody forgot to
  remove. Ticking a box, by contrast, grows a record that duplicates git.
- **Three files, three questions:** `plan.md` = *what's next* (shrinks),
  `decisions.md` = *why* (grows), git = *when*. Nothing answers two of them.
- **The other documents lost their to-do lists, not their content.**
  `roadmap.md` is the wider arc in prose; `entity-editor.md`'s phase table now
  says explicitly that the lettered phases are history, not a schedule. Work
  they held that is not yet scheduled (health/damage, blocking, commands and the
  input buffer, the rest of the keyboard layout) moved into `plan.md` under
  "not yet ordered" rather than being dropped.
- **Detail decays with distance in the plan:** the next few items are slices
  with a *done when*, later ones a single line. Detail written for work three
  weeks out gets rewritten before it is read.
- **The combat push is ordered A–D first for one reason:** build *one complete
  exchange* — impact, hitstop, a catalogue pass over the attack frames, a hit
  spark — before multiplying moves. Four buttons × three stances is twelve
  attacks, and re-tuning how a hit feels afterwards would mean redoing all of
  them. Knockdown is deliberately *not* a third hurt variant: light and heavy
  share one shape, a knockdown is a sequence (fall → down → get up) with its own
  states, so it waits until after the exchange works.

## 2026-08-09 — Push collision, and walking at a speed that matches the jump

- **Fighters can no longer stand inside each other.** Walking into the opponent
  pushes them, and the walker keeps advancing at reduced speed — as the original
  does.
- **The correction is split evenly between both bodies**, and that single rule
  produces the behaviour for free: a walker advancing at *v* overlaps by *v* each
  frame, gets pushed back *v/2* and moves the other *v/2*. No special case for
  who is pushing whom. If one is pinned against the edge of the stage, the other
  absorbs what is left.
- **A push body is one width per entity (`pushWidth`), not per-frame boxes.**
  Per-frame push boxes would shove the opponent every time an arm came out, and
  two fighters standing still would jitter against each other. This is how the
  genre does it. The `push` box type stays in the format for later.
- **Only grounded fighters push.** Otherwise a jump over the opponent would be
  blocked by them, which is the opposite of what a jump is for.
- **Walking was a third of jump speed** (0.83 against 2.3 px/frame), so the jump
  felt like a different game. Now 1.4 forward and 1.0 back — the jump is 1.6×
  walking rather than 2.8×.
- **The walk cycle was sped up in proportion** (12 → 7 frames a step), keeping
  the distance covered per cycle at ~20 px. Speed up the movement without the
  animation and the feet start sliding.

## 2026-08-09 — Jumping: impulse + gravity, and variants without new syntax

- **`vel` was a constant per state, which a jump cannot be.** Two fields carry
  it instead: **`launch`** — a velocity applied once on entering a state — and
  **`airborne`** — while true, gravity accumulates and the velocity carries as
  momentum rather than being re-applied. A state without `launch` leaves the
  velocity alone, which is what lets a take-off state hand its momentum to the
  airborne state that follows.
- **Gravity is an entity attribute, not a constant in code.** Opens
  `attributes.json` (phase C) with a single field rather than hard-coding it.
- **Four new triggers:** `held:up`, `falling`, `nearGround` and `landed`.
  `StateMachine.update` now takes a `Signals` object instead of a lone boolean —
  that list will keep growing. `falling` (past the apex) exists because a rise
  animation is shorter than the climb, so `animEnd` would fire while still going
  up: the phase boundaries come from the arc, not from animation lengths, and
  survive a change of jump height.
- **Jump direction needs no compound trigger.** The walking states already
  encode the held direction, so `idle → held:up` is a neutral jump while
  `walk_fwd → held:up` is a forward one. Held, not an edge, on purpose: an edge
  would be consumed by the frame that enters `walk_fwd` and the jump would
  vanish. Holding up to hop repeatedly comes out for free.
- **Phases are separate states**, because one animation cannot play a take-off
  once and then hand over: a travelling jump is take-off → somersault → fall →
  land, each its own state, chained by the triggers above.
- **Jump height is set by what it is for: clearing the opponent.** Goku is 81
  sprite px tall, so `launch [0, -7.8]` with `gravity 0.3` peaks at 101 px —
  the feet pass 20 px over the other fighter's head, comfortably but not
  absurdly. 52 frames in the air. Guessing at "higher" twice produced a jump
  three times taller than it needed to be; deriving it from the requirement
  settled it in one go. Height goes as `v²/2g`.
- **Every jump runs the same arc** — rise → `falling` → fall pose →
  `nearGround` → landing pose → `landed`. Only the rise differs: the vertical
  jump plays 14→15→16 and mirrors it back 16→15→14 on the way down (each half
  timed to the length of the climb, so the tuck happens at the apex, and
  seamless because both halves meet on 16);
  the travelling jumps play a take-off frame and **one** somersault, then hold
  the fall pose. The original does one rotation, not a spin loop.
- **The falling pose is the extended one (14), the landing pose the tucked one
  (15)** — legs dangling on the way down, knees drawn up to absorb. The reverse
  was tried first and read wrong.
- **Landing starts in the air.** A landing pose entered on touchdown is a
  flicker nobody sees, so `nearGround` (falling, and within the `landCue`
  attribute) hands over on the way down. `landCue` is a distance, but what it
  buys is frames, and that depends on the jump: 60 px is ~7 frames of this one.
  The landing state is itself `airborne` — still falling — and ends on `landed`.
- **Anchors decide whether a transition pops.** Frame 14 sat 93 px below its
  head and frame 15 only 77, so switching between them jumped the character by
  16 px. Anchors are per-frame offsets, so the fix is arithmetic: align the head
  (both now 77) and accept that 14's extended legs hang below the reference
  point, which is what an airborne pose should do anyway.
- **Somersault anchors were re-centred.** Auto-detection puts an anchor at the
  bottom of the frame, which for a rotating body means swinging around the feet
  and jittering between frames. The four spin frames now anchor on the
  silhouette's centre of mass, offset downward by the same distance the standing
  pose has between its centre of mass and its feet (38.7 px) — so the body
  rotates in place and keeps a consistent height.
- Frames confirmed against the contact sheet: rise 14, tuck 15 → 16, forward
  take-off 19, somersault 20→23 (and reversed for the back jump). The owner's
  first list, from memory, had the tuck frames wrong — the catalogue caught it.

## 2026-08-09 — A frame catalogue: what each sprite is, written down once

- **Problem:** which sprite is which pose lived only in the owner's head and was
  re-asked for every animation. That does not scale to ~10 characters, and it
  had already produced one mis-described set of frames.
- **`data/entities/<name>/descriptions.json`** — a section file with `groups`
  (frames per move, non-exclusive) and `frames` (a line per sprite). A leading
  `?` marks a guess, to be settled when the move is built rather than argued
  about up front. Group name matches the animation name when the group is one
  move, so the link needs no field.
- **Descriptions are written from looking**, via `npm run sheet` — a contact
  sheet with the frame numbers **burnt into the image**, because "count from the
  left" is exactly how a description lands on the wrong frame. Uses the PNG
  encoder added alongside the existing decoder; still no dependency.
- **Described on demand**, for the range being worked on. Describing all 219
  frames up front would produce text nobody verifies, that gets re-read anyway.
- **Rejected: a `sequence` field in the catalogue.** It would duplicate
  `animations.json` *and* be stale by construction, since the owner tunes the
  animation afterwards — turning the catalogue into both an input and a rotting
  copy of an output. Multiple use of a frame (a guard pose is the wind-up *and*
  the recovery: `32 → 33 → 32`) is recorded as prose in that frame's
  description instead.
- **Honest limit:** a sheet holds poses, not a recording. Which frames form a
  move, and roughly in what order, can be read off it; the true order and timing
  cannot. Those stay the owner's knowledge. Derived timings are never presented
  as Hyper Dimension frame data.
- **`npm run anim` now keeps existing durations** when the frame list is
  unchanged. It had twice overwritten timings the owner had tuned by hand; the
  script writes blindly where the editor asks first. When the frame list does
  change, defaults return and the previous values are printed.

## 2026-08-09 — Frame numbering: reading order, plain numbers, renumber by hand

- **Detection numbered frames by top edge**, so a taller pose starting a few
  pixels higher stole a lower number from the sprite to its left. Sheets are
  laid out in rows and neighbouring sprites belong together, so numbering must
  follow the layout: **group into rows by vertical overlap, then left to right**
  (`tools/entity-editor/src/rowOrder.ts`, pure and unit-tested; a rect joins a
  row when it shares at least half its height with it, so a tall sprite cannot
  swallow the row below).
- Confirmation the rule is right: with it, Goku's idle becomes 6,7,8 and the
  air spin becomes 20,21,22,23 — both consecutive, where before they were
  8,6,7 and 23,21,22,20.
- **Frame ids are plain numbers** (`"33"`), not `frame_33`. They *are* positions
  on the sheet; the prefix was noise the sheet view already stripped for
  display. Kept as strings because JSON keys are strings — and integer-like keys
  serialise in numeric order, so `frames.json` stays sorted for free.
- **Renumbering is manual and swaps.** Typing a number over a frame's id
  renumbers it; if that number is taken the two frames trade places, since
  renumbering is how an ordering mistake gets fixed and refusing would force a
  dance through a temporary number. Animation steps follow both ways.
- **Animation steps take a typed number, not a dropdown** — a `<select>` of 220
  frames is unusable. An unknown number is rejected and flagged.
- Existing data was migrated in place (one-off, in the shell) rather than by
  re-detecting, which would have discarded hand-adjusted frame rectangles.
  Only ids changed; rects, timings and boxes were untouched.

## 2026-08-09 — Hurt boxes are fitted to the silhouette, not the frame rect

- **Problem:** deriving a hurt box from the frame rectangle gives one box around
  the *whole* sprite, so an outstretched arm makes the legs as wide as the
  punch. On Goku's punch frame that box was 100% of the bounding area.
- **Now:** the script reads the atlas, takes each row's horizontal extent from
  the alpha mask, and greedily merges neighbouring rows — always the pair adding
  the least empty area — into `--hurt-boxes N` bands (default 3). The result
  hugs the body: narrow head, wide torso where the arms are, narrow legs. Same
  punch frame: 60% of the bounding area, in three boxes.
- **PNG decoding uses the built-in `node:zlib`** rather than a dependency: the
  atlas is written by the editor's canvas, so it is always 8-bit non-interlaced
  RGB(A). The decoder refuses anything else loudly instead of misreading it, and
  is round-trip tested against an encoder in the test file that exercises all
  five row filters.
- **The fitting itself is pure and testable** (`hurtBoxesFromMask` in
  `src/sprites/boxes.ts`, driven by ASCII-art masks in the tests); only the decoding
  lives in `scripts/`.
- Falls back to the single bounding box, with a message, when the atlas is
  missing — it is gitignored (BYOA), so a fresh clone has none until
  `npm run fetch-assets`.

## 2026-08-09 — Authoring pipeline: scripts compute, the owner adjusts

There will be ~10 entities × ~20 animations, so how an animation gets made
matters more than any single animation.

- **No approval gates.** The owner supplies the frame list; Claude produces the
  whole animation and state in one go; the owner verifies and edits later, on
  their own schedule. Gates were considered and dropped — they serialise the two
  sides for no gain, since the output is explicitly a *skeleton to adjust*, not
  a finished move.
- **Anything derivable is computed by a script**, not reasoned about. Frames are
  cut tight around the silhouette, so a hurt box *is* the frame rect relative to
  the anchor; the active frame of an attack is the one reaching furthest in
  front of the anchor. `src/sprites/boxes.ts` (pure, tested) + `scripts/anim.ts`
  (`npm run anim`). Rationale is as much about cost as correctness: doing this
  in-context means pulling a 2000-line `frames.json` in per animation, for
  arithmetic that is deterministic — and a script gives the same answer every
  time, which a model does not.
- **The owner names which frames are which pose.** Never inferred.
- **Reports separate computed from guessed** (hurt boxes vs hit box, timing,
  choice of active frame), so the owner knows where to look.
- **Default timings** (wind-up 4 / active 2 / recovery 5; loops 6; reaction ~12
  total) are generic fighting-game values, **not** Hyper Dimension frame data,
  which is undocumented. Tunable by feel, never presented as faithful.
- **Editor is no longer the only writer**, so a stale save could silently
  destroy generated data. `/api/entity` now returns per-section mtimes, the
  editor remembers them, and a save that would overwrite a newer file asks
  first. Added a **Reload data** button (re-reads sections, keeps the sheet).
- **New validator warning:** a state whose animation has steps without a hurt
  box — frames where the fighter cannot be hit and nothing says so.
- **Procedure lives in a skill** (`.claude/skills/add-animation/`), not in
  `CLAUDE.md`: it is loaded on demand, so it costs nothing in sessions about
  something else. `CLAUDE.md` keeps only the principles and points at it.
- **Rejected:** rewriting the editor in Vue (the bottleneck was never the UI
  toolkit — it was the round-trip, which the new flow removes), a separate
  review tool (would duplicate the canvas and box code), and a PNG frame
  exporter for Claude to eyeball hit boxes (bought accuracy that a skeleton
  does not need; hurt boxes are the tedious part and they are computable).

## 2026-08-09 — Attacks: hit detection, `onGotHit`, keyboard layout

- **An attack is an ordinary state**, not a new concept: non-looping animation,
  `hit` boxes on its active steps, `turn: false`, recovery via
  `animEnd → idle`. New trigger **`pressed:attack`** — an *edge*, so holding the
  key does not machine-gun.
- **Getting hit is a single top-level field, `onGotHit`.** The engine forces
  that state on the defender whatever it was doing, instead of every state
  having to declare how it reacts. Same shape as MUGEN's GetHit state.
- **No `hitstun` field yet.** The reaction lasts as long as the `onGotHit`
  state's non-looping animation — timing you author in the editor regardless.
  An explicit field can come later if the animation length turns out to be the
  wrong knob. Damage and health wait for `attributes.json` (phase C): without a
  health bar there is nothing to see.
- **One hit per entry into the attack state**, tracked by the engine, so a hit
  box that stays out for several frames still lands once.
- **Collision lives in `src/combat/hit.ts`** — pure, unit-tested, and used by the box
  overlay too, so what is drawn is exactly what collides.
- **Keyboard = the ZSNES default layout:** SNES `A`=`X`, `B`=`Z`, `X`=`S`,
  `Y`=`A`, `L`=`C`, `R`=`D`, directions on the arrow keys. Only SNES `Y`
  (keyboard `A`, the weak punch) is wired for now; the remaining buttons and a
  remapping screen come later.
- **Still out:** blocking, knockback, push-box collision between bodies (the
  fighters still walk through each other), hit sparks and sounds.

## 2026-08-08 — Vitest now; tests live in the repo, never in a scratch script

- **Vitest is in** (`npm test`), starting with `src/states.test.ts` — 18 cases
  covering the validator and the state-machine runner, including one that
  validates the entity data actually committed under `data/entities/`.
- **Brought forward from Phase E.** Three things changed: dropping the States
  editor froze the states format, so tests written now will not be rewritten;
  the validator is a *safety net*, and when a safety net breaks silently it
  looks exactly like "no problems"; and the test content already existed as a
  throwaway script.
- **The rule this replaces:** verifying logic by running a one-off script in a
  temp directory. That checks the code once, by eye, and leaves nothing that can
  fail later. If a check is worth running, it is worth committing.
- **A test that cannot fail is not a test:** new tests are confirmed against a
  deliberately broken version of the code before being kept. Done here — the
  trigger check and the one-transition-per-frame rule were each broken on
  purpose, and the suite caught both.
- Recorded in `CLAUDE.md` under the verification protocol.

## 2026-08-08 — States stay hand-authored; validator instead of a States editor

- **Phase D2 (a full States tab) is dropped for now.** The editor earns its keep
  on **spatial and timing** data — framing sprites, anchors, hitboxes, animation
  preview — where text is guesswork. States are **relational** data ("this state
  plays that animation and goes there when X"), which reads and edits well as
  text, and beats a form at copy-paste between characters, find & replace and
  git diffs. MUGEN splits the same way: sprites/boxes in a tool, states in text.
- **The real risk of hand-editing is a silent typo** in a cross-reference, not
  tedium. So we bought exactly that: `validateStates()` in `src/entity/states.ts`
  (pure, no PixiJS) checks `initial`, that every `anim` and every transition
  target exists, that triggers are known, that `vel` is two numbers, and warns
  about states unreachable from `initial`.
- **One validator, two callers:** the game runs it at load and shows the
  problems on screen (previously a `console.warn` nobody reads); the editor's
  **States tab shows the machine read-only** with the same problems flagged.
  Save is disabled there rather than misleading.
- **Timing argument:** the states format is still moving (`hit`, `onEnter`, the
  script hook arrive with combat). Building the editing UI now means building it
  against v0 and reworking it at every extension.
- **Revisit when** a character passes ~15 states, or once combat has settled the
  format — then we will know what the tab should actually contain.

## 2026-08-08 — Working process: verification, servers, unit tests

- **Never drive a browser (Playwright) unasked** — not even a smoke check. After
  a change: typecheck/build, then *offer* verification options with "no check"
  as the default. Rationale: the owner keeps the game open beside the session and
  usually already sees the result, so unsolicited screenshot requests cost their
  time; browser automation is also weak at exactly what matters (timing, feel).
  Recorded in `CLAUDE.md`.
- **The dev server (5173) and editor (5174) are always running** — the owner
  starts them. Never start/restart/kill them or spawn background processes;
  report a dead port instead.
- ~~**Unit tests (Vitest) land at Phase E**, not before~~ — **superseded the
  same day**, see the entry below. The reasoning rested on Phase D2 reshaping the
  states format; D2 as an editing UI was then dropped, so the format stopped
  moving and the argument for waiting went with it. Pure logic
  (`src/entity/states.ts` and successors) stays PixiJS-free either way.

## 2026-08-08 — `vel` is authored in sprite pixels (unit fix)

- Box coordinates were in sprite px while `vel` was in screen px — two scales in
  one entity. Changing the render scale would have silently changed every
  authored speed relative to the sprites.
- **`vel` is now in sprite px**, like boxes; `Entity` multiplies by the render
  scale. Goku retuned to keep the same feel: `2.5 → 0.83`, `1.8 → 0.6`.
- Fixed while only three values existed. An entity's world position is still in
  screen px — a fixed logical resolution is open question **Q7**, and when it
  lands the authored `vel` values keep their meaning.

## 2026-08-08 — Phase D1: states v0 (engine first), facing is opponent-relative

- Phase D is split: **D1 = data format + engine runner** (`states.json` written by
  hand), **D2 = the States tab in the editor**. The JSON is small enough that a UI
  first would have been the slower path.
- **State = animation + velocity + transitions.** Format in
  [`data-format.md`](./data-format.md#states-v0-added-2026-08-08).
- **Velocity X is facing-relative** (+ = forward), matching the box-coordinate
  convention — one rule for both, no world-space special cases.
- **Facing belongs to the engine, not the data:** `sign(opponentX − selfX)`,
  applied only in states with `"turn": true`, so an attack cannot turn around
  mid-swing. Movement input is translated to `fwd`/`back` through facing.
- **Trigger vocabulary v0 is tiny on purpose:** `held:fwd`, `held:back`,
  `animEnd`, each negatable with `!`. Transitions are ordered, first match wins,
  **one transition per frame**. `onEnter`, `hit` and the script escape hatch wait
  for later slices.
- **The temporary arrow-key walk is gone.** The game now runs `idle` /
  `walk_fwd` / `walk_back` from `data/entities/goku/states.json`.
- A **second Goku** stands in as a training dummy so facing has an opponent. It
  runs the same state machine with no input. **No push collision yet** — the two
  walk through each other.
- Goku's animation `anim` renamed to **`idle`**.

## 2026-08-08 — Entity data split into per-section files; per-section save

- An entity is a **directory** of section files, not one blob:
  `data/entities/<name>/frames.json`, `animations.json` (later: `states.json`,
  `commands.json`, `sounds.json`, `attributes.json`).
- The dev-server plugin **assembles** all `<section>.json` in the dir for
  `GET /api/entity` (so the game/editor still see one object), and writes ONE
  section via `POST /api/section {name, section, data, atlasPngBase64?}`.
- The editor **Save button saves only the active tab's section** (Sprites →
  `frames.json` + atlas; Animations → `animations.json`), so editing one section
  never clobbers another. Label reflects the section.
- Rationale: the model keeps growing; monolithic save risked overwriting
  sections you didn't touch, and per-section files give cleaner diffs.

## 2026-08-08 — Never auto-commit

- Do not run `git commit` on your own. The owner reviews the diff and commits on
  explicit request. Recorded in `CLAUDE.md`.

## 2026-08-07 — Naming: Entity (final); storage data/ + assets/ (no public/)

- **Amended 2026-08-08 — definition vs instance:** the engine needs both the
  authored thing and a live instance of it. Both keep the agreed word: **`EntityDef`**
  = the loaded definition (frame textures + animations + states), **`Entity`** =
  one live instance in the world (sprite, position, facing, state machine). Two
  Gokus on screen are two `Entity` objects sharing one `EntityDef`. The suffix
  carries the distinction — **do not reintroduce "Actor"**, which this entry
  rejected. `-Def` also matches the existing `FrameDef` / `AnimDef` / `StepDef`
  / `StateDef` convention.
- Final name: **Entity** (chosen over Actor / Character / Fighter). Rationale:
  "entity" is the common term in hand-rolled game code (ECS lineage), generic for
  future non-character objects, and clean in TS. Tool = **Entity Editor**
  (`tools/entity-editor/`); files `*.entity.json`; API `/api/entity`.
- **Storage (supersedes the `public/…` paths in older entries below):** our data
  in `data/entities/` (committed); BYOA images in `assets/` (gitignored:
  `assets/sheets/`, `assets/atlases/`). **No `public/`.** Game and editor load
  via the dev-server plugin (`/api/entity`, `/api/atlas`, `/api/sheet(s)`).

## 2026-08-07 — Editor becomes the Entity Editor

- The tool generalizes from "sprite editor" to **Entity Editor**: authors a whole
  game entity (sprites, animations, hitboxes, sounds, inputs, states). "Entity" is
  generic (fighters now, projectiles/objects later). Full plan in
  [`entity-editor.md`](./entity-editor.md).
- **Rename:** data `character` → `entity`; files `*.character.json` →
  `*.entity.json`; tool `tools/sprite-editor/` → `tools/entity-editor/`; dir
  `public/characters/` → `public/entities/`.
- **States model:** hybrid — mostly data-driven (visual), with a small scripting
  escape hatch for unusual behavior.
- **Editor + engine co-evolve**: each phase is a vertical slice
  (data + editor + engine + verify in game).
- **Start with Phase A** (rename + tab restructure, no new features).

## 2026-08-07 — Editor I/O (repo-integrated) + BYOA storage

- **Repo-integrated editor** instead of upload/download. A **Vite dev-server
  plugin** exposes `/api/...` endpoints (Node fs) to list sheets and read/write
  character JSON directly to repo files. Chosen over File System Access API and a
  separate server. Details/plan in [`tooling.md`](./tooling.md).
- **Storage = BYOA (Bring Your Own Assets).** We keep the project publishable:
  commit **only our work** — engine code + `characters/*.character.json`.
  Copyrighted images/audio are **gitignored** and never enter git history; the
  user supplies the source sheet from their own copy. Considered but rejected
  "commit everything, repo private forever" (blocks publication + pollutes git
  history). See [`assets.md`](./assets.md).
- **Distribution:** a committed `assets.manifest.json` (name → source URL +
  sha256) plus `npm run fetch-assets` downloads canonical sheets from their
  public source on the user's machine (we ship a pointer, not the bytes).
- **File layout:** all BYOA source assets under one gitignored `assets/` root,
  split by type (`assets/sheets/`, `assets/audio/`, `assets/backgrounds/`, …);
  committed `public/characters/<name>.character.json`; runtime keyed atlas
  `public/atlases/<name>.png` (gitignored, regenerated locally).
- **Fetch built:** `assets.manifest.json` (committed) + `npm run fetch-assets`
  (download/verify by sha256, manual-placement guidance) + `npm run hash-assets`.
- **History verified clean:** no image/asset blob has ever been committed.
- **Atlas = whole keyed sheet** for now (frames reference rects); tight repacking
  deferred.

## 2026-08-07 — Character data format v0 accepted

- Accepted the v0 character file format (atlas + frames/anchors + timed
  animations + hit/hurt/push boxes). Full spec in [`data-format.md`](./data-format.md).
- Timing in **game frames (60 FPS)**, not ms.
- Box types: **hit / hurt / push** to start.
- Coordinates **relative to anchor, Y-down** (PixiJS convention); facing flip =
  negate X. This is the contract between the sprite editor and the engine.

## 2026-08-07 — Tooling: build our own sprite editor, sprite-sheet-first

- **Build our own** browser-based sprite/animation/hitbox editor in our stack
  (TS + PixiJS, in-repo under `tools/`). No existing tool exports to our format
  or handles fighting-game hitboxes + our schema. Details in
  [`tooling.md`](./tooling.md).
- **Architecture:** one internal data model (frames + anchors + animations +
  hitboxes), with pluggable importers (sprite sheet now) and one exporter (our
  format).
- **MUGEN import is parked**, not descoped forever: kept as a documented future
  accelerator. The clean data model keeps that slot open without rework.
- **Remake goal (context):** a well-playing fighter using Hyper Dimension HD
  sprites; fidelity to the original's exact mechanics is secondary.

## 2026-08-07 — Asset strategy

- **Approach:** reimplement the engine in TypeScript, reuse the original game's
  data as static assets. **No emulator at runtime** — emulator (Mesen-S) is only
  a research/extraction/RE tool. Model follows OpenRA / ScummVM / DevilutionX.
- **Rejected:** running an emulator as the runtime and "modding" its logic live
  (Option A) — hardest, most fragile path, and leads to 65816 assembly instead
  of TypeScript. It does not remove the manual hitbox/frame-data work anyway.
- **Basis:** research confirmed the full 10-character roster is already ripped by
  the community, so pixel-ripping is largely avoided. Details in
  [`assets.md`](./assets.md).

## 2026-08-07 — Initial setup

- **Rendering:** PixiJS v8 (over Phaser / raw Canvas / raw WebGL).
- **Assets:** start with placeholder shapes; real art decided later.
- **Scope of first step:** repo + docs only. Game mechanics to be discussed
  before any gameplay code is written.
- **Stack:** TypeScript (strict), Vite, npm.
- **Working style:** go slowly; don't guess — confirm facts and decisions with
  the owner. Conversation in Polish; code/docs in English.
