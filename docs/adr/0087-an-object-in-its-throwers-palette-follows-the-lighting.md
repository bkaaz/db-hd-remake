# 0087 — An object in its thrower's palette follows the lighting

**Status:** accepted 2026-11-07 · extends 0026

An object the original draws in its thrower's OBJ palette — Earth Stab's leg,
Regeneration's arm, Goten and Trunks, Goku's hair in his win — takes his
colours in every lighting, because that palette is his own record moved by the
arena (field `0x17`). Such an object says so (`lit` on `OwnObject`, `SpawnDef`),
and the export draws it again per lighting at the same distance from his own
record there (`lightingShifts`, `rom/arena.ts`): `night`, `night_alt`,
`night_shimmer2`. A spawn takes its owner's lighting and alternate colours as it
comes out (`Entity.dressAs`). A record the ROM does not hold is left out with a
note, and the day's stands in (Goten's first fade by evening, `0x13B` `?`).

**Rejected:** recolouring at runtime from the body's palettes (the drawing
holds pixels, not indices, so it would need a second, indexed picture of every
object); the export deciding by a record equal to his own (a recording by
day is the evidence for most, but an exception could not be kept off: the flag
is written per object, from the code or that recording).
