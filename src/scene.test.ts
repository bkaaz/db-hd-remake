import { describe, expect, it } from "vitest";
import { queryFor, requestFromUrl } from "./scene";

const read = (query: string) => requestFromUrl(new URL(`http://localhost/${query}`));

describe("scene requests", () => {
  it("runs the debug scene on the grid unless an arena is named", () => {
    expect(read("?scene=debug")).toEqual({ scene: "debug", p1: "goku", p2: "goku", mode: 0 });
  });

  it("takes an arena and its lighting from the address", () => {
    expect(read("?scene=debug&arena=tournament&time=night")).toMatchObject({ arena: "tournament", time: "night" });
  });

  it("starts player one at the health asked for, and refuses one that is not a whole number", () => {
    expect(read("?scene=debug&hp=100")).toMatchObject({ hp: 100 });
    expect(read("?scene=debug&hp=lots")).toBe('hp "lots" is not a whole number of health, 1 or more');
    expect(read("?scene=debug&hp=0")).toMatch(/not a whole number/);
  });

  it("refuses a lighting without an arena to have it", () => {
    expect(read("?scene=debug&time=night")).toBe('time "night" needs an arena');
  });

  it("writes a request back to the same address", () => {
    for (const query of ["?scene=debug&p1=goku&p2=goku&mode=2", "?scene=debug&p1=goku&p2=goku&mode=0&arena=tournament&time=evening", "?scene=debug&p1=goku&p2=goku&mode=0&hp=100"]) {
      const request = read(query);
      if (typeof request === "string") throw new Error(request);
      expect(queryFor(request)).toBe(query);
    }
  });
});
