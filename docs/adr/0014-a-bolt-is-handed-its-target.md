# 0014 — A bolt is handed its target, not its owner

**Status:** accepted 2026-08-24 · answers the three open items at the foot of
[ADR 0007](./0007-everything-a-state-spawns-is-an-entity.md), which otherwise
still holds

0007 said everything a state brings into the world is an `Entity` and left three
things for the first projectile to settle. Goku's ki blast is that projectile.

**The bolt is told who it may hit, and nothing else.** 0007 expected an `owner`
— whose facing, whose side — so that a blast would not hurt the fighter who
threw it. A *side* is a fact about a pair, and a bolt that carried its owner
could be asked about it: what is my owner's state, has he been hit, is he still
in the move. **Rejected**, and the narrower thing put in its place: the bolt is
constructed with a facing, a position and one `foe`. It cannot hurt anybody
else, which is all "whose side" was for, and there is no back-reference for a
later feature to grow along. Deflection will change the `foe`, not consult it.

**Hitstop freezes bolts too.** 0007 wanted an exception. It is wrong: a hit
pause with something still travelling across it advertises the freeze.

**The blow is authored on the bolt, not on the throw.** `data/spawns/ki_bolt/`
has a `states.json` naming the damage, the reaction, the burst and the speed;
the fighter's state names only `fires`. The alternative — the throw keeps the
blow's numbers and the bolt is a moving hit box — was **rejected** because it
splits one blow across two files and makes the bolt un-openable in the editor.
`landBlow()` takes any `Entity`, exactly as 0007 predicted, so no second
collision path exists.

**A move that cannot be paid for does not come out.** `cost` on the state is
checked *before* the transition fires, so the frame's remaining transitions
still get their turn. **Rejected:** a `ki:` trigger beside a separate cost (two
authored numbers that can disagree), and spending through the existing per-frame
`ki` rate (which would make a move's price a function of how long it is drawn).

**Where a bolt appears is authored, not derived.** `fires.at` is a muzzle
offset in sprite px from the anchor. There is nothing in the data that knows
where a hand is; a box type for it was rejected as a second way to say
"somewhere on this frame" when the editor already has one that nothing would
share.

The moment is the **entry into a state**, so a throw drawn in two parts is two
states — the split this project already uses wherever timing is drawn (the knee,
the hop lunge). No "on frame N" field, which would be a second clock beside the
animation's own.
