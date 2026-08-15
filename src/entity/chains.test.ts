import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { StateMachine, type InputSnapshot, type Signals, type StatesFile } from "./states";

/**
 * Chains, driven frame by frame against the **committed** `states.json`.
 *
 * The state machine is pure, so a chain — which is only a path through it — can
 * be walked here instead of in a browser. That matters more than the usual
 * argument for unit tests: it is the difference between authoring a string and
 * being able to check it, and being able to check it only by asking the owner
 * to play. It also fails loudly when somebody edits the data, which is exactly
 * how the last chain broke.
 *
 * What it cannot see is everything the pure machine does not model: distance,
 * knockback, hit boxes, hitstop, whether the third blow actually reaches. Those
 * are the physics, and they are checked by their own arithmetic test in
 * `states.test.ts` and, in the end, by the owner's hands.
 */

const goku = (): StatesFile =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../../data/entities/goku/states.json", import.meta.url)),
      "utf8",
    ),
  ) as StatesFile;

const NOTHING: InputSnapshot = {
  fwd: false,
  back: false,
  up: false,
  down: false,
  light: false,
  medium: false,
  heavy: false,
  special: false,
};
const QUIET: Signals = {
  animEnded: false,
  falling: false,
  nearGround: false,
  landed: false,
  hitConfirmed: false,
};

/**
 * One fighter's state machine, stepped a frame at a time.
 *
 * The buffer is not modelled: a press here means "the buffer has this press
 * available", which is what the machine is handed by the entity anyway.
 */
class Sim {
  private readonly sm = new StateMachine(goku());

  get state(): string {
    return this.sm.current;
  }

  /** One game frame. Returns the state it left you in. */
  frame(input: Partial<InputSnapshot> = {}, signals: Partial<Signals> = {}): string {
    this.sm.update({ ...NOTHING, ...input }, { ...QUIET, ...signals });
    return this.sm.current;
  }

  /** A blow of ours connected this frame and the player asked for the next one. */
  confirmAnd(button: keyof InputSnapshot): string {
    return this.frame({ [button]: true }, { hitConfirmed: true });
  }
}

describe("the medium string", () => {
  it("walks mid → high → low when every blow connects", () => {
    const s = new Sim();
    expect(s.frame({ medium: true })).toBe("kick_mid");
    expect(s.confirmAnd("medium")).toBe("kick_high_chain");
    expect(s.confirmAnd("medium")).toBe("kick_low");
  });

  it("is three long — the sweep does not chain into anything", () => {
    const s = new Sim();
    s.frame({ medium: true });
    s.confirmAnd("medium");
    s.confirmAnd("medium");
    expect(s.confirmAnd("medium")).toBe("kick_low");
  });

  it("stops on a whiff, however hard the button is pressed", () => {
    const s = new Sim();
    expect(s.frame({ medium: true })).toBe("kick_mid");
    expect(s.frame({ medium: true })).toBe("kick_mid");
    expect(s.frame({ medium: true })).toBe("kick_mid");
  });

  it("stops when the player does not ask, however well it connected", () => {
    const s = new Sim();
    s.frame({ medium: true });
    expect(s.frame({}, { hitConfirmed: true })).toBe("kick_mid");
  });

  it("recovers to idle when the animation runs out instead", () => {
    const s = new Sim();
    s.frame({ medium: true });
    expect(s.frame({}, { animEnded: true })).toBe("idle");
  });

  it("can be started again from idle after it ends", () => {
    const s = new Sim();
    s.frame({ medium: true });
    s.frame({}, { animEnded: true });
    expect(s.frame({ medium: true })).toBe("kick_mid");
  });
});

describe("the buttons reach the moves they are supposed to", () => {
  it("light, medium and heavy each open their own attack from idle", () => {
    expect(new Sim().frame({ light: true })).toBe("punch");
    expect(new Sim().frame({ medium: true })).toBe("kick_mid");
    expect(new Sim().frame({ heavy: true })).toBe("kick_high");
  });

  it("crouching changes what medium and heavy do", () => {
    const crouched = (): Sim => {
      const s = new Sim();
      s.frame({ down: true });
      return s;
    };
    expect(crouched().frame({ medium: true })).toBe("kick_crouch");
    expect(crouched().frame({ heavy: true })).toBe("uppercut");
  });

  it("special is bound to nothing yet — the ki blast is not built", () => {
    expect(new Sim().frame({ special: true })).toBe("idle");
  });
});
