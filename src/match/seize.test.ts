import { describe, expect, it } from "vitest";
import { flightStep, type Flight } from "./seize";

/** Every frame of a flight until it lies still, as [y, landed]. */
function fly(start: Flight, gravity: number): { ys: number[]; landings: number } {
  const ys: number[] = [];
  let landings = 0;
  let f: Flight = start;
  for (let i = 0; i < 500; i++) {
    const next = flightStep(f, gravity, 0);
    ys.push(next.y);
    if (next.landed) landings++;
    if (next.still) return { ys, landings };
    f = next;
  }
  throw new Error("never came to rest");
}

describe("flightStep", () => {
  // Saiyan Meteor's: thrown up at 8, then off the floor at 3 and at 1.5 ($20:8CCE)
  const thrown: Flight = { y: 0, vy: -8, bounces: [-3, -1.5] };

  it("lands three times — two bounces, then still", () => {
    expect(fly(thrown, 0.5).landings).toBe(3);
  });

  it("never goes below the floor", () => {
    expect(Math.max(...fly(thrown, 0.5).ys)).toBe(0);
  });

  it("leaves the floor at the next bounce's speed", () => {
    // a body one frame above the floor, falling
    const next = flightStep({ y: -1, vy: 2, bounces: [-3, -1.5] }, 0.5, 0);
    expect(next).toEqual({ y: 0, vy: -3, bounces: [-1.5], landed: true, still: false });
  });

  it("rises without landing however near the floor it starts", () => {
    expect(flightStep({ y: 0, vy: -8, bounces: [] }, 0.5, 0)).toMatchObject({ y: -8, vy: -7.5, landed: false });
  });
});
