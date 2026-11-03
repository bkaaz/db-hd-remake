import { describe, expect, it } from "vitest";
import { Round, type Announcement, type Contender } from "./round";

const STATES = { ko: "ko_rise", down: "ko_down", win: ["win", "win_air"] };

function fighter(health = 400): Contender & { health: number; state: string; heard: string[] } {
  return {
    health,
    state: "idle",
    heard: [],
    get standing() {
      return this.state === "idle";
    },
    get atFullSpeed() {
      return this.state === "ko_lie";
    },
    roundStates: STATES,
    forceState(name: string) {
      this.state = name;
      return true;
    },
    sound(id: string) {
      this.heard.push(id);
    },
  };
}

function round(dice = 0) {
  const shown: Announcement[] = [];
  const played: string[] = [];
  const r = new Round({ announce: (a) => shown.push(a), sound: (s) => played.push(s), random: () => dice });
  return { r, shown, played };
}

/** Frames of the round with nothing in the air. */
function run(r: Round, fighters: Contender[], frames: number, on = true): void {
  for (let i = 0; i < frames; i++) r.step(fighters, on, true);
}

describe("Round", () => {
  it("knocks out whoever has no health left, with the burst before his voice", () => {
    const { r } = round();
    const [a, b] = [fighter(), fighter(0)];
    r.step([a, b], true, true);
    expect([a.state, b.state]).toEqual(["idle", "ko_rise"]);
    expect(b.heard).toEqual(["burst_0a"]);
  });

  it("does nothing with the switch off: health floors at zero as before", () => {
    const { r } = round();
    const b = fighter(0);
    r.step([fighter(), b], false, true);
    expect(b.state).toBe("idle");
    expect(r.now).toBe("fight");
  });

  it("skips every odd frame from the KO until a state at full speed", () => {
    const { r } = round();
    const b = fighter(0);
    expect(r.skips(1)).toBe(false);
    r.step([fighter(), b], true, true);
    expect([r.skips(1), r.skips(2)]).toEqual([true, false]);
    b.state = "ko_bounce";
    r.step([fighter(), b], true, true);
    expect(r.skips(1)).toBe(true);
    b.state = "ko_lie";
    r.step([fighter(), b], true, true);
    expect(r.skips(1)).toBe(false);
  });

  it("ends the half speed once he lies done, with no state at full speed before it (Vegeta's)", () => {
    const { r } = round();
    const [a, b] = [fighter(), fighter(0)];
    r.step([a, b], true, true);
    b.state = "ko_down";
    a.state = "walk_fwd";
    r.step([a, b], true, true);
    expect(r.skips(1)).toBe(false);
  });

  it("waits for him to lie done and the other to stand, and for the air to clear", () => {
    const { r, shown } = round();
    const [a, b] = [fighter(), fighter(0)];
    run(r, [a, b], 1);
    b.state = "ko_down";
    a.state = "walk_fwd";
    run(r, [a, b], 1);
    expect(shown).toEqual([]);
    a.state = "idle";
    r.step([a, b], true, false);
    expect(shown).toEqual([]);
    run(r, [a, b], 1);
    expect(shown).toEqual(["ko"]);
    expect(r.holds).toBe(true);
  });

  it("puts the winner in his pose once the announcement is gone, its sound twice on the way", () => {
    const { r, played } = round();
    const [a, b] = [fighter(), fighter(0)];
    run(r, [a, b], 1);
    b.state = "ko_down";
    run(r, [a, b], 1);
    run(r, [a, b], 79);
    expect([a.state, played]).toEqual(["idle", ["hit_09", "hit_09"]]);
    run(r, [a, b], 1);
    expect(a.state).toBe("win");
    expect(b.state).toBe("ko_down");
    expect(r.now).toBe("win");
    expect(r.decided).toBe(true);
  });

  it("picks the winner's pose at random among his", () => {
    const { r } = round(0.75);
    const [a, b] = [fighter(), fighter(0)];
    run(r, [a, b], 1);
    b.state = "ko_down";
    run(r, [a, b], 81);
    expect(a.state).toBe("win_air");
  });

  it("calls both down a draw: DOUBLE K.O., one sound, and nobody's pose", () => {
    const { r, shown, played } = round();
    const [a, b] = [fighter(0), fighter(0)];
    run(r, [a, b], 1);
    a.state = b.state = "ko_down";
    run(r, [a, b], 81);
    expect([shown, played]).toEqual([["double_ko"], ["hit_09"]]);
    expect(r.now).toBe("over");
    expect([a.state, b.state]).toEqual(["ko_down", "ko_down"]);
  });

  it("never knocks out a fighter with no states for it", () => {
    const { r } = round();
    const b = { ...fighter(0), roundStates: undefined };
    r.step([fighter(), b], true, true);
    expect(r.now).toBe("fight");
    expect(r.skips(1)).toBe(false);
  });
});
