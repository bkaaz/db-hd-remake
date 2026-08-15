import { describe, expect, it, vi } from "vitest";
import type { Entity } from "../entity/entity";
import { landBlow, type BlowContext } from "./blow";

/**
 * `landBlow` names an `Entity` only as a type — at run time it reaches for two
 * pure functions and nothing else — so the whole of it runs in Node against two
 * stand-ins. That is worth knowing: this is the file where "what a connection
 * costs" is decided, and until now none of it could be checked without a
 * browser.
 *
 * The stand-ins answer only what a blow asks. Anything a test does not care
 * about is a spy, so a rule that starts asking a new question fails here loudly
 * rather than passing on a default.
 */

/** One body, standing at the origin, with a box of `type` covering 0..10. */
function body(type: "hit" | "hurt", extra: Partial<Entity> = {}): Entity {
  const stub = {
    canHit: true,
    invulnerable: false,
    guarding: false,
    facing: 1 as const,
    state: "idle",
    placement: { x: 0, y: 0, facing: 1 as const, scale: 1 },
    boxes: (want: string) => (want === type ? [{ type, x: 0, y: -10, w: 10, h: 10 }] : []),
    attackDamage: 7,
    attackHitstop: 6,
    attackReaction: "hurt",
    attackSmash: false,
    attackHitstun: 12,
    attackFx: "spark_1",
    attackSounds: { hit: "hit_1", block: "block_1" },
    markHit: vi.fn(),
    hurtBy: vi.fn(),
    gotHit: vi.fn(),
    guardHit: vi.fn(() => true),
    freeze: vi.fn(),
    ...extra,
  };
  return stub as unknown as Entity;
}

const context = (): BlowContext =>
  ({ audio: { play: vi.fn() }, effects: { spawn: vi.fn() } }) as unknown as BlowContext;

describe("landBlow", () => {
  it("connects when a hit box reaches a hurt box", () => {
    const attacker = body("hit");
    const defender = body("hurt");
    const result = landBlow(attacker, defender, context());
    expect(result).not.toBeNull();
    expect(defender.hurtBy).toHaveBeenCalledWith(7);
    expect(defender.gotHit).toHaveBeenCalledWith({
      reaction: "hurt",
      smash: false,
      hitstun: 12,
    });
  });

  describe("an invulnerable defender", () => {
    // Being on the floor, and getting up off it. Rank already stops a blow
    // interrupting; this is what stops it costing health while the victim can
    // neither block nor move.
    const attack = (): [Entity, Entity] => [body("hit"), body("hurt", { invulnerable: true })];

    it("is not hit at all — no damage, no reaction", () => {
      const [attacker, defender] = attack();
      expect(landBlow(attacker, defender, context())).toBeNull();
      expect(defender.hurtBy).not.toHaveBeenCalled();
      expect(defender.gotHit).not.toHaveBeenCalled();
    });

    it("does not spend the swing — the same active frames may still land", () => {
      const [attacker, defender] = attack();
      landBlow(attacker, defender, context());
      expect(attacker.markHit).not.toHaveBeenCalled();
    });

    it("leaves no spark and makes no noise", () => {
      const [attacker, defender] = attack();
      const ctx = context();
      landBlow(attacker, defender, ctx);
      expect(ctx.effects.spawn).not.toHaveBeenCalled();
      expect(ctx.audio.play).not.toHaveBeenCalled();
    });

    it("freezes nobody, so the attacker keeps swinging through", () => {
      const [attacker, defender] = attack();
      landBlow(attacker, defender, context());
      expect(attacker.freeze).not.toHaveBeenCalled();
      expect(defender.freeze).not.toHaveBeenCalled();
    });
  });

  it("tells the defender when the blow may lift them", () => {
    const attacker = body("hit", { attackSmash: true });
    const defender = body("hurt");
    landBlow(attacker, defender, context());
    expect(defender.gotHit).toHaveBeenCalledWith(expect.objectContaining({ smash: true }));
  });

  it("hands over how long the blow holds, not how long the pose lasts", () => {
    const attacker = body("hit", { attackHitstun: 20 });
    const defender = body("hurt");
    landBlow(attacker, defender, context());
    expect(defender.gotHit).toHaveBeenCalledWith(expect.objectContaining({ hitstun: 20 }));
  });

  it("costs a blocking defender nothing", () => {
    const attacker = body("hit");
    const defender = body("hurt", { guarding: true });
    const result = landBlow(attacker, defender, context());
    expect(result?.blocked).toBe(true);
    expect(result?.damage).toBe(0);
    expect(defender.hurtBy).not.toHaveBeenCalled();
  });
});
