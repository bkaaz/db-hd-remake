/**
 * A spoken line as the game plays it: the CPU's half of the stream, done as
 * the cartridge does it, and the driver on our chip doing the rest. The line's
 * bytes go to the chip through the ports, 80 at a time, as many a frame as 75
 * a frame allows; the driver plays what lands at `$3700` once asked for `36`.
 * Read from `$00:DB61` (set up), `$00:DA04` (credit), `$00:DA1D` (a frame) and
 * `$00:DA52` (a burst).
 */

import { toFile } from "../rom/cartridge";
import type { Apu } from "./apu";
import { bootedApu, capture, type Rendered } from "./effect";

/** By line, a 3-byte pointer to its chunks: a byte count, that many bytes of BRR, until a count of 0. */
const LINES = 0xdb98;
/** Where the chunks land in the chip's RAM, each from the start. */
const BUFFER = 0x3700;
/** The sound that plays the buffer. */
const PLAY = 0x36;
/** Bytes a frame the stream is owed, once it plays; what it is owed at the start; one burst. */
const PER_FRAME = 0x4b;
const HEAD_START = 0x100;
const BURST = 0x50;
/** The game's state values: done (`$FF`), and the frame the buffer starts to play. */
const DONE = 0xff;
const PLAYING = 5;

/** Line `id`, from its first sound to its last. */
export function renderLine(rom: Uint8Array, id: number): Rendered {
  const apu = bootedApu(rom);
  const at = toFile(LINES)! + 3 * id;
  const stream = new Stream(rom, rom[at] | (rom[at + 1] << 8) | (rom[at + 2] << 16));
  let state = 1;
  let owed = HEAD_START;
  let sent = 0;
  const sender = new Sender(apu, stream);
  return capture(apu, () => {
    if (state === DONE) return false;
    if (state > PLAYING) owed += PER_FRAME;
    if (state < PLAYING) state++;
    else if (state === PLAYING) {
      play(apu, PLAY);
      state++;
    }
    if (sent < owed) {
      sent += BURST;
      if (sender.burst(state === 2)) state = DONE;
    }
    return true;
  });
}

/** The line's bytes, read as `LDA [$d7],Y` reaches them. */
class Stream {
  constructor(
    private readonly rom: Uint8Array,
    private at: number,
  ) {}

  byte(): number {
    const off = toFile(this.at++);
    if (off === null) throw new Error(`a line runs off ROM at $${(this.at - 1).toString(16)}`);
    return this.rom[off];
  }

  word(): number {
    return this.byte() | (this.byte() << 8);
  }
}

/** The CPU's side of a burst ($00:DA52): a byte at a time, each waited on. */
class Sender {
  /** Bytes left in the chunk, and where the next goes. */
  private left = 0;
  private dest = BUFFER;

  constructor(
    private readonly apu: Apu,
    private readonly stream: Stream,
  ) {}

  /** One burst; whether the line has ended. */
  burst(first: boolean): boolean {
    let cmd = first ? 0x99 : 0x98;
    announce(this.apu, cmd);
    if (first) this.left = this.stream.word();
    for (let sent = 0; ; ) {
      if (this.left === 0) {
        this.echo(cmd++);
        this.finish(cmd);
        return true;
      }
      this.echo(cmd++);
      this.apu.input[2] = this.dest & 0xff;
      this.apu.input[3] = this.dest >> 8;
      this.apu.input[1] = this.stream.byte();
      this.apu.input[0] = cmd;
      this.dest = (this.dest + 1) & 0xffff;
      sent++;
      // a chunk's end: the next starts at the buffer's start again ($00:DA76)
      if (--this.left === 0) {
        this.dest = BUFFER;
        this.left = this.stream.word();
        continue;
      }
      if (sent >= BURST) break;
    }
    this.echo(cmd++);
    this.finish(cmd);
    return false;
  }

  /** Wait for the driver to answer `cmd` on port 0, as the game does. */
  private echo(cmd: number): void {
    if (!this.apu.until(() => this.apu.output[0] === cmd)) throw new Error(`the driver never answered ${cmd.toString(16)}`);
  }

  /** The end of a burst ($00:DB1E). */
  private finish(cmd: number): void {
    this.apu.input[3] = 0;
    this.apu.input[1] = 0;
    this.apu.input[0] = cmd & 0xff;
    this.echo(cmd & 0xff);
    this.apu.input[0] = 0;
  }
}

/** A command on port 0, once the driver's port 3 says it is free ($00:D8AF). */
function announce(apu: Apu, cmd: number): void {
  if (!apu.until(() => apu.output[3] === 0)) throw new Error("the driver is busy");
  apu.input[2] = 0;
  apu.input[3] = 0;
  apu.input[0] = cmd;
}

/** A sound asked for on port 1 ($00:D879). */
function play(apu: Apu, id: number): void {
  if (!apu.until(() => apu.output[3] === 0)) throw new Error("the driver is busy");
  apu.input[2] = 0;
  apu.input[3] = 0;
  apu.input[1] = id;
}

