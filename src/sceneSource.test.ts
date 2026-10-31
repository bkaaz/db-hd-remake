import { describe, expect, it } from "vitest";
import { queryFor } from "./scene";
import { firstRequest } from "./sceneSource";

const at = (query = "") => new URL(`http://localhost:5173/${query}`);
const vegeta = queryFor({ scene: "debug", p1: "vegeta", p2: "goku", mode: 5, arena: "tournament", time: "night" });

describe("firstRequest", () => {
  it("takes the remembered request when the address says nothing", () => {
    expect(firstRequest(at(), vegeta).request).toEqual({ scene: "debug", p1: "vegeta", p2: "goku", mode: 5, arena: "tournament", time: "night" });
  });

  it("lets an address that says anything win over the remembered one", () => {
    expect(firstRequest(at("?scene=debug&p1=goku_old"), vegeta).request).toMatchObject({ p1: "goku_old", p2: "goku_old", mode: 0 });
  });

  it("starts at the default with nothing remembered", () => {
    expect(firstRequest(at(), null).request).toEqual({ scene: "select" });
  });

  it("drops a remembered request that no longer reads, and says so", () => {
    const first = firstRequest(at(), "?scene=debug&mode=x");
    expect(first.request).toEqual({ scene: "select" });
    expect(first.notice).toContain("mode");
  });

  it("still shouts at a bad address", () => {
    expect(firstRequest(at("?scene=nope"), vegeta).request).toContain("unknown scene");
  });
});
