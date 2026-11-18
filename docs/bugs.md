# Known bugs

Things that are **wrong**, written down the moment they are noticed — by
whoever notices, owner or Claude, without asking and without fixing them on the
spot. Noticing and fixing are separate acts: a fix smuggled into unrelated work
is a fix nobody reviewed.

This is not a queue. A line here says "this is broken", not "do this next" —
[`plan.md`](./plan.md) stays the only place that says what to work on. A bug
becomes work when it is put there or when someone just fixes it.

**A fixed bug is deleted from this file**, in the same change that fixes it.
Unlike `plan.md` this file also grows, so it needs the other half of the rule:
if a line has been here a long time, either it is not really a bug or it is
worth an entry in `plan.md`.

Newest first. One entry is: what you see, where, and how to make it happen.
Severity in plain words — *cosmetic*, *annoying*, *breaks play*, *loses work* —
because a number would only need translating back.

---

**Eight objects fly unseen** (*cosmetic*, 2026-11-07, owner: left so for now).
Their sheets hold no pixel, though they fly and strike: `buu_9_17`, `buu_9_18`,
`buu_9_19`, `freeza_6_15`, and Mr. Buu's `mr_buu_8_0f` – `8_12`, whose picture
is a circle the cartridge draws some other way (`rom.md`). Moved here from a
test that checked the exported sheets, which no longer exist.

**The select screen's fighters spill out of their slots** (*cosmetic*,
2026-11-17, Claude). Open `?scene=select`: the cartridge's fighters at
`SCALE` 2 are taller and wider than a slot (`CELL_W`, `CELL_H` in
`src/scenes/select.ts`), overlap their neighbours and the prompt above the
grid — Piccolo, Vegetto and Mr. Buu the most.
