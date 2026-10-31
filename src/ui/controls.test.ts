import { describe, expect, it } from "vitest";
import { clock } from "./controls";

describe("clock", () => {
  it("shows minutes and two-digit seconds", () => {
    expect([clock(0), clock(9_999), clock(61_000), clock(600_500)]).toEqual(["0:00", "0:09", "1:01", "10:00"]);
  });
});
