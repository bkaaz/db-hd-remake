import { describe, expect, it } from "vitest";
import type { StateDef } from "./states";
import { faceOpponent } from "./turning";

const IDLE: StateDef = { anim: "idle", turn: true, turnsBy: "turn_round", transitions: [] };

describe("faceOpponent", () => {
  it("plays the turn when the opponent is found behind", () => {
    expect(faceOpponent(IDLE, 1, 100, 50, 1)).toEqual({ facing: -1, turnsBy: "turn_round" });
    expect(faceOpponent(IDLE, 1, 100, 150, -1)).toEqual({ facing: 1, turnsBy: "turn_round" });
  });

  it("plays nothing while he is in front, or level", () => {
    expect(faceOpponent(IDLE, 1, 100, 150, 1)).toEqual({ facing: 1 });
    expect(faceOpponent(IDLE, 1, 100, 100, -1)).toEqual({ facing: -1 });
  });

  it("flips on the spot in a state with no turn of its own", () => {
    expect(faceOpponent({ ...IDLE, turnsBy: undefined }, 1, 100, 50, 1)).toEqual({ facing: -1 });
  });

  it("keeps its back to him in a state that may not turn, and without an opponent", () => {
    expect(faceOpponent({ ...IDLE, turn: false }, 1, 100, 50, 1)).toEqual({ facing: 1 });
    expect(faceOpponent(IDLE, 1, 100, null, 1)).toEqual({ facing: 1 });
  });

  it("waits for `turnFrom`", () => {
    const late: StateDef = { ...IDLE, turn: false, turnFrom: 5 };
    expect(faceOpponent(late, 4, 100, 50, 1)).toEqual({ facing: 1 });
    expect(faceOpponent(late, 5, 100, 50, 1)).toEqual({ facing: -1, turnsBy: "turn_round" });
  });
});
