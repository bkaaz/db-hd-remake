# 0010 — The recording describes, never computes

**Status:** accepted 2026-08-15 (`src/log.ts`, `src/match/record.ts`, `L`)

A recording exists because the owner and Claude cannot see the same thing: one
knows how it felt, the other knows why. Without it that gap is bridged by
reading numbers aloud.

It sits beside the other instrument rather than replacing it. **Scripted chain
tests** drive the committed `states.json` frame by frame and assert the path —
pure, so they need no browser and nobody to play. **A recording** says what
actually happened when somebody did.

## The rule that keeps it worth believing

**It describes, it never computes.** Everything recorded is something the game
already worked out for itself. The rule has teeth: the trigger that fired a
transition would have been nice to print, and reinstating a field to carry it
would have broken the rule — so the line prints the *target state* instead,
which identifies the transition anyway, because two rarely share one.

**Events, not frames.** Sixty frames a second times two fighters is six hundred
near-identical lines for ten seconds of play, and it buries the causes in the
data. A fight's interesting moments are discrete; one combo attempt is about
twenty lines.

**Every line carries both fighters and the gap since the last line.** The first
draft printed one fighter per line against an absolute frame number, and was
near useless: reconstructing what the other body was doing meant scanning
upwards, and "how many frames after the hit did the cancel come out" — which is
nearly every question in a fighting game — meant arithmetic by hand.

**Presses entering and leaving the buffer are recorded**, with *spent* /
*EXPIRED unused* inferred from the frames left on them. That is the answer to
"did the game eat my input", and the inference is guessy enough to have its own
test: a wrong guess sends the reader hunting a bug that is not there.

**On demand.** `L` starts and stops, and starting discards the last one, so the
file holds *what you just did* rather than four hours of noise. That is the only
thing that makes it readable.

## Why the lines are not built in `Entity`

`match/record.ts` is the layer that knows which body is P1; a body neither knows
nor should, and naming one so a log line could print it would be the recording
changing the game to suit itself. It spots things by comparing public state
between frames, so nothing is added anywhere for it to read — and a blow logged
with no state change after it *is* the signature of a refused reaction.

**Not covered:** how any of it felt. A recording says what the engine decided
and never whether it was any good.
