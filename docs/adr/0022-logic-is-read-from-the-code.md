# 0022 — The cartridge's logic is read from its code; a recording confirms

**Status:** accepted 2026-10-29 · supersedes ADR 0016's "how the game behaves
is read from RAM while the owner plays" and its rejection of reading code first

How the original decides something — which move a button picks, what a blow
costs, how far it shoves — is read **statically** with `npm run dis`, starting
from what is already known: a fighter field, a routine, a table
(`rom.md`, Where to start a search). A Mesen recording is asked for only to
confirm a reading, or when the code has been searched and the answer is not
there. Every finding goes into `rom.md` the moment it holds, so the next search
starts further in.

The recordings of 2026-10-29 gave the anchors — the fighter block's fields, the
hit code — and from them the button dispatcher (`$0D:FEC8`) took minutes to
find, where a recording had already been requested to measure it.

**Rejected:**

- **A recording first, code only where a recording cannot reach** (0016). It
  measures an answer without its rule: two distances on either side of a line
  say nothing about where the line is, nor whether another fighter's is the
  same.
- **A full disassembly** (Ghidra, a whole listing). Still rejected: the search
  is targeted, and `rom.md` is the map it leaves behind.
