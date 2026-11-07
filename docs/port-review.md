# Port review — what the owner still has to try

Every move ported from the cartridge and not yet tried by the owner, a fighter
at a time. **A move he approves is deleted from this file**, like an item of
[`plan.md`](./plan.md), which points here; this file holds no other work.

Each line: the state to start from, the input, what the port left out or
guessed (`?`). In a drafted fighter a speed may also point the wrong way: `port`
reads a speed's size, not always its sign. **Not playable** means it waits for something: a recording, or
a mechanism the engine lacks (`plan.md`).

After any change to a reader or the cutter: `npm run rom -- export --all`, then
`npm run rom -- states --all`, then `git diff data/`. A diff on a fighter already
approved names what to try again.

## Every fighter

Changes of two passes reach all of them, not yet judged by the owner:

- A body thrown up by a `high` blow cannot be struck within 16 px of the floor, nor after its bounce (`$2A:8B92`, `combat/hitGate.ts`, Cell's pass).
- A move that goes on as it came in now keeps the speed it had (`savesFlight`, Cell's pass): Freeza's Evil Energy from a forward jump flies on forward.
- A scene opened by a shot no longer pauses its thrower (`$0F:C2FC`, commit `9a7a253`): Oyatsu Kosen, Buu Breath, Volleyball and Jubaku Ha move by 8 frames.
- An object that ends with its thrower's move does so only in its state that says so (ADR 0080): Freeza's Jubaku Ha flies on once it has moved.
- Every move a button or a command begins brings the mover in front (commit `65c6057`; `rom.md` on the draw order).

## Gotenks

Drafted by script (`npm run rom -- draft`), not read move by move. `?scene=debug&p2=gotenks`.

| move | input | left out |
|---|---|---|
| `a0` sender_a0 | ground: → ← → X | — |
| `a1` sender_a1 | ground: ↓ ↙ ← X | — |
| `9f` sender_9f | ground: ↓ ↘ → X | — |
| `a7` omaenanka | ground: → ↘ ↓ ↙ ← Y, in Sliding Headbutt's hit pause | only by hand: the dummy's clock stands in a pause |

Objects: `gotenks_ghost` from his recording. `gotenks_3_08` and `gotenks_3_03` take its colours and `3_08` its frames, the rest drafted `?`; `gotenks_ball` and its shadow from the same, shown by `match/ball.ts`. `gotenks_3_0a` (`b3`, in the air) is not in it.
Goku's states on code of his own, not read: `charge`, `charge_end`, `charge_start`, `dash_back`, `dash_back_end`, `dash_back_run`, `dash_fwd`, `dash_fwd_end`, `dash_fwd_run`, `reel_trip`, `trip_fall`, `trip_land`.

## Vegetto

Drafted by script (`npm run rom -- draft`), not read move by move. `?scene=debug&p2=vegetto`.

| move | input | left out |
|---|---|---|
| `aa` shooting_kick | ground: R + B | — |
| `9e` forward_kick | ground: → + B | — |
| `9d` throw | ground: → + X | m9d's blow, a reaction no type copies |
| `a4` aerial_kick | ground: ↙ ↗ B | — |
| `a0` sender_a0 | ground: → ← → X | — |
| `a1` sender_a1 | ground: ↓ ↙ ← X | — |
| `ad` kakusan | ground: ↓ ↙ ← A | — |
| `9f` sender_9f | ground: ↓ ↘ → X | — |
| `a7` elbow_dash | ground: ↓ ↘ → Y | — |
| `af` big_bang | ground: ← ↙ ↓ ↘ → A | — |
| `a5` geri_combo | ground: → ↘ ↓ ↙ ← B | — |
| `ae` final_kame | ground: ↓ ↙ → A | written after Gohan's Kamehame-Ha, by hand: its three levels, no spoken line checked `?` |
| `b0` galactic_juggle | ground: ↓ ↙ ← ↙ ↓ ↘ → Y | what its handler decides on a button held or a level `?` |
| `a8` slashdown_kick | air: → ↓ B | — |
| `93` attack_b | his own normal | — |
| `94` crouch_y | his own normal | — |
| `95` crouch_b | his own normal | — |
| `9a` attack_x | his own normal | — |
| `b3` move_b3 | from another move | — |
| `b2` move_b2 | from another move | — |
| `a9` move_a9 | from another move | — |

Objects, no recording yet (3): frames from the table, 4 frames each `?`, colours `?`: `vegetto_4_02`, `vegetto_4_04`, `vegetto_4_03`.
Goku's states on code of his own, not read: `charge`, `charge_end`, `charge_start`, `dash_back`, `dash_back_end`, `dash_back_run`, `dash_fwd`, `dash_fwd_end`, `dash_fwd_run`, `intro`, `ko_bounce`, `ko_bounce2`, `ko_down`, `ko_fall`, `ko_lie`, `ko_rise`, `reel_trip`, `trip_fall`, `trip_land`, `win`.

## Piccolo

Read move by move against the original (`docs/rom.md`, Piccolo). `?scene=debug&p1=piccolo&p2=goku&hp1=80`.

| move | input | left out |
|---|---|---|
| `a0` sender_a0 | ground: → ← → X | — |
| `a1` sender_a1 | ground: ↓ ↙ ← X | — |
| `9f` sender_9f | ground: ↓ ↘ → X | — |

## Freeza

Read move by move against the original (`docs/rom.md`, Freeza). `?scene=debug&p1=freeza&p2=goku&hp1=80`.

| move | input | left out |
|---|---|---|
| `a0` sender_a0 | ground: → ← → X | not read: the Senders are out, by the owner's word |
| `a1` sender_a1 | ground: ↓ ↙ ← X | not read: the Senders are out |
| `9f` sender_9f | ground: ↓ ↘ → X | not read: the Senders are out |

Charge and win: from the code, not looked at against a picture `?`; his own reels the same.

## Cell

Read move by move against the original (`docs/rom.md`, Cell). `?scene=debug&p1=cell&p2=goku&hp1=80`.

| move | input | left out |
|---|---|---|
| `a0` sender_a0 | ground: → ← → X | not read: the Senders are out, by the owner's word |
| `a1` sender_a1 | ground: ↓ ↙ ← X | not read: the Senders are out |
| `9f` sender_9f | ground: ↓ ↘ → X | not read: the Senders are out |

His own reels: not looked at against a picture `?`.

## Mr. Buu

Drafted by script (`npm run rom -- draft`), not read move by move. `?scene=debug&p2=mr_buu`.

| move | input | left out |
|---|---|---|
| `a0` sender_a0 | ground: → ← → X | — |
| `9f` sender_9f | ground: ↓ ↘ → X | — |

Goku's states on code of his own, not read: `charge`, `charge_end`, `charge_start`, `dash_back`, `dash_fwd`, `down_bounce`, `down_fall`, `down_lie`, `high_bounce`, `high_fall`, `high_lie`, `intro`, `ko_bounce`, `ko_bounce2`, `ko_down`, `ko_fall`, `ko_lie`, `ko_rise`, `reel_down`, `reel_high`, `reel_trip`, `trip_fall`, `trip_land`, `win`, `win_air`.

## Buu

Read move by move and approved by the owner (2026-11-07); what the port left is in `bugs.md`. `?scene=debug&p2=buu`.

| move | input | left out |
|---|---|---|
| `a0`, `a1`, `9f` Senders | → ← → X, ↓ ↙ ← X, ↓ ↘ → X | out, by his word |

Not compared by picture: intro, win, dash, his reels, Extension Punch, Whip, Matamol. Earth Stab's third stab: from the code only.
