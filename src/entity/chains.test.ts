import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { withHitTypes } from "../combat/hitTypes";
import { Motions } from "../input/motion";
import {
  reactionFor,
  StateMachine,
  type InputSnapshot,
  type Signals,
  type StatesFile,
} from "./states";

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

/** As the engine runs it: every hit type spelled out. */
const goku = (): StatesFile =>
  withHitTypes(
    JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../../data/entities/goku_old/states.json", import.meta.url)),
        "utf8",
      ),
    ) as StatesFile,
  );

const anims = (): Record<string, { steps: { frame: string; dur: number; boxes?: { type: string }[] }[] }> =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../../data/entities/goku_old/animations.json", import.meta.url)),
      "utf8",
    ),
  );

/** From `attributes.json`, which these numbers are derived against. */
const { gravity: GRAVITY, pushWidth: PUSH_WIDTH } = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../data/entities/goku_old/attributes.json", import.meta.url)),
    "utf8",
  ),
) as { gravity: number; pushWidth: number };

const NOTHING: InputSnapshot = {
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
  holding: { attack: false, guard: false, smash: false, blast: false, strike: false, dash: false },
};
const QUIET: Signals = {
  animEnded: false,
  // Nobody is stunned unless a test says so: the fighter driving a chain is the
  // one landing the blows, not the one taking them.
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

/**
 * One fighter's state machine, stepped a frame at a time.
 *
 * The buffer is not modelled: a press here means "the buffer has this press
 * available", which is what the machine is handed by the entity anyway.
 */
class Sim {
  private readonly sm = new StateMachine(goku(), anims());
  // The real recogniser, fed the same way the entity feeds it, so a test about
  // a motion is a test of the thing the game runs and not of a boolean.
  private readonly motions = new Motions();

  get state(): string {
    return this.sm.current;
  }

  /** One game frame. Returns the state it left you in. */
  frame(input: Partial<InputSnapshot> = {}, signals: Partial<Signals> = {}): string {
    const at = { ...NOTHING, ...input };
    this.motions.push(at);
    this.sm.update({ ...at, qcf: this.motions.has("qcf"), qcb: this.motions.has("qcb") }, { ...QUIET, ...signals });
    return this.sm.current;
  }

  /** Put the fighter somewhere from outside, the way a blow landing does. */
  force(state: string): void {
    this.sm.force(state);
  }

  /** A blow of ours connected this frame and the player asked for the next one. */
  confirmAnd(button: keyof InputSnapshot): string {
    return this.frame({ [button]: true }, { hitConfirmed: true });
  }
}

describe("the bolt the beam throws", () => {
  const bolt = (): StatesFile =>
    JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../../data/spawns/kame_bolt/states.json", import.meta.url)),
        "utf8",
      ),
    ) as StatesFile;

  it("climbs on a launch rather than on a velocity, since only momentum carries", () => {
    const up = bolt().states.fly_up;
    expect(up.airborne).toBe(true);
    expect(up.launch?.[1]).toBeLessThan(0);
    expect(up.launch?.[0]).toBeGreaterThan(0);
  });

  it("cannot arc, because a beam that fell would be a thrown rock", () => {
    const attributes = JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../../data/spawns/kame_bolt/attributes.json", import.meta.url)),
        "utf8",
      ),
    ) as { gravity?: number };
    expect(attributes.gravity).toBe(0);
  });

  it("hits the same way whichever direction it went", () => {
    const { fly, fly_up: up } = bolt().states;
    for (const key of ["damage", "hitstun", "hitstop", "onHit", "hitFx"] as const) {
      expect(up[key]).toEqual(fly[key]);
    }
  });
});

describe("charging ki is a stance, not a press", () => {
  /** Both attack keys down — the state an edge cannot describe. */
  const holdAZ = { holding: { attack: true, guard: true, smash: false, blast: false, strike: false, dash: false } };

  it("drops into the charge on A+Z and loops there", () => {
    const s = new Sim();
    expect(s.frame(holdAZ)).toBe("charge_start");
    expect(s.frame(holdAZ, { animEnded: true })).toBe("charge");
    expect(s.frame(holdAZ)).toBe("charge");
  });

  it("leaves the moment either key comes up", () => {
    const s = new Sim();
    s.frame(holdAZ);
    s.frame(holdAZ, { animEnded: true });
    const half = { holding: { attack: true, guard: false, smash: false, blast: false, strike: false, dash: false } };
    expect(s.frame(half)).toBe("idle");
  });

  it("is the one state that fills the meter", () => {
    // A field on the state rather than a rule in the engine. What a special
    // pays is `cost`, a separate field; nothing else in the file fills.
    const states = goku().states;
    const filling = Object.entries(states)
      .filter(([, d]) => d.ki !== undefined)
      .map(([name]) => name);
    expect(filling).toEqual(["charge"]);
    expect(states.charge.ki).toBeGreaterThan(0);
  });

  it("hums through the hand-over from the drop-in to the loop", () => {
    // Both states name the same loopSound on purpose: the entity only restarts
    // a loop whose id changed, so naming it twice is what keeps the hum from
    // clicking when charge_start runs into charge.
    const states = goku().states;
    expect(states.charge_start.loopSound).toBe(states.charge.loopSound);
    expect(states.charge.loopSound).toBeDefined();
    // And at the same rate, or the seam would change the rhythm even without
    // restarting the clock.
    expect(states.charge_start.loopEvery).toBe(states.charge.loopEvery);
    // The shout is one-shot and belongs only to the frame you drop into.
    expect(states.charge_start.sound).toBeDefined();
    expect(states.charge.sound).toBeUndefined();
  });

  it("does not swallow a single button", () => {
    // The stance is checked before every attack, so this is the assertion that
    // keeps it from eating the whole moveset: one key down is still a blow.
    const s = new Sim();
    const onlyAttack = { attack: true, holding: { attack: true, guard: false, smash: false, blast: false, strike: false, dash: false } };
    expect(s.frame(onlyAttack)).toBe("kick_mid");
  });
});

describe("a diagonal changes stance before it does anything else", () => {
  /**
   * What this stops, and it took a session of "the input is hard to hit" to
   * find: `held:fwd` used to be checked before `held:down`, so down-forward
   * read as walking and the crouching move was two frames away — long enough
   * that the button almost always landed on the standing one instead, spending
   * the press on a move nobody asked for.
   */
  it("crouches on down-forward rather than walking", () => {
    expect(new Sim().frame({ down: true, fwd: true })).toBe("crouch_down");
    expect(new Sim().frame({ down: true, back: true })).toBe("crouch_down");
  });

  it("gives the crouching smash on down + smash, not the standing one", () => {
    const s = new Sim();
    s.frame({ down: true, smash: true });
    expect(s.frame({ down: true, smash: true })).toBe("knee_rise");
  });
});

describe("the rush — attack walks it, smash ends it", () => {
  /** A rush of `attacks` connected blows, then a smash — Burst Limit's X…XY. */
  const rush = (attacks: number): string => {
    const s = new Sim();
    s.frame({ attack: true });
    for (let i = 1; i < attacks; i++) s.confirmAnd("attack");
    return s.confirmAnd("smash");
  };

  it("walks kick_mid → kick_thrust → kick_high_rush → kick_low when every blow connects", () => {
    const s = new Sim();
    expect(s.frame({ attack: true })).toBe("kick_mid");
    expect(s.confirmAnd("attack")).toBe("kick_thrust");
    expect(s.confirmAnd("attack")).toBe("kick_high_rush");
    expect(s.confirmAnd("attack")).toBe("kick_low");
    // Four is the end of it: a fifth attack has nowhere to go.
    expect(s.confirmAnd("attack")).toBe("kick_low");
  });

  it("ends in a different smash at every depth", () => {
    expect(new Sim().frame({ smash: true })).toBe("kick_axe");
    expect(rush(1)).toBe("knee");
    expect(rush(2)).toBe("arm_sweep");
    expect(rush(3)).toBe("uppercut");
    expect(rush(4)).toBe("kick_high");
  });

  it("launches on the third smash, for whatever is thrown after it", () => {
    expect(goku().states.uppercut.onHit).toBe("launched");
  });

  it("draws the third blow and the last smash from one pose, and only the smash throws", () => {
    // The same kick twice, as two states: in the middle of the rush it must
    // hold the opponent for the next blow, and at the end it must send them off.
    const { kick_high: smash, kick_high_rush: link } = goku().states;
    const frames = (anim: string): string[] => anims()[anim].steps.map((s) => s.frame);
    expect(frames(smash.anim)).toEqual(frames(link.anim));
    expect(link.onHit).toBe("hurt_chain");
    expect(smash.onHit).toBe("blown");
  });

  it("holds the smash's leg out for as long as the body it kicked is in the air", () => {
    // Only the smash's copy of the pose is held: the rush's would push the
    // next link out of reach. The hold is the flight, so Goku stands in the
    // kick until the opponent lands.
    const [vx, vy] = goku().states.blown.launch as [number, number];
    const flight = Math.round((2 * -vy) / GRAVITY);
    const held = (anim: string): number =>
      anims()[anim].steps.filter((s) => s.frame === "39" && !s.boxes?.some((b) => b.type === "hit"))[0].dur;
    expect(held(goku().states.kick_high.anim)).toBe(flight);
    expect(held(goku().states.kick_high_rush.anim)).toBeLessThan(flight);
    // Four bodies' width: far enough to read as sent away, not across the stage.
    expect(Math.abs(vx) * flight).toBe(4 * PUSH_WIDTH);
  });

  it("ends at the smash: nothing cancels out of it", () => {
    const s = new Sim();
    s.frame({ attack: true });
    s.confirmAnd("smash");
    expect(s.confirmAnd("attack")).toBe("knee");
    expect(s.confirmAnd("smash")).toBe("knee");
  });

  it("leaves the attacks standing — only a smash may floor", () => {
    // A middle link that floored the opponent would end the string at itself,
    // however many links came after it in the data.
    for (const link of ["kick_mid", "kick_thrust", "kick_high_rush", "kick_low"]) {
      expect(goku().states[link].onHit, link).toBe("hurt_chain");
    }
  });

  it("does not skip a blow while it may still connect, however hard the button is pressed", () => {
    const s = new Sim();
    expect(s.frame({ attack: true })).toBe("kick_mid");
    expect(s.frame({ smash: true })).toBe("kick_mid");
    expect(s.frame({ attack: true })).toBe("kick_mid");
  });

  it("walks the whole rush at nothing, the button held down every frame", () => {
    const s = new Sim();
    const walked = [s.frame({ attack: true })];
    for (let i = 0; i < 120 && walked.length < 4; i++) {
      const now = s.frame({ attack: true });
      if (now !== walked.at(-1)) walked.push(now);
    }
    expect(walked).toEqual(["kick_mid", "kick_thrust", "kick_high_rush", "kick_low"]);
  });

  it("ends the rush with a smash at nothing too", () => {
    const s = new Sim();
    s.frame({ attack: true });
    let now = "kick_mid";
    for (let i = 0; i < 60 && now === "kick_mid"; i++) now = s.frame({ smash: true });
    expect(now).toBe("knee");
  });

  it("stops when the player does not ask, however well it connected", () => {
    const s = new Sim();
    s.frame({ attack: true });
    expect(s.frame({}, { hitConfirmed: true })).toBe("kick_mid");
  });

  it("recovers to idle when the animation runs out instead", () => {
    const s = new Sim();
    s.frame({ attack: true });
    expect(s.frame({}, { animEnded: true })).toBe("idle");
  });
});

describe("the guard is a stance the button holds", () => {
  const holdGuard = { holding: { attack: false, guard: true, smash: false, blast: false, strike: false, dash: false } };
  const isGuarding = (state: string): boolean => !!goku().states[state].guarding;

  it("stands in guard while held, and leaves it when let go", () => {
    const s = new Sim();
    expect(s.frame(holdGuard)).toBe("guard");
    expect(s.frame(holdGuard)).toBe("guard");
    expect(s.frame()).toBe("idle");
  });

  it("does not walk while guarding", () => {
    const s = new Sim();
    s.frame(holdGuard);
    expect(s.frame({ fwd: true, ...holdGuard })).toBe("guard");
    expect(s.frame({ back: true, ...holdGuard })).toBe("guard");
  });

  it("guards low with down held, from either stance", () => {
    const s = new Sim();
    s.frame(holdGuard);
    expect(s.frame({ down: true, ...holdGuard })).toBe("guard_low");
    expect(s.frame(holdGuard)).toBe("guard");
    const crouched = new Sim();
    crouched.frame({ down: true });
    expect(crouched.frame({ down: true, ...holdGuard })).toBe("guard_low");
  });

  it("blocks only in guard — walking back is just walking now", () => {
    expect(isGuarding("guard")).toBe(true);
    expect(isGuarding("guard_low")).toBe(true);
    expect(isGuarding("walk_back")).toBe(false);
    expect(isGuarding("idle")).toBe(false);
  });

  it("keeps blocking through blockstun, so a blocked string stays blocked", () => {
    expect(isGuarding("guard_hit")).toBe(true);
    expect(isGuarding("guard_crouch")).toBe(true);
    const s = new Sim();
    s.frame(holdGuard);
    s.frame(holdGuard);
    s.force("guard_hit");
    expect(s.frame(holdGuard, { animEnded: true })).toBe("guard");
  });
});

/**
 * The other half of a string, and the one the frame-by-frame walk above cannot
 * see: what each blow does to a defender who is already *in* something.
 *
 * Found by playing — the string juggled nobody, because rank compared a flinch
 * against a knockdown and refused every blow. The rule was right and the data
 * was too blunt: `hurt_chain` now names an air version that is a juggle, so one
 * reaction is a flinch on the ground and a lift in the air.
 */
describe("the string juggles what the uppercut launched", () => {
  /** What a blow does to a defender currently in `state`. */
  const against = (onHit: string, state: string): string | undefined =>
    reactionFor(onHit, goku(), goku().states[state]);

  it("lifts a body that is still falling", () => {
    expect(against("hurt_chain", "knockdown")).toBe("juggle");
  });

  it("re-enters itself, which is what keeps a body up for the next link", () => {
    expect(against("hurt_chain", "juggle")).toBe("juggle");
  });

  it("still flinches someone standing — one reaction, two ways of taking it", () => {
    expect(against("hurt_chain", "idle")).toBe("hurt_chain");
  });

  it("lets a knockdown end the juggle", () => {
    expect(against("knockdown", "juggle")).toBe("knockdown_air");
  });

  it("lets the heavy floor a body it finds in the air", () => {
    // The ender of a string has to be able to end a juggle. Its air reaction
    // ranks with the juggle rather than below it — below it, the blow lands,
    // costs health and does nothing at all, which is what it did on the day
    // the heavy became the ender.
    expect(against("hurt_heavy", "juggle")).toBe("hurt_heavy_air");
    expect(against("hurt_heavy", "knockdown")).toBe("hurt_heavy_air");
  });

  it("is over once the body touches the floor", () => {
    // Rank 4 is the floor and nothing forces it: bounce, downed and getup are
    // where an exchange ends, juggle or no juggle.
    expect(against("hurt_chain", "bounce")).toBeUndefined();
    expect(against("hurt_chain", "downed")).toBeUndefined();
  });

  it("does not let a jab juggle — only the string has an air version", () => {
    // Deliberate (owner, 2026-08-15): `hurt` keeps `hurt_air`, so a single
    // light blow into a falling body still hurts and still does not interrupt.
    expect(against("hurt", "knockdown")).toBeUndefined();
  });

  it("does not let a jab stand up someone on the floor", () => {
    expect(against("hurt", "downed")).toBeUndefined();
  });

  it("makes the whole trip to the floor untouchable", () => {
    // Rank 4 says a blow may not interrupt these; it does not stop one costing
    // health, and a fighter here can neither block nor move. The two lists are
    // asserted to be the same so a fifth rank-4 state cannot arrive hittable.
    const named = (pick: (d: { rank?: number; invulnerable?: boolean }) => unknown): string[] =>
      Object.entries(goku().states)
        .filter(([, def]) => pick(def))
        .map(([name]) => name)
        .sort();
    expect(named((d) => d.invulnerable)).toEqual(["blown_bounce", "bounce", "downed", "getup"]);
    expect(named((d) => d.rank === 4)).toEqual(named((d) => d.invulnerable));
  });

  it("ends every grounded reaction on the blow's clock", () => {
    // `animEnd` creeping back into one of these is the whole regression: the
    // reaction would silently go back to lasting as long as its drawing, and
    // every number tuned against hitstun would quietly stop applying to it.
    const states = goku().states;
    for (const name of ["hurt", "hurt_chain", "hurt_heavy"]) {
      expect(states[name].transitions?.map((t) => t.when)).toEqual(["stunEnd"]);
    }
  });

  it("pushes away from the blow in every reaction that can still be moved", () => {
    // `juggle` shipped as [null, -2.0]. A null keeps the axis, and the axis it
    // keeps is the victim's own approach — so a fighter who jumped *at* the
    // opponent was handed jump_fwd's forward speed and flew into the blow.
    // Rank 4 is exempt: those are the floor, not the blow that put you there.
    const states = goku().states;
    for (const [name, def] of Object.entries(states)) {
      const rank = def.rank ?? 0;
      if (rank === 0 || rank === 4) continue;
      const push = def.launch?.[0] ?? def.vel?.[0];
      expect(push, `${name} has no horizontal knockback`).toBeLessThan(0);
    }
  });

  it("marks as a relaunch exactly the blows meant to floor a body", () => {
    // The budget in src/combat/combo.ts is spent by these and nothing else, so
    // a new launcher arriving unmarked is a loop nobody notices until it is
    // played. The list is short on purpose: a chain link is not a relaunch.
    const marked = Object.entries(goku().states)
      .filter(([, def]) => def.relaunch)
      .map(([name]) => name)
      .sort();
    expect(marked).toEqual(["arm_sweep", "kick_axe", "kick_high", "knee", "knee_rise", "uppercut"]);
  });
});

describe("the buttons reach the moves they are supposed to", () => {
  it("attack, smash and blast each open their own move from idle", () => {
    expect(new Sim().frame({ attack: true })).toBe("kick_mid");
    expect(new Sim().frame({ smash: true })).toBe("kick_axe");
    expect(new Sim().frame({ blast: true })).toBe("ki_blast");
  });

  it("crouching changes what attack and smash do", () => {
    const crouched = (): Sim => {
      const s = new Sim();
      s.frame({ down: true });
      return s;
    };
    expect(crouched().frame({ attack: true })).toBe("punch_knee");
    expect(crouched().frame({ smash: true })).toBe("knee_rise");
  });

  it("blast charges the ki blast, which then fires on its own", () => {
    const s = new Sim();
    expect(s.frame({ blast: true })).toBe("ki_blast");
    expect(s.frame({}, { animEnded: true })).toBe("ki_blast_fire");
  });

  it("forward and blast charge the kamehameha, and letting go fires it", () => {
    const holdX = { holding: { attack: false, guard: false, smash: false, blast: true, strike: false, dash: false } };
    const s = new Sim();
    expect(s.frame({ fwd: true, blast: true, ...holdX })).toBe("kame_charge");
    // It is held, not pressed: the charge lasts exactly as long as the key does.
    expect(s.frame({ fwd: true, ...holdX })).toBe("kame_charge");
    expect(s.frame({ fwd: true })).toBe("kame_fire");
    // The arms stay out on their own clock and not the bolt's: a beam whose
    // pose lasted as long as its flight held the fighter still for a second
    // and a half, and the owner would rather it were one number.
    expect(s.frame({}, { spawnEnded: false })).toBe("kame_fire");
    expect(s.frame({}, { animEnded: true })).toBe("idle");
  });

  it("back and blast charge the same beam, aimed up", () => {
    const holdX = { holding: { attack: false, guard: false, smash: false, blast: true, strike: false, dash: false } };
    const s = new Sim();
    expect(s.frame({ back: true, blast: true, ...holdX })).toBe("kame_charge_up");
    expect(s.frame({ back: true })).toBe("kame_fire_up");
    expect(s.frame({ back: true }, { animEnded: true })).toBe("idle");
  });

  it("draws the climbing head differently, since a sprite cannot be rotated", () => {
    const anims = JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../../data/spawns/kame_bolt/animations.json", import.meta.url)),
        "utf8",
      ),
    ) as Record<string, unknown>;
    const bolt = JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../../data/spawns/kame_bolt/states.json", import.meta.url)),
        "utf8",
      ),
    ) as StatesFile;
    expect(Object.keys(anims).sort()).toEqual(["fly", "fly_up"]);
    expect(bolt.states.fly.anim).toBe("fly");
    expect(bolt.states.fly_up.anim).toBe("fly_up");
  });

  it("aims the same bolt differently rather than throwing a second one", () => {
    const fires = (name: string): { spawn: string; state?: string } | undefined =>
      goku().states[name].fires;
    expect(fires("kame_fire")?.spawn).toBe(fires("kame_fire_up")?.spawn);
    expect(fires("kame_fire")?.state).toBeUndefined();
    expect(fires("kame_fire_up")?.state).toBe("fly_up");
  });

  it("lets go of itself once the charge is full", () => {
    const holdX = { holding: { attack: false, guard: false, smash: false, blast: true, strike: false, dash: false } };
    const s = new Sim();
    s.frame({ fwd: true, blast: true, ...holdX });
    expect(s.frame({ fwd: true, ...holdX }, { charged: true })).toBe("kame_fire");
  });

  it("but not on an empty meter — the shipped cost is what is checked", () => {
    const cost = goku().states.ki_blast.cost;
    expect(cost).toBeGreaterThan(0);
    expect(new Sim().frame({ blast: true }, { ki: (cost ?? 0) - 1 })).toBe("idle");
  });
});
