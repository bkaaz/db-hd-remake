import { describe, expect, it } from "vitest";
import type { Entity } from "../entity/entity";
import { parries } from "./parry";

/** A body whose boxes all stand on the same spot, facing `facing`. */
function body(extra: Partial<Record<string, unknown>> = {}): Entity {
  const boxes = (kind: string) => (kind === "hit" ? [{ type: "hit", x: 0, y: -20, w: 20, h: 20 }] : []);
  return { name: "goku", facing: 1, canHit: true, attackReaction: "light", attackDamage: 10, animation: "m92", parry: undefined, placement: { x: 0, y: 0, facing: 1, scale: 1 }, boxes, ...extra } as unknown as Entity;
}

const PARRY = { to: "cut", except: { goku: ["9a", "a8"] } };
const parrier = (extra = {}) => body({ name: "piccolo", facing: -1, parry: PARRY, attackReaction: undefined, attackDamage: 0, ...extra });

describe("parries", () => {
  it("turns an armed blow whose hit box touches its own", () => {
    expect(parries(parrier(), body())).toBe(true);
  });

  it("lets through the moves the striker's fighter is listed with, any part of them", () => {
    expect(parries(parrier(), body({ animation: "m9a" }))).toBe(false);
    expect(parries(parrier(), body({ animation: "ma8_2" }))).toBe(false);
  });

  it("is no parry from a state that has none, nor of a blow already spent", () => {
    expect(parries(body({ facing: -1 }), body())).toBe(false);
    expect(parries(parrier(), body({ canHit: false }))).toBe(false);
  });

  it("does not take a box with no blow behind it, as a state's drawing may have", () => {
    expect(parries(parrier(), body({ attackReaction: undefined, attackDamage: 0 }))).toBe(false);
  });

  it("wants them facing each other, and one parry does not parry another ($2A:8537, $2A:8648)", () => {
    expect(parries(parrier({ facing: 1 }), body())).toBe(false);
    expect(parries(parrier(), body({ parry: PARRY }))).toBe(false);
  });

  it("wants the boxes to touch", () => {
    expect(parries(parrier({ placement: { x: 500, y: 0, facing: -1, scale: 1 } }), body())).toBe(false);
  });
});
