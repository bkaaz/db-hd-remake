# 0063 — A colour set of ours is a rule over his palette

**Status:** accepted 2026-11-03

Colours that are ours, not the cartridge's — Vegeta's gold aura (owner) —
are written in `data/entities/<name>/palettes.json` as a rule by colour
index: another index of the same palette (`12: 6`), or a colour picked in
his own palette (`own`) that every other palette gets as its `from`
colour scaled the same way (`src/rom/recolour.ts`). `npm run rom -- export`
draws each set over every variant he has but the fire — `gold`,
`night_glow_gold`, `alt_gold` — and the side panels offer the sets by name
(`pal1=gold`); `paletteVariant` puts it last in a variant's name.

**Rejected:**

- **A palette written out whole** — sixteen colours for one lighting;
  evening, night and the glow would each need their own, and would drift.
- **Recolouring the exported sheets' pixels** — a colour that two indices
  share would change in both; the palette is where an index is still one.
- **A set over the fire palettes** — burning is the same on everyone.
- **Picking which colours are the aura by eye** — they were measured (the
  share of a colour's pixels on the sheet's outline), then looked at.
