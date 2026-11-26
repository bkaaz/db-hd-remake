import { describe, expect, it } from "vitest";
import type { StatesFile } from "../entity/states";
import { withCharge } from "./smashCharge";
import type { AnimSteps } from "./swing";

const hit = { type: "hit" };
/** S3: a 5-frame wind-up, the hit box, a recovery. */
const anims: Record<string, AnimSteps> = { s3: { steps: [{ dur: 5 }, { dur: 6, boxes: [hit] }, { dur: 9 }] } };
const file: StatesFile = {
  initial: "idle",
  states: {
    idle: { anim: "s3", transitions: [] },
    reel_high: { anim: "s3", launch: [-0.75, -7.5], transitions: [] },
    smash_3: {
      anim: "s3",
      type: "high",
      damage: 30,
      transitions: [
        { when: ["cancelable", "pressed:blast"], to: "kame_up" },
        { when: "animEnd", to: "idle" },
      ],
    },
  },
};
const made = withCharge(file, anims, "smash_3");
const exits = (s: string) => (made.states[s].transitions ?? []).map((t) => `${[t.when].flat().join("+")}>${t.to}`);
/** Where holding Smash from S3's start for `frames` goes, with `ki` to spend: the level let go, or where it still holds. `Infinity`: never let go. */
function heldFor(frames: number, combo = false, ki = 60): string {
  return heldForAt(frames, combo, ki)[0];
}
/** `heldFor`, with the frame of S3 it let go on. */
function heldForAt(frames: number, combo = false, ki = 60): [string, number] {
  let state = "smash_3";
  let inState = 0;
  for (let f = 0; f <= Math.min(frames, 1000); f++, inState++) {
    const held = f < frames;
    const next = (made.states[state].transitions ?? []).find((t) =>
      (made.states[t.to]?.cost ?? 0) <= ki &&
      [t.when].flat().every((w) => {
        if (w === "held:smash") return held;
        if (w === "!held:smash") return !held;
        if (w === "combo") return combo;
        if (w.startsWith("frames:")) return inState >= Number(w.slice(7));
        if (w.startsWith("!frames:")) return inState < Number(w.slice(8));
        if (w.startsWith("!ki:")) return ki < Number(w.slice(4));
        return false;
      }),
    );
    if (next) [state, inState, ki] = [next.to, 0, ki - (made.states[next.to].cost ?? 0)];
    if (state.includes("_lv")) return [state, f];
  }
  return [state, frames];
}

describe("withCharge", () => {
  it("stops on the wind-up's pose while Smash is held, before the hit box is out", () => {
    expect(exits("smash_3").slice(2, 4)).toEqual(["frames:3+!frames:5+held:smash+combo>smash_3_charge_1_combo", "frames:3+!frames:5+held:smash>smash_3_charge_0"]);
    expect(made.states.smash_3_charge_0).toMatchObject({ anim: "s3", holdStep: 0 });
  });

  it("starts no charge on a press held once the blow is out, or it would strike twice", () => {
    // let go at once, pressed again from the frame the hit box is out (owner's recording, 2026-11-26)
    let state = "smash_3";
    for (let f = 0; f < 30; f++) {
      const next = (made.states[state].transitions ?? []).find((t) =>
        [t.when].flat().every((w) => {
          if (w === "held:smash") return f >= 5;
          if (w.startsWith("frames:")) return f >= Number(w.slice(7));
          if (w.startsWith("!frames:")) return f < Number(w.slice(8));
          return false;
        }),
      );
      if (next) state = next.to;
    }
    expect(state).toBe("smash_3");
  });

  it("leaves a tap a plain S3: let go before the first level, it is worth what S3 is", () => {
    expect(heldFor(2)).toBe("smash_3");
    expect(heldFor(8)).toBe("smash_3_lv0");
    expect(made.states.smash_3_lv0.damage).toBe(30);
  });

  it("reaches each level at its frame standing, and lets go by itself at the top", () => {
    expect([heldFor(12), heldFor(30), heldFor(50), heldFor(Infinity)]).toEqual(["smash_3_lv1", "smash_3_lv2", "smash_3_lv3", "smash_3_lv3"]);
  });

  it("starts a level up in a combo, the second a few frames on", () => {
    expect(heldFor(4, true)).toBe("smash_3_lv1");
    expect(heldFor(9, true)).toBe("smash_3_lv2");
  });

  it("is worth more and lifts higher each level, the top whitening the screen", () => {
    const lv = [1, 2, 3].map((n) => made.states[`smash_3_lv${n}`]);
    expect(lv.map((s) => s.damage)).toEqual([38, 45, 54]);
    expect(lv.map((s) => s.launches?.reel_high?.[1])).toEqual([-8.25, -9, -10.12]);
    expect(lv.map((s) => s.hitFlash)).toEqual([undefined, undefined, 8]);
  });

  it("costs ki each level past the first, and lets go at once with the level he has where the next is not to be paid for", () => {
    expect([0, 1, 2, 3].map((n) => made.states[`smash_3_charge_${n}`].cost)).toEqual([undefined, undefined, 5, 5]);
    expect(made.states.smash_3_charge_1_combo.cost).toBeUndefined();
    // the frame after the level is reached, held all the while: not the top's time
    expect(heldForAt(Infinity, false, 7)).toEqual(["smash_3_lv2", 26]);
    expect(heldForAt(Infinity, false, 0)).toEqual(["smash_3_lv1", 11]);
    expect(heldForAt(Infinity, true, 0)).toEqual(["smash_3_lv1", 4]);
    expect(heldForAt(Infinity)).toEqual(["smash_3_lv3", 60]);
  });

  it("blocks every blow while he holds, from the pose on, for ki", () => {
    for (const n of ["0", "1", "1_combo", "2", "3"]) expect(made.states[`smash_3_charge_${n}`].braces).toBe(5);
    expect(made.states.smash_3.braces).toBeUndefined();
  });

  it("does nothing on a hold but let go: the release keeps S3's own ways out", () => {
    for (const n of [0, 1, 2, 3]) expect(exits(`smash_3_charge_${n}`)[0]).toBe(`!held:smash>smash_3_lv${n}`);
    expect(exits("smash_3_lv2")).toEqual(["cancelable+pressed:blast>kame_up", "animEnd>idle"]);
  });

  it("blinks from the first level, faster each level, the second reached with a sound", () => {
    expect([0, 1, 2, 3].map((n) => made.states[`smash_3_charge_${n}`].blinks)).toEqual([undefined, 6, 4, 2]);
    expect([0, 1, 2, 3].map((n) => made.states[`smash_3_charge_${n}`].sound)).toEqual([undefined, undefined, "ball_2d", undefined]);
    expect(made.states.smash_3_charge_1_combo.sound).toBeUndefined();
  });

  it("lifts a tap low, so he is soon down", () => {
    expect(made.states.smash_3.launches?.reel_high).toEqual([-0.75, -3.75]);
    expect(made.states.smash_3_lv0.launches?.reel_high).toEqual([-0.75, -3.75]);
  });

  it("plays the charge fast with RB held, the world still, into the top: for the whole charge and a bar more", () => {
    expect(exits("smash_3").slice(0, 2)).toEqual(["held:boost+!frames:1+ki:20>smash_3_boost_1", "held:boost+!frames:1>smash_3_lv0"]);
    expect([1, 2, 3].map((n) => exits(`smash_3_boost_${n}`))).toEqual([["frames:6>smash_3_boost_2"], ["frames:6>smash_3_boost_3"], ["frames:6>smash_3_max"]]);
    expect([1, 2, 3].reduce((sum, n) => sum + (made.states[`smash_3_boost_${n}`].cost ?? 0), 0)).toBe(20);
    expect(made.states.smash_3_boost_1.freezesFoe).toBe(18);
    expect(made.states.smash_3_max).toMatchObject({ damage: made.states.smash_3_lv3.damage, hitFlash: 8 });
    expect(made.states.smash_3_max.launches).toEqual(made.states.smash_3_lv3.launches);
  });

  it("adds nothing of the boost's own: each level's flash and sound, as the charge by hand has them", () => {
    for (const n of [1, 2, 3]) {
      const fast = made.states[`smash_3_boost_${n}`];
      const slow = made.states[`smash_3_charge_${n}`];
      expect([fast.blinks, fast.sound]).toEqual([slow.blinks, slow.sound]);
    }
    expect([made.states.smash_3_max.blinks, made.states.smash_3_max.sound]).toEqual([undefined, undefined]);
  });

  it("breaks off the ki charge (LB) into the blow, the direction + Smash asking", () => {
    const charging = withCharge({ ...file, states: { ...file.states, charge: { anim: "s3", transitions: [{ when: "animEnd", to: "idle" }] } } }, anims, "smash_3");
    expect(charging.states.charge.transitions?.[0]).toEqual({ when: ["held:down", "!held:fwd", "!held:back", "pressed:smash"], to: "smash_3" });
    expect(withCharge(charging, anims, "smash_3")).toEqual(charging);
  });

  it("is the same made again over itself", () => {
    expect(withCharge(made, anims, "smash_3")).toEqual(made);
  });

  it("stops on the wind-up's last pose, the one before the blow, where it has more than one", () => {
    const two = { s3: { steps: [{ dur: 5 }, { dur: 5 }, { dur: 6, boxes: [hit] }, { dur: 9 }] } };
    const charged = withCharge(file, two, "smash_3");
    expect(charged.states.smash_3_charge_0.holdStep).toBe(1);
    expect(charged.states.smash_3.transitions?.[3]).toEqual({ when: ["frames:8", "!frames:10", "held:smash"], to: "smash_3_charge_0" });
  });

  it("stops on the step named, crouching before a leap, the rest of the wind-up played once let go", () => {
    // crouch 4, leap 2, blow 6: stopped crouching, the blow 2 frames after he lets go
    const leap = { s3: { steps: [{ dur: 2 }, { dur: 4 }, { dur: 2 }, { dur: 6, boxes: [hit] }, { dur: 4 }] } };
    const crouched = withCharge(file, leap, "smash_3", 1);
    expect(crouched.states.smash_3_charge_0.holdStep).toBe(1);
    expect(crouched.states.smash_3.transitions?.[3]).toEqual({ when: ["frames:4", "!frames:6", "held:smash"], to: "smash_3_charge_0" });
    expect(() => withCharge(file, leap, "smash_3", 3)).toThrow(/too short to stop on/);
  });

  it("will not charge a wind-up too short to stop on", () => {
    expect(() => withCharge(file, { s3: { steps: [{ dur: 2 }, { dur: 6, boxes: [hit] }] } }, "smash_3")).toThrow(/too short to stop on/);
  });
});

describe("withCharge on S1", () => {
  const s1File: StatesFile = {
    initial: "idle",
    states: {
      idle: { anim: "s3", transitions: [] },
      hurt_heavy: { anim: "s3", transitions: [] },
      sent_off: { anim: "s3", launch: [-4, -2.5], transitions: [] },
      smash_1: { anim: "s3", type: "stagger", damage: 30, transitions: [{ when: "animEnd", to: "idle" }] },
    },
  };
  const s1 = withCharge(s1File, anims, "smash_1");

  it("leaves a tap the blow it was, and sends him off flat from the first level, further each level", () => {
    expect(s1.states.smash_1).toMatchObject({ type: "stagger" });
    expect(s1.states.smash_1.launches).toBeUndefined();
    expect(s1.states.smash_1_lv0.type).toBe("stagger");
    expect([1, 2, 3].map((n) => s1.states[`smash_1_lv${n}`].type)).toEqual(["sendoff", "sendoff", "sendoff"]);
    expect([1, 2, 3].map((n) => s1.states[`smash_1_lv${n}`].launches?.sent_off)).toEqual([[-4, -2.5], [-5, -2.75], [-6.4, -3]]);
  });

  it("is charged under its own names, the way in on S1", () => {
    expect(s1.states.smash_1.transitions?.[3]).toEqual({ when: ["frames:3", "!frames:5", "held:smash"], to: "smash_1_charge_0" });
    expect(s1.states.smash_1_charge_3.transitions?.[0]).toEqual({ when: "!held:smash", to: "smash_1_lv3" });
  });

  it("holds the kick out and drives him forward on it, further and faster each level, raising dust", () => {
    // the fixture's animation: its blow is step 1, 6 frames long, after 5 of wind-up
    const reach = (st: string) => {
      const [[, speed], [until]] = s1.states[st].velAt!;
      return speed * (until - s1.states[st].velAt![0][0]);
    };
    expect(s1.states.smash_1).toMatchObject({ holdStep: 1, holdFrames: 5 + 6 + 6, trail: { fx: "dust", from: 5, to: 17 } });
    const levels = [0, 1, 2, 3].map((n) => reach(`smash_1_lv${n}`));
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(new Set(levels).size).toBe(4);
    expect(s1.states.smash_1_lv2.velAt![0][1]).toBeGreaterThan(s1.states.smash_1_lv1.velAt![0][1]);
  });

  it("holds the blow's last pose where it has more than one, the knee at its highest", () => {
    const knee = { s3: { steps: [{ dur: 4 }, { dur: 6, boxes: [hit] }, { dur: 6, boxes: [hit] }, { dur: 4 }] } };
    const kneed = withCharge(s1File, knee, "smash_1");
    expect(kneed.states.smash_1).toMatchObject({ holdStep: 2, holdFrames: 4 + 6 + 6 + 6 });
  });

  it("hops Smash alone higher each level and takes him up along, a lift at every level", () => {
    const plain = withCharge({ ...s1File, states: { ...s1File.states, smash: { ...s1File.states.smash_1, type: "heavy" } } }, anims, "smash");
    const rises = [0, 1, 2, 3].map((n) => (plain.states[`smash_lv${n}`].air![0][1] as { vy: number }).vy);
    expect(rises).toEqual([...rises].sort((a, b) => b - a));
    expect(new Set(rises).size).toBe(4);
    expect([0, 1, 2, 3].map((n) => [plain.states[`smash_lv${n}`].type, plain.states[`smash_lv${n}`].carries])).toEqual(Array(4).fill(["lift", true]));
    // the blow spent, a jump's moves in the air: no chain of the air's own
    expect(plain.states.smash_lv2.inputsOf).toEqual({ state: "jump_fall", only: "buttons", from: 6 });
    // off the floor a frame before the blow is out, so it has a flight to take him on
    expect(plain.states.smash.air![0][0]).toBe(4);
  });

  it("leaves S3 where he stands", () => {
    expect(made.states.smash_3_lv3.velAt).toBeUndefined();
  });

  it("leaves S2's tap a knockdown, crumples him from the first level, longer each, the top breaking a guard", () => {
    const s2 = withCharge({ ...s1File, states: { ...s1File.states, smash_2: { ...s1File.states.smash_1, type: "down" } } }, anims, "smash_2");
    expect([0, 1, 2, 3].map((n) => s2.states[`smash_2_lv${n}`].type)).toEqual(["down", "crumple", "crumple_2", "crumple_3"]);
    expect([0, 1, 2, 3].map((n) => s2.states[`smash_2_lv${n}`].breaksGuard)).toEqual([undefined, undefined, undefined, true]);
    expect(s2.states.smash_2_max.breaksGuard).toBe(true);
    // pushed back the less the harder: least where it breaks a guard
    const pushes = [1, 2, 3].map((n) => -(s2.states[`smash_2_lv${n}`].pushes ?? 0));
    expect(pushes).toEqual([...pushes].sort((a, b) => b - a));
    expect(new Set(pushes).size).toBe(3);
  });

  it("charges only the enders it knows how to send", () => {
    expect(() => withCharge(s1File, anims, "rush_1")).toThrow(/does not charge/);
  });
});
