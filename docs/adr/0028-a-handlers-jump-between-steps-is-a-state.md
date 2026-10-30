# 0028 — A handler's jump to another step starts a state

**Status:** accepted 2026-10-30 · extends 0018 and 0023 (cutting a move)

Some handlers run by the script's step and move the script on themselves —
the knockdown (`1b`) jumps field `0x44` to the fall when vy turns, to the
floor when it lands, to lying when it lands again. The export cuts a move
at every step such a handler jumps to from another step (`jumpCuts` in
`src/rom/animation.ts`, the facts from `src/rom/handler.ts`), and names the
parts as 0018 does. The condition the handler tests becomes a state's
transition (`falling`, `landed`); what it does there becomes that state's
fields — `rebound` for the bounce, `groundFx` for the dust, `sound`.

A jump inside the step it runs on (the fall's frame held at `0x30`) holds a
pose and cuts nothing. A handler keyed on frames (`CMP` on `0x44`) cuts
nothing either: its jumps are times, which a state already has.

**Rejected:**

- **One state playing the whole script, with a field to jump its frame.**
  Nearer the original's shape, but the engine would grow a second way to
  sequence a move beside transitions, and the editor and the chains tool
  would see one state where the fight has four.
- **Cutting by hand in `animations.json`.** The export rewrites that file
  whole (ADR 0017), and the cut is derivable from the handler.
