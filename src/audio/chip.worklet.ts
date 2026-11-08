/**
 * The sound chip running live, on the audio thread (ADR 0094): the driver
 * booted as the game boots it, then asked for a song once it has set itself
 * up. Loaded with `audioWorklet.addModule`, never imported by the game.
 */

import { Apu, SAMPLE_RATE } from "../apu/apu";
import { WARM_UP } from "../apu/effect";
import { startSong } from "../apu/music";
import type { ApuUpload } from "../rom/apuUpload";
import { Resampler } from "./resample";

/** What the page sends: the boot uploads and the song's, all at once — or that it is over. */
export type ChipMessage = { boot: ApuUpload[]; song: ApuUpload[] } | { stop: true };

// The audio thread's own globals, which the DOM library does not declare.
declare const sampleRate: number;
declare function registerProcessor(name: string, processor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

/** Samples the chip makes at a time when the resampler wants more. */
const CHUNK = 64;

class ChipProcessor extends AudioWorkletProcessor {
  private apu: Apu | null = null;
  /** Once stopped, the node is let go: the audio thread stops calling it. */
  private over = false;
  private song: ApuUpload[] = [];
  private pcm: Int16Array = new Int16Array(0);
  private read = 0;
  private readonly out = new Resampler(SAMPLE_RATE, sampleRate, () => this.pull());

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<ChipMessage>) => {
      if ("stop" in e.data) {
        this.over = true;
        this.apu = null;
        return;
      }
      const apu = new Apu();
      apu.load(e.data.boot);
      this.apu = apu;
      this.song = e.data.song;
    };
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const [left, right] = outputs[0];
    if (this.apu) this.out.fill(left, right ?? new Float32Array(left.length));
    return !this.over;
  }

  /** The chip's next sample — and the song asked for once the driver is ready. */
  private pull(): [number, number] {
    const apu = this.apu;
    if (!apu) return [0, 0];
    if (this.read >= this.pcm.length) {
      if (this.song.length > 0 && apu.time >= WARM_UP) {
        startSong(apu, this.song);
        this.song = [];
      }
      this.pcm = apu.render(CHUNK);
      this.read = 0;
    }
    const l = this.pcm[this.read++] / 32768;
    const r = this.pcm[this.read++] / 32768;
    return [l, r];
  }
}

registerProcessor("chip", ChipProcessor);
