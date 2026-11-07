/**
 * The DSP's interpolation weights, 512 of them: entry `j` weighs a sample
 * `2 − j/256` samples from the point played. The chip's table is a windowed
 * sinc, rebuilt here from the formula ares derives it with (ISC licence,
 * © 2004-2025 ares team, Near et al), which gives the chip's own values.
 */
export const GAUSS: Int16Array = (() => {
  const table = new Float64Array(512);
  for (let n = 0; n < 512; n++) {
    const k = 0.5 + n;
    const s = Math.sin((Math.PI * k * 1.28) / 1024);
    const t = (Math.cos((Math.PI * k * 2) / 1023) - 1) * 0.5;
    const u = (Math.cos((Math.PI * k * 4) / 1023) - 1) * 0.08;
    table[511 - n] = (s * (t + u + 1)) / k;
  }
  // each phase's four weights scaled to sum to 2048, as the chip's do
  const out = new Int16Array(512);
  for (let phase = 0; phase < 128; phase++) {
    const at = [phase, phase + 256, 511 - phase, 255 - phase];
    const scale = 2048 / at.reduce((sum, i) => sum + table[i], 0);
    for (const i of at) out[i] = Math.trunc(table[i] * scale + 0.5);
  }
  return out;
})();
