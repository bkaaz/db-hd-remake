# Plan — the work queue

**This is the only queue in the repo.** What is next lives here and nowhere
else, and **a finished item is deleted** in the change that finishes it: the
reasoning goes to `adr/`, the timing is in git. The next items have a *done
when*; later ones are a line.

---

## First: the common part

[ADR 0038](./adr/0038-a-fighters-states-are-generated.md), before the first change
of mechanics.

1. **Rules of the game out of `attributes.json`** (`comboLimits`).
2. **Freeze the port:** its flat states and hit types kept as they are.
3. **The generator stops overwriting** a blow's type and damage: a sparse file
   of each fighter's, by state, written once from what `blowOf` gives now,
   shaped as the later parameters will be. An override of nothing is an error.
4. **A stale `replaces` caught:** a test fails when a common state changes
   that a fighter plays a copy of (`attack_b`, `crouch_b`, … are copied).
5. **Whose `animations.json` is** — open. The export writes it whole, so an
   animation edited in the editor or added for a mechanic is gone at the next
   export. Settled with the owner before the mechanics touch an animation.

## Then: the mechanics

The order is provisional; `combat.md` says what each is. `npm run chains` has to
hold for every fighter, not only one.

1. **The press lost as a move ends:** a state entered on a frame reads its input
   only on the next, so a window's last frame is never usable.
2. **Cancels and combos:** the rush (`combat.md`, The buttons), strings joined
   up, what punishes a string thrown at nothing.
3. **Vanish** (`combat.md` §5). *Done when:* a recording shows a vanish out of
   blockstun, and a tap without ki blocks.
4. **Launch scaling:** each lift raises less, so a juggle ends by the body
   falling out of it (`Combo.lifts`).
5. **The aura.**
6. **The hit types:** one set (the original's beside our five), `stun`, a type
   for ki blasts; chip damage and a guard break.

## Later: the rest of the cartridge, and the game around the fight

- **Loading the ROM without a stall** (owner, 2026-11-07): measure where the time
  goes, then a loading screen or drawing on demand.
- **The effects on the music's chip** (ADR 0092): the rendered buffers go.
- **Settings:** the music's level first, fixed at 30% of the effects' until then.
- **Menus** — title, select, a second round — and with them how a scene says it
  wants to be replaced; the select's fighters spill out of their slots
  (`bugs.md`).
- **Other dumps of the cartridge:** only the owner's is checked.
- **What the original does that is not read yet:** the red bars under the HUD
  while charging; `$37` set to `16` by a big explosion; idle's poses held 13–14
  frames where its script says 12; the sparks' tiles and palette; a name for
  each `sfx_<id>`.
  Whether a command or a held guard wins on a crouch's frame, and whether a
  special can start from a low guard (`guard_low` has no entries).
- **What we change of the original:** a crouching attack's two frames of the way
  down; five objects a fighter; the winners' poses in the air.
- **Nothing checks that a `sound` or `hitFx` id exists**, as one does for `anim`.

## Not yet ordered

- **A fighter's character as parameters** of the common states (walk, dash,
  jump, gravity, the get-up frame), resolved as `states` writes; the
  cartridge's readers then write beside `data/`, in a gitignored directory,
  never over it — when a mechanic or tuning runs into the generator.

- A second player, and round rules.
- A remapping screen.
- Combos authored in the editor, as a view of the states, never a second format.
- The player's move list, once a screen exists for it.
