/**
 * One sound effect as the cartridge's driver plays it: the chip loaded as the
 * game loads it at boot, the id put in port 1 as the game asks, and what the
 * DSP puts out until it falls silent. Rendered once and played as a buffer —
 * the driver's own mixing of sounds that overlap is not kept (ADR 0092).
 */

import { apuUpload, voiceUploads } from "../rom/apuUpload";
import { Apu, SAMPLE_RATE } from "./apu";

/** The uploads the game sends at boot (`$00:9237`): the driver, its tables, the music's samples and the effects'. */
const BOOT = [0, 1, 2, 3];
/** What the driver takes to set itself up before it hears the game. */
const WARM_UP = SAMPLE_RATE / 2;
/** Silence this long after the sound began ends it. */
const QUIET = SAMPLE_RATE / 4;
/** Longer than anything the sound test plays: past it a sound is cut. */
const LONGEST = SAMPLE_RATE * 10;

export interface Rendered {
  rate: number;
  left: Float32Array;
  right: Float32Array;
}

/** The chip as a fight finds it: booted, with player one's `voice` if given, and set up. */
export function bootedApu(rom: Uint8Array, voice?: number): Apu {
  const apu = new Apu();
  const boot = BOOT.map((i) => apuUpload(rom, i));
  apu.load([...boot, ...(voice === undefined ? [] : voiceUploads(rom, voice, 0))], boot[boot.length - 1].start);
  apu.render(WARM_UP);
  return apu;
}

/**
 * Effect `id`, from the first sample it sounds to the last — with `voice`, as
 * that character's voice is loaded for player one, for his cry and his shout.
 */
export function renderEffect(rom: Uint8Array, id: number, voice?: number): Rendered {
  const apu = bootedApu(rom, voice);
  apu.input[1] = id;
  return capture(apu);
}

/**
 * What the chip plays from now, a frame of the game at a time, `frame` doing
 * the game's part of each first while it says it has one; from its first
 * sound to its last, once it has gone quiet.
 */
export function capture(apu: Apu, frame: () => boolean = () => false): Rendered {
  const start0 = apu.time;
  const chunks: Int16Array[] = [];
  let busy = true;
  let length = 0;
  let start = -1;
  let lastLoud = -1;
  for (let n = 1; length < LONGEST; n++) {
    if (busy) busy = frame();
    const end = start0 + Math.round((n * SAMPLE_RATE) / 60);
    apu.until(() => apu.time >= end, Infinity);
    const pcm = apu.take();
    for (let i = 0; i < pcm.length; i += 2) {
      if (Math.abs(pcm[i]) + Math.abs(pcm[i + 1]) < 4) continue;
      const at = length + i / 2;
      if (start < 0) start = at;
      lastLoud = at;
    }
    chunks.push(pcm);
    length += pcm.length / 2;
    if (!busy && start >= 0 && length - lastLoud > QUIET) break;
  }

  const end = start < 0 ? 0 : lastLoud + 1;
  const from = Math.max(start, 0);
  const left = new Float32Array(end - from);
  const right = new Float32Array(end - from);
  let at = 0;
  for (const pcm of chunks) {
    for (let i = 0; i < pcm.length; i += 2, at++) {
      if (at < from || at >= end) continue;
      left[at - from] = pcm[i] / 32768;
      right[at - from] = pcm[i + 1] / 32768;
    }
  }
  return { rate: SAMPLE_RATE, left, right };
}
