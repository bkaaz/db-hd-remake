import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { StateMachine, validateStates, type AnimInfo, type StatesFile } from "./states";

/**
 * The state machine and its validator are pure (no PixiJS, no DOM), so they are
 * verified here in Node rather than by driving a browser — see CLAUDE.md.
 */

const ANIMS = {
  idle: { loop: true },
  walk: { loop: true },
  punch: { loop: false },
  hurt: { loop: false },
};

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

const NONE = { fwd: false, back: false, attack: false };
const FWD = { fwd: true, back: false, attack: false };
const ATTACK = { fwd: false, back: false, attack: true };

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
    f.states.orphan = { anim: "walk", transitions: [{ when: "animEnd", to: "idle" }] };
    const { errors, warnings } = validateStates(f, ANIMS);
    expect(errors).toEqual([]);
    expect(warnings).toContain('state "orphan" is unreachable (no transition leads to it)');
  });

  it("does not call the onGotHit state unreachable — the engine forces it", () => {
    const f = machine();
    f.states.hurt = { anim: "hurt", transitions: [{ when: "animEnd", to: "idle" }] };
    f.onGotHit = "hurt";
    expect(validateStates(f, ANIMS)).toEqual({ errors: [], warnings: [] });
  });

  it("warns when a state can only end by animEnd but its animation loops", () => {
    // The classic authoring slip: forgetting to untick "loop" on an attack.
    const f = machine();
    f.states.punch = { anim: "walk", transitions: [{ when: "animEnd", to: "idle" }] };
    f.states.idle.transitions?.push({ when: "pressed:attack", to: "punch" });
    expect(validateStates(f, ANIMS).warnings).toContain(
      'state "punch": can never be left — animation "walk" loops, so animEnd never fires',
    );
  });

  it("accepts the same state once its animation stops looping", () => {
    const f = machine();
    f.states.punch = { anim: "punch", transitions: [{ when: "animEnd", to: "idle" }] };
    f.states.idle.transitions?.push({ when: "pressed:attack", to: "punch" });
    expect(validateStates(f, ANIMS)).toEqual({ errors: [], warnings: [] });
  });

  it("warns about steps with no hurt box — frames where nothing can hit you", () => {
    const withSteps = {
      ...ANIMS,
      walk: {
        loop: true,
        steps: [{ boxes: [{ type: "hurt" }] }, { boxes: [{ type: "push" }] }, {}],
      },
    };
    expect(validateStates(machine(), withSteps).warnings).toContain(
      'state "walk_fwd": animation "walk" has no hurt box on step 1, 2 — cannot be hit there',
    );
  });

  it("says \"every step\" when an animation has no hurt boxes at all", () => {
    const withSteps = { ...ANIMS, walk: { loop: true, steps: [{}, {}] } };
    expect(validateStates(machine(), withSteps).warnings).toContain(
      'state "walk_fwd": animation "walk" has no hurt box on every step — cannot be hit there',
    );
  });

  it("stays quiet when every step is covered", () => {
    const covered = { boxes: [{ type: "hurt" }] };
    const withSteps = {
      idle: { loop: true, steps: [covered, covered] },
      walk: { loop: true, steps: [covered] },
    };
    expect(validateStates(machine(), withSteps)).toEqual({ errors: [], warnings: [] });
  });

  it("warns about a state with no way out at all", () => {
    const f = machine();
    f.states.ko = { anim: "hurt" };
    expect(validateStates(f, ANIMS).warnings).toContain(
      'state "ko": no transitions — nothing can leave it',
    );
  });

  it("reports an onGotHit state that does not exist", () => {
    const f = machine();
    f.onGotHit = "hrut";
    expect(validateStates(f, ANIMS).errors).toContain('onGotHit state "hrut" does not exist');
  });

  it("keeps the entities we actually ship valid", () => {
    // The point of the validator: catch a typo in hand-authored data. Checking
    // the committed states against the committed animations is what makes that
    // guarantee real — warnings are allowed (data is still being authored),
    // errors are not.
    const read = <T>(file: string): T =>
      JSON.parse(
        readFileSync(fileURLToPath(new URL(`../data/entities/goku/${file}`, import.meta.url)), "utf8"),
      ) as T;
    const states = read<StatesFile>("states.json");
    const anims = read<Record<string, AnimInfo>>("animations.json");
    expect(validateStates(states, anims).errors).toEqual([]);
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

  it("enters an attack on the button edge, not while it is held", () => {
    const f = machine();
    f.states.punch = { anim: "idle", transitions: [{ when: "animEnd", to: "idle" }] };
    f.states.idle.transitions = [{ when: "pressed:attack", to: "punch" }];
    const sm = new StateMachine(f);
    expect(sm.update(NONE, false)).toBeNull();
    expect(sm.update(ATTACK, false)).toBe("punch");
  });

  it("force() enters a state regardless of transitions", () => {
    const f = machine();
    f.states.hurt = { anim: "idle" };
    const sm = new StateMachine(f);
    expect(sm.force("hurt")).toBe(true);
    expect(sm.current).toBe("hurt");
    expect(sm.force("ghost")).toBe(false);
    expect(sm.current).toBe("hurt");
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
