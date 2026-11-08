/**
 * The music of a fight: the cartridge's driver playing a song on the chip
 * running live in an AudioWorklet (ADR 0094), through the page's one audio
 * context. Which song is the page's pick, kept as the scale is: picking
 * another changes the song a fight plays and rebuilds nothing. Separate from `playback.ts` because the effects there are still
 * rendered once and played as buffers; they move onto this chip later.
 */

import chipUrl from "./chip.worklet.ts?worker&url";
import type { ChipMessage } from "./chip.worklet";
import type { Audio } from "./playback";
import { cartridge } from "../cartridge/romFile";
import { bootUploads } from "../apu/effect";
import { songIds, songUploads } from "../apu/music";
import { fightSong, readSongPick, REMEMBERED_SONG, type SongPick } from "../match/song";
import type { Memory } from "../debug/toggles";
import { logEvent } from "../log";

/**
 * 30% of the effects' level (owner, 2026-11-08), until a settings screen makes
 * it the player's; the effects are played at 0.85 (`sounds.json`).
 */
const GAIN = 0.85 * 0.3;

export class Music {
  private loaded: Promise<void> | null = null;
  private chip: AudioWorkletNode | null = null;
  /** Bumped by every play and stop, so a play still loading when stopped never sounds. */
  private asked = 0;
  private picked: SongPick;
  /** Between a fight's start and its end: a new pick is heard at once. */
  private fighting = false;

  constructor(
    private readonly audio: Audio,
    private readonly memory: Memory | null,
  ) {
    this.picked = readSongPick(memory?.getItem(REMEMBERED_SONG) ?? null);
  }

  get pick(): SongPick {
    return this.picked;
  }

  set pick(pick: SongPick) {
    this.picked = pick;
    this.memory?.setItem(REMEMBERED_SONG, String(pick));
    if (this.fighting) this.fight();
  }

  /** A fight begins: its song from the start — random drawn anew — until `stop`. */
  fight(): void {
    this.fighting = true;
    const song = fightSong(this.picked);
    logEvent(song === null ? "music: none" : `music: song ${song}${this.picked === "random" ? " (random)" : ""}`);
    if (song === null) this.silence();
    else void this.play(song);
  }

  /** The fight is over, or the scene gone. */
  stop(): void {
    this.fighting = false;
    this.silence();
  }

  /** Song `id` from its start, in place of whatever played. */
  private async play(id: number): Promise<void> {
    this.silence();
    const asked = this.asked;
    const ctx = this.audio.context();
    if (!ctx) return;
    this.loaded ??= ctx.audioWorklet.addModule(chipUrl);
    const [rom] = await Promise.all([cartridge(), this.loaded]);
    if (asked !== this.asked) return;
    // past the table an id names some other upload, which the driver would take for a song
    if (!songIds(rom).includes(id)) return console.warn(`[music] no song ${id.toString(16)} in the cartridge`);

    const chip = new AudioWorkletNode(ctx, "chip", { numberOfInputs: 0, outputChannelCount: [2] });
    const gain = new GainNode(ctx, { gain: GAIN });
    chip.connect(gain).connect(ctx.destination);
    const message: ChipMessage = { boot: bootUploads(rom), song: songUploads(rom, id) };
    chip.port.postMessage(message);
    this.chip = chip;
  }

  private silence(): void {
    this.asked++;
    if (!this.chip) return;
    const over: ChipMessage = { stop: true };
    this.chip.port.postMessage(over);
    this.chip.disconnect();
    this.chip = null;
  }
}
