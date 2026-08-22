# 0006 — The chain graph is derived, and one function owns the sum

**Status:** accepted 2026-08-16

What cancels into what — with its window, the next attack's start-up, the worst
case, the depth in the string, the hitstun left at that depth and the resulting
margin — is a **conclusion from `states.json` and the animations**, computed by
`src/combat/chains.ts`.

**It is never written down.** A markdown table of links would be wrong the first
time a number moved, and twenty fighters would mean twenty stale tables.

**One function, three consumers**: `npm test` asserts on it, `npm run chains`
prints it, the editor's Combos tab draws it. Two implementations of one formula
disagree by a frame and nobody can tell which is lying — which was about to
happen, because the test had already grown its own copy of the arithmetic.

The division of labour between the two that a person uses: **the test says a
link works or does not; the script says by how much.** That margin is what frame
data is tuned against, instead of guessing and waiting for a recording.

**Deliberately not built: the player's move list.** It is rows, not a graph — a
player reads strings as sequences and must never see `cancelBy` — and there is
no screen to put it on yet.
