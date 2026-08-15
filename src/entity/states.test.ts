import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  effectsNamed,
  reactionFor,
  StateMachine,
  validateStates,
  type AnimInfo,
  type StateDef,
  type StatesFile,
} from "./states";

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

const NONE = {
  fwd: false,
  back: false,
  up: false,
  down: false,
  light: false,
  medium: false,
  heavy: false,
  special: false,
};
const FWD = { ...NONE, fwd: true };
const ATTACK = { ...NONE, light: true };
const UP = { ...NONE, up: true };

/** Nothing happened to the entity this frame. */
const QUIET = {
  animEnded: false,
  falling: false,
  nearGround: false,
  landed: false,
  hitConfirmed: false,
};

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

  it("accepts a `when` of several triggers", () => {
    const f = machine();
    f.states.idle.transitions = [{ when: ["hitConfirmed", "pressed:light"], to: "walk_fwd" }];
    expect(validateStates(f, ANIMS).errors).toEqual([]);
  });

  it("reports an unknown trigger inside a list, not just a lone one", () => {
    const f = machine();
    f.states.idle.transitions = [{ when: ["hitConfirmed", "pressed:x"], to: "walk_fwd" }];
    expect(validateStates(f, ANIMS).errors).toHaveLength(1);
    expect(validateStates(f, ANIMS).errors[0]).toMatch(/unknown trigger "pressed:x"/);
  });

  it("reports an empty list — a transition nothing can fire", () => {
    const f = machine();
    f.states.idle.transitions = [{ when: [], to: "walk_fwd" }];
    expect(validateStates(f, ANIMS).errors).toContain('state "idle", transition 0: no "when" trigger');
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

  it("accepts a launch that keeps an axis", () => {
    const f = machine();
    f.states.idle.launch = [null, -2.4];
    expect(validateStates(f, ANIMS).errors).toEqual([]);
  });

  it("reports a malformed launch", () => {
    const f = machine();
    (f.states.idle as { launch: unknown }).launch = ["fast", -2.4];
    expect(validateStates(f, ANIMS).errors).toContain(
      'state "idle": "launch" must be two numbers or nulls, e.g. [null, -2.4]',
    );
  });

  it("reports a malformed rank", () => {
    const f = machine();
    (f.states.idle as { rank: unknown }).rank = "heavy";
    expect(validateStates(f, ANIMS).errors).toContain(
      'state "idle": "rank" must be a number, 0 or more',
    );
  });

  it("reports a malformed smash", () => {
    const f = machine();
    (f.states.idle as { smash: unknown }).smash = "yes";
    expect(validateStates(f, ANIMS).errors).toContain('state "idle": "smash" must be true or false');
  });

  it("warns about a smash whose reaction cannot lift anybody", () => {
    // The flag on the wrong half of a pair: it reads as a launcher and behaves
    // like a jab, and nothing says so until a juggle refuses to end.
    const f = machine();
    f.states.hurt = { anim: "hurt", rank: 1, transitions: [{ when: "animEnd", to: "idle" }] };
    f.states.idle.smash = true;
    f.states.idle.onHit = "hurt";
    expect(validateStates(f, ANIMS).warnings).toContain(
      'state "idle": "smash" but its reaction "hurt" neither launches nor has an air version',
    );
  });

  it("stays quiet about a smash whose reaction launches", () => {
    const f = machine();
    f.states.knockdown = {
      anim: "hurt",
      rank: 3,
      launch: [null, -6],
      airborne: true,
      transitions: [{ when: "landed", to: "idle" }],
    };
    f.states.idle.smash = true;
    f.states.idle.onHit = "knockdown";
    expect(validateStates(f, ANIMS).warnings.filter((w) => w.includes("smash"))).toEqual([]);
  });

  it("reports a malformed invulnerable", () => {
    const f = machine();
    (f.states.idle as { invulnerable: unknown }).invulnerable = 1;
    expect(validateStates(f, ANIMS).errors).toContain(
      'state "idle": "invulnerable" must be true or false',
    );
  });

  it("warns about an invulnerable state with no way out", () => {
    // Untouchable and unleavable is a fighter removed from the match.
    const f = machine();
    f.states.limbo = { anim: "hurt", invulnerable: true };
    f.states.idle.transitions?.push({ when: "animEnd", to: "limbo" });
    expect(validateStates(f, ANIMS).warnings).toContain(
      'state "limbo": invulnerable and has no transitions — nothing can end it',
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

  /** A machine whose flinch has an air version, as goku's does. */
  function withAirReaction(): StatesFile {
    const f = machine();
    f.onGotHit = "hurt";
    f.states.hurt = {
      anim: "hurt",
      ifAirborne: "hurt_air",
      transitions: [{ when: "animEnd", to: "idle" }],
    };
    f.states.hurt_air = {
      anim: "hurt",
      airborne: true,
      transitions: [{ when: "landed", to: "idle" }],
    };
    return f;
  }

  it("does not call an air reaction unreachable — its ground version leads there", () => {
    expect(validateStates(withAirReaction(), ANIMS)).toEqual({ errors: [], warnings: [] });
  });

  it("reports an ifAirborne that names no state", () => {
    const f = withAirReaction();
    f.states.hurt.ifAirborne = "hurt_ari";
    expect(validateStates(f, ANIMS).errors).toContain('state "hurt": ifAirborne "hurt_ari" is not a state');
  });

  it("warns when the air version is not itself airborne", () => {
    const f = withAirReaction();
    delete f.states.hurt_air.airborne;
    expect(validateStates(f, ANIMS).warnings).toContain(
      'state "hurt": ifAirborne "hurt_air" is not airborne — ' +
        "an entity sent there mid-jump snaps to the ground",
    );
  });

  it("warns when a state can only end by animEnd but its animation loops", () => {
    // The classic authoring slip: forgetting to untick "loop" on an attack.
    const f = machine();
    f.states.punch = { anim: "walk", transitions: [{ when: "animEnd", to: "idle" }] };
    f.states.idle.transitions?.push({ when: "pressed:light", to: "punch" });
    expect(validateStates(f, ANIMS).warnings).toContain(
      'state "punch": can never be left — animation "walk" loops, so animEnd never fires',
    );
  });

  it("accepts the same state once its animation stops looping", () => {
    const f = machine();
    f.states.punch = { anim: "punch", transitions: [{ when: "animEnd", to: "idle" }] };
    f.states.idle.transitions?.push({ when: "pressed:light", to: "punch" });
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

  it("reports a hitstop that is not a frame count", () => {
    const f = machine();
    f.states.punch = { anim: "punch", hitstop: -1, transitions: [{ when: "animEnd", to: "idle" }] };
    f.states.idle.transitions?.push({ when: "pressed:light", to: "punch" });
    expect(validateStates(f, ANIMS).errors).toContain(
      'state "punch": "hitstop" must be a number of game frames, 0 or more',
    );
  });

  it("accepts a hitstop of zero — an attack that deliberately does not pause", () => {
    const f = machine();
    f.states.punch = { anim: "punch", hitstop: 0, transitions: [{ when: "animEnd", to: "idle" }] };
    f.states.idle.transitions?.push({ when: "pressed:light", to: "punch" });
    expect(validateStates(f, ANIMS).errors).toEqual([]);
  });

  it("reports damage that is not a number", () => {
    const f = machine();
    f.states.punch = { anim: "punch", damage: -3, transitions: [{ when: "animEnd", to: "idle" }] };
    f.states.idle.transitions?.push({ when: "pressed:light", to: "punch" });
    expect(validateStates(f, ANIMS).errors).toContain(
      'state "punch": "damage" must be a number, 0 or more',
    );
  });

  it("accepts damage of zero — an attack that only moves the opponent", () => {
    const f = machine();
    f.states.punch = { anim: "punch", damage: 0, transitions: [{ when: "animEnd", to: "idle" }] };
    f.states.idle.transitions?.push({ when: "pressed:light", to: "punch" });
    expect(validateStates(f, ANIMS).errors).toEqual([]);
  });

  it("reports an onGuard state that does not exist", () => {
    const f = machine();
    f.onGuard = "gaurd";
    expect(validateStates(f, ANIMS).errors).toContain('onGuard state "gaurd" does not exist');
  });

  it("does not call the onGuard state unreachable — the engine forces it too", () => {
    const f = machine();
    f.states.hurt = { anim: "hurt", transitions: [{ when: "animEnd", to: "idle" }] };
    f.onGuard = "hurt";
    expect(validateStates(f, ANIMS)).toEqual({ errors: [], warnings: [] });
  });

  it("reports an onGotHit state that does not exist", () => {
    const f = machine();
    f.onGotHit = "hrut";
    expect(validateStates(f, ANIMS).errors).toContain('onGotHit state "hrut" does not exist');
  });

  it("warns about an onHit reaction this entity does not define", () => {
    // Only a warning: the reaction is looked up on the *defender*, so a name
    // this fighter lacks may still be legitimate. A typo, though, fails
    // silently — the attack connects and nothing visible happens.
    const f = machine();
    f.states.punch = { anim: "punch", onHit: "hrut", transitions: [{ when: "animEnd", to: "idle" }] };
    f.states.idle.transitions?.push({ when: "pressed:light", to: "punch" });
    const { errors, warnings } = validateStates(f, ANIMS);
    expect(errors).toEqual([]);
    expect(warnings).toContain(
      'state "punch": onHit reaction "hrut" is not a state of this entity — fine only if every opponent defines it',
    );
  });

  it("does not call an onHit reaction unreachable — the engine forces it", () => {
    // `hurt` here is entered only by being hit; no transition leads to it.
    const f = machine();
    f.states.punch = { anim: "punch", onHit: "hurt", transitions: [{ when: "animEnd", to: "idle" }] };
    f.states.hurt = { anim: "hurt", transitions: [{ when: "animEnd", to: "idle" }] };
    f.states.idle.transitions?.push({ when: "pressed:light", to: "punch" });
    expect(validateStates(f, ANIMS)).toEqual({ errors: [], warnings: [] });
  });

  it("keeps the entities we actually ship valid", () => {
    // The point of the validator: catch a typo in hand-authored data. Checking
    // the committed states against the committed animations is what makes that
    // guarantee real — warnings are allowed (data is still being authored),
    // errors are not.
    const read = <T>(file: string): T =>
      JSON.parse(
        readFileSync(fileURLToPath(new URL(`../../data/entities/goku/${file}`, import.meta.url)), "utf8"),
      ) as T;
    const states = read<StatesFile>("states.json");
    const anims = read<Record<string, AnimInfo>>("animations.json");
    expect(validateStates(states, anims).errors).toEqual([]);
  });
});

describe("a chain link has to be able to reach what the last one knocked away", () => {
  /**
   * The failure this exists to prevent, found by playing: the middle of the
   * kick string forced `hurt_heavy`, whose knockback is 62 sprite px, against a
   * longest reach in the whole game of 44. The third blow could not connect —
   * not badly tuned, arithmetically impossible.
   *
   * So for every chain transition, measure what the blow does to the distance
   * between the two fighters and compare it with how far the next one reaches.
   * The margin is crude, because it ignores where they were standing and how
   * wide the defender is, but the number it catches is not a near miss.
   */
  const read = <T>(file: string): T =>
    JSON.parse(
      readFileSync(fileURLToPath(new URL(`../../data/entities/goku/${file}`, import.meta.url)), "utf8"),
    ) as T;

  interface Step {
    dur: number;
    boxes?: { type: string; x: number; w: number }[];
  }
  const anims = read<Record<string, { steps: Step[] }>>("animations.json");
  const states = read<StatesFile>("states.json").states;

  const frames = (anim: string): number =>
    (anims[anim]?.steps ?? []).reduce((n, s) => n + s.dur, 0);
  const reach = (anim: string): number =>
    Math.max(
      0,
      ...(anims[anim]?.steps ?? []).flatMap((s) =>
        (s.boxes ?? []).filter((b) => b.type === "hit").map((b) => b.x + b.w),
      ),
    );

  /** Every transition that continues a chain: source state → target state. */
  const links = Object.entries(states).flatMap(([from, def]) =>
    (def.transitions ?? [])
      .filter((t) => Array.isArray(t.when) && t.when.includes("hitConfirmed"))
      .map((t) => [from, t.to] as const),
  );

  it("finds the chains that exist, so this suite cannot pass by testing nothing", () => {
    expect(links.length).toBeGreaterThan(0);
  });

  it.each(links)("%s can still be followed by %s", (from, to) => {
    const attack = states[from];
    const reaction = states[attack.onHit ?? ""];
    // A reaction that launches is a knockdown: the chain is over either way.
    if (!reaction?.vel) return;

    const knockback = Math.abs(reaction.vel[0]) * frames(reaction.anim);
    const advance = (attack.vel?.[0] ?? 0) * frames(attack.anim);
    expect(knockback - advance).toBeLessThan(reach(states[to].anim));
  });

  /**
   * Distance is only half of it, and the recording found the other half: the
   * defender has to still be *helpless* when the next blow arrives, not merely
   * within range of it.
   *
   * From the blow landing, both fighters freeze for the same hit pause, so it
   * cancels out of both sides of the sum. The attacker is then free one frame
   * later and spends the next link's start-up getting its box out; the defender
   * is helpless for as long as the reaction lasts. Hence `1 + start-up` against
   * the reaction's length, with no hitstop in it.
   */
  const startup = (anim: string): number => {
    let before = 0;
    for (const step of anims[anim]?.steps ?? []) {
      if ((step.boxes ?? []).some((b) => b.type === "hit")) return before;
      before += step.dur;
    }
    return before;
  };

  it.each(links)("%s still has %s helpless when the next blow lands", (from, to) => {
    const reaction = states[states[from].onHit ?? ""];
    if (!reaction?.vel) return; // a knockdown: helplessness is not the question
    expect(1 + startup(states[to].anim)).toBeLessThanOrEqual(frames(reaction.anim));
  });
});

/** idle ⇄ walk_fwd, plus an attack reached with the light button. */
function withAttack(when: string | string[] = "pressed:light"): StatesFile {
  const f = machine();
  f.states.punch = { anim: "punch", transitions: [{ when: "animEnd", to: "idle" }] };
  f.states.idle.transitions?.push({ when, to: "punch" });
  return f;
}

describe("StateMachine.pressSpent", () => {
  it("is null when a button was not what caused the change", () => {
    const sm = new StateMachine(machine());
    expect(sm.pressSpent).toBeNull();
    sm.update(FWD, QUIET);
    expect(sm.pressSpent).toBeNull();
  });

  it("names the button a transition consumed, so it cannot fire a second move", () => {
    const sm = new StateMachine(withAttack());
    sm.update(ATTACK, QUIET);
    expect(sm.pressSpent).toBe("light");
  });

  it("finds the button inside a conjunction", () => {
    const sm = new StateMachine(withAttack(["hitConfirmed", "pressed:light"]));
    sm.update(ATTACK, { ...QUIET, hitConfirmed: true });
    expect(sm.current).toBe("punch");
    expect(sm.pressSpent).toBe("light");
  });
});

describe("a `when` of several triggers needs all of them", () => {
  const CHAIN = ["hitConfirmed", "pressed:light"];

  it("fires when both hold", () => {
    const sm = new StateMachine(withAttack(CHAIN));
    sm.update(ATTACK, { ...QUIET, hitConfirmed: true });
    expect(sm.current).toBe("punch");
  });

  it("does not fire on the button alone — a whiff ends a string", () => {
    const sm = new StateMachine(withAttack(CHAIN));
    sm.update(ATTACK, QUIET);
    expect(sm.current).toBe("idle");
  });

  it("does not fire on the confirm alone — the player still has to ask", () => {
    const sm = new StateMachine(withAttack(CHAIN));
    sm.update(NONE, { ...QUIET, hitConfirmed: true });
    expect(sm.current).toBe("idle");
  });

  it("still honours a negation inside the list", () => {
    // `back` rather than `fwd`: idle already leaves on held:fwd, and the first
    // matching transition wins, so testing against it would prove nothing.
    const sm = new StateMachine(withAttack(["!held:back", "pressed:light"]));
    sm.update({ ...ATTACK, back: true }, QUIET);
    expect(sm.current).toBe("idle");
    sm.update(ATTACK, QUIET);
    expect(sm.current).toBe("punch");
  });
});

describe("an airborne state has to notice the ground", () => {
  const flying = {
    initial: "idle",
    states: {
      idle: { anim: "idle", transitions: [{ when: "held:up", to: "thrown" }] },
      thrown: { anim: "hurt", airborne: true, transitions: [{ when: "animEnd", to: "idle" }] },
    },
  };

  it("warns when nothing catches the landing", () => {
    expect(validateStates(flying as never, ANIMS).warnings).toContain(
      'state "thrown": airborne with no "landed" or "nearGround" transition — ' +
        "nothing happens when it reaches the floor",
    );
  });

  it("is satisfied by either signal", () => {
    for (const when of ["landed", "nearGround"]) {
      const ok = JSON.parse(JSON.stringify(flying));
      ok.states.thrown.transitions.push({ when, to: "idle" });
      const found = validateStates(ok, ANIMS).warnings.filter((w: string) =>
        w.includes("reaches the floor"),
      );
      expect(found).toEqual([]);
    }
  });
});

describe("reactionFor", () => {
  /** A defender whose flinch has an air version and whose stagger has none. */
  function defender(): StatesFile {
    return {
      initial: "idle",
      onGotHit: "hurt",
      states: {
        hurt: { anim: "hurt", rank: 1, ifAirborne: "hurt_air" },
        hurt_air: { anim: "hurt", rank: 1, airborne: true },
        hurt_heavy: { anim: "hurt", rank: 2 },
        knockdown: { anim: "hurt", rank: 3, airborne: true },
        downed: { anim: "hurt", rank: 4 },
      },
    };
  }
  const STANDING = undefined;
  const IN_AIR: StateDef = { anim: "jump", airborne: true };
  const in_ = (name: string): StateDef => defender().states[name];

  it("takes the attack's reaction over the defender's default", () => {
    // The blow outranks the body: a heavy attack staggers someone whose own
    // default is a flinch.
    expect(reactionFor("hurt_heavy", defender(), STANDING)).toBe("hurt_heavy");
  });

  it("falls back to the defender's default when the attack names nothing", () => {
    expect(reactionFor(undefined, defender(), STANDING)).toBe("hurt");
  });

  it("is undefined when neither side says anything", () => {
    expect(reactionFor(undefined, { initial: "idle", states: {} }, STANDING)).toBeUndefined();
  });

  it("redirects an airborne defender to the reaction's air version", () => {
    expect(reactionFor(undefined, defender(), IN_AIR)).toBe("hurt_air");
  });

  it("leaves a grounded defender on the ground reaction", () => {
    expect(reactionFor(undefined, defender(), STANDING)).toBe("hurt");
  });

  it("keeps the ground reaction when it has no air version", () => {
    // The old behaviour, and all a fighter without air reactions can be given.
    expect(reactionFor("hurt_heavy", defender(), IN_AIR)).toBe("hurt_heavy");
  });

  it("redirects the attack's reaction, not only the defender's default", () => {
    expect(reactionFor("hurt", defender(), IN_AIR)).toBe("hurt_air");
  });

  it("does not follow a second hop", () => {
    // hurt_air would have to name its own ifAirborne to chain, and a redirect
    // that chains is a loop waiting to be authored.
    const f = defender();
    f.states.hurt_air = { anim: "hurt", rank: 1, airborne: true, ifAirborne: "hurt" };
    expect(reactionFor(undefined, f, IN_AIR)).toBe("hurt_air");
  });

  describe("severity has the last word", () => {
    it("lets a harder blow take over a lighter reaction", () => {
      expect(reactionFor("hurt_heavy", defender(), in_("hurt"))).toBe("hurt_heavy");
    });

    it("lets an equal blow re-enter — that is what a combo is", () => {
      expect(reactionFor("hurt", defender(), in_("hurt"))).toBe("hurt");
    });

    it("refuses to rescue someone already being knocked down", () => {
      // The blow still lands and still hurts; it just does not interrupt, so
      // the victim keeps falling on the arc they were already on.
      expect(reactionFor("hurt", defender(), in_("knockdown"))).toBeUndefined();
    });

    it("refuses to stand a floored fighter back up", () => {
      expect(reactionFor("hurt_heavy", defender(), in_("downed"))).toBeUndefined();
    });

    it("compares the air version's rank, not the ground one's", () => {
      // A jab at someone mid-knockdown resolves to hurt_air, which ranks 1
      // against the knockdown's 3 — the redirect happens first, the rank check
      // second.
      expect(reactionFor("hurt", defender(), { anim: "x", rank: 3, airborne: true })).toBeUndefined();
    });

    it("treats a missing rank as zero, so any reaction beats standing there", () => {
      expect(reactionFor("hurt", defender(), { anim: "idle" })).toBe("hurt");
    });
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
    expect(sm.update(FWD, QUIET)).toBe("walk_fwd");
    expect(sm.update(FWD, QUIET)).toBeNull(); // already there — no repeated change
    expect(sm.update(NONE, QUIET)).toBe("idle");
  });

  it("exposes the current state's data", () => {
    const sm = new StateMachine(machine());
    sm.update(FWD, QUIET);
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
    sm.update(FWD, QUIET);
    expect(sm.current).toBe("b"); // not "c", even though b's trigger also fires
  });

  it("lets the first matching transition win", () => {
    const f = machine();
    f.states.idle.transitions = [
      { when: "held:fwd", to: "walk_fwd" },
      { when: "held:fwd", to: "idle" },
    ];
    const sm = new StateMachine(f);
    sm.update(FWD, QUIET);
    expect(sm.current).toBe("walk_fwd");
  });

  it("ignores a transition whose target does not exist", () => {
    const f = machine();
    f.states.idle.transitions = [{ when: "held:fwd", to: "ghost" }];
    const sm = new StateMachine(f);
    expect(sm.update(FWD, QUIET)).toBeNull();
    expect(sm.current).toBe("idle");
  });

  it("enters an attack on the button edge, not while it is held", () => {
    const f = machine();
    f.states.punch = { anim: "idle", transitions: [{ when: "animEnd", to: "idle" }] };
    f.states.idle.transitions = [{ when: "pressed:light", to: "punch" }];
    const sm = new StateMachine(f);
    expect(sm.update(NONE, QUIET)).toBeNull();
    expect(sm.update(ATTACK, QUIET)).toBe("punch");
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

  it("jumps on up, and the direction comes from the state you are in", () => {
    // No compound triggers: holding forward already puts you in walk_fwd, and
    // that state is what turns "up" into a forward jump.
    const f = machine();
    f.states.jump_up = { anim: "idle", transitions: [{ when: "landed", to: "idle" }] };
    f.states.jump_fwd = { anim: "idle", transitions: [{ when: "landed", to: "idle" }] };
    f.states.idle.transitions = [
      { when: "held:fwd", to: "walk_fwd" },
      { when: "held:up", to: "jump_up" },
    ];
    f.states.walk_fwd.transitions = [
      { when: "held:up", to: "jump_fwd" },
      { when: "!held:fwd", to: "idle" },
    ];

    const neutral = new StateMachine(f);
    expect(neutral.update(UP, QUIET)).toBe("jump_up");

    const forward = new StateMachine(f);
    expect(forward.update({ ...UP, fwd: true }, QUIET)).toBe("walk_fwd");
    expect(forward.update({ ...UP, fwd: true }, QUIET)).toBe("jump_fwd");
  });

  it("leaves an airborne state on landing, not before", () => {
    const f = machine();
    f.states.jump_up = { anim: "idle", airborne: true, transitions: [{ when: "landed", to: "idle" }] };
    f.states.idle.transitions = [{ when: "held:up", to: "jump_up" }];
    const sm = new StateMachine(f);
    sm.update(UP, QUIET);
    expect(sm.current).toBe("jump_up");
    expect(sm.update(NONE, QUIET)).toBeNull();
    expect(sm.update(NONE, { ...QUIET, landed: true })).toBe("idle");
  });

  it("switches to the falling pose at the apex, not when the rise animation ends", () => {
    // The rise animation is shorter than the climb, so animEnd would fire while
    // still going up. `falling` is the arc's own signal.
    const f = machine();
    f.states.jump_up = {
      anim: "idle",
      airborne: true,
      transitions: [{ when: "falling", to: "fall" }],
    };
    f.states.fall = { anim: "idle", airborne: true, transitions: [{ when: "landed", to: "idle" }] };
    const sm = new StateMachine(f);
    sm.force("jump_up");
    expect(sm.update(NONE, { ...QUIET, animEnded: true })).toBeNull(); // still rising
    expect(sm.update(NONE, { ...QUIET, falling: true })).toBe("fall");
  });

  it("starts the landing pose before touchdown, not after it", () => {
    // The landing animation is only worth playing if it is visible: nearGround
    // fires on the way down, so it finishes as the feet arrive.
    const f = machine();
    f.states.jump_up = {
      anim: "idle",
      airborne: true,
      transitions: [
        { when: "nearGround", to: "land" },
        { when: "landed", to: "land" },
      ],
    };
    f.states.land = { anim: "idle", airborne: true, transitions: [{ when: "landed", to: "idle" }] };
    const sm = new StateMachine(f);
    sm.force("jump_up");
    expect(sm.update(NONE, QUIET)).toBeNull();
    expect(sm.update(NONE, { ...QUIET, nearGround: true })).toBe("land");
    expect(sm.update(NONE, { ...QUIET, nearGround: true })).toBeNull();
    expect(sm.update(NONE, { ...QUIET, landed: true })).toBe("idle");
  });

  it("carries a launch impulse on the state that starts the jump", () => {
    const f = machine();
    f.states.jump_fwd = { anim: "idle", launch: [2.3, -6.5], airborne: true };
    const sm = new StateMachine(f);
    sm.force("jump_fwd");
    expect(sm.def.launch).toEqual([2.3, -6.5]);
    expect(sm.def.airborne).toBe(true);
    // The airborne state it continues into has no launch, so nothing re-fires.
    expect(machine().states.idle.launch).toBeUndefined();
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
    expect(sm.update(NONE, QUIET)).toBeNull();
    expect(sm.update(NONE, { ...QUIET, animEnded: true })).toBe("idle");
  });
});

describe("effectsNamed", () => {
  const file = (states: StatesFile["states"]): StatesFile => ({ initial: "idle", states });

  it("always includes the default, since a state without hitFx still sparks", () => {
    expect(effectsNamed(file({ idle: { anim: "idle" } }))).toEqual(["spark_1"]);
  });

  it("collects every effect the states name, without repeating one", () => {
    const states = file({
      punch: { anim: "punch", hitFx: "spark_1" },
      heavy: { anim: "heavy", hitFx: "spark_2" },
      kick: { anim: "kick", hitFx: "spark_2" },
    });
    expect(effectsNamed(states).sort()).toEqual(["spark_1", "spark_2"]);
  });

  it("survives an entity with no states at all", () => {
    expect(effectsNamed(null)).toEqual(["spark_1"]);
  });
});
