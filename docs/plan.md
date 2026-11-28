# Plan — the work queue

**This is the only queue in the repo.** What is next lives here and nowhere
else, and **a finished item is deleted** in the change that finishes it: the
reasoning goes to `adr/`, the timing is in git. The next items have a *done
when*; later ones are a line.

---

## Next: the mechanics

The order is provisional; `combat.md` says what each is. `npm run chains` has to
hold for every fighter, not only one.

1. **Cancels and combos:** which blow stands where in Goku's and Freeza's
   rush; a rush for each other fighter, accepted by the owner; enders on Smash, a launcher
   and a ki follow-up after it, once the owner picks their animations; what
   punishes a string thrown at nothing.
2. **The counter against a projectile** (`combat.md` §5): behind the
   shooter. *Done when:* a recording shows it.
3. **Launch scaling:** each lift raises less, so a juggle ends by the body
   falling out of it (`Combo.lifts`).
4. **The aura.**
5. **The hit types:** one set (the original's beside our five), `stun`, a type
   for ki blasts; chip damage and a guard break.

## Later: the rest of the cartridge, and the game around the fight

- **Loading the ROM without a stall** (owner, 2026-11-07): measure where the time
  goes, then a loading screen or drawing on demand.
- **The effects on the music's chip** (ADR 0092): the rendered buffers go.
- **Pause**, on Start (the keyboard's Enter).
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
  jump, gravity, the get-up frame) in place of the same number overridden in
  several states — when tuning them gets in the way.
- **A shockwave out of a combo** (owner, 2026-11-28): the one being hit
  pushes the attacker off with a wave around him — no timing, no damage, back
  to neutral, dear (ki or fatigue); the sure way out beside the counter's
  timed and cheaper one (`combat.md` §5).
- A second player, and round rules.
- A remapping screen.
- Combos authored in the editor, as a view of the states, never a second format.
- The player's move list, once a screen exists for it.
