import { describe, expect, it } from "vitest";
import { toFile } from "./cartridge";

describe("toFile", () => {
  it("maps the four LoROM bank ranges onto the four megabytes in order", () => {
    expect(toFile(0x32bae9)).toBe(0x193ae9); // far Y's tiles, seen in a trace
    expect(toFile(0x098000)).toBe(0x048000);
    expect(toFile(0x8fb161)).toBe(0x27b161); // PalMod's hair palette
    expect(toFile(0xa08000)).toBe(0x300000);
  });

  it("maps $C0-$FF linearly", () => {
    expect(toFile(0xc12345)).toBe(0x012345);
  });

  it("is null where the bus is not ROM", () => {
    expect(toFile(0x003100)).toBeNull(); // I-RAM
    expect(toFile(0x408000)).toBeNull(); // BW-RAM
  });
});
