# 0092 — Every sound is the cartridge's driver on our chip

**Status:** accepted 2026-11-17 · consolidates 0011, 0024, 0034, 0055, 0092 and
0094 (2026-08-13 – 2026-11-07), which it replaces

Every effect, voice, spoken line and song is played by the cartridge's own sound
driver on our SPC700 + DSP (`src/apu/`), asked for as the game asks. Effects,
voices and lines are rendered once, when their bank is first wanted; the music
runs live in an AudioWorklet. The bank, `data/audio/sounds.json`, has one entry
per cartridge id; a fighter's voices are in his own `sounds.json`. A script's
sounds ride on its animation steps as the cartridge's ids; a state's own
`sound` names the moment it is entered. A sound asked for again cuts its copy on
the same side.

**Rejected:**

- **Audio files cut from a recording**, matched to ids by silence or by ear — every
  match was a guess.
- **Rendering from samples along a DSP recording**, or **a line's BRR decoded
  straight** — the same sound by another road, with numbers the driver knows.
- **Effects running live too** — a timing problem across threads that changes
  nothing a rendered buffer does not do; **songs rendered once** — their loop
  point would have to be found, and minutes rendered at the start.
- **A sound on the attack that caused it** — throws and blows inherit the floor's
  crash by entering the same state.
- **Overlapping copies**, or **dropping a request while it plays** — the original
  cuts; **cutting across sides** — one player's hit would silence the other's.
