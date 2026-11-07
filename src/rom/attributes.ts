import { toFile } from "./cartridge";
import type { StatesFile } from "../entity/states";

/**
 * A fighter's attributes: 32 bytes at `$3D:9D9B + 32 × character`, read a
 * word at a time by `$0D:C4C1` (A the byte offset). Only the words a caller
 * names are here — defence (byte 0, `$01:8112`), walking (1, 3:
 * `$10:D577`…), the dash (5, 7), the jump's rise (`0x19`, `$0D:FC99`) and
 * gravity (`0x1D`, `$01:80A4`), and the jump's vx: 1.5 × the word at 9 for
 * forward (move 06) or `0B` for back (07), whichever way ↑ → / ↑ ← is
 * pressed for his facing (`$0D:FC99`, `$0D:FD3F`). The hop (08, 09: a
 * direction tapped and held, `input/hop.ts`) the same way: vy the word at
 * `0x1B`, vx 1.5 × the word at `0D` / `0F` (`$0D:FA8B`, `$0D:FAFA`).
 */
export interface Attributes {
  defence: number;
  walk: [forward: number, back: number];
  dash: [forward: number, back: number];
  /** The jump's vy as it leaves the floor, − up. */
  jump: number;
  /** The jump's vx, forward and back, both positive. */
  jumpVx: [forward: number, back: number];
  /** The hop's vy, − up, and its vx forward and back, both positive. */
  hop: number;
  hopVx: [forward: number, back: number];
  gravity: number;
}

const TABLE = 0x3d9d9b;
const SIZE = 32;

export function readAttributes(rom: Uint8Array, character: number): Attributes {
  const at = toFile(TABLE + SIZE * character);
  if (at === null) throw new Error("the attributes are not ROM");
  const word = (offset: number) => (((rom[at + offset] | (rom[at + offset + 1] << 8)) << 16) >> 16) / 256;
  return { defence: rom[at], walk: [word(1), word(3)], dash: [word(5), word(7)], jump: word(0x19), jumpVx: [1.5 * word(9), 1.5 * word(0xb)], hop: word(0x1b), hopVx: [1.5 * word(0xd), 1.5 * word(0xf)], gravity: word(0x1d) };
}

/**
 * The template's movement on his numbers: Goku's states walk, dash and jump
 * at Goku's speeds, which another fighter's own words replace — the same
 * states, as the same code moves every fighter.
 */
export function withAttributes(file: StatesFile, a: Attributes): StatesFile {
  const states = structuredClone(file.states);
  const speed = (name: string, vx: number) => {
    const def = states[name];
    if (def?.vel) def.vel = [vx, def.vel[1]];
  };
  speed("walk_fwd", a.walk[0]);
  speed("walk_back", -a.walk[1]);
  for (const part of ["", "_run"]) {
    speed(`dash_fwd${part}`, a.dash[0]);
    speed(`dash_back${part}`, -a.dash[1]);
  }
  for (const name of ["jump_up", "jump_fwd", "jump_back"]) {
    for (const [, step] of states[name]?.air ?? []) if (step.vy !== undefined && step.vy < 0) step.vy = a.jump;
  }
  for (const [name, vx] of [["jump_fwd", a.jumpVx[0]], ["jump_back", -a.jumpVx[1]]] as const) {
    for (const [, step] of states[name]?.air ?? []) if (step.vx) step.vx = vx;
  }
  for (const [name, vx] of [["hop_fwd", a.hopVx[0]], ["hop_back", -a.hopVx[1]]] as const) {
    for (const [, step] of states[name]?.air ?? []) {
      if (step.vx) step.vx = vx;
      if (step.vy !== undefined && step.vy < 0) step.vy = a.hop;
    }
  }
  return { ...file, states };
}
