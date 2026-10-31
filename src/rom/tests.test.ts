import { describe, expect, it } from "vitest";
import { sayTest } from "./tests";

describe("sayTest", () => {
  it("names the buttons held, one bit or a set", () => {
    // $20:8496: LDA $EC,X / BIT #$80 / BNE — A still held
    expect(sayTest("BNE", { field: 0xec }, undefined, { op: "bit", mask: 0x80 })).toEqual(["while A held", "while not A held"]);
    // $20:81B6: AND #$C000 / CMP #$C000 / BNE — let go of B or Y
    expect(sayTest("BNE", { field: 0xec }, 0xc000, { op: "cmp", value: 0xc000 })).toEqual(["unless B + Y held", "while B + Y held"]);
  });

  it("names every n-th frame of the game's count", () => {
    expect(sayTest("BNE", { global: 0x74 }, undefined, { op: "bit", mask: 7 })).toEqual([
      "between the game's every 8th frames",
      "every 8th frame of the game",
    ]);
  });

  it("says any other test plainly, with the field's name where it has one", () => {
    expect(sayTest("BCC", { field: 0x23 }, undefined, { op: "cmp", value: 0xc8 })).toEqual([
      "when field 23 (y, whole px (200 on the ground)) is below c8",
      "when field 23 (y, whole px (200 on the ground)) is c8 or more",
    ]);
    expect(sayTest("BEQ", { field: 0x47 }, undefined, { op: "field", field: 0x46 })).toEqual([
      "when field 47 (step, a second count — with 0x46 at $01:86A7, alone at $01:86B2 ?) equals field 46",
      "when field 47 (step, a second count — with 0x46 at $01:86A7, alone at $01:86B2 ?) differs from field 46",
    ]);
  });
});
