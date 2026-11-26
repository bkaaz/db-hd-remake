import { describe, expect, it } from "vitest";
import { quickened } from "./quicken";

describe("quickened", () => {
  const sent = { sent_off: [-4, -2] as [number, number] };

  it("leaves the first chase as written, and a blow that does not quicken", () => {
    expect([quickened(sent, 0.25, 1), quickened(sent, undefined, 3)]).toEqual([sent, sent]);
  });

  it("sends him faster along with each chase after, never higher", () => {
    expect(quickened(sent, 0.25, 2)).toEqual({ sent_off: [-5, -2] });
    expect(quickened(sent, 0.25, 3)).toEqual({ sent_off: [-6, -2] });
  });

  it("keeps an axis the launch leaves alone", () => {
    expect(quickened({ x: [null, -3] }, 0.5, 3)).toEqual({ x: [null, -3] });
  });
});
