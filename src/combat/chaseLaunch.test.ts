import { describe, expect, it } from "vitest";
import { chaseLaunch, jumpPeak } from "./chaseLaunch";

describe("chaseLaunch", () => {
  const sent = { sent_off: [-4, -2] as [number, number] };
  const low = 50;
  const peak = 100;

  it("leaves the first chase as written, and a blow that does not quicken", () => {
    expect([chaseLaunch(sent, { quickens: 0.25 }, 1, low, peak), chaseLaunch(sent, {}, 3, low, peak)]).toEqual([sent, sent]);
  });

  it("sends him faster along with each chase after, never higher", () => {
    expect(chaseLaunch(sent, { quickens: 0.25 }, 2, low, peak)).toEqual({ sent_off: [-5, -2] });
    expect(chaseLaunch(sent, { quickens: 0.25 }, 3, low, peak)).toEqual({ sent_off: [-6, -2] });
  });

  it("sends him down, nearly flat, once he is above the attacker's jump; never below it", () => {
    expect(chaseLaunch(sent, { sinks: true }, 1, 120, peak)).toEqual({ sent_off: [-4, 0.4] });
    expect(chaseLaunch(sent, { sinks: true }, 1, peak, peak)).toEqual(sent);
    expect(chaseLaunch(sent, {}, 1, 120, peak)).toEqual(sent);
  });

  it("keeps an axis the launch leaves alone", () => {
    expect(chaseLaunch({ x: [null, null] }, { quickens: 0.5, sinks: true }, 3, 120, peak)).toEqual({ x: [null, null] });
  });
});

describe("jumpPeak", () => {
  it("is v² / 2g, the height a jump rises to", () => {
    expect(jumpPeak(-10, 0.5)).toBe(100);
    expect(jumpPeak(-10, 0)).toBe(0);
  });
});
