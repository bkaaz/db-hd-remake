# 0061 — A state borrows another state's inputs

**Status:** accepted 2026-11-03

A state may carry `inputsOf: { state, from?, only? }` (`src/entity/inputsOf.ts`):
from its frame `from`, the input transitions of `state` are tried ahead of
its own. `only: "buttons"` keeps the commands and presses — what `$0F:9EB1`
reads — and leaves the directions and the dash, which `$0D:F9BD` starts.
Only inputs are borrowed (held, pressed, command, close, grab, health…):
never the lender's `animEnd` or `frames:`. One step: a lender may not borrow.

So the original's landing (`3b`: commands, buttons and ↑, `$0F:A451`), a
block (`0d` / `0f` from frame 4, `$0F:A081` — with nothing held `$0D:F9BD`
sets idle, so ours goes `frames:4 → idle`), the dash (`0a` / `0b`) and the
get-up (`1f`) all borrow idle. `npm run rom -- entries` counts what a state
borrows as its own.

**Rejected:**

- **Copying idle's entries into each state** — a dozen entries in eight
  more states, which drift apart the first time one is edited; and every
  copy is one more to keep in the table's order (ADR 0060).
- **A list of shared entries at the file's top** — idle already is that
  list; a second one would have to agree with it by hand.
- **Borrowing every transition** — the lender's `animEnd` would end the
  borrower's state on the lender's clock (Vegeta's crouch into its loop).
