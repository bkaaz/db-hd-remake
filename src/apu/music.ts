/**
 * A song as the game loads it (`$0E:817D`, `$00:D19C`): its samples and its
 * own upload put into the booted chip, then `1` asked for on port 0
 * (`$00:DE5A`, sent by `$00:D8AF`). The game plays it on the chip running
 * live (`audio/music.ts`, ADR 0094); the CLI renders it to listen to.
 */

import { toFile } from "../rom/cartridge";
import { apuUpload, type ApuUpload } from "../rom/apuUpload";
import { bootedApu, type Rendered } from "./effect";
import { SAMPLE_RATE, type Apu } from "./apu";

/** By song, the upload of the samples it plays (`$00:98C4`). */
const SAMPLES = 0x98d6;
/** By song, its own upload (`$00:DE0A`). */
const SONGS = 0xdca8;
/** The command that plays the song loaded, on port 0. */
const PLAY = 1;
/**
 * The pre-fight choice's count, the operand of its wrap (`$02:B8AA`
 * `CMP #$000B`): random, then each song a fight may play, then off.
 */
const CHOICES = 0x02b8ab;

/** The songs the table names: 1 up to the first that has no upload. */
export function songIds(rom: Uint8Array): number[] {
  const ids: number[] = [];
  for (let id = 1; rom[toFile(SONGS)! + id] !== 0; id++) ids.push(id);
  return ids;
}

/** The songs a fight plays: those the pre-fight choice steps through, from 1. */
export function fightSongIds(rom: Uint8Array): number[] {
  const at = toFile(CHOICES)!;
  const choices = rom[at] | (rom[at + 1] << 8);
  return Array.from({ length: choices - 2 }, (_, i) => i + 1);
}

/** What the chip is sent for song `id`: its samples, then the song. */
export function songUploads(rom: Uint8Array, id: number): ApuUpload[] {
  return [rom[toFile(SAMPLES)! + id], rom[toFile(SONGS)! + id]].map((i) => apuUpload(rom, i));
}

/**
 * Put the song into a booted chip and ask for it. The bytes go straight into
 * RAM, not through the driver's transfer as the game sends them — it plays
 * as the original's does all the same (owner, by ear).
 */
export function startSong(apu: Apu, uploads: ApuUpload[]): void {
  for (const u of uploads) for (const b of u.blocks) apu.ram.set(b.bytes, b.at);
  if (!apu.until(() => apu.output[3] === 0)) throw new Error("the driver is busy");
  apu.input[2] = 0;
  apu.input[3] = 0;
  apu.input[0] = PLAY;
}

/** Song `id`, its first `seconds` from the moment it is asked for. */
export function renderSong(rom: Uint8Array, id: number, seconds: number): Rendered {
  const apu = bootedApu(rom);
  startSong(apu, songUploads(rom, id));
  const pcm = apu.render(Math.round(seconds * SAMPLE_RATE));
  const left = new Float32Array(pcm.length / 2);
  const right = new Float32Array(pcm.length / 2);
  for (let i = 0; i < left.length; i++) {
    left[i] = pcm[2 * i] / 32768;
    right[i] = pcm[2 * i + 1] / 32768;
  }
  return { rate: SAMPLE_RATE, left, right };
}
