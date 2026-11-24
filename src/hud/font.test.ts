import { describe, expect, it } from "vitest";
import { textDots, textWidth } from "./font";

describe("the HUD's font", () => {
  it("sets letters six apart, five wide and seven tall", () => {
    expect(textWidth("CELL")).toBe(23);
    const dots = textDots("I");
    expect(Math.max(...dots.map(([x]) => x))).toBe(3);
    expect(Math.max(...dots.map(([, y]) => y))).toBe(6);
  });

  it("leaves a gap for what it has no letter for, and reads lower case as capitals", () => {
    expect(textDots("A A").filter(([x]) => x >= 6 && x < 12)).toEqual([]);
    expect(textDots("kid")).toEqual(textDots("KID"));
  });
});
