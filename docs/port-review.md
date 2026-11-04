# Port review — what the owner still has to try

Every move ported from the cartridge and not yet tried by the owner, a fighter
at a time. **A move he approves is deleted from this file**, like an item of
[`plan.md`](./plan.md), which points here; this file holds no other work.

Each line: the state to start from, the input, what the port left out or
guessed (`?`). **Not playable** means it waits for something: a recording, or
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
| Bukuuh Kyaku `a8`, `a9` | `bukuuh_kyaku` | → ↓ B, in the air | **not playable**: dives, hits nothing (`plan.md`) |
| Renzoku Energy Dan `ab` | `renzoku` | ↓ ↘ → A | — |
| Masenko `ad` | `masenko` | ← ↙ ↓ ↘ → A | its hit sounds `?` |
| Kamehame-Ha `ac` | `kame_charge` | ↓ ↙ → A, held | — |
| Rushing Suki Combo `ae` | `suki_combo` | → ↘ ↓ ↙ ← → B, health ≤ 80 | palette run, re-arm at 136, last blow's effect `?` |
| `9f`, `a0`, `a1` | `sender_*` | ↓ ↘ → / → ← → / ↓ ↙ ← + X | — |
| dash, knockdown, win, intro | | | intro objects named by nothing but the move, `gohan_intro_b` may look wrong `?` |
