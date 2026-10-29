import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HIT_TYPES, hitTypeErrors, withHitTypes, type HitType } from "./hitTypes";
import { validateStates, type StatesFile } from "../entity/states";

const TYPES: Record<string, HitType> = {
  pop: { code: "po", onHit: "hurt", hitstun: 18, hitstop: 9, relaunch: false },
};

/** An idle, a reaction, and one attack shaped by the caller. */
const fileWith = (attack: StatesFile["states"][string]): StatesFile => ({
  initial: "idle",
  states: {
    idle: { anim: "idle", transitions: [{ when: "pressed:attack", to: "a" }] },
    hurt: { anim: "idle", transitions: [{ when: "stunEnd", to: "idle" }] },
    a: { ...attack, transitions: [{ when: "animEnd", to: "idle" }] },
  },
});

describe("withHitTypes", () => {
  it("spells a type out as the fields it stands for", () => {
    const a = withHitTypes(fileWith({ anim: "jab", type: "pop", damage: 7 }), TYPES).states.a;
    expect(a).toMatchObject({ onHit: "hurt", damage: 7, hitstun: 18, hitstop: 9, relaunch: false });
    expect(a).not.toHaveProperty("code");
  });

  it("leaves what the state owns alone", () => {
    const a = withHitTypes(
      fileWith({ anim: "jab", type: "pop", cancelBy: 11, hitSound: "hit_2", hitFx: "spark_2" }),
      TYPES,
    ).states.a;
    expect(a).toMatchObject({ anim: "jab", cancelBy: 11, hitSound: "hit_2", hitFx: "spark_2" });
  });

  it("leaves a state without a type exactly as written", () => {
    const own = { anim: "jab", damage: 3, onHit: "hurt" };
    expect(withHitTypes(fileWith(own), TYPES).states.a).toMatchObject(own);
  });
});

describe("hitTypeErrors", () => {
  it("accepts a known type beside the blow's own damage", () => {
    expect(hitTypeErrors(fileWith({ anim: "jab", type: "pop", damage: 7 }), TYPES)).toEqual([]);
  });

  it("refuses a typed blow that does not say what it costs", () => {
    // No type and no attribute stands in for it: one place, or a missing
    // number would quietly take one from somewhere else.
    const errors = hitTypeErrors(fileWith({ anim: "jab", type: "pop" }), TYPES);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"damage"');
  });

  it("refuses a type nobody defined", () => {
    const errors = hitTypeErrors(fileWith({ anim: "jab", type: "poke", damage: 7 }), TYPES);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"poke"');
  });

  it("refuses a number beside the type, naming it", () => {
    // The type is the only source of a blow's numbers.
    const errors = hitTypeErrors(fileWith({ anim: "jab", type: "pop", damage: 7, hitstop: 4 }), TYPES);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("hitstop");
  });
});

describe("validateStates with hit types", () => {
  const anims = { idle: { loop: true }, jab: { loop: false } };

  it("reports an unknown type at load", () => {
    const { errors } = validateStates(fileWith({ anim: "jab", type: "nonsense" }), anims);
    expect(errors.some((e) => e.includes('"nonsense"'))).toBe(true);
  });

  it("checks the rest against the spelled-out blow", () => {
    // flinch names `hurt_chain`, which this file lacks — only visible once
    // the type has been spelled out.
    const { warnings } = validateStates(fileWith({ anim: "jab", type: "flinch", damage: 7 }), anims);
    expect(warnings.some((w) => w.includes('"hurt_chain"'))).toBe(true);
  });
});

describe("the shipped types", () => {
  const goku = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../data/entities/goku_old/states.json", import.meta.url)), "utf8"),
  ) as StatesFile;

  it("each name a reaction goku has", () => {
    for (const [name, type] of Object.entries(HIT_TYPES)) {
      expect(goku.states[type.onHit], `${name} → ${type.onHit}`).toBeDefined();
    }
  });

  it("each have a code of two lower-case letters, and no two share one", () => {
    const codes = Object.values(HIT_TYPES).map((t) => t.code);
    for (const code of codes) expect(code).toMatch(/^[a-z]{2}$/);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
