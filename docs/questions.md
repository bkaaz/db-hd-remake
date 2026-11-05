# Questions and the roster check's report

What came up while the owner was away (from 2026-11-05), for him to read on return: what was
checked, what was fixed, and what is still his to say. `npm run moves -- <fighter>` repeats any
fighter's comparison; `logs/moves/<fighter>/report.txt` holds the last one. Deleted when answered.

## Questions

1. **Gotenks's discharges (intro):** do you see a pale smear instead of a sharp line, or something
   else, such as when or where they appear? (Measured: they should be solid, `docs/bugs.md`.)
2. **Goten and Trunks splitting (win):** in which light did you look, and as which player? Is it the
   final colour, the flash or the moment of change? By day the palettes match the original.

3. **The ultimates' scenes** (Galactic Juggle, Aerial Assault, Jubaku Ha, Buu Breath, Oyatsu Kosen, Candy
   Beam): they now seize, play their parts and throw, but the opponent plays one pose in place, without the
   original's flight, flashes and sprays, and **their damage is my guess** (70 to 120), save Candy Beam's 100
   from the code. Are they worth doing to the frame now, or after the port?

## Report

### For everyone

- A reel's knockback held 3 × 12 and 2 × 8 px in every recording; ours slowed by friction, a heavy
  blow moved a body 19 px instead of 36. Goku, Vegeta and Gohan feel this too: **try it again**.
- A bolt's hit now stops its thrower too, as a melee blow does: his blast lasts 9 frames longer on a hit.
- The first bolt to land stops the rest for the pause.
- A fighter who finds the opponent behind him now plays his turn (`41`), 6 frames, from idle,
  walking and the crouch. Before he flipped at once. **Try it on all of them:** it costs frames.

### Vegetto

Fixed: Shooting Kick, Far Smash and low Smash's movement, low blows' return to the crouch, Aerial
Kick (117 frames, as the original), Geri Combo's hold and throw, Kakusan's three, Final Kamehameha's
ending, his objects from a recording (Big Bang's ball, the flashes of low Y and X).
Galactic Juggle's scene when it lands is approximate (below). Left: Kakusan's balls land closer together than the original's; Elbow Dash lands 3 frames early.

### Piccolo

Fixed: Sonic Kick moves and goes behind, the mystic blows' second part is by whether the first landed
(one hit, as the original), Bukuuh Kyaku no longer hangs for ever in the air and holds and throws,
Beam Cannon has its three levels on the Kamehameha's way and its ending, Shocking Stunner seizes at
close range, his objects come from a recording. Every fighter now has his own close-range lines
(`$3D:9EDB`), before all had Goku's: **this changes which Y and B come out at a distance, for all.**
Aerial Assault's scene is approximate (below). Left: Shocking Stunner's opponent flashes in
palettes `0x113`/`0x114` while held (not done) and his throw's choice of `1e` or `1b` is not read `?`.
Beam Cannon's head's frames every 12 and its band are a guess `?`.

### Freeza

Fixed: his normals' and Double Leg Kick's movement, Flaming Headbutt's run and its new reaction (`20`,
a high tumble, `reel_tumble`), Kienzan's disc falls on its way (vy 2.12, not read by `port`: every other
"vx 3, vy 2.12" object may share it `?`), Kishin Ha steps back, low blows crouch. Objects from a recording.
Jubaku Ha's scene is approximate (below).

### Cell

Fixed: Giga Shoulder moves and goes behind, Chou Kamehameha's ending, Psychic Lift raises the opponent
81 px over 81 frames and throws him from there. Objects from a recording.
Left, not ported: **Cell Junior** (the ball bounces and comes at the opponent, reading its code is ahead).
Tri-Eruption is 116 frames where the original's is 200, and knocks down where its keeps him in the air. Suki Combo's last blow misses by a hair where the original's lands `?`.

### Mr. Buu

Fixed: his Y's and X's blows counted twice (body and object), Flying Bomber moves and goes behind,
Butt Drop falls, bounces and strikes again, Planet Attack's speed, low blows crouch, Kakusan's three
different shots. Objects from a recording. The dash's charge commands now reach `npm run moves` too.
Buu Breath's and Oyatsu Kosen's scenes are approximate (below). Left: **Energy Field's** ball draws from
tiles at base 0 that the exporter finds empty (`8/12`): it strikes, but shows nothing `?`.

### Buu

Fixed: Matamol moves and goes behind, his throw lasts and springs off as the original's, Earth Stab
rises under the opponent, Buu Burn's ball is what hits, low Y returns to the crouch, the air commands in
the cartridge's order. Objects from a recording.
Candy Beam's scene is approximate (below). Left: **Energy Sphere's** objects by part. A command of
the air whose conditions ask for the ground (`b2`) has no way in now `?`.

### Goku, Vegeta, Gohan, Gotenks (you had approved them; compared again)

Goku agrees in almost everything, which is the tool's own check. Changed: the Kamehameha now ends in
its last pose for all who have one, 14 frames longer (**try it**). Vegeta's B in the crouch never came out
(`crouch` had no entry for it). Triangle Illusion and Wild Boar throw at knockback 5, 111 px instead of 58.
Gotenks's close Y struck twice. Not changed: Jumping Bomb travels 21 px further than the original, whose
speed may depend on the side he faces `?`.

### Every object's blow

An object struck with the whole of its picture, computed; now with its own rectangle, read from
`$2A:9AE3`. Every ki blast and beam has a new reach: **try them.** Beam heads and many objects are narrower
than drawn. Gohan's and Gotenks's and Goku's too.

### Across the roster, not done

- **Sender moves** (`a0`, `a1`, `9f`) leave out the fight above the arena, as the owner decided.
- **The charge** taking over a punch begun a frame before: `docs/bugs.md`, already known.
- **A block's shove** stays on friction: no recording away from an edge says otherwise `?`.
