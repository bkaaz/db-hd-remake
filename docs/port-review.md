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

## Gohan

Dummy: `?scene=debug&mode=5&p2=gohan`, `T` (mode 5 is rewritten per batch).

| move | state | input | left out or guessed |
|---|---|---|---|
| the throw `9d` | `throw` | → + X, in range | — |
| Triangle Illusion `aa` | `triangle_illusion` | R + B | its 16 px step, the depth's palette `?` |
| Rushing Uppercut `a2` | `rushing_uppercut` | → + Y | — |
| Knee Slasher `a4`, `a5` | `knee_slasher` | ← (charge) → B | the dust |
| Zankuu Kyaku `a6` | `zankuu_kyaku` | ↓ (charge) ↑ B | — |
| Bakuretsu Punch `a7` | `bakuretsu` | ← (charge) → Y | the dust |
| Renzoku Energy Dan `ab` | `renzoku` | ↓ ↘ → A | — |
| Kamehame-Ha `ac` | `kame_charge` | ↓ ↙ → A, held | — |
| Rushing Suki Combo `ae` | `suki_combo` | → ↘ ↓ ↙ ← → B, health ≤ 80 | palette run, re-arm at 136, last blow's effect `?` |
| `9f`, `a0`, `a1` | `sender_*` | ↓ ↘ → / → ← → / ↓ ↙ ← + X | — |
| dash, knockdown, win, intro | | | intro objects named by nothing but the move, `gohan_intro_b` may look wrong `?` |

## Gotenks

Drafted by script (`npm run rom -- draft`), not read move by move. `?scene=debug&p2=gotenks`.

| move | input | left out |
|---|---|---|
| `af` ultra_headbutt | ground: R + Y | — |
| `9d` throw | ground: → + X | m9d's blow, a reaction no type copies |
| `a5` sliding_headbutt | ground: ↘ + Y | — |
| `a0` sender_a0 | ground: → ← → X | — |
| `a1` sender_a1 | ground: ↓ ↙ ← X | — |
| `9f` sender_9f | ground: ↓ ↘ → X | — |
| `ab` renzoku | ground: ↓ ↘ → A | — |
| `a8` wild_boar | ground: ↓ ↘ → Y | — |
| `bd` ultra_renzoku | ground: ↓ ↘ → ↓ ↘ → A | — |
| `ac` kikoha | ground: ← ↙ ↓ ↘ → A | — |
| `a7` omaenanka | ground: → ↘ ↓ ↙ ← Y | — |
| `ad` heat_seeking | ground: ↓ ↙ → A | what its handler decides on a button held or a level `?` |
| `b4` rolling_thunder | ground: ← ↙ ↓ ↘ → Y | — |
| `ae` volleyball | ground: → ← ↙ ↓ ↘ → Y | — |
| `b0` air_dive | air: → ↓ Y | — |
| `b3` aerial_kantsu | air: → ← → A | mb3_2's blow, a reaction no type copies; mb3_3's blow, a reaction no type copies; mb3_4's blow, a reaction no type copies; mb3_5's blow, a reaction no type copies; mb3_6's blow, a reaction no type copies |
| `90` attack_y_close | his own normal | — |
| `92` attack_y | his own normal | — |
| `93` attack_b | his own normal | — |
| `94` crouch_y | his own normal | — |
| `95` crouch_b | his own normal | — |
| `a6` move_a6 | from another move | — |
| `aa` move_aa | from another move | — |
| `b1` move_b1 | from another move | — |
| `b2` move_b2 | from another move | mb2's blow, a reaction no type copies |

Objects, no recording yet (4): frames from the table, 4 frames each `?`, colours `?`: `gotenks_3_08`, `gotenks_3_06`, `gotenks_3_03`, `gotenks_3_0a`.
Goku's states on code of his own, not read: `charge`, `charge_end`, `charge_start`, `dash_back`, `dash_back_end`, `dash_back_run`, `dash_fwd`, `dash_fwd_end`, `dash_fwd_run`, `intro`, `ko_bounce`, `ko_bounce2`, `ko_down`, `ko_fall`, `ko_lie`, `ko_rise`, `reel_trip`, `trip_fall`, `trip_land`, `win`, `win_2`, `win_air`.

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

Drafted by script (`npm run rom -- draft`), not read move by move. `?scene=debug&p2=piccolo`.

| move | input | left out |
|---|---|---|
| `9e` sonic_kick | ground: R + B | — |
| `9d` throw | ground: → + X | — |
| `b9` shocking_stunner | ground: ← ↙ ↓ A | — |
| `a0` sender_a0 | ground: → ← → X | — |
| `a1` sender_a1 | ground: ↓ ↙ ← X | — |
| `b4` low_counter | ground: ↓ ↙ ← B | — |
| `ab` high_counter | ground: ↓ ↙ ← Y | — |
| `9f` sender_9f | ground: ↓ ↘ → X | — |
| `bb` yuudoh | ground: → ↓ ↘ A | — |
| `ae` low_mystic | ground: → ↓ ↘ B | — |
| `a5` high_mystic | ground: → ↓ ↘ Y | — |
| `bd` gekiretsudokan | ground: ← ↙ ↓ ↘ → A | — |
| `bc` beam_cannon | ground: ↓ ↙ → A | mbc_3: only the first of its spawn counters; what its handler decides on a button held or a level `?` |
| `b7` regeneration | ground: ← ↙ ↓ ↘ → Y | mb7's blow, a reaction no type copies |
| `a2` aerial_assault | ground: → ← ↓ ↑ Y | ma2's blow, a reaction no type copies; what its handler decides on a button held or a level `?` |
| `be` bukuuh_kyaku | air: → ↓ B | mbe's blow, a reaction no type copies; mbe: only the first of its spawn counters; what its handler decides on a button held or a level `?` |
| `93` attack_b | his own normal | — |
| `b3` move_b3 | from another move | — |
| `aa` move_aa | from another move | — |

Objects, no recording yet (5): frames from the table, 4 frames each `?`, colours `?`: `piccolo_5_0b`, `piccolo_5_0a`, `piccolo_5_02`, `piccolo_5_03`, `piccolo_5_07`.
Goku's states on code of his own, not read: `dash_back`, `dash_fwd`, `intro`, `ko_bounce`, `ko_bounce2`, `ko_down`, `ko_fall`, `ko_lie`, `ko_rise`, `reel_trip`, `trip_fall`, `trip_land`, `win`, `win_air`.

## Freeza

Drafted by script (`npm run rom -- draft`), not read move by move. `?scene=debug&p2=freeza`.

| move | input | left out |
|---|---|---|
| `a4` double_leg_kick | ground: R + B | — |
| `9d` throw | ground: → + X | — |
| `a7` ground_wave | ground: ← ↙ ↓ A | — |
| `a0` sender_a0 | ground: → ← → X | what its handler decides on a button held or a level `?` |
| `a1` sender_a1 | ground: ↓ ↙ ← X | — |
| `a9` freeza_slash | ground: ↓ ↙ ← Y | — |
| `9f` sender_9f | ground: ↓ ↘ → X | what its handler decides on a button held or a level `?` |
| `af` flaming_headbutt | ground: ↓ ↙ ← B + Y | maf_3's blow, a reaction no type copies; what its handler decides on a button held or a level `?` |
| `a8` kienzan | ground: → ↓ ↘ A | — |
| `a5` kishin_ha | ground: → ↓ ↘ Y | — |
| `ab` death_ball | ground: ← ↙ ↓ ↘ → A | — |
| `aa` explosive_grab | ground: → ↘ ↓ ↙ ← Y | — |
| `ac` jubaku_ha | ground: ↓ ↙ → A | — |
| `ad` jasenkoh | air: → ↓ B | — |
| `a6` evil_energy | air: ↓ ↙ ← B | — |
| `92` attack_y | his own normal | — |
| `93` attack_b | his own normal | — |
| `95` crouch_b | his own normal | what its handler decides on a button held or a level `?` |
| `9e` move_9e | from another move | — |
| `ae` move_ae | from another move | — |

Objects, no recording yet (12): frames from the table, 4 frames each `?`, colours `?`: `freeza_6_07`, `freeza_6_08`, `freeza_6_0b`, `freeza_6_12`, `freeza_6_06`, `freeza_6_14`, `freeza_6_05`, `freeza_6_0a`, `freeza_6_11`, `freeza_6_0d`, `freeza_6_0e`, `freeza_6_13`.
Objects with nothing to draw from their table, so left out: `06/15`.
Goku's states on code of his own, not read: `charge`, `charge_end`, `charge_start`, `dash_back`, `dash_fwd`, `down_bounce`, `down_fall`, `down_lie`, `high_bounce`, `high_fall`, `high_lie`, `intro`, `reel_down`, `reel_high`, `win`, `win_2`, `win_air`.

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
| `ad` flying_bomber | ground: R + B | — |
| `9d` throw | ground: → + X | m9d's blow, a reaction no type copies |
| `a0` sender_a0 | ground: → ← → X | — |
| `a1` sender_a1 | ground: ↓ ↙ ← X | — |
| `ab` kakusan | ground: ↓ ↙ ← A | — |
| `9f` sender_9f | ground: ↓ ↘ → X | — |
| `aa` rolling_tackle | ground: ↓ ↘ → Y | — |
| `b0` buu_breath | ground: ↓ ↘ → B + Y | — |
| `af` energy_field | ground: ← ↙ ↓ ↘ → A | — |
| `ae` mightiness_bomber | ground: ↓ ↙ → A | what its handler decides on a button held or a level `?` |
| `a4` tornado_hip | ground: ← → B | — |
| `a8` planet_attack | ground: ← → Y | what its handler decides on a button held or a level `?` |
| `a5` oyatsu_kosen | ground: ↓ ↑ B | — |
| `ac` powersault | ground: ↓ ↑ Y | — |
| `9e` butt_drop | air: ↓ + B | — |
| `92` attack_y | his own normal | — |
| `94` crouch_y | his own normal | — |
| `95` crouch_b | his own normal | — |
| `9a` attack_x | his own normal | — |

Objects, no recording yet (7): frames from the table, 4 frames each `?`, colours `?`: `mr_buu_a_25`, `mr_buu_a_26`, `mr_buu_8_17`, `mr_buu_8_04`, `mr_buu_8_08`, `mr_buu_8_09`, `mr_buu_8_06`.
Objects with nothing to draw from their table, so left out: `08/12`, `08/0f`, `08/05`.
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
