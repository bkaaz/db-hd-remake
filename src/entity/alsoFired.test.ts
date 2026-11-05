import { describe, expect, it } from "vitest";
import { alsoFired } from "./alsoFired";

const place = (at: [number, number]) => ({ x: 100 - at[0] * 2, y: 200 + at[1] * 2 });

describe("alsoFired", () => {
  it("places each by the thrower's own rule", () => {
    const fires = { spawn: "ball", at: [0, 0] as [number, number], also: [{ at: [10, -5] as [number, number] }, { at: [-10, 3] as [number, number] }] };
    expect(alsoFired(fires, place).map((b) => [b.x, b.y])).toEqual([[80, 190], [120, 206]]);
  });

  it("takes the first bolt's spawn and state unless it names its own", () => {
    const fires = {
      spawn: "ball",
      state: "fly",
      at: [0, 0] as [number, number],
      also: [{ at: [1, 0] as [number, number] }, { at: [2, 0] as [number, number], spawn: "other", state: "drop" }],
    };
    const [same, own] = alsoFired(fires, place);
    expect([same.spawn, same.state]).toEqual(["ball", "fly"]);
    expect([own.spawn, own.state]).toEqual(["other", "drop"]);
  });

  it("is nothing for a state with one bolt", () => {
    expect(alsoFired({ spawn: "ball", at: [0, 0] }, place)).toEqual([]);
  });
});
