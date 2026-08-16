import { describe, expect, it } from "vitest";
import { chainLinks, entriesOf, framesOf, openings, startupOf, type AnimSteps } from "./chains";
import type { StatesFile } from "../entity/states";

/** 4 frames of wind-up, 4 with a hit box, 4 of recovery. */
const swing: AnimSteps = {
  steps: [
    { dur: 4, boxes: [{ type: "hurt" }] },
    { dur: 4, boxes: [{ type: "hit" }] },
    { dur: 4, boxes: [{ type: "hurt" }] },
  ],
};
const anims: Record<string, AnimSteps> = { light: swing, medium: swing, heavy: swing };

function file(): StatesFile {
  return {
    initial: "idle",
    states: {
      idle: { anim: "idle", transitions: [] },
      hurt: { anim: "hurt", rank: 1, vel: [-1, 0] },
      floored: { anim: "hurt", rank: 3 },
      a: {
        anim: "light",
        hitstun: 20,
        cancelBy: 8,
        onHit: "hurt",
        transitions: [{ when: ["cancelable", "pressed:medium"], to: "b" }],
      },
      b: {
        anim: "medium",
        hitstun: 20,
        cancelBy: 8,
        onHit: "hurt",
        transitions: [{ when: ["cancelable", "pressed:heavy"], to: "c" }],
      },
      c: { anim: "heavy", hitstun: 20, onHit: "floored", transitions: [] },
    },
  };
}

describe("chainLinks", () => {
  it("finds only the transitions that are cancels", () => {
    const f = file();
    f.states.idle.transitions = [{ when: "pressed:light", to: "a" }];
    expect(chainLinks(f, anims, 12).map((l) => `${l.from}→${l.to}`)).toEqual(["a→b", "b→c"]);
  });

  it("names the button, because two cancels out of one attack differ only by it", () => {
    const f = file();
    f.states.a.transitions = [
      { when: ["cancelable", "pressed:medium"], to: "b" },
      { when: ["cancelable", "pressed:heavy"], to: "c" },
    ];
    expect(chainLinks(f, anims, 12).map((l) => `${l.on}→${l.to}`)).toContain("heavy→c");
  });

  it("does the sum a link lives or dies by", () => {
    const [link] = chainLinks(file(), anims, 12);
    // Hit lands on frame 5, cancel allowed to 8 → 4 frames of window; the next
    // attack needs 4 to get its box out; 20 frames of hitstun leave 12 spare.
    expect(link).toMatchObject({ window: 4, startup: 4, worst: 8, hitstun: 20, margin: 12 });
  });

  it("says a link drops rather than quietly passing", () => {
    const f = file();
    f.states.a.hitstun = 6;
    expect(chainLinks(f, anims, 12)[0].margin).toBeLessThan(0);
  });

  it("treats a missing window as the whole animation, which is the usual bug", () => {
    const f = file();
    delete f.states.a.cancelBy;
    // 12 frames long, hit on 5: eight frames of window instead of four.
    expect(chainLinks(f, anims, 12)[0].window).toBe(8);
  });

  it("scales the hitstun by how deep the link is", () => {
    const links = chainLinks(file(), anims, 12);
    expect(links.map((l) => l.depth)).toEqual([0, 1]);
    expect(links[1].hitstun).toBe(18); // 20 with one blow already landed
  });

  it("measures depth by the longest way in, not the first one found", () => {
    // A light that feeds the middle of a string: `b` is reachable in one step
    // and in two, and the two-step route is where scaling has taken the most.
    const f = file();
    f.states.opener = {
      anim: "light",
      hitstun: 20,
      cancelBy: 8,
      onHit: "hurt",
      transitions: [{ when: ["cancelable", "pressed:medium"], to: "a" }],
    };
    const toC = chainLinks(f, anims, 12).find((l) => l.to === "c");
    expect(toC?.depth).toBe(2);
  });

  it("falls back to the entity's hitstun, so an untuned attack is visible", () => {
    const f = file();
    delete f.states.a.hitstun;
    expect(chainLinks(f, anims, 12)[0].hitstun).toBe(12);
  });

  it("marks a link whose own blow floors the victim, where the question does not apply", () => {
    // Helplessness is not in question when the reaction is a knockdown: the
    // chain is over either way, and the victim is on the floor for as long as
    // the fall takes rather than for a number of frames.
    const f = file();
    f.states.b.onHit = "floored";
    expect(chainLinks(f, anims, 12).map((l) => l.launcher)).toEqual([false, true]);
  });

  it("survives a chain authored as a loop", () => {
    const f = file();
    f.states.c.transitions = [{ when: ["cancelable", "pressed:light"], to: "a" }];
    expect(() => chainLinks(f, anims, 12)).not.toThrow();
  });
});

describe("entriesOf", () => {
  it("names the ways into a string that are not cancels", () => {
    const f = file();
    f.states.idle.transitions = [{ when: "pressed:light", to: "a" }];
    f.states.crouch = { anim: "crouch", transitions: [{ when: "pressed:medium", to: "b" }] };
    expect(entriesOf(f)).toEqual([
      { to: "a", from: "idle", when: "pressed:light" },
      { to: "b", from: "crouch", when: "pressed:medium" },
    ]);
  });

  it("spells out a conjunction, because that is the input", () => {
    const f = file();
    f.states.idle.transitions = [{ when: ["held:down", "pressed:heavy"], to: "c" }];
    expect(entriesOf(f)[0].when).toBe("held:down + pressed:heavy");
  });

  it("ignores links between attacks — those are cancels, not ways in", () => {
    const f = file();
    f.states.idle.transitions = [{ when: "pressed:light", to: "a" }];
    // a → b is a cancel and already in the graph; it must not be listed twice.
    expect(entriesOf(f).map((e) => e.to)).toEqual(["a"]);
  });

  it("says nothing about a state nothing leads to", () => {
    const f = file();
    f.states.idle.transitions = [{ when: "pressed:light", to: "hurt" }];
    expect(entriesOf(f)).toEqual([]);
  });
});

describe("openings", () => {
  it("gathers the neutral states that open the same attack the same way", () => {
    const f = file();
    f.states.idle.transitions = [{ when: "pressed:light", to: "a" }];
    f.states.walk = { anim: "walk", transitions: [{ when: "pressed:light", to: "a" }] };
    expect(openings(f)).toEqual([{ to: "a", when: "pressed:light", from: ["idle", "walk"] }]);
  });

  it("keeps two different inputs apart", () => {
    const f = file();
    f.states.idle.transitions = [
      { when: "pressed:light", to: "a" },
      { when: ["held:down", "pressed:light"], to: "b" },
    ];
    expect(openings(f).map((o) => o.when)).toEqual(["pressed:light", "held:down + pressed:light"]);
  });
});

describe("reading an animation", () => {
  it("counts the frames before the hit box appears", () => {
    expect(startupOf(swing)).toBe(4);
    expect(startupOf(undefined)).toBe(0);
  });

  it("counts the whole thing", () => {
    expect(framesOf(swing)).toBe(12);
  });
});
