import { describe, expect, it } from "vitest";
import { Opening, readyY } from "./opening";
import type { Contender, RoundWorld } from "./round";

function fighter(intro: string | undefined = "intro"): Contender & { state: string } {
  return {
    health: 400,
    state: "idle",
    get standing() {
      return this.state === "idle";
    },
    atFullSpeed: false,
    roundStates: { intro, ko: "ko_rise", down: "ko_down", win: ["win"] },
    forceState(name: string) {
      this.state = name;
      return true;
    },
    sound() {},
  };
}

function world() {
  const shown: string[] = [];
  const heights: number[] = [];
  const played: string[] = [];
  const w: RoundWorld = {
    announce: (a) => {
      shown.push(a);
      return { at: (y) => heights.push(y) };
    },
    sound: (s) => played.push(s),
  };
  return { w, shown, heights, played };
}

describe("Opening", () => {
  it("is over at once with the switch off, and plays nobody's intro", () => {
    const { w } = world();
    const a = fighter();
    expect(new Opening(w, [a], false).over).toBe(true);
    expect(a.state).toBe("idle");
  });

  it("plays both intros together, and puts READY up only once both stand", () => {
    const { w, shown } = world();
    const [a, b] = [fighter(), fighter()];
    const o = new Opening(w, [a, b], true);
    expect([a.state, b.state]).toEqual(["intro", "intro"]);
    a.state = "idle";
    o.step([a, b]);
    expect(shown).toEqual([]);
    b.state = "idle";
    o.step([a, b]);
    expect(shown).toEqual(["ready"]);
    expect(o.over).toBe(false);
  });

  it("puts READY up as soon as both have left their intro, standing or not: Gotenks's discharges play under it", () => {
    const { w, shown } = world();
    const [a, b] = [fighter(), fighter()];
    const o = new Opening(w, [a, b], true);
    a.state = "idle";
    b.state = "intro_2";
    o.step([a, b]);
    expect(shown).toEqual(["ready"]);
  });

  it("drops READY in, sounds READY and FIGHT!, and is over when it is gone", () => {
    const { w, heights, played } = world();
    const o = new Opening(w, [fighter(undefined)], true);
    for (let i = 0; i < 96; i++) o.step([]);
    expect(o.over).toBe(false);
    o.step([]);
    expect(o.over).toBe(true);
    expect(heights.slice(0, 3)).toEqual([0, 8, 16]);
    expect(played).toEqual(["sfx_4d", "sfx_3a"]);
  });
});

describe("readyY", () => {
  it("falls 8 a tick to 88, past it to 92 and back, then stays", () => {
    expect([readyY(11), readyY(13), readyY(15), readyY(40)]).toEqual([88, 92, 88, 88]);
  });
});
