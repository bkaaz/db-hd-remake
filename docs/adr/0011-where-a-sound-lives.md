# 0011 — A voice has an owner, a punch does not, and a sound sits on the moment

**Status:** accepted 2026-08-13 (which state carries a sound) and 2026-08-14
(one bank, voices per fighter) · the id-space rules are in `data-format.md`

**One sound bank for the whole game**, `data/audio/sounds.json`. Impacts,
swings, blocks and landings belong to nobody: nothing in a hit clip is Goku's,
and the next nine fighters would each want their own copy of the same thing. The
bank needs no adjective — there is no second one, so nothing is marked "shared"
and no `common/` directory exists to become a junk drawer.

**A fighter's voice stays with the fighter**, in `data/entities/<name>/sounds.json`.
Ownership is fake for a punch and real for a grunt, so one rule for both would be
convenient rather than true. The bank then stays small and stable while voices
grow with the roster, and adding a fighter stays "add a directory".

This does not break "an entity is a directory". That rule never meant an entity
*contains* its content: Goku's sprites live in a shared sheet and `frames.json`
says which rectangles are his. A `sounds.json` naming which clips of a shared
`assets/audio/sfx/` are his is the same pattern.

**What would overturn the voice half:** finding that the original reuses voice
clips across the roster. Then a voice has no owner either and everything belongs
in the bank. Unknown today — most of the captured clips have never been listened
to.

## A sound sits on the state that names the moment

Never on the attack that caused it. The crash of a body hitting the floor is on
`downed`, which is entered on `landed` from whatever put the fighter in the air —
so throws, heavier blows and whatever comes later inherit it by transitioning
into the same state, and none of them has to remember to play a sound.

The same rule sorts the two kinds of landing without a special case: coming down
from a jump enters `land` and sounds soft, coming down from a knockdown enters
`downed` and sounds hard. The distinction is which state you were in, not which
move hit.

**A voice and an impact are different events at different times** — the grunt is
on `knockdown`, at the blow; the crash is on `downed`, at the floor. Wanting both
*at once* is what would force `sound` to take a list, and nothing needs that yet.

The validator warns about an airborne state with no `landed` or `nearGround`
transition, because that is the mistake the next launcher will make and its
symptom — a fighter stuck airborne at ground level, silent — looks like an engine
bug rather than a missing line of data.
