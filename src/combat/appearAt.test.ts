import { describe, expect, it } from "vitest";
import { appearAt } from "./appearAt";

describe("appearAt", () => {
  const arena = { min: 0, max: 400 };
  const reach = { past: 50, near: 30 };

  it("comes out past him on the side he flies to, facing him", () => {
    expect(appearAt(100, { x: 200 }, reach, arena, 1)).toEqual({ x: 250, facing: -1 });
    expect(appearAt(300, { x: 200 }, reach, arena, -1)).toEqual({ x: 150, facing: 1 });
  });

  it("goes by the way he moves, not away from the attacker: off a wall he comes back", () => {
    expect(appearAt(300, { x: 200, goes: 1 }, reach, arena, -1)).toEqual({ x: 250, facing: -1 });
    expect(appearAt(100, { x: 200, goes: -1 }, reach, arena, 1)).toEqual({ x: 150, facing: 1 });
  });

  it("off a wall comes out between it and him, whichever way he goes: he is sent across, not back into it", () => {
    // behind his flight: the blow's middle on him, as he flies off from it
    expect(appearAt(300, { x: 100, goes: 1, wall: -1 }, reach, arena, -1)).toEqual({ x: 70, facing: 1 });
    expect(appearAt(100, { x: 300, goes: -1, wall: 1 }, reach, arena, 1)).toEqual({ x: 330, facing: -1 });
  });

  it("comes out between him and the wall, as far as it lets him, wherever his blow's middle still reaches", () => {
    expect(appearAt(100, { x: 360 }, reach, arena, 1)).toEqual({ x: 400, facing: -1 });
    expect(appearAt(300, { x: 30, goes: -1 }, reach, arena, -1)).toEqual({ x: 0, facing: 1 });
  });

  it("comes out on the near side where not even that fits, closer, his blow's middle on him", () => {
    expect(appearAt(100, { x: 380 }, reach, arena, 1)).toEqual({ x: 350, facing: 1 });
    expect(appearAt(300, { x: 20, goes: -1 }, reach, arena, -1)).toEqual({ x: 50, facing: -1 });
  });

  it("takes his own facing where he stands on him", () => {
    expect(appearAt(200, { x: 200 }, reach, arena, -1)).toEqual({ x: 150, facing: 1 });
  });
});
