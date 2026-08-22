# 0013 — States stay hand-authored, and the tool bought a validator instead

**Status:** accepted 2026-08-08 · still holds; the States tab returned
2026-08-16 as a read-only view (the Combos graph), which does not reopen it

**The editor earns its keep on spatial and timing data** — framing sprites,
anchors, hit boxes, animation preview — where text is guesswork. States are
**relational** data: "this state plays that animation and goes there when X".
That reads and edits well as text, and beats a form at copy-paste between
fighters, find & replace, and git diffs. MUGEN splits the same way: sprites and
boxes in a tool, states in text.

**The real risk of hand-editing is a silent typo in a cross-reference, not
tedium.** So the effort bought exactly that instead of an editing UI:
`validateStates()` in `src/entity/states.ts` — pure, PixiJS-free — checks that
`initial`, every `anim` and every transition target exists, that triggers are
known, and warns about states unreachable from the entry points.

**One validator, two callers.** The game runs it at load and shows the problems
on screen, where a `console.warn` was being read by nobody; the editor shows the
same problems beside a read-only view, with Save disabled rather than misleading.

**The revisit condition has since been passed, and the answer did not change.**
It was "when a fighter goes past ~15 states", and Goku went well past it. What
the editor grew was a *view* — a graph of what cancels into what, which is
the one question the file cannot answer by being read (see
[0006](./0006-the-chain-graph-is-derived.md)). Authoring stays in text.
