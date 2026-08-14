---
name: add-effect
description: Make a visual effect (hit spark, explosion, aura, projectile impact) for db-hd-remake by generating pixel art with a script. Use when the owner asks for a new fx, a spark, a flash, a burst, smoke, or wants an existing effect retuned — and before writing any code that draws effects at runtime.
---

# Making an effect

Effects here are **generated**, not ripped and not drawn by hand: `npm run fx`
writes a whole entity — the atlas PNG *and* its `frames.json` /
`animations.json` — from `src/fx/generate.ts` (pure, unit-tested) via `scripts/fx.ts`
(file I/O only). There is no sheet to frame and no editor round-trip.

Why generated: no ripped hit spark exists for this game. The community sheets
have auras, beams, explosions and smoke (`Locke_gb7`, in `assets.manifest.json`)
but nothing for a basic blow. Generating also means the art is **ours**, unlike
the ripped sheets.

## The four rules that keep generated art from looking bolted on

The tell is never the shape. It is the softness. Break any of these and the
effect reads as a modern engine glued onto 1996 sprites, however good the
silhouette:

1. **One effect pixel = one sprite pixel.** Draw on a small integer grid; the
   engine scales up nearest-neighbour.
2. **No antialiasing, no alpha ramp.** Every pixel is one palette index or
   nothing.
3. **The palette is the game's** (`FX_PALETTE`), sampled from the ripped effects
   sheet. Never invent colours.
4. **Edges are dithered, not blended** — the checkerboard the SNES used to fake
   sprite transparency, visible on Goku's own frames 0, 2, 82, 83. Half a pixel
   wide: a wider band eats the silhouette and the result reads as confetti.

**Never rotate or non-uniformly scale a finished effect sprite at runtime.** A
pixel rotated by anything but a right angle stops being square. Variation is
baked into the drawing instead (see below). A horizontal mirror is the one free
transform — it moves whole pixels and resamples nothing.

## Get the reference from the owner, and measure it

Do not design an effect from imagination when the original exists.

- Ask for **screenshots of the real game**, ideally two or three consecutive
  frames of one hit — a single frame cannot show the arc.
- **Derive the capture's scale** from the dither in the background: run-length
  along a row is the scale (3 px runs = 3×). Then real sizes follow.
- **Extract the actual mask**: classify pixels into white / fringe / other and
  print an ASCII grid. This is how the hit spark's silhouette was settled —
  a solid irregular white mass ~20 px across, about a quarter of a fighter's
  height.
- Sample the colours and check them against `FX_PALETTE` rather than eyeballing.

You cannot watch video. WebFetch returns text, and there is no `yt-dlp` or
`ffmpeg` here — say so and ask for stills instead of guessing.

## Timing is where effects go wrong, not shape

The first hit spark had the right silhouette and still read as a small
detonation. Three separate causes, all worth checking on any new effect:

- **It cooled.** Going white → gold → orange → ember ring is an *explosion* arc.
  A physical blow flashes and stays white/yellow.
- **It bloomed.** Growing from nothing wastes the impact — and see the next
  point for why that is specific to this engine.
- **It was long.** 15 game frames is 250 ms. A spark is ~6 frames.

**Hitstop freezes effects too, and holds frame 0 for the whole pause.** So frame
0 is what the player stares at during the impact and must be the biggest,
brightest one. An effect that grows spends that moment showing its weakest frame.

**A long effect drifts off what it hit.** It is pinned where it spawned while
knockback slides the defender away — 16.8 px over a light reaction, 46.8 over a
heavy one. Six frames keeps the drift to about 5 px.

## Where an effect is drawn

At the **leading edge** of the hit ∩ hurt overlap (`impactPoint` in `src/combat/hit.ts`),
not its centre. A fist box is narrow and sits entirely inside the body it
strikes, so the overlap *is* the fist and its middle lands on the attacker's
forearm — the spark then looks stuck to the puncher.

## Variety: bake variants, pick at random

A repeated identical stamp is obvious in a combo. Variation belongs in the
generator:

- Several **variants**, each a separate animation (`hit0`, `hit1`, …) in one
  entity. The engine treats an effect's animations as interchangeable and picks
  one per spawn, so adding a variant is a data change with no code to touch.
- Make them differ by **more than one thing**. A squash axis alone is too subtle
  at this size. Vary size, ray count, how flat, and whether the middle is there
  at all (`open`) — the last of these changes the character most.
- **Spread angles evenly, do not randomise them.** With a handful of variants
  random angles clump and half the work is wasted. Randomness belongs at the
  moment of the hit. A squash axis repeats every 180°, so spread over half a
  turn.
- **Squash only, never stretch.** The grid is sized for `reach`; a stretched
  burst loses its tips in the atlas. `burst` clamps values above 1.
- A random mirror at spawn doubles the variety for free.

## Procedure

1. Add or edit an entry in `EFFECTS` in `scripts/fx.ts` — name, kind, `reach`,
   `seed`, `durations`, `variants`.
2. Shape lives in `src/fx/generate.ts`. `burst()` draws one; `spark()` and `explosion()`
   are the two arcs. `taper` carries most of the difference between them: low
   values bulge into an explosion, high values pull out into rays.
3. `npm run fx` (`--dry-run` to report only). It is seeded, so re-running is
   safe and never silently changes the art.
4. **Look at it.** Upscale the atlas nearest-neighbour and read the image —
   there is no substitute. Put previews in `assets/contact/` (gitignored).
5. `npm test` and `npm run typecheck`.

## Testing generated art

Tests pin the properties that make it right, never whether it is pretty — that
is the owner's call. Existing ones cover: closed palette, nothing touching the
sprite edge, dither notches in the outline, non-circular radius, squash follows
its axis, stretch refused, spark arrives at size, spark never uses the orange
half of the palette, spark is short.

Three traps this file has already fallen into — check for them:

- **A test that cannot fail.** The first "ragged edge" test passed against a
  version with the dither removed. Break the code on purpose and confirm the
  test goes red before keeping it.
- **A test calibrated to noise.** An "uneven arm lengths" test measured 0.44
  against 0.33 for uniform arms — inside rasterisation noise. It was dropped
  rather than shipped with a threshold pinning an accident.
- **An even grid has no centre pixel.** `(size - 1) / 2` is then a half index and
  reads as `undefined`, which quietly satisfies `not.toBe(0)`. Floor it, and
  assert `toBeGreaterThan(0)` rather than `not.toBe(0)`.

Also note: a spark **hollows as it opens**, so it covers *fewer* pixels while
staying as wide. Anything about size must be measured on the outline, not on a
pixel count.

## Effects at runtime

An effect is an entity with **no states** — one animation, played once, then
destroyed. `Entity` already runs animation-only when it has no state machine, so
there is no separate class. No input, no opponent, no physics, no boxes.

Which effect a blow leaves is the blow's choice: `hitFx` on the attack state,
alongside `onHit` and `hitstop`. Three fields, one idea — the blow decides how
it is taken, how long the game stops, and what the impact looks like.

Effects are **derived**, like the atlas: gitignored and rebuilt with `npm run fx`.
A clone that has not run it gets a console warning and no sparks, not a crash.
