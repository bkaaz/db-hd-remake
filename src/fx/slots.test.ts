import { describe, expect, it } from "vitest";
import { backToFront } from "./slots";

describe("backToFront", () => {
  it("adds the object put out first last, so it ends up in front", () => {
    expect(backToFront(["dust", "body"])).toEqual(["body", "dust"]);
  });

  it("leaves what it was given as it was", () => {
    const spawned = ["dust", "body"];
    backToFront(spawned);
    expect(spawned).toEqual(["dust", "body"]);
  });
});
