import { describe, expect, it } from "vitest";
import { airProblem, applyAir, fall, grounded, leavesGround, type AirBody, type AirTimeline } from "./air";

// Jumping Knee Slash, as $20:85E2 runs it
const KNEE: AirTimeline = [
  [16, { vx: 1, vy: -7, gravity: 0 }],
  [24, { gravity: 0.5, toApex: true }],
  [42, { vx: 0, gravity: "own" }],
];
const OWN = 0.469;

/** The body through `frames` frames of the state, as Entity steps it: the timeline, then gravity once aloft. */
function run(timeline: AirTimeline, frames: number): AirBody[] {
  let body = grounded(0, 0);
  const out: AirBody[] = [];
  for (let frame = 0; frame < frames; frame++) {
    body = applyAir(body, timeline, frame);
    out.push(body);
    if (body.aloft) body = { ...body, vy: fall(body, OWN) };
  }
  return out;
}

describe("applyAir", () => {
  it("keeps the body on the ground until the first vy", () => {
    const frames = run(KNEE, 17);
    expect(frames[15].aloft).toBe(false);
    expect(frames[16]).toMatchObject({ aloft: true, vx: 1, vy: -7 });
  });

  it("rises at full speed with gravity off, slows by 0.5 from 24 and hangs at the top", () => {
    const frames = run(KNEE, 42);
    expect(frames[23].vy).toBe(-7);
    expect(frames[24].vy).toBe(-7);
    expect(frames[25].vy).toBe(-6.5);
    expect(frames[38].vy).toBe(0);
    expect(frames[41].vy).toBe(0);
  });

  it("falls at the fighter's own gravity once the timeline gives it back", () => {
    const frames = run(KNEE, 45);
    expect(frames[42]).toMatchObject({ vx: 0, vy: 0, gravity: "own" });
    expect(frames[44].vy).toBeCloseTo(2 * OWN);
  });

  it("changes nothing on a frame the timeline does not name", () => {
    const body = grounded(2, -3);
    expect(applyAir(body, KNEE, 17)).toBe(body);
    expect(applyAir(body, undefined, 16)).toBe(body);
  });
});

describe("fall", () => {
  it("adds the fighter's own gravity unless the body has its own", () => {
    expect(fall({ ...grounded(0, -2), aloft: true }, OWN)).toBeCloseTo(-2 + OWN);
    expect(fall({ ...grounded(0, -2), aloft: true, gravity: 0 }, OWN)).toBe(-2);
  });

  it("never turns a rise into a fall when it only slows the rise", () => {
    expect(fall({ ...grounded(0, -0.25), toApex: true, gravity: 0.5 }, OWN)).toBe(0);
    expect(fall({ ...grounded(0, 0), toApex: true, gravity: 0.5 }, OWN)).toBe(0);
  });
});

describe("airProblem", () => {
  it("passes a timeline as the knee slash writes it", () => {
    expect(airProblem(KNEE)).toBeNull();
    expect(airProblem(undefined)).toBeNull();
  });

  it("names what is wrong: frames out of order, an unknown key, a wrong value", () => {
    expect(airProblem([[16, {}], [8, {}]])).toMatch(/frames rising/);
    expect(airProblem([[16, { vz: 1 }]])).toMatch(/"vz"/);
    expect(airProblem([[16, { gravity: "low" }]])).toMatch(/"gravity"/);
    expect(airProblem({ 16: {} })).toMatch(/pairs/);
  });
});

describe("leavesGround", () => {
  it("is true only for a timeline that sets vy", () => {
    expect(leavesGround(KNEE)).toBe(true);
    expect(leavesGround([[4, { vx: 2 }]])).toBe(false);
    expect(leavesGround(undefined)).toBe(false);
  });
});
