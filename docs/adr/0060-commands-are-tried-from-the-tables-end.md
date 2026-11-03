# 0060 — Commands are tried from the table's end

**Status:** accepted 2026-11-03

When two commands are met on one frame, the one later in the fighter's
command table wins: `$0D:EDF8` starts at the table's last row and steps
back a row at a time (`$0D:EF31`), starting the first whose input and
conditions both hold. So ↓ ↘ → X near the opponent is Goku's `9f`, not the
throw `9d` (owner: the original never throws there), and the throw out of
range falls through to the next row back.

Ours is the order of a state's transitions: its command entries stand as
one block, the table's last row first, where the first of them stood —
ahead of the buttons, which `$0D:FEC8` reads after. A conditioned entry
(`grab&command:9d`) that fails falls through, as a row does.
`inTableOrder` (`src/rom/entries.ts`) puts them so; `states --fighter`
runs it, `npm run rom -- entries --order` rewrites a hand-written file, and
`entries.test.ts` refuses any other order.

**Rejected:**

- **The engine sorting the entries as it loads them** — the file would say
  one order and the game play another.
- **Picking among the commands met in `commandsMet`** — the conditions
  (`grab`, `health:80`) live on the transitions, so the winner is not known
  until the state's triggers are tried.
- **Keeping the hand-written order** — it put the throw first in every
  state, against the cartridge.
