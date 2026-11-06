# 0078 — An object can be rewritten on the floor, and a scene can run without its thrower

Status: accepted 2026-11-06 (Freeza's pass). Extends ADR 0046 and 0056.

Two things the cartridge's slots do that a bolt could not. A slot reaching the floor is rewritten as another object that
still strikes (Ground Wave's `6/09`, Evil Energy's `6/0f` and `6/10`): a bolt's `landsAs` names them, and `Projectiles`
puts them out on the floor as bolts of the same thrower, loading what a spawn names as well as what a fighter does.
A shot that puts the opponent in his own move (Jubaku Ha's `37`, `$0F:A3D5`) has nothing to do with what its thrower does next:
a `seize` with `free` is opened by `Entity.opensScene`, and `Seizures` counts its frames itself, with no state of his holding
it, so he is free when his move ends though the body is still held. Other scenes stay states of the thrower: theirs do
play in his move.

**Rejected:** `burstsInto` growing a blow (an effect has no boxes, and `6/09` strikes); one spawn with both objects'
frames (different drawings by object, read by type and animation); `37` as a reaction of the defender in every fighter's
states (a hold with a ball and a let-go is what a `seize` already is); keeping Jubaku's scene as a state of Freeza's, held
to the release (from afar it stood him still some 90 frames longer than the original).
