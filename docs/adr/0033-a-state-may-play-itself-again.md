# 0033 — A state may go back into itself when its animation ends

**Status:** accepted 2026-10-30

A transition from a state to itself fires only if its `when` includes
`animEnd`, and then plays the state again from the top — its animation
restarted (`StateMachine.update`, `Entity.enterState`). A loop that runs
while something holds and, once let go, finishes its pass is two
transitions: `["animEnd", "held:…"]` back to itself, then `animEnd`
onward. Goku's charge is one (`charge` in `data/entities/goku/states.json`).
Any other transition into itself is still ignored, as before, or a state
whose condition holds would restart every frame.

**Rejected:**

- **A looping animation, left on release.** Leaves mid-pass; the
  original plays the pass out.
- **Two states taking turns** (`charge` ⇄ `charge_again`). The same state
  twice in the data, kept equal by hand.
- **A `loop` flag on the state.** Another way to sequence a move beside
  transitions, which ADR 0028 refused once already.
