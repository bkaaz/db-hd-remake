# 0008 — A scene is built from a request; an address sets it, the browser remembers it

**Status:** accepted 2026-11-17 · consolidates 0008 and 0040 (2026-08-14 –
2026-10-31), which it replaces

Every scene is built from a small serialisable request —
`?scene=debug&p1=goku&p2=vegeta` — never from what the previous scene left
behind (`src/scene.ts`). An address with any parameter wins and is remembered in
localStorage; a reload without one lands on the last scene (`src/sceneSource.ts`).
An unknown or invalid parameter is a loud error. Setups too long for an address
are the debug scene's modes in `data/debug.json`.

**Rejected:**

- **A committed dev-state file as the main source** — global, and it rides along
  with unrelated commits.
- **The address as the only memory** — lost in a fresh tab; **localStorage over an
  address** — a link would mean nothing.
- **A quiet fallback to the default scene** — it sends someone debugging the wrong
  thing.
