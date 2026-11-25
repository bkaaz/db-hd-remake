import { describe, expect, it } from "vitest";
import { queryFor, requestFromUrl, sameBut, type DebugRequest } from "./scene";

const read = (query: string) => requestFromUrl(new URL(`http://localhost/${query}`));

describe("scene requests", () => {
  it("runs the debug scene on the grid unless an arena is named", () => {
    expect(read("?scene=debug")).toEqual({ scene: "debug", p1: "goku", p2: "goku", mode: 0 });
  });

  it("takes an arena and its lighting from the address", () => {
    expect(read("?scene=debug&arena=tournament&time=night")).toMatchObject({ arena: "tournament", time: "night" });
  });

  it("starts player one at the health asked for, and refuses one that is not a whole number", () => {
    expect(read("?scene=debug&hp1=100&hp2=50")).toMatchObject({ hp1: 100, hp2: 50 });
    expect(read("?scene=debug&hp2=lots")).toBe('hp2 "lots" is not a whole number of health, 1 or more');
    expect(read("?scene=debug&hp1=0")).toMatch(/not a whole number/);
  });

  it("takes either player's colours, 1, 2 or a set's name, and refuses any other", () => {
    expect(read("?scene=debug&pal1=2&pal2=gold")).toMatchObject({ pal1: "2", pal2: "gold" });
    expect(read("?scene=debug&pal2=3")).toBe('pal2 "3" is not a set of colours — 1, 2 or a set\'s name');
  });

  it("takes player one's rush as three animations, and refuses any other count", () => {
    expect(read("?scene=debug&rush1=m92,m93_short,ma5_kick")).toMatchObject({ rush1: "m92,m93_short,ma5_kick" });
    expect(read("?scene=debug&rush1=m92,m93")).toMatch(/not three animations/);
  });

  it("tells a request that differs only by one parameter from one that asks for another scene", () => {
    const base = read("?scene=debug&p1=goku&p2=vegeta&mode=0") as DebugRequest;
    expect(sameBut({ ...base, rush1: "m90,m91,m92" }, base, "rush1")).toBe(true);
    expect(sameBut({ ...base, rush1: "m90,m91,m92", p1: "cell" }, base, "rush1")).toBe(false);
    expect(sameBut({ ...base, hp1: 80 }, base, "rush1")).toBe(false);
  });

  it("refuses a lighting without an arena to have it", () => {
    expect(read("?scene=debug&time=night")).toBe('time "night" needs an arena');
  });

  it("writes a request back to the same address", () => {
    for (const query of ["?scene=debug&p1=goku&p2=goku&mode=2", "?scene=debug&p1=goku&p2=goku&mode=0&arena=tournament&time=evening", "?scene=debug&p1=goku&p2=goku&mode=0&hp1=100&hp2=50", "?scene=debug&p1=goku&p2=vegeta&mode=0&pal1=2&pal2=gold", "?scene=debug&p1=goku&p2=goku&mode=0&rush1=m90%2Cm91%2Cm92"]) {
      const request = read(query);
      if (typeof request === "string") throw new Error(request);
      expect(queryFor(request)).toBe(query);
    }
  });
});
