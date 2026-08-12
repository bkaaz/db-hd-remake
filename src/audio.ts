/**
 * Playing sounds. The browser half of `src/sound.ts`, which owns the shapes.
 *
 * Plain Web Audio, no dependency: what a fighter needs is "play this short
 * noise now, several at once, with a little pitch wobble", and that is a few
 * dozen lines. The same reasoning as writing our own PNG encoder.
 *
 * Browsers refuse to start audio until the user has interacted with the page,
 * so the context is created lazily on the first sound and simply produces
 * nothing before then — a missing first punch is better than a console full of
 * autoplay warnings.
 */

import { pitchFor, rateFor, type Sounds } from "./sound";

export class Audio {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  /** Decoded samples by file name, empty until the context exists. */
  private readonly samples = new Map<string, AudioBuffer>();
  private loading = false;

  constructor(private readonly sounds: Sounds) {}

  /** Play a sound by id. Unknown ids are silent, deliberately — see below. */
  play(id: string | undefined): void {
    if (!id) return;
    const spec = this.sounds[id];
    // A missing sound is not worth a crash or a warning per frame: sound is the
    // last thing added to a move and the first thing forgotten.
    if (!spec) return;
    const ctx = this.context();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(spec.gain, ctx.currentTime);
    gain.connect(ctx.destination);

    // A real sample beats the placeholder — but only once it has arrived. Until
    // then, and if it never does, the synth spec is what plays: the game is
    // audible from the first frame either way.
    const sample = spec.file ? this.samples.get(spec.file) : undefined;
    if (sample) {
      const src = ctx.createBufferSource();
      src.buffer = sample;
      // The recording carries its own envelope, so nothing is ramped here; the
      // wobble is the same one the synth uses, applied as speed.
      src.playbackRate.setValueAtTime(rateFor(spec, Math.random()), ctx.currentTime);
      src.connect(gain);
      src.start();
      return;
    }

    // Nothing to synthesise and no sample yet: a recorded voice has no
    // stand-in, so it simply waits rather than being faked.
    if (spec.kind === undefined || spec.decay === undefined) return;

    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + spec.decay);
    const freq = pitchFor(spec, Math.random());
    if (spec.kind === "tone") {
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      // Falling pitch: a flat tone reads as a UI beep, not as an impact.
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + spec.decay);
      osc.connect(gain);
      osc.start();
      osc.stop(ctx.currentTime + spec.decay);
      return;
    }

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(freq, ctx.currentTime);
    filter.Q.setValueAtTime(1.2, ctx.currentTime);
    src.connect(filter);
    filter.connect(gain);
    src.start();
    src.stop(ctx.currentTime + spec.decay);
  }

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      this.ctx = new AudioContext();
    } catch {
      this.ctx = null;
    }
    if (this.ctx) void this.loadSamples(this.ctx);
    return this.ctx;
  }

  /**
   * Fetch and decode every sample once, as soon as there is a context to decode
   * with — which is the first sound of the session, because a browser will not
   * give us one before the player has touched the page.
   */
  private async loadSamples(ctx: AudioContext): Promise<void> {
    if (this.loading) return;
    this.loading = true;

    const files = new Set(
      Object.values(this.sounds)
        .map((s) => s.file)
        .filter((f): f is string => f !== undefined),
    );

    await Promise.all(
      [...files].map(async (file) => {
        try {
          const res = await fetch(`/api/sfx?file=${encodeURIComponent(file)}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          this.samples.set(file, await ctx.decodeAudioData(await res.arrayBuffer()));
        } catch (err) {
          // Loudly, once: a wrong path otherwise means the placeholder stands in
          // for a sample forever and nobody notices which is playing.
          console.error(`[sounds] ${file}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }),
    );

    // One line a session, because "I cannot hear it" needs to be answerable
    // without a debugger: a sound with no synth spec behind it is silent when
    // its sample is missing, and that is indistinguishable from never firing.
    console.info(`[sounds] ${this.samples.size}/${files.size} sample(s) loaded`);
  }

  /** One second of white noise, made once and reused by every impact. */
  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noise) return this.noise;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
    return buf;
  }
}
