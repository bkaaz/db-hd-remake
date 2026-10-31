import { describe, expect, it } from "vitest";
import { walk, type Body } from "./walk";

/** A cartridge of a few bytes at $00:8000 (file offset 0, LoROM). */
function rom(bytes: number[]): Uint8Array {
  const image = new Uint8Array(0x8000);
  image.set(bytes);
  return image;
}

const body = (stops: number[]): Body => ({
  frames: 0x44,
  dispatch: { field: 0x46, entries: [], tagged: false },
  names: {},
  routines: { 0x009000: { fact: () => ({ what: "calls the routine" }) } },
  ownBanks: new Set(),
  stops: new Set(stops),
  observe: () => {},
});

describe("walk", () => {
  // $8000: BRA $8004 / $8002: RTL / $8004: JSL $00:9000 / RTL
  const code = rom([0x80, 0x02, 0x6b, 0x00, 0x22, 0x00, 0x90, 0x00, 0x6b]);

  it("follows a jump, and the routine called there is a fact", () => {
    expect(walk(code, 0x008000, body([])).map((f) => f.what)).toEqual(["calls the routine"]);
  });

  it("goes no further than a stop: the code it returns to is the caller's", () => {
    expect(walk(code, 0x008000, body([0x008004]))).toEqual([]);
  });
});
