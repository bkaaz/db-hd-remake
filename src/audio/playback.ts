/**
 * Playing sounds. The browser half of `src/audio/sounds.ts`, which owns the shapes.
 *
 * Plain Web Audio, no dependency: what a fighter needs is "play this short
 * noise now, several at once, with a little pitch wobble", and that is a few
 * dozen lines. The same reasoning as writing our own PNG encoder.
 *
 * Browsers refuse to start audio until the user has interacted with the page.
 * The game calls `start`: the context is made at once, suspended, so every
 * sample is decoded before the first press, which wakes it. Without `start`
 * (the editor) the context is made on the first sound, which then waits.
 */

import { withVoices } from "./bank";
import { pitchFor, rateFor, soundForLine, soundForRom, type Sounds } from "./sounds";

/** What a fighter, or anything it throws, plays its sounds through. */
export interface SoundPlayer {
  play(id: string | undefined): void;
  playRom(id: number): void;
  playLine(id: number): void;
}

/**
 * A sound asked for again while it still plays starts again: the earlier
 * copy stops. The original's sound driver restarts a sound's voices so
 * (`tools/re/log-dsp.lua`, `rom.md`, The sounds) — per side, since player
 * two's sounds are other ids in the original and never cut player one's.
 */
export class Audio implements SoundPlayer {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  /** Decoded samples by file name, empty until the context exists. */
  private readonly samples = new Map<string, AudioBuffer>();
  /** Every file a map played from names, and those already asked for. */
  private readonly wanted = new Set<string>();
  private readonly requested = new Set<string>();
  /** The copy of each sound still playing, by side and id, for the next to stop. */
  private readonly playing = new Map<string, AudioScheduledSourceNode>();

  constructor(private readonly sounds: Sounds) {
    this.want(sounds);
  }

  /**
   * Make the context now and load every sample into it; the first key or
   * click on `page` wakes it. One `Audio` for the page's life: made per scene,
   * each would load everything again and its first voice would be silent.
   */
  start(page: Window = window): void {
    const ctx = this.context();
    if (!ctx) return;
    const wake = () => {
      if (ctx.state === "suspended") void ctx.resume();
    };
    page.addEventListener("keydown", wake);
    page.addEventListener("pointerdown", wake);
  }

  /**
   * One side of the fight: these sounds plus that fighter's own voice, and
   * restarting only its own copies. A voice is a fighter's — two fighters'
   * lines share the cartridge's ids — so each side looks them up in its own map.
   */
  side(name: string, voices?: Sounds): SoundPlayer {
    const sounds = withVoices(this.sounds, voices);
    this.want(sounds);
    return {
      play: (id) => this.play(id, name, sounds),
      playRom: (id) => this.play(soundForRom(sounds, id), name, sounds),
      playLine: (id) => this.play(soundForLine(sounds, id), name, sounds),
    };
  }

  /** Say the spoken line matched to a cartridge id; an unmatched one is silent. */
  playLine(id: number): void {
    this.play(soundForLine(this.sounds, id));
  }

  /** Play the sound matched to a cartridge id; an unmatched id is silent. */
  playRom(id: number): void {
    this.play(soundForRom(this.sounds, id));
  }

  /** Play a sound by id, for `side`. Unknown ids are silent, deliberately — see below. */
  play(id: string | undefined, side = "", sounds = this.sounds): void {
    if (!id) return;
    const spec = sounds[id];
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
      this.restart(`${side}:${id}`, src);
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
      this.restart(`${side}:${id}`, osc);
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
    this.restart(`${side}:${id}`, src);
    src.start();
    src.stop(ctx.currentTime + spec.decay);
  }

  /** Stop the copy of this sound still playing, and remember the new one. */
  private restart(key: string, node: AudioScheduledSourceNode): void {
    const before = this.playing.get(key);
    if (before) {
      try {
        before.stop();
      } catch {
        // already stopped, or never started
      }
    }
    this.playing.set(key, node);
    node.addEventListener("ended", () => {
      if (this.playing.get(key) === node) this.playing.delete(key);
    });
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

  /** Note the files `sounds` plays, and load the new ones if there is a context. */
  private want(sounds: Sounds): void {
    for (const spec of Object.values(sounds)) if (spec.file) this.wanted.add(spec.file);
    if (this.ctx) void this.loadSamples(this.ctx);
  }

  /** Fetch and decode every wanted sample not yet asked for, each once. */
  private async loadSamples(ctx: AudioContext): Promise<void> {
    const files = [...this.wanted].filter((f) => !this.requested.has(f));
    if (files.length === 0) return;
    for (const f of files) this.requested.add(f);

    await Promise.all(
      files.map(async (file) => {
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

    // One line a load, because "I cannot hear it" needs to be answerable
    // without a debugger: a sound with no synth spec behind it is silent when
    // its sample is missing, and that is indistinguishable from never firing.
    console.info(`[sounds] ${this.samples.size}/${this.requested.size} sample(s) loaded`);
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
