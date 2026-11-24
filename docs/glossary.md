# Glossary

Words this project uses and defines nowhere else. **One line a term, plus where it
is explained**; a term whose field or file is renamed is renamed here in the same
change.

---

- **Active frames** — the frames an attack's hit box is out, the only ones it can connect on. → `combat.md` §1
- **Alt** — player two's colours when both sides are the same fighter: the next palette record. → `rom.md`
- **Arena** — the original's stage art behind a fight, layers scrolling at their own speeds, in a lighting; not the `Stage`, the playfield's numbers. → `data/arenas/`, ADR 0081
- **Cancel** — cutting your own attack short with the next, up to its `cancelBy` on a connection, or for as long once a whiff's last hit box is gone. → `combat.md` (Chaining)
- **`cancelBy`** — the last frame of an attack a cancel may fire on, counted from entering it. → `states.ts`
- **Chain (string)** — attacks joined by cancels: a path through `states.json`, never a structure of its own. → `combat/chains.ts`, `npm run chains`
- **Charging** — holding A + S: the state's `ki` rate fills the ki meter. → `combat.md` (The buttons)
- **Colour set** — colours of our own for a fighter, a rule over his palette (`palettes.json`). → ADR 0063
- **Combo** — a chain whose links hold: the defender never gets control back. → `combat.md`
- **Command** — a special's input as the cartridge's table has it. → `input/command.ts`, ADR 0050
- **Common states** — the states every fighter shares, by hand; his `states.json` is them on his numbers with his specials. → `data/template/states.json`, ADR 0038
- **Defence** — an attribute taken off every blow a fighter takes, before scaling. → ADR 0019
- **Depth** — how many blows landed before a link, by the longest route into it. → `combat.md` §3
- **Fatigue** — hits taken, each counting one, blocked ones none; the twentieth collapses him and leaves him tired (`onTired`). → `combat.md` §8
- **Finale** — a ball thrown at the floor, swelling into an explosion, then the arena white. → `match/finale.ts`, ADR 0035
- **Frame advantage** — hitstun less the attacker's remaining recovery: who acts first after a blow. → `combat.md` §1
- **Frees / freed** — one body's state letting the other's held step go on. → ADR 0035
- **Game pixel** — one pixel of the original's screen, the unit of every position, speed and box. → ADR 0041
- **Glow** — the palette a fighter is drawn in while he charges. → `rom.md`
- **Grab / held** — a throw: the thrower's state holds the opponent, who plays `m30_<thrower>_<move>`. → `match/throw.ts`, ADR 0035
- **Group** — a named list of common states an entry's `from` gives as `@name`. → `data/template/groups.json`, `rom/specials.ts`
- **Guard** — the stance that blocks; a blow is blocked only in a state marked `guarding`. → `combat.md`
- **Hit again** (`ifHitAgain`) — a reaction that overrules the next blows taken in it. → `combat.md`, `entity/hitAgain.ts`
- **Hit type** — what a blow does to whoever it hits, every number but its damage; written `fl30`, its code and a frame of the move. → `data/hit-types.json`, ADR 0019
- **Hitstop** — the freeze on contact, the same for both fighters. → `combat.md` §1
- **Hitstun** — how long the defender is helpless after a blow, set by its type. → `combat.md` §1
- **Hop** — a direction tapped and then held: a low jump. → `input/hop.ts`
- **HUD** — the corners over the fight: face, ki, health in layers, fatigue, the name; under them the hit counter. → `src/hud/`, ADR 0032
- **Inputs of** (`inputsOf`) — a state starting what another state's inputs would. → ADR 0013
- **Intro** — a fighter's opening pose on the arena before READY and FIGHT!. → `match/opening.ts`, ADR 0064
- **Journey** — what a sender plays before the arena changes. → `arena/flight.ts`, ADR 0081
- **Ki** — the meter separate from health, filled by charging and spent by a special's `cost`; 30 at the start. → `combat.md`
- **KO** — health run out: the fall at half speed, the announcement, the winner's pose. → `match/round.ts`, ADR 0064
- **Launcher** — a blow that lifts a grounded opponent into a juggle. → `combat.md` §4
- **Link** — hitting again after your attack has played out, while the defender is still in hitstun. → `combat.md` (Chaining)
- **Lit** (an object) — drawn in its thrower's palette, so in his colours in every lighting. → ADR 0036
- **Move id** (`m92`) — the original's number for a move, which names its animation. → ADR 0017
- **Pinned** — let fall, bounced, left lying until whoever pinned him throws him. → `rom.md`
- **Push band** — the screen's outer band; a fighter moving toward its edge scrolls the camera. → `camera/push.ts`
- **Push box** — a drawing's body or head, keeping two fighters apart. → `combat.md`
- **Queued** — the next part of a move, typed during this one and taken when it ends. → ADR 0013
- **Rank** — how badly a reaction has taken control away; a blow never lowers it. → `combat.md` §7
- **Rebound** — a body going back up off the floor at a share of its speed. → `combat/rebound.ts`
- **Recovery** — the frames after the active ones, when you still cannot act. → `combat.md` §1
- **Rehit** — frames before a blow may connect again while its box is still out. → `combat/swing.ts`
- **Relaunch** — a blow allowed to lift or floor a body already juggled, from a budget per combo. → `combat.md` §4
- **Rush** — the string the Attack button walks; Smash ends it. → `combat.md` (The buttons)
- **SA-1** — the cartridge's second CPU, which runs the fight. → `rom.md`
- **Scaling** — each blow of a combo worth less, in damage and hitstun. → `combat.md` §3, `combat/scaling.ts`
- **Seize** — a scene on the opponent: set down, flown and let go hurt. → `match/seize.ts`, ADR 0035
- **Sender** — a blow whose state `sends` the opponent to another arena. → `arena/ways.ts`, ADR 0081
- **Shake** — the backdrop jolting while the fighters stay put. → `camera/shake.ts`
- **Shove** — a reaction's knockback, a speed that dies out each frame; not `push`. → `combat.md`
- **Situation flag** (`airborne`, `crouching`) — what redirects a reaction without the attack knowing. → ADR 0019
- **Slam** — a blow that drives the body down rather than lifting it. → `combat.md`
- **Smash** — the button that ends a rush. → `combat.md` (The buttons)
- **Song** — one of the cartridge's pieces of music, by its number. → ADR 0092
- **Spawn** — anything a state brings into the world, an ordinary `Entity`. → ADR 0014
- **Startup** — the frames from the press to the hit box. → `combat.md` §1
- **Vanish** — guard tapped just before a blow lands: a teleport behind the attacker. → `combat.md` §5
