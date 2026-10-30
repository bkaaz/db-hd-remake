/**
 * How alike two sounds are: the best normalised cross-correlation of their
 * waveforms at any offset, 0..1 — for telling which clip of our capture a
 * sample from the cartridge is. Both must be at one sample rate first
 * (`resample`). Pure; build-time only.
 */

/** `samples` at `from` Hz as they would be at `to` Hz, linearly interpolated. */
export function resample(samples: Float32Array, from: number, to: number): Float32Array {
  const out = new Float32Array(Math.max(1, Math.floor((samples.length * to) / from)));
  for (let i = 0; i < out.length; i++) {
    const at = (i * from) / to;
    const k = Math.floor(at);
    const t = at - k;
    out[i] = (samples[k] ?? 0) * (1 - t) + (samples[k + 1] ?? samples[k] ?? 0) * t;
  }
  return out;
}

/** In-place radix-2 FFT of `re` / `im`, whose length is a power of two. */
function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const [wr, wi] = [Math.cos(angle * k), Math.sin(angle * k)];
        const [ar, ai] = [re[i + k + len / 2], im[i + k + len / 2]];
        const [tr, ti] = [ar * wr - ai * wi, ar * wi + ai * wr];
        re[i + k + len / 2] = re[i + k] - tr;
        im[i + k + len / 2] = im[i + k] - ti;
        re[i + k] += tr;
        im[i + k] += ti;
      }
    }
  }
}

/**
 * The best match of `a` against `b` at any offset: their cross-correlation's
 * peak over the energies of the overlap's two signals as wholes — 1 for the
 * same sound, near 0 for unrelated ones.
 */
export function likeness(a: Float32Array, b: Float32Array): number {
  let n = 1;
  while (n < a.length + b.length) n <<= 1;
  const [ar, ai, br, bi] = [new Float64Array(n), new Float64Array(n), new Float64Array(n), new Float64Array(n)];
  ar.set(a);
  br.set(b);
  fft(ar, ai);
  fft(br, bi);
  // a × conj(b), back: the correlation at every lag
  for (let i = 0; i < n; i++) {
    const [r, im] = [ar[i] * br[i] + ai[i] * bi[i], ai[i] * br[i] - ar[i] * bi[i]];
    ar[i] = r;
    ai[i] = im;
  }
  fft(ar, ai, true);
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(ar[i]) / n);
  const energy = (x: Float32Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0));
  const scale = energy(a) * energy(b);
  return scale > 0 ? peak / scale : 0;
}
