# 0007 — Everything a state brings into the world is an Entity

**Status:** accepted 2026-08-14 · only the simplest kind is built (`data/spawns/`,
one animation and gone)

A spark, an aura and a ki blast are **one mechanism, not three**. They differ in
four properties that vary independently: whether the thing has its own position
or borrows its owner's, whether it moves, whether it has hit boxes, and what
ends its life — the animation, the owner's state, or its own logic.

**`effect`, `attachment` and `projectile` are vocabulary, not types.** They name
the three combinations we expect to author most and are worth having in
conversation, and later as presets in data. The first draft made them three
kinds; a spawned attack that does not move but grows and damages killed that —
under three types it is "a projectile that does not move", which is a name that
lies. Naming things after how they look instead of what they are made of was the
mistake.

**A spawn is an `Entity`**, so the loader, animations, boxes and the validator
need nothing new. No `states.json` means one animation and gone; a `states.json`
means a life of its own — a ki blast that grows, strikes and fades is three
states. `landBlow()` already takes any `Entity`, so a spawn with hit boxes
becomes an attacker in the existing exchange rather than needing a second
collision path.

**The art and the behaviour are separate.** `data/spawns/<name>/` says what it
looks like; the state that spawns it says how it behaves. The same discharge art
can be attached in one move and fired in another, so baking the behaviour into
the asset would force two copies of one drawing.

**`data/spawns/`, not `data/fx/`.** "Fx" means decoration and a ki blast deals
damage, so the name would start lying at the first projectile. "Spawn" names the
one thing they all share: something else brings them into the world. `npm run fx`
and `src/fx/generate.ts` keep their name, because they describe how the *art* was
made — generated rather than ripped — which is a different axis.

**If it is on the fighter's sheet, it is an animation, not a spawn.** Goku's aura
is drawn into his sprites, so it needs no machinery at all.

## From MUGEN we take the shape and refuse the interface

That a helper can grow, attack and follow is the good part. The bad part is the
unlimited conversation with its parent — reading its variables, driving its
state, ids to keep track of. **The limit belongs on what a spawn may say to its
owner, not on what it may do by itself:** it is told position, facing and side,
and nothing else passes between them.

## What is still missing, and only when the second kind exists

An `owner` (whose facing and whose side, so a blast does not hurt the fighter who
threw it), a `follow` flag, and an exception so hitstop does not freeze a spawn
along with the two fighters.
