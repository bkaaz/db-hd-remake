# 0037 — Shared objects are named by what they are, not by who fires them

**Status:** accepted 2026-10-31

The cartridge has one catalogue of objects for the whole roster, by type and
animation (`$0F:B467`): the code, the timing and the frames' layouts of type
`a` — the ki blast `a/03`, the explosions `a/01` `02` `17` `18`, the dust
`a/0d`, the Kamehameha's heads and base `a/13`–`16` — are the same whoever
puts one out. Vegeta's ki blast is Goku's (`a/03`, the same six tiles), in
other colours. So a spawn of that catalogue is named by what it is
(`ki_blast`, `burst`, `burst_s/m/l`, `dust`, `kame_s/m/l`, `kame_base`), a
fighter's colours for it are a variant of its sheet, and only a fighter's
own objects (type `1`, his own tiles; Goku's transformation hair) carry his
name. A shared shot leaves from where the fighter's own script puts it
(`b0`'s dx / dy), not where the template's does.

**Rejected:**

- **`<fighter>_<object>` for everything** — what it was (`goku_ki`): it
  read as Goku's own, and the states template had to drop Vegeta's ki blast
  and dust for carrying Goku's prefix.
- **Cartridge ids as names** (`a03`) — kept beside the name in the export's
  table instead, where a name can be tied back to the code (`npm run rom --
  code a 3`).
