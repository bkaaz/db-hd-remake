# 0013 — What a state does is in its data, and transitions are the one way to sequence

**Status:** accepted 2026-11-17 · consolidates 0005, 0013, 0033, 0049 and 0061
(2026-08-09 – 2026-11-03), which it replaces

**No state ends by magic.** Every way out is a transition in `states.json`
with a trigger, where the validator sees it and the editor lists it — hitstun
ending is `stunEnd`, not the engine pushing a reaction out. A phase ends on a
fact about the body (`falling`, `landed`, `nearGround`), never on how many frames
were drawn, so a jump is four states and survives being retuned.

`when` is a list and all of it must hold; a direction needs no conjunction,
because the walking states already say which way is held. A state goes back
into itself only on `animEnd`, from its top. A transition can be kept until
the animation ends (`queued`), and a state can try another's input
transitions ahead of its own (`inputsOf`). `validateStates()` checks every
cross-reference at load, in the game and the editor alike.

**Rejected:**

- **A compound trigger per pair** (`confirmed:medium`, `fwd:heavy`) — multiplies
  with every button and pairing; a conjunction is built once.
- **A second way to sequence a move**: a `loop` flag, a field that jumps the
  animation's frame, one state playing a whole script. The editor, the chains
  tool and the log would each see one state where the fight has several.
- **Two states taking turns** for a loop, or **idle's entries copied into each
  state that reads them** — the same thing twice, kept equal by hand.
- **Checking a press at `animEnd`**, or **a longer input buffer**, for a move
  that reads the next one while it plays — the press is gone by then, or a press
  that lives that long starts moves nobody asked for.
- **An editing UI for states.** They are relational and read well as text; the
  real risk is a silent typo in a cross-reference, which the validator catches.
