import { describe, expect, it } from "vitest";
import { keepAround } from "./around";

describe("keepAround", () => {
  it("puts the companion at its offset from the bolt, scaled, its floor going with it", () => {
    const spark = { x: 0, y: 0, groundY: 0 };
    keepAround(spark, { x: 100, y: 200 }, [16, -4], 2);
    expect(spark).toEqual({ x: 132, y: 192, groundY: 192 });
  });

  it("follows the bolt as it flies", () => {
    const spark = { x: 0, y: 0, groundY: 0 };
    keepAround(spark, { x: 100, y: 200 }, [-16, 2], 1);
    keepAround(spark, { x: 104, y: 200 }, [-16, 2], 1);
    expect(spark.x).toBe(88);
  });
});
