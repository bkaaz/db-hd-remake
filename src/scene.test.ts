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

  it("refuses a lighting without an arena to have it", () => {
    expect(read("?scene=debug&time=night")).toBe('time "night" needs an arena');
  });

  it("writes a request back to the same address", () => {
    for (const query of ["?scene=debug&p1=goku&p2=goku&mode=2", "?scene=debug&p1=goku&p2=goku&mode=0&arena=tournament&time=evening"]) {
      const request = read(query);
      if (typeof request === "string") throw new Error(request);
      expect(queryFor(request)).toBe(query);
    }
  });
});
