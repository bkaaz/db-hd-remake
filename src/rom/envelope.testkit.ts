/**
 * For tests that hold a sound read from the cartridge against the capture's
 * clip of it: how loud it is over time survives what the chip's
 * interpolation and echo do to the waveform, which a waveform match does not.
 */

/** Loudness in 50 ms windows: how a voice rises and falls, whatever the chip's interpolation did to its waveform. */
export function envelope(samples: Float32Array, rate: number): number[] {
  const n = Math.round(rate * 0.05);
  const out: number[] = [];
  for (let i = 0; i + n <= samples.length; i += n) {
    let e = 0;
    for (let k = 0; k < n; k++) e += samples[i + k] ** 2;
    out.push(Math.sqrt(e / n));
  }
  return out;
}

export function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  const mean = (v: number[]) => v.slice(0, n).reduce((s, x) => s + x, 0) / n;
  const [ma, mb] = [mean(a), mean(b)];
  let [ab, aa, bb] = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    ab += (a[i] - ma) * (b[i] - mb);
    aa += (a[i] - ma) ** 2;
    bb += (b[i] - mb) ** 2;
  }
  return ab / Math.sqrt(aa * bb);
}
