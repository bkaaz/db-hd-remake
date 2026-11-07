import { describe, expect, it } from "vitest";
import { arrival, LINKED, wayFrom } from "./ways";

const right = { facesLeft: false, rightHalf: false };
const left = { facesLeft: true, rightHalf: false };

describe("wayFrom", () => {
  it("goes sideways round the floor's arenas the way the attacker faces, as the cartridge does from the tournament", () => {
    expect(wayFrom("tournament", "side", right)).toBe("ruins");
    expect(wayFrom("tournament", "side", left)).toBe("plains");
    expect(wayFrom("ruins", "side", right)).toBe("shore");
    expect(wayFrom("shore", "side", right)).toBe("plains");
    expect(wayFrom("plains", "side", left)).toBe("shore");
  });

  it("takes every floor up to the palace, and nowhere down", () => {
    for (const floor of ["plains", "tournament", "ruins", "shore"]) {
      expect(wayFrom(floor, "up", right)).toBe("palace");
      expect(wayFrom(floor, "down", right)).toBeNull();
    }
  });

  it("lets the palace go only down, by the half he stood in", () => {
    expect(wayFrom("palace", "up", right)).toBeNull();
    expect(wayFrom("palace", "side", right)).toBeNull();
    expect(wayFrom("palace", "down", { facesLeft: false, rightHalf: true })).toBe("tournament");
    expect(wayFrom("palace", "down", { facesLeft: true, rightHalf: false })).toBe("plains");
  });

  it("closes every way out of an arena it does not know", () => {
    expect(wayFrom("grid", "side", right)).toBeNull();
  });

  it("names every arena a way reaches among those it loads ahead", () => {
    const from = ["plains", "tournament", "ruins", "shore", "palace"];
    const reached = from.flatMap((a) =>
      (["up", "side", "down"] as const).flatMap((w) =>
        [right, left, { facesLeft: false, rightHalf: true }].map((s) => wayFrom(a, w, s)),
      ),
    );
    for (const to of reached) if (to) expect(LINKED).toContain(to);
  });
});

describe("arrival", () => {
  it("puts the defender ahead of the attacker, the way he was sent", () => {
    const r = arrival(false);
    const l = arrival(true);
    expect(r.defender).toBeGreaterThan(r.attacker);
    expect(l.defender).toBeLessThan(l.attacker);
  });
});
