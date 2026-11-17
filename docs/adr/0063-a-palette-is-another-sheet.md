# 0063 — Another palette is the same sheet drawn again

**Status:** accepted 2026-11-17 · consolidates 0026, 0027 and 0063 (2026-10-29 –
2026-11-03), which it replaces

A fighter's colours in another palette — the fire of a burn, an arena's lighting,
a colour set of ours — are his whole sheet drawn again in that palette, so the
same rectangles cut every variant. A blow that `burns` steps its victim through
the burn's variants until his body next lands, starting at a random one, as the
original's shared counter does. A set of ours (Vegeta's gold aura) is a rule over
his palette by colour index, in `palettes.json`, drawn over every variant he has
but the fire.

**Rejected:**

- **A palette shader** — a technique nothing else uses and no test can see, in a
  codebase its owner reads to learn it.
- **Tinting the sprite** — not the original's palette.
- **A fixed run named by the blow** — the original burns until the body lands,
  which no count reproduces from another height.
- **A palette written out whole** for a set of ours — one per lighting, drifting
  apart; **recolouring the drawn pixels** — two indices sharing a colour change
  together.
