# Plan — the work queue

**This is the only queue in the repo.** What is next lives here and nowhere
else, and **a finished item is deleted** in the change that finishes it: the
reasoning goes to `adr/`, the timing is in git. The next items have a *done
when*; later ones are a line.

---

## First: a clean foundation, before any new work

The approach changed several times — the last to reading the ROM in the
browser (ADR 0090) — and nothing new starts until the project is tidy and all of
it works. Reviewed with the owner area by area; what is agreed and left:

1. **The living docs, trimmed to their one job:** `data-format.md` (where files
   live and who writes them, not field by field), `entity-editor.md` (the editor
   today, not its history), `glossary.md` (a line a term), `combat.md` (what still
   describes the hand-built Goku).
2. **What the hand-built Goku left in the code:** `input/motion.ts` and its wiring
   (no entity asks by `motion:`); the synth half of `audio/sounds.ts` and
   `playback.ts` (every sound is the cartridge's, ADR 0092); `npm run which`,
   which fails without `descriptions.json` — mended to point without one.
3. **`CLAUDE.md`**, last: the rules about docs as they now are.

Waiting for the mechanics, from `bugs.md`: the late KO and Cell's downward
sender. Exports used only in their own file stay as they are.

*Done when:* this section is empty, and the next one is the common part.

## Then: the common part

[ADR 0038](./adr/0038-a-fighters-states-are-generated.md), before the first change
of mechanics.

1. **The template out of Goku:** a file of its own, his specials into his
   `specials.json`, and he is generated like the rest. *Done when:*
   `goku/states.json` comes out of the command and the test covers him.
2. **Named groups in `entries`** in place of the lists of states, by script.
3. **Rules of the game out of `attributes.json`** (`comboLimits`).
4. **Freeze the port:** its flat states and hit types kept as they are.
5. **The generator stops overwriting** a blow's type.
6. **Whose `animations.json` is** — open. The export writes it whole, so an
   animation edited in the editor or added for a mechanic is gone at the next
   export. Settled with the owner before the mechanics touch an animation.

## Then: the mechanics

The order is provisional; `combat.md` says what each is. `npm run chains` has to
hold for every fighter, not only one.

1. **The press lost as a move ends:** a state entered on a frame reads its input
   only on the next, so a window's last frame is never usable.
2. **Ki** for the cartridge's fighters, who pay in health today, and what spends
   it.
3. **Cancels and combos:** the rush (`combat.md`, The buttons), strings joined
   up, what punishes a string thrown at nothing.
4. **Vanish** (`combat.md` §5). *Done when:* a recording shows a vanish out of
   blockstun, and a tap without ki blocks.
5. **Launch scaling:** each lift raises less, so a juggle ends by the body
   falling out of it (`Combo.lifts`).
6. **The aura.**
7. **The hit types:** one set (the original's beside our five), `stun`, a type
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
- **What we change of the original:** a crouching attack's two frames of the way
  down; five objects a fighter; the winners' poses in the air.
- **Nothing checks that a `sound` or `hitFx` id exists**, as one does for `anim`.

## Not yet ordered

- A LICENSE for the code, and a README line on what is not ours.
- A second player, and round rules.
- A remapping screen.
- Combos authored in the editor, as a view of the states, never a second format.
- The player's move list, once a screen exists for it.
