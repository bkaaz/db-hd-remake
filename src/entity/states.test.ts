import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { chainLinks, framesOf } from "../combat/chains";
import { startupOf } from "../combat/swing";
import { withHitTypes } from "../combat/hitTypes";
import { BUFFER_FRAMES } from "../input/buffer";
import {
  effectsNamed,
  spawnsNamed,
  groundSpeed,
  guardStateFor,
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
  attack: false,
  guard: false,
  smash: false,
  blast: false,
  strike: false,
  dash: false,
  qcf: false,
  qcb: false,
  hcf: false,
  dbf: false,
  holding: { attack: false, guard: false, smash: false, blast: false, strike: false, dash: false },
};
const FWD = { ...NONE, fwd: true };
const ATTACK = { ...NONE, attack: true };
const UP = { ...NONE, up: true };

/** Nothing happened to the entity this frame, and nobody is holding it. */
const QUIET = {
  animEnded: false,
  stunEnded: true,
  falling: false,
  nearGround: false,
  landed: false,
  close: {},
  hitConfirmed: false,
  /** Full, so a test about triggers is never quietly about affording a move. */
  ki: 100,
  /** Nothing thrown, so a pose waiting on its own projectile is free to end. */
  spawnEnded: true,
  charged: false,
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
    f.states.idle.transitions = [{ when: ["cancelable", "pressed:attack"], to: "walk_fwd" }];
    expect(validateStates(f, ANIMS).errors).toEqual([]);
  });

  it("reports an unknown trigger inside a list, not just a lone one", () => {
    const f = machine();
    f.states.idle.transitions = [{ when: ["cancelable", "pressed:x"], to: "walk_fwd" }];
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
    (f.states.idle as { rank: unknown }).rank = "smash";
    expect(validateStates(f, ANIMS).errors).toContain(
      'state "idle": "rank" must be a number, 0 or more',
    );
  });

  it("reports a malformed hitstun", () => {
    const f = machine();
    (f.states.idle as { hitstun: unknown }).hitstun = "long";
    expect(validateStates(f, ANIMS).errors).toContain(
      'state "idle": "hitstun" must be a number of game frames, 0 or more',
    );
  });

  it("reports a malformed relaunch", () => {
    const f = machine();
    (f.states.idle as { relaunch: unknown }).relaunch = "yes";
    expect(validateStates(f, ANIMS).errors).toContain('state "idle": "relaunch" must be true or false');
  });

  it("warns about a relaunch whose reaction cannot lift anybody", () => {
    // The flag on the wrong half of a pair: it reads as a launcher and behaves
    // like a jab, and nothing says so until a juggle refuses to end.
    const f = machine();
    f.states.hurt = { anim: "hurt", rank: 1, transitions: [{ when: "animEnd", to: "idle" }] };
    f.states.idle.relaunch = true;
    f.states.idle.onHit = "hurt";
    expect(validateStates(f, ANIMS).warnings).toContain(
      'state "idle": "relaunch" but its reaction "hurt" neither launches nor has an air version',
    );
  });

  it("stays quiet about a relaunch whose reaction launches", () => {
    const f = machine();
    f.states.knockdown = {
      anim: "hurt",
      rank: 3,
      launch: [null, -6],
      airborne: true,
      transitions: [{ when: "landed", to: "idle" }],
    };
    f.states.idle.relaunch = true;
    f.states.idle.onHit = "knockdown";
    expect(validateStates(f, ANIMS).warnings.filter((w) => w.includes("relaunch"))).toEqual([]);
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

  it("reports a hitstop that is not a frame count", () => {
    const f = machine();
    f.states.punch = { anim: "punch", hitstop: -1, transitions: [{ when: "animEnd", to: "idle" }] };
    f.states.idle.transitions?.push({ when: "pressed:attack", to: "punch" });
    expect(validateStates(f, ANIMS).errors).toContain(
      'state "punch": "hitstop" must be a number of game frames, 0 or more',
    );
  });

  it("accepts a hitstop of zero — an attack that deliberately does not pause", () => {
    const f = machine();
    f.states.punch = { anim: "punch", hitstop: 0, transitions: [{ when: "animEnd", to: "idle" }] };
    f.states.idle.transitions?.push({ when: "pressed:attack", to: "punch" });
    expect(validateStates(f, ANIMS).errors).toEqual([]);
  });

  it("reports damage that is not a number", () => {
    const f = machine();
    f.states.punch = { anim: "punch", damage: -3, transitions: [{ when: "animEnd", to: "idle" }] };
    f.states.idle.transitions?.push({ when: "pressed:attack", to: "punch" });
    expect(validateStates(f, ANIMS).errors).toContain(
      'state "punch": "damage" must be a number, 0 or more',
    );
  });

  it("accepts damage of zero — an attack that only moves the opponent", () => {
    const f = machine();
    f.states.punch = { anim: "punch", damage: 0, transitions: [{ when: "animEnd", to: "idle" }] };
    f.states.idle.transitions?.push({ when: "pressed:attack", to: "punch" });
    expect(validateStates(f, ANIMS).errors).toEqual([]);
  });

  it("reports a state that strikes without saying what it costs", () => {
    // No attribute stands in any more (ADR 0019): a forgotten damage is loud.
    const f = machine();
    const swing = { loop: false, steps: [{ boxes: [{ type: "hit" }] }] };
    f.states.swing = { anim: "swing", transitions: [{ when: "animEnd", to: "idle" }] };
    f.states.idle.transitions?.push({ when: "pressed:attack", to: "swing" });
    expect(validateStates(f, { ...ANIMS, swing }).errors).toContain(
      'state "swing": its animation has a hit box, so it needs "damage" — 0 for a blow that only moves',
    );
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
    f.states.idle.transitions?.push({ when: "pressed:attack", to: "punch" });
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
    f.states.idle.transitions?.push({ when: "pressed:attack", to: "punch" });
    expect(validateStates(f, ANIMS)).toEqual({ errors: [], warnings: [] });
  });

  it.each(["goku_old", "goku"])("keeps the entity we ship, %s, valid", (entity) => {
    // The point of the validator: catch a typo in hand-authored data. Checking
    // the committed states against the committed animations is what makes that
    // guarantee real — warnings are allowed (data is still being authored),
    // errors are not.
    const read = <T>(file: string): T =>
      JSON.parse(
        readFileSync(fileURLToPath(new URL(`../../data/entities/${entity}/${file}`, import.meta.url)), "utf8"),
      ) as T;
    const states = read<StatesFile>("states.json");
    const anims = read<Record<string, AnimInfo>>("animations.json");
    expect(validateStates(states, anims).errors).toEqual([]);
  });
});

describe("the arithmetic of a blow, against the data we ship", () => {
  /**
   * Three sums, each of which was a bug before it was a test: can the next link
   * still **reach**, is the victim still **helpless** when it arrives, and does
   * landing a blow leave you acting **first**. All of them are properties of the
   * committed data, so they are checked here rather than by playing.
   *
   * The failure the first one exists to prevent, found by playing: the middle of
   * the kick string forced `hurt_heavy`, whose knockback is 62 sprite px,
   * against a longest reach in the whole game of 44. The third blow could not
   * connect — not badly tuned, arithmetically impossible.
   *
   * So for every chain transition, measure what the blow does to the distance
   * between the two fighters and compare it with how far the next one reaches.
   * The margin is crude, because it ignores where they were standing and how
   * wide the defender is, but the number it catches is not a near miss.
   */
  const read = <T>(file: string): T =>
    JSON.parse(
      readFileSync(fileURLToPath(new URL(`../../data/entities/goku_old/${file}`, import.meta.url)), "utf8"),
    ) as T;

  interface Step {
    dur: number;
    boxes?: { type: string; x: number; w: number }[];
  }
  const anims = read<Record<string, { steps: Step[] }>>("animations.json");
  const states = withHitTypes(read<StatesFile>("states.json")).states;
  const attributes = read<{ hitstun: number }>("attributes.json");

  /**
   * How long a blow holds its victim — the blow's own number, or the fighter's
   * default. **Not the reaction animation's length**: that is exactly the
   * coupling `hitstun` exists to break, and reading it here would put it back.
   */
  const hitstun = (attack: string): number => states[attack].hitstun ?? attributes.hitstun;

  const frames = (anim: string): number => framesOf(anims[anim]);
  const reach = (anim: string): number =>
    Math.max(
      0,
      ...(anims[anim]?.steps ?? []).flatMap((s) =>
        (s.boxes ?? []).filter((b) => b.type === "hit").map((b) => b.x + b.w),
      ),
    );

  /**
   * Every cancel in the file, with its arithmetic already done — by the same
   * function `npm run chains` prints, so the two cannot drift apart by a frame
   * and leave nobody knowing which one is lying.
   */
  const chains = chainLinks({ initial: "idle", states }, anims, attributes.hitstun);
  const links = chains.map((l) => [l.from, l.to] as const);

  it("finds the chains that exist, so this suite cannot pass by testing nothing", () => {
    expect(links.length).toBeGreaterThan(0);
  });

  it.each(links)("%s can still be followed by %s", (from, to) => {
    const attack = states[from];
    const reaction = states[attack.onHit ?? ""];
    // A reaction that launches is a knockdown: the chain is over either way.
    if (!reaction?.vel) return;

    // Knockback is velocity times how long the reaction lasts, and what decides
    // that is now the blow's hitstun rather than the pose — so tuning how long
    // a fighter is held also moves them, which is worth remembering when the
    // curves of §3 arrive.
    const knockback = Math.abs(reaction.vel[0]) * hitstun(from);
    const advance = (attack.vel?.[0] ?? 0) * frames(attack.anim);
    expect(knockback - advance).toBeLessThan(reach(states[to].anim));
  });

  /**
   * Distance is only half of it, and the recording found the other half: the
   * defender has to still be *helpless* when the next blow arrives, not merely
   * within range of it.
   *
   * From the blow landing, both fighters freeze for the same hit pause, so it
   * cancels out of both sides of the sum. What is left is the **worst case**,
   * because the player picks when to press: the latest frame the cancel may
   * fire, plus the next attack's start-up, against the hitstun this blow gave.
   * `cancelBy` is that latest frame; without one it is the end of the animation,
   * which is how a string can look like it chains while the defender stands up
   * between blows (`combat.md`, 2026-08-16).
   *
   * And it is measured **at the link's own depth in the chain**, because scaling
   * shortens each successive hitstun — a string that holds at its opener can
   * still fall apart at its third link, which is exactly what happened.
   */
  const startup = (anim: string): number => startupOf(anims[anim]);

  it.each(chains)("$from still has $to helpless when the next blow lands", (link) => {
    if (link.launcher) return; // a knockdown: helplessness is not the question
    expect(link.margin).toBeGreaterThanOrEqual(0);
  });

  /**
   * The third arithmetic, and the one a recording found: **landing a blow must
   * not leave you acting second.** Hitstun against the attacker's own recovery,
   * with the hit pause cancelling out of both sides as always.
   *
   * There are two ways to be safe and only requiring the first would be wrong.
   * Either you recover first, or you have put them further away than anything in
   * the game can reach — a heavy that pushes 62 px cannot be punished at that
   * distance whatever the frame count says.
   *
   * A launcher is exempt: its reaction has no `vel` because the victim is in the
   * air, and being minus against somebody still falling means nothing.
   *
   * **An airborne attack is exempt too**, and for a matching reason on the other
   * side of the blow: its state ends on `landed`, so the frames left in its
   * animation are not its recovery — the ground is. `hop_lunge` holds its
   * descending frame for as long as the arc needs and would read as minus one
   * here while never playing that long. Whatever replaces this check for air
   * attacks has to know the arc, which this file cannot.
   */
  const advantage = (attack: string): number =>
    // The `- 1` is measured, not derived: collision is resolved after both
    // fighters have advanced, so the frame a blow lands on is already spent for
    // the attacker and not yet for the defender. A recording of the jab put it
    // at +3 where the sum without it says +4.
    hitstun(attack) - (frames(states[attack].anim) - startup(states[attack].anim)) - 1;

  /** The longest any attack reaches, which is what "out of range" has to beat. */
  const longestReach = Math.max(
    ...Object.values(states)
      .filter((d) => d.onHit)
      .map((d) => reach(d.anim)),
  );

  const grounded = Object.entries(states)
    .filter(
      ([, d]) =>
        d.onHit !== undefined && states[d.onHit]?.vel !== undefined && d.airborne !== true,
    )
    .map(([name]) => name);

  it("finds the blows that keep the victim on the ground", () => {
    expect(grounded.length).toBeGreaterThan(0);
  });

  it("keeps the jab's advantage reachable — the buffer outlasts its recovery", () => {
    /**
     * The other half of frame advantage, and the half a recording found: being
     * plus is worthless if the press cannot survive to the frame it is spent on.
     *
     * The jab is the case that matters, because it is the only blow whose plus
     * is used by **linking** — waiting out your own recovery — rather than by
     * cancelling out of it. Hitstop is free (a frozen entity does not age the
     * buffer); the animation frames left after the hit are not.
     */
    const left = frames("punch") - startup("punch");
    expect(BUFFER_FRAMES).toBeGreaterThan(left);
  });

  // A rush that stops on its third blow is punishable, accepted by the owner
  // 2026-09-29: the hit type sets the hitstun, and nothing may hold it longer.
  const mayBePunished = new Set(["kick_high_rush"]);

  const judged = grounded.filter((n) => !mayBePunished.has(n));

  it.each(judged)("%s does not leave its owner punishable", (name) => {
    const reaction = states[states[name].onHit ?? ""];
    const knockback = Math.abs(reaction?.vel?.[0] ?? 0) * hitstun(name);
    // Phrased as a sentence so a failure names the numbers instead of saying
    // "expected false to be true".
    const verdict =
      advantage(name) >= 0
        ? "recovers first"
        : knockback > longestReach
          ? "pushes them out of range"
          : `punishable: ${advantage(name)} frames, pushed only ${knockback.toFixed(0)} px`;
    expect(verdict).not.toMatch(/^punishable/);
  });
});

/** idle ⇄ walk_fwd, plus an attack reached with the light button. */
function withAttack(when: string | string[] = "pressed:attack"): StatesFile {
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
    expect(sm.pressSpent).toBe("attack");
  });

  it("finds the button inside a conjunction", () => {
    const sm = new StateMachine(withAttack(["cancelable", "pressed:attack"]));
    sm.update(ATTACK, { ...QUIET, hitConfirmed: true });
    expect(sm.current).toBe("punch");
    expect(sm.pressSpent).toBe("attack");
  });
});

describe("cancelBy closes the window a chain fires in", () => {
  /** An attack that may only be cancelled in its first three frames. */
  function windowed(): StatesFile {
    const f = withAttack();
    f.states.punch = {
      anim: "punch",
      cancelBy: 3,
      transitions: [
        { when: ["cancelable", "pressed:guard"], to: "kick" },
        { when: "animEnd", to: "idle" },
      ],
    };
    f.states.kick = { anim: "kick", transitions: [] };
    return f;
  }
  const CONNECTED = { ...QUIET, hitConfirmed: true };
  const MEDIUM = { ...NONE, guard: true };

  it("lets the cancel through while the window is open", () => {
    const sm = new StateMachine(windowed());
    sm.update(ATTACK, QUIET); // idle -> punch
    sm.update(MEDIUM, CONNECTED);
    expect(sm.current).toBe("kick");
  });

  it("refuses it afterwards, however long the attack still plays", () => {
    // The whole point: recovery may be long enough to read and to punish
    // without the cancel window growing with it.
    const sm = new StateMachine(windowed());
    sm.update(ATTACK, QUIET);
    for (let i = 0; i < 5; i++) sm.update(NONE, CONNECTED);
    sm.update(MEDIUM, CONNECTED);
    expect(sm.current).toBe("punch");
  });

  it("counts from entering the state, so every attempt gets the same window", () => {
    const sm = new StateMachine(windowed());
    sm.update(ATTACK, QUIET);
    for (let i = 0; i < 9; i++) sm.update(NONE, CONNECTED);
    sm.update(NONE, { ...CONNECTED, animEnded: true }); // punch -> idle
    expect(sm.current).toBe("idle");
    sm.update(ATTACK, QUIET); // idle -> punch again
    sm.update(MEDIUM, CONNECTED);
    expect(sm.current).toBe("kick");
  });

  it("leaves an attack without one cancellable to the end", () => {
    const f = windowed();
    delete f.states.punch.cancelBy;
    const sm = new StateMachine(f);
    sm.update(ATTACK, QUIET);
    for (let i = 0; i < 20; i++) sm.update(NONE, CONNECTED);
    sm.update(MEDIUM, CONNECTED);
    expect(sm.current).toBe("kick");
  });
});

describe("a string goes on through a miss", () => {
  // punch: 2 frames of wind-up, 2 with a hit box, 6 of recovery; cancelBy 4,
  // so a hit may cancel for 2 frames and a miss for 2 frames from frame 5.
  const PUNCH = {
    steps: [
      { dur: 2, boxes: [{ type: "hurt" }] },
      { dur: 2, boxes: [{ type: "hit" }] },
      { dur: 6, boxes: [{ type: "hurt" }] },
    ],
  };
  function chained(): StatesFile {
    const f = withAttack();
    f.states.punch = {
      anim: "punch",
      cancelBy: 4,
      transitions: [
        { when: ["cancelable", "pressed:guard"], to: "kick" },
        { when: "animEnd", to: "idle" },
      ],
    };
    f.states.kick = { anim: "kick", transitions: [] };
    return f;
  }
  const MEDIUM = { ...NONE, guard: true };

  /** Enter the punch, wait `frames` frames having hit nothing, then press. */
  const pressAfter = (frames: number, anims: Record<string, typeof PUNCH> = { punch: PUNCH }): string => {
    const sm = new StateMachine(chained(), anims);
    sm.update(ATTACK, QUIET);
    for (let i = 0; i < frames; i++) sm.update(NONE, QUIET);
    sm.update(MEDIUM, QUIET);
    return sm.current;
  };

  it("not while the swing may still connect", () => {
    expect(pressAfter(3)).toBe("punch");
  });

  it("once the last hit box is gone", () => {
    expect(pressAfter(4)).toBe("kick");
  });

  it("for as long as a hit's window lasts, and no longer", () => {
    expect(pressAfter(5)).toBe("kick");
    expect(pressAfter(6)).toBe("punch");
  });

  it("never when the machine does not know the animation", () => {
    expect(pressAfter(4, {})).toBe("punch");
  });
});

describe("a `when` of several triggers needs all of them", () => {
  const CHAIN = ["cancelable", "pressed:attack"];

  it("fires when both hold", () => {
    const sm = new StateMachine(withAttack(CHAIN));
    sm.update(ATTACK, { ...QUIET, hitConfirmed: true });
    expect(sm.current).toBe("punch");
  });

  it("does not fire on the button alone, while the swing may still connect", () => {
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
    const sm = new StateMachine(withAttack(["!held:back", "pressed:attack"]));
    sm.update({ ...ATTACK, back: true }, QUIET);
    expect(sm.current).toBe("idle");
    sm.update(ATTACK, QUIET);
    expect(sm.current).toBe("punch");
  });
});

describe("a reaction leaves on the blow's clock, not on the pose", () => {
  /** A flinch whose only way out is the hitstun running out. */
  function stunned(): StatesFile {
    const f = machine();
    f.states.hurt = { anim: "hurt", rank: 1, transitions: [{ when: "stunEnd", to: "idle" }] };
    return f;
  }

  it("holds while the blow still has frames left", () => {
    const sm = new StateMachine(stunned());
    sm.force("hurt");
    expect(sm.update(NONE, { ...QUIET, stunEnded: false })).toBeNull();
    expect(sm.current).toBe("hurt");
  });

  it("lets go the frame it runs out", () => {
    const sm = new StateMachine(stunned());
    sm.force("hurt");
    sm.update(NONE, { ...QUIET, stunEnded: false });
    expect(sm.update(NONE, { ...QUIET, stunEnded: true })).toBe("idle");
  });

  it("does not care that the animation ended first", () => {
    // The whole point: a pose that runs out early holds its last frame, and a
    // long one is cut off. Either way the number decides.
    const sm = new StateMachine(stunned());
    sm.force("hurt");
    expect(sm.update(NONE, { ...QUIET, stunEnded: false, animEnded: true })).toBeNull();
    expect(sm.current).toBe("hurt");
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
    f.states.idle.transitions = [{ when: "pressed:attack", to: "punch" }];
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

  it("picks the close version of a button only with the opponent in range", () => {
    // The original's close Y: the same press, a different move by distance.
    const f = machine();
    f.states.idle.transitions = [
      { when: ["pressed:attack", "close:attack"], to: "punch_close" },
      { when: "pressed:attack", to: "punch" },
    ];
    f.states.punch = { anim: "punch", damage: 1, transitions: [{ when: "animEnd", to: "idle" }] };
    f.states.punch_close = { anim: "punch", damage: 1, transitions: [{ when: "animEnd", to: "idle" }] };
    expect(new StateMachine(f).update(ATTACK, QUIET)).toBe("punch");
    // Another button's range says nothing about this one.
    expect(new StateMachine(f).update(ATTACK, { ...QUIET, close: { smash: true } })).toBe("punch");
    expect(new StateMachine(f).update(ATTACK, { ...QUIET, close: { attack: true } })).toBe("punch_close");
  });

  it("changes the forward speed at the frames velAt names, vel before the first", () => {
    const kick = { anim: "punch", vel: [0.5, 0] as [number, number], velAt: [[4, 2.375], [8, 1.25]] as [number, number][] };
    expect([0, 3, 4, 7, 8, 30].map((f) => groundSpeed(kick, f))).toEqual([0.5, 0.5, 2.375, 2.375, 1.25, 1.25]);
    expect(groundSpeed({ anim: "idle" }, 5)).toBe(0);
  });

  it("refuses a velAt whose frames do not rise", () => {
    const f = machine();
    f.states.punch = { anim: "punch", damage: 1, velAt: [[8, 1], [4, 2]], transitions: [{ when: "animEnd", to: "idle" }] };
    f.states.idle.transitions?.push({ when: "pressed:attack", to: "punch" });
    expect(validateStates(f, ANIMS).errors.some((e) => e.includes('"velAt"'))).toBe(true);
  });

  describe("a charge: frames:N and released:<button>", () => {
    // The charged Kamehameha: let go early and it fires small, but not before
    // frame 20; held through, it carries on charging.
    const HOLD = { ...NONE, holding: { ...NONE.holding, blast: true } };
    function charge() {
      const f = machine();
      f.states.charge = {
        anim: "idle",
        transitions: [
          { when: ["frames:20", "released:blast"], to: "small" },
          { when: "frames:20", to: "more" },
        ],
      };
      f.states.small = { anim: "idle", transitions: [{ when: "animEnd", to: "idle" }] };
      f.states.more = { anim: "idle", transitions: [{ when: "animEnd", to: "idle" }] };
      const sm = new StateMachine(f);
      sm.force("charge");
      return sm;
    }
    const run = (sm: StateMachine, inputs: (typeof NONE)[]) => inputs.map((i) => sm.update(i, QUIET)).filter(Boolean);

    it("waits for the frame, then goes where the release says", () => {
      const sm = charge();
      expect(run(sm, [...Array(5).fill(HOLD), ...Array(14).fill(NONE)])).toEqual([]);
      expect(sm.update(NONE, QUIET)).toBe("small");
    });

    it("keeps a release once made, even pressed again", () => {
      const sm = charge();
      expect(run(sm, [HOLD, NONE, ...Array(18).fill(HOLD)])).toEqual(["small"]);
    });

    it("carries on when held through", () => {
      expect(run(charge(), Array(20).fill(HOLD))).toEqual(["more"]);
    });

    it("forgets a release when the state changes", () => {
      const sm = charge();
      run(sm, [NONE]);
      sm.force("charge");
      expect(run(sm, Array(20).fill(HOLD))).toEqual(["more"]);
    });
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

describe("a state that costs ki", () => {
  /** Idle, one button, and a special behind it that has to be paid for. */
  const machine = (cost: number): StatesFile => ({
    initial: "idle",
    states: {
      idle: {
        anim: "idle",
        transitions: [
          { when: "pressed:blast", to: "blast" },
          { when: "pressed:attack", to: "punch" },
        ],
      },
      blast: { anim: "blast", cost },
      punch: { anim: "punch" },
    },
  });
  const SPECIAL = { ...NONE, blast: true };

  it("comes out when the meter covers it", () => {
    const sm = new StateMachine(machine(10));
    sm.update(SPECIAL, { ...QUIET, ki: 10 });
    expect(sm.current).toBe("blast");
  });

  it("does not come out at all when it does not", () => {
    const sm = new StateMachine(machine(10));
    sm.update(SPECIAL, { ...QUIET, ki: 9 });
    expect(sm.current).toBe("idle");
  });

  it("leaves the rest of the frame's transitions their turn", () => {
    const sm = new StateMachine(machine(10));
    // Both buttons in one frame: the special is unaffordable, so the punch —
    // listed after it — must still be allowed to fire.
    sm.update({ ...SPECIAL, attack: true }, { ...QUIET, ki: 0 });
    expect(sm.current).toBe("punch");
  });
});

describe("spawnsNamed", () => {
  const file = (states: StatesFile["states"]): StatesFile => ({ initial: "idle", states });

  it("collects every projectile the states fire, without repeating one", () => {
    const states = file({
      idle: { anim: "idle" },
      blast: { anim: "blast", fires: { spawn: "ki_bolt", at: [30, -50] } },
      blast_air: { anim: "blast_air", fires: { spawn: "ki_bolt", at: [30, -30] } },
      big: { anim: "big", fires: { spawn: "ki_bolt_big", at: [30, -50] } },
    });
    expect(spawnsNamed(states).sort()).toEqual(["ki_bolt", "ki_bolt_big"]);
  });

  it("is empty for a fighter who throws nothing, and for no states at all", () => {
    expect(spawnsNamed(file({ idle: { anim: "idle" } }))).toEqual([]);
    expect(spawnsNamed(null)).toEqual([]);
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
      smash: { anim: "smash", hitFx: "spark_2" },
      kick: { anim: "kick", hitFx: "spark_2" },
    });
    expect(effectsNamed(states).sort()).toEqual(["spark_1", "spark_2"]);
  });

  it("survives an entity with no states at all", () => {
    expect(effectsNamed(null)).toEqual(["spark_1"]);
  });
});

describe("guarding", () => {
  it("refuses a reaction that blocks", () => {
    // The rule that makes a combo a combo: a fighter a blow already holds
    // cannot answer the next one, or every sequence is escapable.
    const f = machine();
    f.states.idle.rank = 1;
    f.states.idle.guarding = true;
    expect(validateStates(f, ANIMS).errors).toContain(
      'state "idle": a reaction (rank 1) cannot be "guarding"',
    );
  });

  it("lets a fighter who is their own block", () => {
    const f = machine();
    f.states.idle.guarding = true;
    expect(validateStates(f, ANIMS).errors).toEqual([]);
  });
});

describe("guardStateFor", () => {
  /** A fighter who blocks standing, and blocks differently while crouching. */
  function fighter(): StatesFile {
    return {
      initial: "idle",
      onGuard: "guard_hit",
      states: {
        idle: { anim: "idle", vel: [0, 0], turn: true, transitions: [] },
        crouch: {
          anim: "idle",
          vel: [0, 0],
          turn: true,
          guard: "guard_crouch",
          transitions: [],
        },
        guard_hit: { anim: "hurt", vel: [0, 0], turn: false, transitions: [] },
        guard_crouch: { anim: "hurt", vel: [0, 0], turn: false, transitions: [] },
      },
    };
  }

  it("uses the stance's own block when it declares one", () => {
    const f = fighter();
    expect(guardStateFor(f.states.crouch, f)).toBe("guard_crouch");
  });

  it("falls back to the fighter's default when the stance declares none", () => {
    const f = fighter();
    expect(guardStateFor(f.states.idle, f)).toBe("guard_hit");
  });

  it("cannot block at all when nothing names a guard", () => {
    const f = fighter();
    delete f.onGuard;
    expect(guardStateFor(f.states.idle, f)).toBeUndefined();
    // The crouch still can: its own is what it asked for, not a fallback.
    expect(guardStateFor(f.states.crouch, f)).toBe("guard_crouch");
  });

  it("refuses a guard that names a state which does not exist", () => {
    const f = fighter();
    f.states.crouch.guard = "guard_crouhc";
    expect(guardStateFor(f.states.crouch, f)).toBeUndefined();
  });

  it("has nothing to offer without a file", () => {
    expect(guardStateFor(undefined, undefined)).toBeUndefined();
  });
});

describe("a stance's own guard, through the validator", () => {
  function crouching(): StatesFile {
    const f = machine();
    f.onGuard = "guard_hit";
    const leaves = [{ when: "animEnd", to: "idle" } as const];
    f.states.guard_hit = { anim: "hurt", vel: [0, 0], turn: false, transitions: leaves };
    f.states.guard_crouch = {
      anim: "hurt",
      vel: [0, 0],
      turn: false,
      // A block blocks the way it already is: without this, a second blow
      // arriving during the first block falls back to the standing one.
      guard: "guard_crouch",
      transitions: leaves,
    };
    f.states.idle.guard = "guard_crouch";
    return f;
  }

  it("accepts a stance that names its own block", () => {
    expect(validateStates(crouching(), ANIMS).errors).toEqual([]);
  });

  it("reports a guard that names a state which does not exist", () => {
    const f = crouching();
    f.states.idle.guard = "guard_crouhc";
    expect(validateStates(f, ANIMS).errors).toContain(
      'state "idle": guard state "guard_crouhc" does not exist',
    );
  });

  it("warns when a block would change stance halfway through a blocked string", () => {
    // The bug this exists for: the second blow of a string arrives while the
    // defender is still in the first block, so the block itself is what gets
    // asked how to cover. One that names none falls back to the file's and
    // stands a crouching fighter up (owner's recording, 2026-08-22).
    const f = crouching();
    delete f.states.guard_crouch.guard;
    expect(validateStates(f, ANIMS).warnings).toContain(
      'state "guard_crouch" is a block, but blocking again from it goes to ' +
        '"guard_hit" — a blocked string would change stance mid-way',
    );
  });

  it("is quiet about a block that covers the same way from itself", () => {
    const warnings = validateStates(crouching(), ANIMS).warnings.join(" ");
    expect(warnings).not.toContain("change stance mid-way");
  });

  it("does not call a block unreachable just because nothing transitions to it", () => {
    // It is forced from outside on contact, exactly like a reaction — the thing
    // reachability already knows about `onGotHit` and every `onHit`.
    expect(validateStates(crouching(), ANIMS).warnings).not.toContain(
      'state "guard_crouch" is unreachable (no transition leads to it)',
    );
  });
});

describe("a crouching defender keeps the crouch a blow arrives on", () => {
  /** Flinch and stagger, each with a low version; knockdown has none. */
  function defender(): StatesFile {
    return {
      initial: "idle",
      onGotHit: "hurt",
      states: {
        crouch: { anim: "idle", crouching: true },
        hurt: { anim: "hurt", rank: 1, ifAirborne: "hurt_air", ifCrouching: "hurt_crouch" },
        hurt_air: { anim: "hurt", rank: 1, airborne: true },
        hurt_crouch: { anim: "hurt", rank: 1, crouching: true },
        hurt_heavy: { anim: "hurt", rank: 2, ifCrouching: "hurt_heavy_crouch" },
        hurt_heavy_crouch: { anim: "hurt", rank: 2, crouching: true },
        knockdown: { anim: "hurt", rank: 3, airborne: true },
      },
    };
  }
  const LOW: StateDef = { anim: "crouch", crouching: true };
  const STANDING = undefined;
  const IN_AIR: StateDef = { anim: "jump", airborne: true };

  it("sends a low defender to the low version of the blow's reaction", () => {
    expect(reactionFor(undefined, defender(), LOW)).toBe("hurt_crouch");
    expect(reactionFor("hurt_heavy", defender(), LOW)).toBe("hurt_heavy_crouch");
  });

  it("stays standing when the defender is not low", () => {
    expect(reactionFor(undefined, defender(), STANDING)).toBe("hurt");
  });

  it("keeps the crouch through a string, because the reaction is low too", () => {
    // The failure this is here for: the second blow arrives while the defender
    // is already in the low reaction, so *that* is the state being asked. A
    // reaction not marked `crouching` would stand them up mid-string, which is
    // exactly what the crouching guard did on its first day.
    const f = defender();
    expect(reactionFor(undefined, f, f.states.hurt_crouch)).toBe("hurt_crouch");
  });

  it("lets airborne win when a state somehow claims both", () => {
    // You cannot crouch in mid-air, and a grounded reaction on a body in the
    // air erases the jump — the failure ifAirborne exists to prevent.
    const both: StateDef = { anim: "jump", airborne: true, crouching: true };
    expect(reactionFor(undefined, defender(), both)).toBe("hurt_air");
    expect(reactionFor(undefined, defender(), IN_AIR)).toBe("hurt_air");
  });

  it("invents nothing: a reaction with no low version is used as it stands", () => {
    expect(reactionFor("knockdown", defender(), LOW)).toBe("knockdown");
  });
});

describe("ifCrouching, through the validator", () => {
  function lowered(): StatesFile {
    const f = machine();
    f.onGotHit = "hurt";
    f.states.hurt = {
      anim: "hurt",
      rank: 1,
      ifCrouching: "hurt_crouch",
      transitions: [{ when: "stunEnd", to: "idle" }],
    };
    f.states.hurt_crouch = {
      anim: "hurt",
      rank: 1,
      crouching: true,
      transitions: [{ when: "stunEnd", to: "idle" }],
    };
    return f;
  }

  it("accepts a reaction with a low version that is itself low", () => {
    expect(validateStates(lowered(), ANIMS).errors).toEqual([]);
    expect(validateStates(lowered(), ANIMS).warnings.join(" ")).not.toContain("ifCrouching");
  });

  it("reports a low version that is not a state", () => {
    const f = lowered();
    f.states.hurt.ifCrouching = "hurt_crouhc";
    expect(validateStates(f, ANIMS).errors).toContain(
      'state "hurt": ifCrouching "hurt_crouhc" is not a state',
    );
  });

  it("warns about a low version that would stand the defender up", () => {
    const f = lowered();
    delete f.states.hurt_crouch.crouching;
    expect(validateStates(f, ANIMS).warnings).toContain(
      'state "hurt": ifCrouching "hurt_crouch" is not itself crouching — ' +
        "the next blow of a string would stand the defender up",
    );
  });

  it("does not call a low version unreachable — the reaction that names it reaches it", () => {
    expect(validateStates(lowered(), ANIMS).warnings).not.toContain(
      'state "hurt_crouch" is unreachable (no transition leads to it)',
    );
  });
});
