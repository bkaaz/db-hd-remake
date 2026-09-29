import { describe, expect, it } from "vitest";
import {
  animationsWithNoState,
  chainLinks,
  entriesOf,
  framesOf,
  openings,
  unassigned,
  type AnimSteps,
} from "./chains";
import { startupOf } from "./swing";
import type { StatesFile } from "../entity/states";

/** 4 frames of wind-up, 4 with a hit box, 4 of recovery. */
const swing: AnimSteps = {
  steps: [
    { dur: 4, boxes: [{ type: "hurt" }] },
    { dur: 4, boxes: [{ type: "hit" }] },
    { dur: 4, boxes: [{ type: "hurt" }] },
  ],
};
const anims: Record<string, AnimSteps> = { attack: swing, blast: swing, smash: swing };

function file(): StatesFile {
  return {
    initial: "idle",
    states: {
      idle: { anim: "idle", transitions: [] },
      hurt: { anim: "hurt", rank: 1, vel: [-1, 0] },
      floored: { anim: "hurt", rank: 3 },
      a: {
        anim: "attack",
        hitstun: 20,
        cancelBy: 8,
        onHit: "hurt",
        transitions: [{ when: ["cancelable", "pressed:blast"], to: "b" }],
      },
      b: {
        anim: "blast",
        hitstun: 20,
        cancelBy: 8,
        onHit: "hurt",
        transitions: [{ when: ["cancelable", "pressed:smash"], to: "c" }],
      },
      c: { anim: "smash", hitstun: 20, onHit: "floored", transitions: [] },
    },
  };
}

describe("chainLinks", () => {
  it("finds only the transitions that are cancels", () => {
    const f = file();
    f.states.idle.transitions = [{ when: "pressed:attack", to: "a" }];
    expect(chainLinks(f, anims, 12).map((l) => `${l.from}→${l.to}`)).toEqual(["a→b", "b→c"]);
  });

  it("names the button, because two cancels out of one attack differ only by it", () => {
    const f = file();
    f.states.a.transitions = [
      { when: ["cancelable", "pressed:blast"], to: "b" },
      { when: ["cancelable", "pressed:smash"], to: "c" },
    ];
    expect(chainLinks(f, anims, 12).map((l) => `${l.on}→${l.to}`)).toContain("smash→c");
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
      anim: "attack",
      hitstun: 20,
      cancelBy: 8,
      onHit: "hurt",
      transitions: [{ when: ["cancelable", "pressed:blast"], to: "a" }],
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
    f.states.c.transitions = [{ when: ["cancelable", "pressed:attack"], to: "a" }];
    expect(() => chainLinks(f, anims, 12)).not.toThrow();
  });
});

describe("entriesOf", () => {
  it("names the ways into a string that are not cancels", () => {
    const f = file();
    f.states.idle.transitions = [{ when: "pressed:attack", to: "a" }];
    f.states.crouch = { anim: "crouch", transitions: [{ when: "pressed:blast", to: "b" }] };
    expect(entriesOf(f)).toEqual([
      { to: "a", from: "idle", when: "pressed:attack" },
      { to: "b", from: "crouch", when: "pressed:blast" },
    ]);
  });

  it("spells out a conjunction, because that is the input", () => {
    const f = file();
    f.states.idle.transitions = [{ when: ["held:down", "pressed:smash"], to: "c" }];
    expect(entriesOf(f)[0].when).toBe("held:down + pressed:smash");
  });

  it("ignores links between attacks — those are cancels, not ways in", () => {
    const f = file();
    f.states.idle.transitions = [{ when: "pressed:attack", to: "a" }];
    // a → b is a cancel and already in the graph; it must not be listed twice.
    expect(entriesOf(f).map((e) => e.to)).toEqual(["a"]);
  });

  it("says nothing about a state nothing leads to", () => {
    const f = file();
    f.states.idle.transitions = [{ when: "pressed:attack", to: "hurt" }];
    expect(entriesOf(f)).toEqual([]);
  });
});

describe("openings", () => {
  it("gathers the neutral states that open the same attack the same way", () => {
    const f = file();
    f.states.idle.transitions = [{ when: "pressed:attack", to: "a" }];
    f.states.walk = { anim: "walk", transitions: [{ when: "pressed:attack", to: "a" }] };
    expect(openings(f)).toEqual([{ to: "a", when: "pressed:attack", from: ["idle", "walk"] }]);
  });

  it("keeps two different inputs apart", () => {
    const f = file();
    f.states.idle.transitions = [
      { when: "pressed:attack", to: "a" },
      { when: ["held:down", "pressed:attack"], to: "b" },
    ];
    expect(openings(f).map((o) => o.when)).toEqual(["pressed:attack", "held:down + pressed:attack"]);
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

describe("unassigned", () => {
  it("names the attacks nothing leads to, and only those", () => {
    const f = file();
    // `a` is opened from idle, `b` and `c` are cancelled into: all three are
    // reachable, so nothing is waiting.
    f.states.idle.transitions = [{ when: "pressed:attack", to: "a" }];
    expect(unassigned(f)).toEqual([]);

    // A move that exists and nothing reaches — the state the moveset pass
    // leaves behind, and the one that has no arrow to notice it by.
    f.states.parked = { anim: "smash", hitstun: 20, onHit: "hurt", transitions: [] };
    expect(unassigned(f)).toEqual(["parked"]);
  });

  it("does not count a state that is not an attack", () => {
    // `hurt` and `floored` are reached by `onHit`, never by a transition, so a
    // rule about transitions alone would report both as waiting for a button.
    const f = file();
    f.states.idle.transitions = [{ when: "pressed:attack", to: "a" }];
    expect(unassigned(f)).not.toContain("hurt");
    expect(unassigned(f)).not.toContain("floored");
  });
});

describe("animationsWithNoState", () => {
  it("names an animation nothing plays", () => {
    // The case it was written for: a state was deleted and its animation stayed,
    // which leaves no trace in states.json for anyone to notice.
    const f = file();
    expect(animationsWithNoState(f, anims)).toEqual([]);
    expect(animationsWithNoState(f, { ...anims, parked: swing })).toEqual(["parked"]);
  });
});
