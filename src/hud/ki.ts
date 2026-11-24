/**
 * The ki meter as the HUD's marks: six levels of the meter's 60 (`attributes.ki`),
 * each lit when full, half lit while it fills.
 */

export const KI_MARKS = 6;

/** How full each mark is, 0 to 1, for a meter `fraction` full. */
export function kiMarks(fraction: number, n = KI_MARKS): number[] {
  return Array.from({ length: n }, (_, k) => Math.max(0, Math.min(1, fraction * n - k)));
}
