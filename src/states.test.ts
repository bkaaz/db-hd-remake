import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { StateMachine, validateStates, type StatesFile } from "./states";

/**
 * The state machine and its validator are pure (no PixiJS, no DOM), so they are
 * verified here in Node rather than by driving a browser — see CLAUDE.md.
 */

const ANIMS = ["idle", "walk"];

/** A minimal valid machine: idle ⇄ walk_fwd. */
function machine(): StatesFile {
  return {
    initial: "idle",
    states: {
      idle: {
        anim: "idle",
        vel: [0, 0],
        turn: true,
        transitions: [{ when: "held:fwd", to: "walk_fwd" }],
      },
      walk_fwd: {
        anim: "walk",
        vel: [0.83, 0],
        turn: true,
        transitions: [{ when: "!held:fwd", to: "idle" }],
      },
    },
  };
}

const NONE = { fwd: false, back: false };
const FWD = { fwd: true, back: false };

describe("validateStates", () => {
  it("accepts a well-formed machine", () => {
    expect(validateStates(machine(), ANIMS)).toEqual({ errors: [], warnings: [] });
  });

  it("accepts a negated trigger", () => {
    const f = machine();
    f.states.idle.transitions = [{ when: "!held:back", to: "walk_fwd" }];
    expect(validateStates(f, ANIMS).errors).toEqual([]);
  });

  it("reports an animation that does not exist", () => {
    const f = machine();
    f.states.idle.anim = "idel";
    expect(validateStates(f, ANIMS).errors).toContain('state "idle": unknown animation "idel"');
  });

  it("reports a transition to a state that does not exist", () => {
    const f = machine();
    f.states.idle.transitions = [{ when: "held:fwd", to: "walk_fwrd" }];
    expect(validateStates(f, ANIMS).errors).toContain(
      'state "idle", transition 0: unknown target state "walk_fwrd"',
    );
  });

  it("reports an unknown trigger", () => {
    const f = machine();
    f.states.idle.transitions = [{ when: "pressed:x", to: "walk_fwd" }];
    const { errors } = validateStates(f, ANIMS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/unknown trigger "pressed:x"/);
  });

  it("reports a missing or unknown initial state", () => {
    const f = machine();
    f.initial = "idl";
    expect(validateStates(f, ANIMS).errors).toContain('initial state "idl" does not exist');
  });

  it("reports a malformed vel", () => {
    const f = machine();
    // Hand-authored JSON is not type-checked, so the runtime shape must be caught.
    (f.states.idle as { vel: unknown }).vel = ["fast", 0];
    expect(validateStates(f, ANIMS).errors).toContain(
      'state "idle": "vel" must be two numbers, e.g. [0.83, 0]',
    );
  });

  it("reports an empty machine", () => {
    expect(validateStates({ initial: "idle", states: {} }, ANIMS).errors).toEqual([
      "no states defined",
    ]);
  });

  it("warns about a state nothing can reach", () => {
    const f = machine();
    f.states.orphan = { anim: "walk" };
    const { errors, warnings } = validateStates(f, ANIMS);
    expect(errors).toEqual([]);
    expect(warnings).toEqual(['state "orphan" is unreachable from "idle"']);
  });

  it("keeps the entities we actually ship valid", () => {
    // The point of the validator: catch a typo in hand-authored data. This test
    // is what makes that guarantee hold for the data in the repo.
    const path = fileURLToPath(new URL("../data/entities/goku/states.json", import.meta.url));
    const states = JSON.parse(readFileSync(path, "utf8")) as StatesFile;
    expect(validateStates(states, ANIMS).errors).toEqual([]);
  });
});

describe("StateMachine", () => {
  it("starts in the initial state", () => {
    expect(new StateMachine(machine()).current).toBe("idle");
  });

  it("falls back to the first state when initial is unknown", () => {
    const f = machine();
    f.initial = "nope";
    expect(new StateMachine(f).current).toBe("idle");
  });

  it("walks forward while the input is held and returns to idle on release", () => {
    const sm = new StateMachine(machine());
    expect(sm.update(FWD, false)).toBe("walk_fwd");
    expect(sm.update(FWD, false)).toBeNull(); // already there — no repeated change
    expect(sm.update(NONE, false)).toBe("idle");
  });

  it("exposes the current state's data", () => {
    const sm = new StateMachine(machine());
    sm.update(FWD, false);
    expect(sm.def.anim).toBe("walk");
    expect(sm.def.vel).toEqual([0.83, 0]);
  });

  it("takes at most one transition per frame", () => {
    const f: StatesFile = {
      initial: "a",
      states: {
        a: { anim: "idle", transitions: [{ when: "held:fwd", to: "b" }] },
        b: { anim: "idle", transitions: [{ when: "held:fwd", to: "c" }] },
        c: { anim: "idle" },
      },
    };
    const sm = new StateMachine(f);
    sm.update(FWD, false);
    expect(sm.current).toBe("b"); // not "c", even though b's trigger also fires
  });

  it("lets the first matching transition win", () => {
    const f = machine();
    f.states.idle.transitions = [
      { when: "held:fwd", to: "walk_fwd" },
      { when: "held:fwd", to: "idle" },
    ];
    const sm = new StateMachine(f);
    sm.update(FWD, false);
    expect(sm.current).toBe("walk_fwd");
  });

  it("ignores a transition whose target does not exist", () => {
    const f = machine();
    f.states.idle.transitions = [{ when: "held:fwd", to: "ghost" }];
    const sm = new StateMachine(f);
    expect(sm.update(FWD, false)).toBeNull();
    expect(sm.current).toBe("idle");
  });

  it("fires animEnd only when the animation has ended", () => {
    const f: StatesFile = {
      initial: "punch",
      states: {
        punch: { anim: "idle", transitions: [{ when: "animEnd", to: "idle" }] },
        idle: { anim: "idle" },
      },
    };
    const sm = new StateMachine(f);
    expect(sm.update(NONE, false)).toBeNull();
    expect(sm.update(NONE, true)).toBe("idle");
  });
});
