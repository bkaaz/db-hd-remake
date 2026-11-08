import { describe, expect, it } from "vitest";
import { Resampler } from "./resample";

/** A chip that counts: its nth sample is n on the left, −n on the right. */
function counting(): () => [number, number] {
  let n = 0;
  return () => {
    n++;
    return [n, -n];
  };
}

describe("the resampler", () => {
  it("hands every sample over unchanged at the chip's own rate", () => {
    const left = new Float32Array(4);
    const right = new Float32Array(4);
    new Resampler(32000, 32000, counting()).fill(left, right);
    expect([...left]).toEqual([0, 1, 2, 3]);
    expect([...right]).toEqual([0, -1, -2, -3]);
  });

  it("puts a sample halfway between two at twice the rate", () => {
    const left = new Float32Array(5);
    const right = new Float32Array(5);
    new Resampler(32000, 64000, counting()).fill(left, right);
    expect([...left]).toEqual([0, 0.5, 1, 1.5, 2]);
  });

  it("carries on where the last block ended", () => {
    const r = new Resampler(32000, 64000, counting());
    const a = new Float32Array(3);
    const b = new Float32Array(3);
    r.fill(a, new Float32Array(3));
    r.fill(b, new Float32Array(3));
    expect([...a, ...b]).toEqual([0, 0.5, 1, 1.5, 2, 2.5]);
  });
});
