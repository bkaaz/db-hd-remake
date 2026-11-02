# 0051 — A fighter's own handler replaces a template state by name

**Status:** accepted 2026-11-02; extends [0038](./0038-a-fighters-own-specials-are-merged-into-the-template.md)

A state the template copies from Goku but the fighter plays with a handler
of his own (Vegeta's far B slides, his crouching B hits twice) is written
in his `specials.json` and named in its `replaces` list; his version takes
the template's place whole (`src/rom/specials.ts`). A clash not listed
there is still an error, and `npm run rom -- states` stops reporting a
replaced state as "to read".

**Rejected:**

- **Any special overriding a template state of its name** — a typo or a
  reused name would silently drop a template state.
- **Patching the template's state** (only `velAt`, only a next part) — two
  sources for one state, which neither file shows whole.
