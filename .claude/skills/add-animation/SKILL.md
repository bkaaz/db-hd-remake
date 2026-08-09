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

## Procedure

### 1. Get the frames

If the owner has not given frame numbers, ask. `npm run anim -- <entity> --list`
shows what animations already exist without loading any JSON into context.

### 2. Generate the animation

```bash
npm run anim -- goku punch --frames 42,43,44,45 --kind attack
```

- `--kind attack` — wind-up / active / recovery timing, and a placeholder hit
  box on the frame that reaches furthest forward. Implies `loop: false`.
- `--kind loop` — even timing, no hit box. Implies `loop: true`. Idle, walk.
- `--kind hurt` — a short reaction, ~12 frames total, `loop: false`.
- `--dur N` overrides every step; `--inset N` shrinks hurt boxes (useful when
  spiky hair or aura should not be hittable); `--no-hit` skips the hit box;
  `--dry-run` prints without writing.
- `--hurt-boxes N` (default 3) — how many boxes are fitted to the silhouette per
  frame. The script reads `assets/atlases/<entity>.png`, takes each row's
  horizontal extent and merges neighbouring rows into N bands, so the boxes hug
  the body: narrow head, wide torso where the arms are, narrow legs. `1` gives
  the old single bounding box, which an outstretched arm makes far too wide.
  More boxes means a tighter fit and more of them to check by hand.
  **Without the atlas** (it is gitignored — run `npm run fetch-assets`) it falls
  back to one bounding box per frame and says so.

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
