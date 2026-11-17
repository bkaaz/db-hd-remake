# 0036 — An object's look is the cartridge's, written beside its spawn

**Status:** accepted 2026-11-17 · consolidates 0036, 0037, 0087, 0088 and 0091
(2026-10-31 – 2026-11-07), which it replaces

What an object looks like — its frames in the order its sheet packs them, tile
base, palette, VRAM loads and the variants it is drawn in — is written by the
export as its spawn's `look.json`, and the browser draws it from that and the
ROM alone. Where the code holds a table, frames and timing come from the code;
otherwise from one recording of the object slots per fighter
(`npm run rom -- recorded`). The cartridge's shared catalogue is named by what
an object is (`ki_blast`, `burst_m`, `kame_base`), and only a fighter's own
objects carry his name. An object drawn in its thrower's palette follows the
arena's lighting; a lit record the ROM lacks is the day's, relit by his shift.

**Rejected:**

- **Working the look out again in the browser** — for most fighters it comes from
  a recording a player does not have.
- **`<fighter>_<object>` for everything** — a shared shot read as one fighter's
  own; **cartridge ids as names** — kept beside the name instead.
- **Every object's timing from its code** — some patterns the reader does not
  follow; **a recording per attack** — one session holds them all.
- **Recolouring an object at runtime** — the drawing holds pixels, not indices.
