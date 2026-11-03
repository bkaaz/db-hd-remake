/**
 * `palettes.json`: a fighter's colour sets of our own — not the cartridge's —
 * each a rule over his palette, so the export draws it in every lighting,
 * glow and second set he has (`rom/recolour.ts`). Shared by the export and
 * the side panels, which offer the sets by name.
 */
export interface PalettesFile {
  _comment?: string;
  sets: Record<string, ColourSet>;
}

/** An RGB colour as the export draws it, each channel 0–248 in steps of 8 (SNES 5 bits). */
export type Rgb = [number, number, number];

/**
 * By colour index: another index of the same palette — `12: 6`, the aura in
 * his hair's gold — or a colour of its own in his palette, `own`, which
 * every other palette gets as its colour `from` scaled the same way.
 */
export type ColourSet = Record<string, number | { from: number; own: Rgb }>;
