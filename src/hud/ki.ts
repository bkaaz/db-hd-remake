/**
 * The ki meter as the HUD's bars: one for each level of 10 of the meter's 60
 * (`attributes.ki`); the one filling grows as the meter does, not a level at a time.
 */

export const KI_BARS = 6;

/** How full each bar is, 0 to 1, for a meter `fraction` full. */
export function kiBars(fraction: number, n = KI_BARS): number[] {
  return Array.from({ length: n }, (_, k) => Math.max(0, Math.min(1, fraction * n - k)));
}
