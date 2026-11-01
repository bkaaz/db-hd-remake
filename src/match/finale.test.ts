import { describe, expect, it } from "vitest";
import { finaleStep, throwBall, type Finale, type FinaleDef, type FinaleEvents } from "./finale";

const METEOR: FinaleDef = {
  frame: 394,
  from: [0, -112],
  speed: 8,
  radius: 73,
  resume: 454,
  grow: 2,
  max: 112,
  white: 60,
  every: 4,
  fx: "burst_s",
  shakes: [
    { pattern: 2, frames: 32 },
    { pattern: 1, frames: 32 },
    { pattern: 3, frames: 64 },
  ],
};

/** Every frame to the end: how many it took and what happened on the way. */
function play(f: Finale): { frames: number; events: FinaleEvents[] } {
  const events: FinaleEvents[] = [];
  let at = f;
  for (let i = 0; i < 1000; i++) {
    const [next, e] = finaleStep(at, METEOR, 200);
    events.push(e);
    if (e.done) return { frames: i + 1, events };
    at = next;
  }
  throw new Error("never ended");
}

describe("the finale", () => {
  // from 112 px over a hanging mover's head, at someone lying 96 px along
  const ball = throwBall(METEOR, 100, 0, 196, 200);

  it("flies at its speed straight at where he lies", () => {
    expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(8);
    expect(ball.vx / ball.vy).toBeCloseTo(96 / 200);
  });

  it("flies at the radius its held frame gives it", () => {
    expect(ball.radius).toBe(73);
  });

  it("lands on the floor, then swells from its radius to the full one at 2 a frame", () => {
    const { events } = play(ball);
    const landed = events.findIndex((e) => e.landed);
    const exploded = events.findIndex((e) => e.exploded);
    // 222 px at 8 a frame: on the 28th; 73 → 112 by 2: 20 more
    expect(landed).toBe(27);
    expect(exploded - landed).toBe(20);
  });

  it("holds the white for its frames with a burst every 4th, then is done", () => {
    const { events } = play(ball);
    const exploded = events.findIndex((e) => e.exploded);
    expect(events.length - 1 - exploded).toBe(60);
    expect(events.filter((e) => e.burst)).toHaveLength(14);
  });
});
