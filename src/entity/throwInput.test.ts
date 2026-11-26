import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { withHitTypes } from "../combat/hitTypes";
import { generatedFighters } from "../rom/fighterStates";
import { StateMachine, type InputSnapshot, type StatesFile } from "./states";

/** The throw is Attack + Smash together, the opponent in reach (owner, 2026-11-26), for every fighter. */
const held = { attack: false, guard: false, smash: false, blast: false, strike: false, dash: false, charge: false, boost: false };
const press = (buttons: Partial<InputSnapshot>): InputSnapshot =>
  ({ fwd: false, back: false, up: false, down: false, attack: false, guard: false, smash: false, blast: false, strike: false, dash: false, holding: held, ...buttons }) as InputSnapshot;
const signals = (grab: boolean) => ({
  animEnded: false,
  stunEnded: true,
  falling: false,
  nearGround: false,
  landed: false,
  close: {},
  grab,
  hitConfirmed: false,
  ki: 100,
  spawnEnded: true,
  charged: false,
});

describe.each(generatedFighters())("%s's throw", (name) => {
  const file = JSON.parse(readFileSync(`data/entities/${name}/states.json`, "utf8")) as StatesFile;
  const from = (input: InputSnapshot, grab: boolean) => {
    const sm = new StateMachine(withHitTypes(file));
    sm.update(input, signals(grab));
    return sm.current;
  };

  it("is Attack and Smash together with him in reach, ahead of either alone", () => {
    expect(from(press({ attack: true, smash: true }), true)).toBe("throw");
  });

  it("is the other button a frame or two late too: A1 or Smash alone just begun turns into it", () => {
    const late = (first: Partial<InputSnapshot>, second: Partial<InputSnapshot>) => {
      const sm = new StateMachine(withHitTypes(file));
      sm.update(press(first), signals(true));
      sm.update(press(second), signals(true));
      return sm.current;
    };
    expect(late({ attack: true }, { smash: true })).toBe("throw");
    expect(late({ smash: true }, { attack: true })).toBe("throw");
  });

  it("is not Attack alone, nor the two out of reach", () => {
    expect(from(press({ attack: true }), true)).not.toBe("throw");
    expect(from(press({ attack: true, smash: true }), false)).not.toBe("throw");
  });
});
