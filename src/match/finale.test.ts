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

describe("a finale dropped straight down", () => {
  it("falls at its speed to the floor under it, wherever he lies", () => {
    const ball = throwBall({ ...METEOR, aim: "down", speed: 4 }, 100, 0, 196, 200);
    expect([ball.vx, ball.vy]).toEqual([0, 4]);
  });
});

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

  it("opens the band a frame, thickens it 16 a frame from 2 past 0xC0, then the white", () => {
    // 2 → 194 in 12 frames, the opening's 1 and the frame that finds it full
    const { events } = play(ball);
    expect(events.findIndex((e) => e.white) - events.findIndex((e) => e.exploded)).toBe(14);
  });

  it("tolls the white's sound as it begins and every 64th frame of it", () => {
    const { events } = play(ball);
    const white = events.findIndex((e) => e.white);
    expect(events.flatMap((e, i) => (e.toll ? [i - white] : []))).toEqual([0]);
    const long = { ...METEOR, white: 130 };
    let at = throwBall(long, 100, 0, 196, 200);
    const tolls: number[] = [];
    for (let i = 0, start = -1; i < 400; i++) {
      const [next, e] = finaleStep(at, long, 200);
      if (e.white) start = i;
      if (e.toll) tolls.push(i - start);
      if (e.done) break;
      at = next;
    }
    expect(tolls).toEqual([0, 64, 128]);
  });

  it("holds the white for its frames with a burst every 4th, then is done", () => {
    const { events } = play(ball);
    const white = events.findIndex((e) => e.white);
    expect(events.length - 1 - white).toBe(60);
    expect(events.filter((e) => e.burst)).toHaveLength(14);
  });
});

describe("a finale that sweeps", () => {
  const BREATH: FinaleDef = { ...METEOR, sweep: { each: 8, half: 28 }, white: 300 };

  it("starts at the screen's left, keeps the apex's x, and crosses the screen", () => {
    const f = throwBall(BREATH, 500, 100, 100, 200, 2);
    expect(f).toMatchObject({ phase: "sweep", x: 100, y: 100, vx: 16, vy: 500, left: 32 });
    const [next] = finaleStep(f, BREATH, 200);
    expect(next.x).toBe(116);
  });

  it("gives way to the band after 32 frames, and has no ball or clock to hold", () => {
    let f = throwBall(BREATH, 0, 0, 0, 200);
    let frames = 0;
    while (f.phase === "sweep") {
      [f] = finaleStep(f, BREATH, 200);
      frames++;
    }
    expect(frames).toBe(32);
    expect(f.phase).toBe("band");
  });
});
