# 0088 — A lit record the ROM lacks is relit from the day's

**Status:** accepted 2026-11-07 · supersedes 0087's "left out with a note"

Where a lighting moves an object's record past what the ROM holds (Goten's
and Trunks's first fade, own + 0xC9: 0x13B by evening), the export draws the
day's record relit by the shift his own palette takes in that lighting
(`litPalette`, `rom/arena.ts`), as his intro's runs already are. The day's
colours no longer stand in.

**Rejected:** leaving the variant out (2 frames of white by night, which the
owner saw); reading the palette from a recording (no evening state of the
original was played, and the reader cannot follow the address).
