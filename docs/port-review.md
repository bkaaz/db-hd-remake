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

Two changes of Piccolo's pass reach all of them, not yet judged by the owner:

- A scene opened by a shot no longer pauses its thrower (`$0F:C2FC`, commit `9a7a253`): Oyatsu Kosen, Buu Breath, Volleyball and Jubaku Ha move by 8 frames.
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

Drafted by script (`npm run rom -- draft`), not read move by move. `?scene=debug&p2=cell`.

| move | input | left out |
|---|---|---|
| `a2` giga_shoulder | ground: R + Y | — |
| `9d` throw | ground: → + X | m9d's blow, a reaction no type copies |
| `a0` sender_a0 | ground: → ← → X | — |
| `9e` kantsu | ground: → ← → A | — |
| `a8` cell_junior | ground: → ← → B | what its handler decides on a button held or a level `?` |
| `a1` sender_a1 | ground: ↓ ↙ ← X | — |
| `9f` sender_9f | ground: ↓ ↘ → X | — |
| `a4` suki_combo | ground: ↓ ↘ → Y | — |
| `ab` kamehameha | ground: ← ↙ ↓ ↘ → A | — |
| `a5` energy_burst | ground: → ↘ ↓ ↙ ← B | what its handler decides on a button held or a level `?` |
| `a6` psychic_lift | ground: → ↘ ↓ ↙ ← Y | — |
| `aa` chou_kamehameha | ground: ↓ ↙ → A | written after Gohan's Kamehame-Ha, by hand: its three levels, no spoken line checked `?` |
| `a7` ki_flame | ground: ← ↙ ↓ ↘ → Y | — |
| `ac` bakuretsu_rush | ground: → ← → ← → Y | — |
| `ad` tri_eruption | ground: ↓ ↙ ← ↙ ↓ ↘ → Y | mad's blow, a reaction no type copies; mad_3's blow, a reaction no type copies |
| `a9` negative_arrow | air: → ↓ Y | — |
| `9a` attack_x | his own normal | — |

Objects, no recording yet (11): frames from the table, 4 frames each `?`, colours `?`: `cell_7_05`, `cell_7_03`, `cell_7_04`, `cell_7_0a`, `cell_7_07`, `cell_7_08`, `cell_7_02`, `cell_a_21`, `cell_a_22`, `cell_a_23`, `cell_7_06`.
Goku's states on code of his own, not read: `charge`, `charge_end`, `charge_start`, `dash_back`, `dash_back_run`, `dash_fwd`, `dash_fwd_run`, `intro`, `ko_bounce`, `ko_bounce2`, `ko_down`, `ko_fall`, `ko_lie`, `ko_rise`, `win`, `win_2`, `win_air`.

## Mr. Buu

Drafted by script (`npm run rom -- draft`), not read move by move. `?scene=debug&p2=mr_buu`.

| move | input | left out |
|---|---|---|
| `a0` sender_a0 | ground: → ← → X | — |
| `9f` sender_9f | ground: ↓ ↘ → X | — |

Goku's states on code of his own, not read: `charge`, `charge_end`, `charge_start`, `dash_back`, `dash_fwd`, `down_bounce`, `down_fall`, `down_lie`, `high_bounce`, `high_fall`, `high_lie`, `intro`, `ko_bounce`, `ko_bounce2`, `ko_down`, `ko_fall`, `ko_lie`, `ko_rise`, `reel_down`, `reel_high`, `reel_trip`, `trip_fall`, `trip_land`, `win`, `win_air`.

## Buu

Drafted by script (`npm run rom -- draft`), not read move by move. `?scene=debug&p2=buu`.

| move | input | left out |
|---|---|---|
| `b6` matamol | ground: R + Y | — |
| `a8` extension_punch | ground: → + Y | — |
| `9d` throw | ground: → + X | — |
| `a0` sender_a0 | ground: → ← → X | — |
| `b5` kantsu | ground: → ← → A | — |
| `a1` sender_a1 | ground: ↓ ↙ ← X | — |
| `b0` earth_stab_again | ground: ↓ ↙ ← A | ground: ↓ ↙ ← B | ground: ↓ ↙ ← Y | what its handler decides on a button held or a level `?` |
| `af` earth_stab | ground: ↓ ↙ ← A | ground: ↓ ↙ ← B | ground: ↓ ↙ ← Y | what its handler decides on a button held or a level `?` |
| `9f` sender_9f | ground: ↓ ↘ → X | — |
| `b1` whip | ground: ↓ ↘ → Y | — |
| `b7` putty_uppercut | ground: ← → ↓ ↑ Y | mb7's blow, a reaction no type copies |
| `b3` buu_burn | ground: ← ↙ ↓ ↘ → A | — |
| `b4` energy_sphere | ground: ↓ ↙ → A | what its handler decides on a button held or a level `?` |
| `b2` disk_tackle | air: ← ↙ ↓ ↘ → Y | — |
| `d2` slashdown_blast | air: → ↓ B | — |
| `d1` horizontal_blast | air: → ↓ Y | — |
| `a9` floater | air: → ↘ ↓ ↙ ← Y | — |
| `90` attack_y_close | his own normal | — |
| `92` attack_y | his own normal | — |
| `93` attack_b | his own normal | — |
| `94` crouch_y | his own normal | — |
| `97` jump_b | his own normal | — |
| `98` jump_fwd_y | his own normal | — |

Objects, no recording yet (7): frames from the table, 4 frames each `?`, colours `?`: `buu_9_09`, `buu_9_06`, `buu_9_04`, `buu_9_15`, `buu_9_12`, `buu_9_0e`, `buu_a_20`.
Objects with nothing to draw from their table, so left out: `09/17`, `09/16`, `09/18`, `09/13`, `09/14`, `09/19`, `09/0f`, `09/10`, `09/11`.
Goku's states on code of his own, not read: `charge_start`, `dash_back`, `dash_back_end`, `dash_back_run`, `dash_fwd`, `dash_fwd_end`, `dash_fwd_run`, `intro`, `ko_bounce`, `ko_bounce2`, `ko_down`, `ko_fall`, `ko_lie`, `ko_rise`, `reel_trip`, `trip_fall`, `trip_land`, `win`, `win_2`.
