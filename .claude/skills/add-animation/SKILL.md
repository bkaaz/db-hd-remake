---
name: add-animation
description: Add an animation (and usually a state) to an entity in db-hd-remake. Use when the owner asks for a new move, attack, walk cycle, hit reaction or idle — typically "add animation X from frames a,b,c" — or when wiring an existing animation into the state machine.
---

# Adding an animation (+ state)

The owner names the animation and lists its frames **in playback order**. You
turn that into data. What you produce is a **skeleton the owner will adjust** —
not a finished move. Do not agonise over pixels or timing; being roughly right
and *saying which parts are guesses* beats being slow.

## The division of labour

| | Who |
|---|---|
| Which frames are which pose | **Owner.** Never guess this — a wrong frame is a silent, expensive mistake. Ask. |
| Frame order | **Owner** (assume the list is already in order) |
| Hurt boxes, timing, active frame, hit box | **Script** (`npm run anim`) — arithmetic, never done by hand or by eye |
| Animation kind, `loop`, state shape, transitions | **You** — these are judgement calls |
| Feel, exact box geometry, whether the pose reads | **Owner**, in the editor, afterwards |

**Never read `frames.json` into context to compute boxes.** It is thousands of
lines and the result is deterministic. That is what the script is for.

## The frame catalogue

`data/entities/<name>/descriptions.json` records **what each sprite is** — the
memory that would otherwise live only in the owner's head and be re-asked every
time.

```jsonc
{
  "groups": { "punch_light": { "desc": "…", "frames": ["32", "33"] } },
  "frames": { "33": "straight punch fully extended — the active frame" }
}
```

- **A leading `?`** marks a guess. Do not agonise over them: they get settled
  when the move is actually built and someone looks at it in motion.
- **Groups are not exclusive.** A frame can belong to several moves.
- **A frame can appear more than once in one animation.** A guard pose is
  usually both the wind-up and the recovery (`32 → 33 → 32`). When you notice
  it, write it into that frame's description — this is exactly the knowledge
  that is expensive to rediscover.
- **Order and timing are NOT in the catalogue.** They live in
  `animations.json`. A sheet is a set of poses, not a recording: the return to
  `32` cannot be read off it. Keeping a second copy of the order here would
  simply go stale, because the owner tunes the animation afterwards.
- **Group name = animation name** when the group is one move, so nothing has to
  store the link.
- **Describe on demand**, the range you are about to work on — not the whole
  sheet. Descriptions written months before use are unverified and are re-read
  anyway.

To see the sprites, render a labelled contact sheet and look at it:

```bash
npm run sheet -- goku --frames 31-45        # → assets/contact/ (gitignored)
```

The numbers are burnt into the image because "count from the left" is how a
description ends up on the wrong frame.

**What this cannot give you:** whether a reconstruction is faithful to the
original game. The sheet fixes which poses exist, roughly in order; the real
sequence and timing are the owner's knowledge. Never present derived timings as
Hyper Dimension frame data.

## Procedure

### 1. Get the frames

Check the catalogue first. If the range is not described yet, render a contact
sheet, describe it, and only then build. If the frames for the move are not
obvious, ask — never guess which pose is which.
`npm run anim -- <entity> --list` shows the existing animations and runs the
validator, without loading any JSON into context.

### 2. Generate the animation

**The house shape for an attack** — every attack on the roster is drawn this
way, so the script does it for you:

```
wind-up 4  →  (mid pose 4)  →  STRIKING FRAME 12  →  mid pose again 4
```

Three things follow from it, and all three are deliberate:

- **The striking frame is held, not flashed past.** It is the pose the move is
  read by, and holding it is what makes the swing legible — especially when it
  *misses*, where nothing else sells the blow.
- **How long the pose is shown is not how long the hit box is out.** These are
  two different questions that one `dur` used to answer at once. Split the
  striking frame into two steps that name the **same frame**: the first short
  and carrying the hit box, the second long and carrying none. The sprite does
  not change, so it looks identical — only the window in which the attack can
  connect gets shorter.

  ```jsonc
  { "frame": "33", "dur": 4,  "boxes": [ …hurt…, {"type": "hit", …} ] }  // active
  { "frame": "33", "dur": 12, "boxes": [ …hurt… ] }                      // the pose, held
  ```

  **Starting values, to be tuned, not truth:** 3–4 frames active for a light
  attack, 4–6 for a heavy one. Put the box on the *first* part of the strike —
  the moment of extension — not the tail. Expect the attack to become
  noticeably harder to land than it is with a 12-frame window; that is the
  point, and it is what makes whiffing punishable.

  Why the old shape existed, and why it should not be copied: the long active
  was standing in for **hitstop**, which did not exist when the first attacks
  were authored. Hitstop does that job now, and does it better, because it only
  fires when the blow actually lands. (`hitstop` freezes both fighters on
  contact; `hitstun` is how long the defender stays helpless afterwards. They
  are different fields and are easy to confuse.)
- **The move comes back the way it went**, stepping out through the frame
  immediately before the strike rather than cutting to idle. That recovery frame
  is a *repeat*, so `npm run anim` appends it automatically for `--kind attack`
  when the striking frame is last: give it `--frames 37,38,39` and you get
  `37 38 39 38`. Total ~24 frames.

A consequence worth knowing: because the script appends that frame, the list it
builds matches what is already on disk for hand-tuned attacks, so re-running to
recompute boxes **keeps** the owner's timings instead of resetting them.


```bash
npm run anim -- goku punch --frames 42,43,44,45 --kind attack
```

> **The script still emits the old, single-step strike** — one long step with
> the hit box on it. Splitting it into an active step plus a held pose is a
> hand edit for now (or the editor). Say so when you hand the work over, so
> nobody assumes the active window is tuned.

- `--kind attack` — house timing (below), and a placeholder hit box on the frame
  that reaches furthest forward. Implies `loop: false`.
- `--kind loop` — even timing, no hit box. Implies `loop: true`. Idle, walk.
- `--kind hurt` — a short reaction, ~12 frames total, `loop: false`.
- `--dur N` overrides every step; `--inset N` shrinks hurt boxes (useful when
  spiky hair or aura should not be hittable); `--no-hit` skips the hit box;
  `--dry-run` prints without writing.
- **Existing timings are kept** when the frame list is unchanged — the owner
  tunes durations by hand and rebuilding for boxes must not undo that. If the
  frame list changed, defaults come back and the script prints the old values.
  `--retime` forces defaults.
- `--hurt-boxes N` (default 3) — how many boxes are fitted to the silhouette per
  frame. The script reads `assets/atlases/<entity>.png`, takes each row's
  horizontal extent and merges neighbouring rows into N bands, so the boxes hug
  the body: narrow head, wide torso where the arms are, narrow legs. `1` gives
  the old single bounding box, which an outstretched arm makes far too wide.
  More boxes means a tighter fit and more of them to check by hand.
  **Without the atlas** (it is gitignored — run `npm run fetch-assets`) it falls
  back to one bounding box per frame and says so.

> **Consecutive numbers are not always one sequence.** Where two rows of the
> sheet sit close together, detection interleaves them, so 60-67 turned out to
> be *two* effects alternating rather than one. The `y` in `frames.json` settles
> it in a second and is not a judgement call: group by row before believing a
> run of numbers is a run of frames.

> **Dithered frames are detected wrong, and it is not obvious.** Wherever
> something fades on this sheet — a teleport, a transformation, a step into the
> background — the sprite is drawn as a checkerboard, and auto-detection finds
> only the pixels that survived. It crops the box to them and can spill the rest
> into a bogus extra frame (127 lost 15 px and produced a phantom 128; frame 0
> lost a column). Two useful moves: compare the box against the *solid* frames
> either side of the fade, and measure with
> `npm run anim -- <entity> probe --frames <n> --kind hurt --dry-run --hurt-boxes 1`,
> which prints the real pixel extent without writing anything. Content that ends
> exactly on the box edge is the sign that the box is cutting into it.

> **Do not use the depth frames.** Some sprites are drawn smaller because the
> character moved *into* the screen (`kick_from_depth`, every `_far` group) or
> larger because they stepped toward the camera (the `_foreground` pairs).
> **Treat them as absent unless the owner names them** — owner's instruction,
> 2026-08-15. They are for cases where hit boxes do not matter, or for an
> explicit request.
>
> The reason is that the derivation breaks silently: physics stays on one plane,
> so a box fitted to a 59 px drawing of an 85 px fighter is a tiny box low on the
> body, and the move becomes nearly unhittable for reasons nobody chose — while
> the printed table looks perfectly normal. If one of them is the pose you want,
> say so and ask rather than authoring boxes for it.

The script prints a table separating **computed** (hurt boxes) from
**placeholder** (hit box, timing). Read that table — it is your report source.
It also tells you when the hit box is a `FALLBACK`, meaning nothing measurably
extends and the box is arbitrary. Say so if it happens.

### 3. Add the state

`states.json` stays hand-written (see `docs/decisions.md`); it is short and
involves judgement. An attack:

```jsonc
"punch": {
  "anim": "punch",
  "vel": [0, 0],
  "turn": false,                                   // no spinning mid-swing
  "transitions": [{ "when": "animEnd", "to": "idle" }]
}
```

Wire it in: add `{ "when": "pressed:attack", "to": "punch" }` to the states it
should be reachable from (usually `idle` and both walks), and set the top-level
`"onGotHit": "hurt"` once a reaction state exists.

Trigger vocabulary and field meanings: `docs/data-format.md`.

### 4. Check and report

```bash
npm test          # the validator and runner suites
npm run typecheck
```

The validator will flag a state whose animation has steps without hurt boxes, a
looping animation that can only exit on `animEnd`, unknown animation or state
names, and unreachable states. Fix what it reports before handing over.

Then tell the owner, in this shape:

- what was **computed** (hurt boxes, per-step, from the silhouette),
- what is a **guess** (timing, hit box geometry, choice of active frame),
- anything that looked odd (a `FALLBACK` hit box, a frame far wider or narrower
  than its neighbours, a validator warning left in place deliberately).

Do **not** wait for approval before moving on — the owner verifies on their own
schedule and edits in the editor. Do offer the usual verification choices
(CLAUDE.md); the default is no check.

## Things that will bite

- **The editor may be open.** It saves whole sections, so it can overwrite what
  the script just wrote. The editor now warns on a stale save, and has a
  **Reload data** button — mention it when handing over.
- **Frame ids are plain numbers** (`42`), numbered in reading order along each
  row of the sheet then down — so frames that belong to one move are usually
  consecutive. The owner can renumber in the editor, which swaps two frames.
- **An attack with no hit box cannot connect**, and a hit box with no hurt box
  on the target means nothing to hit — both are warnings, not errors.
- **Timing numbers are generic fighting-game values, not Hyper Dimension frame
  data** — the original's is undocumented (`docs/game-overview.md`). Never
  present them as faithful to the original.
