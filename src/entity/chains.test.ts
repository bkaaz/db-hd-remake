import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
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
  qcf: false,
  qcb: false,
  holding: { light: false, medium: false, heavy: false, special: false },
};
const QUIET: Signals = {
  animEnded: false,
  // Nobody is stunned unless a test says so: the fighter driving a chain is the
  // one landing the blows, not the one taking them.
  stunEnded: true,
  falling: false,
  nearGround: false,
  landed: false,
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
  private readonly sm = new StateMachine(goku());
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
  const holdAZ = { holding: { light: true, medium: true, heavy: false, special: false } };

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
    const half = { holding: { light: true, medium: false, heavy: false, special: false } };
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
    const onlyLight = { light: true, holding: { light: true, medium: false, heavy: false, special: false } };
    expect(s.frame(onlyLight)).toBe("punch");
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

  it("gives the crouching medium on down + medium, not the standing one", () => {
    const s = new Sim();
    s.frame({ down: true, medium: true });
    expect(s.frame({ down: true, medium: true })).toBe("kick_crouch");
  });

  it("reaches the launching knee on a held down-forward + medium", () => {
    const s = new Sim();
    s.frame({ down: true, fwd: true, medium: true });
    expect(s.frame({ down: true, fwd: true, medium: true })).toBe("knee_rise");
  });

  it("reaches it on a rolled quarter circle, which is what hands actually do", () => {
    // The whole point of motion:qcf. Down is released before the button, so no
    // live `held:` condition can see the input any more — and the roll leaves
    // you in walk_fwd, not in a crouch, which is why the trigger cannot live on
    // the crouch states alone.
    const s = new Sim();
    s.frame({ down: true });
    expect(s.frame({ fwd: true, medium: true })).toBe("knee_rise");
  });

  it("reaches the lunge on a rolled quarter circle back", () => {
    // The mirror, on real data: qcb leaves you holding back, so the trigger has
    // to be where the roll ends and not only in a crouch.
    const s = new Sim();
    s.frame({ down: true });
    expect(s.frame({ back: true, medium: true })).toBe("hop_lunge");
  });

  it("keeps back + medium as its own move when nothing was rolled", () => {
    // kick_low lives on the held diagonal and must not be swallowed by the
    // motion sitting in front of it.
    const s = new Sim();
    s.frame({ back: true });
    expect(s.frame({ back: true, medium: true })).toBe("kick_low");
  });

  it("still gives the plain medium when no motion preceded it", () => {
    // The other half: leniency that swallows every forward medium would be
    // worse than the bug it fixes.
    const s = new Sim();
    s.frame({ fwd: true });
    expect(s.frame({ fwd: true, medium: true })).toBe("knee");
  });
});

describe("the ladder — light, then medium, then heavy", () => {
  it("walks punch → kick_mid → kick_thrust → kick_high when every blow connects", () => {
    const s = new Sim();
    expect(s.frame({ light: true })).toBe("punch");
    expect(s.confirmAnd("medium")).toBe("kick_mid");
    expect(s.confirmAnd("medium")).toBe("kick_thrust");
    expect(s.confirmAnd("heavy")).toBe("kick_high");
  });

  it("takes the medium rung twice, but only with a different move", () => {
    // A rung may repeat; a move may never cancel into itself, which would be a
    // loop with extra steps. So the second medium is a different attack, and
    // there is no third.
    const s = new Sim();
    s.frame({ medium: true });
    expect(s.confirmAnd("medium")).toBe("kick_thrust");
    expect(s.confirmAnd("medium")).toBe("kick_thrust");
  });

  it("only goes up: the heavy ends it, and nothing cancels back down", () => {
    // The rung a string cannot climb back down is what makes it finite without
    // any special rule — see combat.md. Every button, on the ender, does
    // nothing.
    const s = new Sim();
    s.frame({ light: true });
    s.confirmAnd("medium");
    s.confirmAnd("medium");
    s.confirmAnd("heavy");
    expect(s.confirmAnd("light")).toBe("kick_high");
    expect(s.confirmAnd("medium")).toBe("kick_high");
    expect(s.confirmAnd("heavy")).toBe("kick_high");
  });

  it("lets a light skip the medium and end on the heavy", () => {
    const s = new Sim();
    s.frame({ light: true });
    expect(s.confirmAnd("heavy")).toBe("kick_high");
  });

  it("leaves the middle links standing — only an ender may floor", () => {
    // A middle link that floored the opponent would end the string at itself,
    // however many links came after it in the data.
    const reaction = (state: string): string | undefined => goku().states[state].onHit;
    expect(reaction("punch")).toBe("hurt_chain");
    expect(reaction("kick_mid")).toBe("hurt_chain");
    expect(reaction("kick_thrust")).toBe("hurt_chain");
    expect(reaction("kick_high")).toBe("hurt_heavy");
  });

  it("stops on a whiff, however hard the button is pressed", () => {
    const s = new Sim();
    expect(s.frame({ medium: true })).toBe("kick_mid");
    expect(s.frame({ heavy: true })).toBe("kick_mid");
    expect(s.frame({ heavy: true })).toBe("kick_mid");
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
    expect(named((d) => d.invulnerable)).toEqual(["bounce", "downed", "getup"]);
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

  it("marks as a smash exactly the blows meant to floor a body", () => {
    // The budget in src/combat/combo.ts is spent by these and nothing else, so
    // a new launcher arriving unmarked is a loop nobody notices until it is
    // played. The list is short on purpose: a chain link is not a smash.
    const marked = Object.entries(goku().states)
      .filter(([, def]) => def.smash)
      .map(([name]) => name)
      .sort();
    expect(marked).toEqual(["kick_axe", "kick_high", "knee_rise", "uppercut"]);
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

  it("special charges the ki blast, which then fires on its own", () => {
    const s = new Sim();
    expect(s.frame({ special: true })).toBe("ki_blast");
    expect(s.frame({}, { animEnded: true })).toBe("ki_blast_fire");
  });

  it("forward and special charge the kamehameha, and letting go fires it", () => {
    const holdX = { holding: { light: false, medium: false, heavy: false, special: true } };
    const s = new Sim();
    expect(s.frame({ fwd: true, special: true, ...holdX })).toBe("kame_charge");
    // It is held, not pressed: the charge lasts exactly as long as the key does.
    expect(s.frame({ fwd: true, ...holdX })).toBe("kame_charge");
    expect(s.frame({ fwd: true })).toBe("kame_fire");
    // The arms stay out on their own clock and not the bolt's: a beam whose
    // pose lasted as long as its flight held the fighter still for a second
    // and a half, and the owner would rather it were one number.
    expect(s.frame({}, { spawnEnded: false })).toBe("kame_fire");
    expect(s.frame({}, { animEnded: true })).toBe("idle");
  });

  it("back and special charge the same beam, aimed up", () => {
    const holdX = { holding: { light: false, medium: false, heavy: false, special: true } };
    const s = new Sim();
    expect(s.frame({ back: true, special: true, ...holdX })).toBe("kame_charge_up");
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
    const holdX = { holding: { light: false, medium: false, heavy: false, special: true } };
    const s = new Sim();
    s.frame({ fwd: true, special: true, ...holdX });
    expect(s.frame({ fwd: true, ...holdX }, { charged: true })).toBe("kame_fire");
  });

  it("but not on an empty meter — the shipped cost is what is checked", () => {
    const cost = goku().states.ki_blast.cost;
    expect(cost).toBeGreaterThan(0);
    expect(new Sim().frame({ special: true }, { ki: (cost ?? 0) - 1 })).toBe("idle");
  });
});
