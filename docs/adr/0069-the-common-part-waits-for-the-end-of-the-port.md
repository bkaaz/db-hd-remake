# 0069 — The common part comes out of Goku after the port, at build time

**Status:** accepted 2026-11-04; once done, supersedes 0038's "Goku's
`states.json` is still his own, by hand"

Until every fighter is ported the cartridge rules and nothing changes: Goku's
`states.json` stays the template. `npm run rom -- states --all` writes every
generated fighter, and `fighterStates.test.ts` fails when one is out of date
(`src/rom/fighterStates.ts`, which both call).

Once the port ends, before the first change of mechanics: the template gets a
file of its own and Goku a `specials.json`, so he is generated like the rest;
the lists in a special's `entries` become named groups; rules of the game
leave the fighters' attributes (`comboLimits`); the generator stops overwriting
what the design then owns (a blow's type). From there the common part is our
design, and the cartridge gives drawings, boxes, timing and the specials' moves.

The engine still reads one flat `states.json` per fighter.

**A new mechanic comes in through data and is off without it.** That keeps the
original's rules playable as an option, not a promise: the port's flat files
and hit types are frozen as they stand at its end, and a switch is built only if
still wanted. A change that cannot be made this way is decided when it comes up:
an `if` in the engine, or the legacy mode gives that rule up. Its bugs stay.

**Rejected:**

- **Inheritance at run time** (MUGEN's `common1`) — no file shows a state whole,
  to the game, the editor or a log; an edit takes effect without a command, which
  is all it buys.
- **A layer of our changes laid over the cartridge** — the changes planned are
  the design of the fight, not a patch on it.
- **Keeping two sets of rules alive** — every engine change would have to hold in
  both; the frozen one asks nothing of it.
- **Taking the common part out before the port ends** — only Goku's file has to
  be split and the lists can be renamed by script, so waiting costs nothing.
