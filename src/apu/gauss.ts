/**
 * The DSP's interpolation weights, 512 of them, entry `j` the weight of a
 * sample `2 − j/256` samples from the point played. The chip's own table is
 * measured, not computed; this one is a Gaussian fitted to three of its
 * values (0x519 at the sample, 0x174 one away, near 0 two away) — the same
 * muffling, not the same bits. POC: to be replaced by the real table.
 */
export const GAUSS = Int32Array.from({ length: 512 }, (_, j) => {
  const d = 2 - (j + 0.5) / 256;
  return Math.round(0x519 * Math.exp(-1.255 * d * d));
});
