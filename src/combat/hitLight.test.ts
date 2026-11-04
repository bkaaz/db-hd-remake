import { describe, expect, it } from "vitest";
import { HitLight } from "./hitLight";

describe("HitLight", () => {
  it("shows nothing until the first frame after the pause", () => {
    const light = new HitLight();
    light.land("ball", 10, 20);
    expect(light.ball).toBeNull();
    light.tick();
    expect(light.ball).toEqual({ x: 10, y: 20, radius: 16 });
  });

  it("grows a ball by 2 a frame and takes it away at 32", () => {
    const light = new HitLight();
    light.land("ball", 0, 0);
    light.tick();
    const radii: number[] = [];
    while (light.ball) {
      radii.push(light.ball.radius);
      light.tick();
    }
    expect(radii).toEqual([16, 18, 20, 22, 24, 26, 28, 30]);
  });

  it("narrows a pillar by 2 a side from 32 and ends it", () => {
    const light = new HitLight();
    light.land("pillar", 5, 0);
    light.tick();
    expect(light.pillar).toEqual({ x: 5, half: 32 });
    let frames = 0;
    while (light.pillar) {
      light.tick();
      frames++;
    }
    expect(frames).toBe(16);
  });

  it("starts the next ball over the last", () => {
    const light = new HitLight();
    light.land("ball", 0, 0);
    light.tick();
    light.tick();
    light.land("ball", 7, 7);
    light.tick();
    expect(light.ball).toEqual({ x: 7, y: 7, radius: 16 });
  });
});
