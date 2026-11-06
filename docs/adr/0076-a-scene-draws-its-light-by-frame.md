# 0076 — A scene draws its light by frame

Status: accepted 2026-11-06 (Vegetto's pass, Galactic Juggle; the owner asked for it from the cartridge). Extends ADR 0046, 0058 and 0075.

Galactic Juggle's light is data on its `seize`: a `dome` (kind 5) and `bars` (kind 4), worked out
in the pure `match/sceneLight.ts`, with `sparks` and `screens` on named frames. A bar's x is taken
on its first frame, so it stays when he leaves. A step may keep the opponent at an offset from a
mover in the air (`on`) or end his flight (`lands`); a `launch` happens once.

Vegetto's throw strikes a second time through `throwsFoe`, which gained `ahead` and `fx`.

`npm run moves -- <fighter> --close` plays the commands from arm's length: a blow that misses from
the usual distance never showed what it opens.

**Rejected:** the dome as a `finale` (its phases end in the white and hold the mover's clock; here
the white came and went long before); the bars as `showSweep` (a wedge from one point); a second
launch for the rise (he moves at a constant speed there, so a drift says it); the object `4/05`
as a spawn (it draws nothing: `objectTiles.test.ts` refuses a blank sheet).
