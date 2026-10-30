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
    attackRelaunch: false,
    attackHitstun: 12,
    attackFx: "spark_1",
    attackFlash: 0,
    attackBurst: undefined,
    attackBurns: false,
    attackSounds: { hit: "hit_1", block: "block_1" },
    markHit: vi.fn(),
    travels: false,
    turnToward: vi.fn(),
    turnFrom: vi.fn(),
    // Scaled by the combo it lands in, so it is rarely what was asked for.
    hurtBy: vi.fn(() => 5),
    gotHit: vi.fn(),
    guardHit: vi.fn(() => true),
    freeze: vi.fn(),
    sound: vi.fn(),
    ...extra,
  };
  return stub as unknown as Entity;
}

const context = (): BlowContext =>
  ({ effects: { spawn: vi.fn() } }) as unknown as BlowContext;

describe("landBlow", () => {
  it("turns the defender away from a bolt's heading, not away from the bolt", () => {
    // Fired point-blank, a bolt is past the victim's anchor by the time it
    // connects; turning them toward it would face them away from the shooter,
    // and knockback is facing-relative, so they would be thrown into the shot.
    const bolt = body("hit", { travels: true, facing: 1, placement: { x: 8, y: 0, facing: 1, scale: 1 } });
    const defender = body("hurt");
    landBlow(bolt, defender, context());
    expect(defender.turnFrom).toHaveBeenCalledWith(1);
    expect(defender.turnToward).not.toHaveBeenCalled();
  });

  it("turns the defender to face whoever landed the blow", () => {
    // The bug this stops: knockback is facing-relative and no airborne state
    // recomputes facing, so a fighter hit after crossing the opponent used to
    // be thrown into the blow. The turn has to happen for a blocked blow too —
    // `guard_hit` pushes along the same axis.
    // The defender stands at 0; both attackers have to be close enough to
    // connect, or landBlow returns before anything is applied.
    const fromRight = body("hit", { placement: { x: 8, y: 0, facing: -1, scale: 1 } });
    const defender = body("hurt");
    landBlow(fromRight, defender, context());
    expect(defender.turnToward).toHaveBeenCalledWith(8);

    const blocking = body("hurt", { guarding: true });
    const fromLeft = body("hit", { placement: { x: -8, y: 0, facing: 1, scale: 1 } });
    landBlow(fromLeft, blocking, context());
    expect(blocking.turnToward).toHaveBeenCalledWith(-8);
  });


  it("asks for the white screen and passes the fire on, unless it is blocked", () => {
    const beam = body("hit", { attackFlash: 16, attackBurns: true } as Partial<Entity>);
    const defender = body("hurt");
    expect(landBlow(beam, defender, context())?.flash).toBe(16);
    expect(defender.gotHit).toHaveBeenCalledWith(expect.objectContaining({ burns: true }));
    const guard = body("hurt", { guarding: true });
    expect(landBlow(beam, guard, context())?.flash).toBe(0);
  });

  it("puts a projectile's burst at the middle of the overlap, in place of its spark", () => {
    const bolt = body("hit", { attackBurst: "burst_l" } as Partial<Entity>);
    const ctx = context();
    landBlow(bolt, body("hurt"), ctx);
    // both boxes cover 0..10 x -10..0 at the origin: the middle is (5, -5)
    expect(ctx.effects.spawn).toHaveBeenCalledWith("burst_l", 5, -5);
    expect(ctx.effects.spawn).toHaveBeenCalledTimes(1);
  });

  it("connects when a hit box reaches a hurt box", () => {
    const attacker = body("hit");
    const defender = body("hurt");
    const result = landBlow(attacker, defender, context());
    expect(result).not.toBeNull();
    expect(defender.hurtBy).toHaveBeenCalledWith(7);
    expect(defender.gotHit).toHaveBeenCalledWith({
      reaction: "hurt",
      relaunch: false,
      hitstun: 12,
      burns: false,
    });
  });

  it("decides the reaction before the blow is added to the combo", () => {
    // Both scalings read how many blows landed *before* this one, and `hurtBy`
    // is what counts it. Reversed, the opener would be held as if it were the
    // second blow of its own combo.
    const order: string[] = [];
    const attacker = body("hit");
    const defender = body("hurt", {
      hurtBy: vi.fn(() => {
        order.push("hurtBy");
        return 5;
      }),
      gotHit: vi.fn(() => {
        order.push("gotHit");
        return true;
      }),
    });
    landBlow(attacker, defender, context());
    expect(order).toEqual(["gotHit", "hurtBy"]);
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
      expect(defender.sound).not.toHaveBeenCalled();
      expect(attacker.sound).not.toHaveBeenCalled();
    });

    it("freezes nobody, so the attacker keeps swinging through", () => {
      const [attacker, defender] = attack();
      landBlow(attacker, defender, context());
      expect(attacker.freeze).not.toHaveBeenCalled();
      expect(defender.freeze).not.toHaveBeenCalled();
    });
  });

  it("tells the defender when the blow may lift them", () => {
    const attacker = body("hit", { attackRelaunch: true });
    const defender = body("hurt");
    landBlow(attacker, defender, context());
    expect(defender.gotHit).toHaveBeenCalledWith(expect.objectContaining({ relaunch: true }));
  });

  it("hands over how long the blow holds, not how long the pose lasts", () => {
    const attacker = body("hit", { attackHitstun: 20 });
    const defender = body("hurt");
    landBlow(attacker, defender, context());
    expect(defender.gotHit).toHaveBeenCalledWith(expect.objectContaining({ hitstun: 20 }));
  });

  it("reports what the blow cost, not what it asked for", () => {
    // Damage is scaled by how long the combo has already run, and the defender
    // is what knows that — so the number in the result comes back from it.
    const attacker = body("hit");
    const defender = body("hurt");
    expect(landBlow(attacker, defender, context())?.damage).toBe(5);
    expect(defender.hurtBy).toHaveBeenCalledWith(7);
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

describe("the noise of a blow", () => {
  it("is played on the defender's side, as the original plays it", () => {
    const [attacker, defender] = [body("hit"), body("hurt")];
    landBlow(attacker, defender, context());
    expect(defender.sound).toHaveBeenCalledWith("hit_1");
    expect(attacker.sound).not.toHaveBeenCalled();
  });
});
