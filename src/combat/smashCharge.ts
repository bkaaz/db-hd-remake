import type { StateDef, StatesFile, Transition } from "../entity/states";
import { HIT_TYPES } from "./hitTypes";
import { aimed, type Aim } from "./rushEntries";
import { AIMS } from "./rushSlots";
import { startupOf, type AnimSteps } from "./swing";

/**
 * An ender charged by holding Smash (owner, 2026-11-26): he stops on the
 * wind-up's pose and lets go on the release — the plain blow before the first
 * level, then three levels, each worth more and sending him further. Each level
 * begins with a flash, to be let go on in a combo; the second with a sound too.
 * Each level past the first costs ki: where he cannot pay for the next he
 * lets go at once, with the level he has (owner, 2026-11-26); while he holds, every blow is blocked where he stands for ki, and
 * lands once he has too little — the throw and the push are what answer it.
 * Begun in a combo it starts at the first level and reaches the second in a
 * few frames, so a charged ender can still end the rush; held longer, the
 * combo is his to drop. Only letting go of Smash does anything; at the top it
 * lets go of itself.
 *
 * With RB (boost) held the charge plays fast to its top, for what it costs and
 * a bar more (`boosts`, `entity/boost.ts`); without the ki it is the plain
 * blow, at once all the same.
 *
 * Laid over the states `withRush` made, from the ender as it is there, so a
 * new pick of it is charged as it was. Pure: plain data in and out.
 */

/**
 * How each level of an ender sends him, over the reaction it is taken with:
 * that much higher (`lift`) and further (`send`), none to three. `types`
 * take a level's blow another way, none its own: S1's charged levels send
 * him off flat to the wall, its tap still staggers him; S2's leave him
 * crumpling, longer each level, a new combo's opening, and its top breaks a
 * guard (`breaksFrom`); S3's tap lifts him low, so he is soon down (owner,
 * 2026-11-26).
 */
interface Sending {
  lift: readonly number[];
  send: readonly number[];
  types?: readonly (string | undefined)[];
  breaksFrom?: number;
  /** The shove each level's reaction takes in place of its own, none its own: S2's less the harder (owner, 2026-11-26). */
  push?: readonly (number | undefined)[];
  /**
   * He drives forward on the blow's pose, held that many frames longer, that
   * fast, raising dust: S1's kick stays out and slides further each level,
   * S2's a little way (owner, 2026-11-26).
   */
  lunge?: { hold: readonly number[]; speed: readonly number[] };
  /**
   * He hops on the blow, `rise` up each level and `ahead` forward, a puff of
   * dust as he leaves the floor, and takes the opponent up with him, level
   * (`carries`): Smash alone, Goku's up sender's hop (owner, 2026-11-26).
   * Once his blow is spent he has the air's own moves, a jump's — no chain
   * of the air's own.
   */
  hop?: Hop;
  /** Its hop takes him along, level (`carries`), and leaves a jump's moves once the blow is spent: Smash alone. */
  carries?: boolean;
  /**
   * The opponent its top sends flying may be chased: RB, a bar, and he
   * vanishes, comes out past him and throws this ender's first level again,
   * sending him back — three times a combo (owner, 2026-11-26).
   */
  chases?: boolean;
}

/** A hop on the blow: `rise` up each level, `ahead` forward. */
export interface Hop {
  rise: readonly number[];
  ahead: number;
}
const SENDING: Record<string, Sending> = {
  smash_1: {
    lift: [1, 1, 1.1, 1.2],
    send: [1, 1, 1.25, 1.6],
    types: [undefined, "sendoff", "sendoff", "sendoff"],
    lunge: { hold: [6, 8, 10, 12], speed: [1.5, 2.5, 3.5, 4.5] },
    chases: true,
  },
  smash_2: {
    lift: [1, 1, 1, 1],
    send: [1, 1, 1, 1],
    types: [undefined, "crumple", "crumple_2", "crumple_3"],
    breaksFrom: 3,
    push: [undefined, -3, -2, -0.5],
    lunge: { hold: [2, 3, 4, 5], speed: [0.6, 1, 1.4, 1.8] },
  },
  smash_3: { lift: [0.5, 1.1, 1.2, 1.35], send: [1, 1.3, 1.6, 2] },
  // a level lower each since 2026-11-26: the top was too high
  smash: { lift: [1, 1, 1, 1], send: [1, 1, 1, 1], types: ["lift", "lift", "lift", "lift"], hop: { rise: [4.5, 6, 8, 10], ahead: 2 }, carries: true },
};
/** The enders that charge. */
export const CHARGEABLE = Object.keys(SENDING);

/** Frames from the ender's start each level is reached at, standing; the last, when it lets go of itself. */
const LEVEL_AT = [10, 25, 45] as const;
const FULL = 60;
/** Frames from the first level to the second, begun in a combo. */
const COMBO_TO_SECOND = 5;
/** What each level is worth over the plain blow: none, then the three. */
const DAMAGE = [1, 1.25, 1.5, 1.8];
/** Ki each level past the first costs on reaching it — the first is free (owner, 2026-11-26) — and each blow blocked while he holds. */
const LEVEL_COST = 5;
const BRACE_COST = 5;
const costOf = (level: number) => (level > 1 ? LEVEL_COST : 0);
/** What RB costs over the whole charge, to have it at once: a bar of the meter (owner, 2026-11-26). */
const AT_ONCE_COST = 10;
/** A vanish: what it costs, how long he is gone, how often a combo. He comes out as far past the opponent as his blow reaches. */
const VANISH_COST = 10;
const VANISH_FRAMES = 6;
const VANISH_LIMIT = 3;
/** Where he may be when the opponent flies off: off the blow, or about on his feet. */
const CHASE_FROM = ["idle", "walk_fwd", "walk_back", "land"];
/** The ki charge (LB), which a direction + Smash breaks off into the blow at once. */
const KI_CHARGE = ["charge_start", "charge"];
/** Frames between puffs of a lunge's dust. */
const DUST_EVERY = 4;
/** The top level whitens the screen when it lands, as a beam does. */
const TOP_FLASH = 8;
/** Frames of his charge colours, then of his own, by level, the first on reaching it: none before the first. */
const BLINKS = [undefined, 6, 4, 2];
/**
 * The charge's one sound, on reaching the second level: Saiyan Meteor's ball
 * charging (owner, 2026-11-26) — not the ki charge's hum, not the
 * Kamehameha's charge, and none on the other levels.
 */
const CHARGE_SOUND = "ball_2d";
const CUES = [undefined, undefined, CHARGE_SOUND, undefined];

/** `file` with `ender` charged: its holds, its releases, and its way into them. */
/**
 * `stopOn`: the step of its animation he stops on to charge, where the
 * wind-up's last pose is in the air — Gohan's Smash alone, crouching before
 * the Zankuu Kyaku's leap (owner, 2026-11-26). Past it the wind-up plays on
 * when he lets go.
 */
export function withCharge(file: StatesFile, anims: Record<string, AnimSteps>, ender: string, stopOn?: number): StatesFile {
  const sending = SENDING[ender];
  if (!sending) throw new Error(`${ender} does not charge: ${CHARGEABLE.join(", ")} do`);
  const s3 = file.states[ender];
  if (!s3) throw new Error(`${ender} is not picked: nothing to charge`);
  const hold = (n: number) => `${ender}_charge_${n}`;
  const COMBO_HOLD = `${ender}_charge_1_combo`;
  const release = (n: number) => `${ender}_lv${n}`;
  const vanish = `${ender}_vanish`;
  const chase = `${ender}_chase`;
  // what this puts on the ender, to take out before putting it back
  const ours = (t: Transition) =>
    t.to.startsWith(`${ender}_charge_`) || t.to === vanish || (t.to === release(0) && [t.when].flat()[0] === "held:boost");
  const startup = startupOf(anims[s3.anim]);
  const steps = anims[s3.anim]?.steps ?? [];
  const blowStep = steps.findIndex((st) => (st.boxes ?? []).some((b) => b.type === "hit"));
  // he stops on the wind-up's last pose, the one before the blow, or the one
  // named: asked while it still has frames to run, or there is nothing to stop on
  const pose = stopOn ?? blowStep - 1;
  const poseFrom = steps.slice(0, Math.max(pose, 0)).reduce((n, st) => n + st.dur, 0);
  const poseEnd = poseFrom + (steps[pose]?.dur ?? 0);
  const decide = poseEnd - 2;
  if (pose < 0 || pose >= blowStep || decide < Math.max(poseFrom, 1)) throw new Error(`${s3.anim}'s wind-up's last pose is too short to stop on`);
  // let go, what is left of the wind-up past the pose before the blow is out
  const afterPose = startup - poseEnd;
  const others = (s3.transitions ?? []).filter((t) => !ours(t));
  // asked only while he is still winding up: a press held after the blow is
  // out starts nothing, or it strikes twice (owner's recording, 2026-11-26)
  const held = (to: string, extra: string[] = []): Transition => ({ when: [`frames:${decide}`, `!frames:${poseEnd}`, "held:smash", ...extra], to });
  // the reaction each level sends him into, and how far: its own launch scaled
  const scaled = (v: number | null, by: number) => (v === null ? null : Math.round(v * by * 100) / 100);
  const sent = (level: number): Partial<StateDef> => {
    const retyped = sending.types?.[level];
    const reaction = HIT_TYPES[retyped ?? s3.type ?? ""]?.onHit;
    const base = reaction ? file.states[reaction]?.launch : undefined;
    const launch = base && [scaled(base[0], sending.send[level]), scaled(base[1], sending.lift[level])];
    return {
      ...(retyped && { type: retyped }),
      ...(reaction && launch && { launches: { [reaction]: launch as [number | null, number | null] } }),
    };
  };
  const boostCost = AT_ONCE_COST + [1, 2, 3].reduce((sum, level) => sum + costOf(level), 0);
  // the blow's poses driven forward, from `start`, the frame of the state they begin on
  // the blow's last pose is the one held: the knee at its highest, S2's (owner, 2026-11-26)
  const lastBlow = steps.reduce((last, st, i) => ((st.boxes ?? []).some((b) => b.type === "hit") ? i : last), -1);
  const lunge = (level: number, start: number): Partial<StateDef> => {
    if (!sending.lunge || blowStep < 0) return {};
    const blowFrames = steps.slice(blowStep, lastBlow + 1).reduce((n, st) => n + st.dur, 0);
    const until = start + blowFrames + sending.lunge.hold[level];
    return {
      holdStep: lastBlow,
      holdFrames: until,
      velAt: [[start, sending.lunge.speed[level]], [until, 0]],
      trail: { fx: "dust", every: DUST_EVERY, from: start, to: until },
    };
  };
  // the hop from `start`, the frame of the state it begins on
  const blowEnds = steps.slice(blowStep, lastBlow + 1).reduce((n, st) => n + st.dur, 0);
  const hop = (level: number, start: number, blowFrom: number): Partial<StateDef> => {
    const hopping = sending.hop;
    if (!hopping) return {};
    return {
      air: [[start, { vx: hopping.ahead, vy: -hopping.rise[level], gravity: "own" }]],
      trail: { fx: "dust", every: DUST_EVERY, from: start, to: start + 1 },
      ...(sending.carries && {
        carries: true,
        // the blow spent, what a jump falling may do
        inputsOf: { state: "jump_fall", only: "buttons", from: blowFrom + blowEnds },
      }),
    };
  };
  const states: Record<string, StateDef> = {
    ...file.states,
    // RB held: the charge played fast (`entity/boost.ts`), or the plain blow at once where he cannot pay for it (owner, 2026-11-26)
    [ender]: {
      ...s3,
      ...sent(0),
      boosts: { hold: "smash", frames: FULL, bar: AT_ONCE_COST, needs: boostCost },
      ...lunge(0, startup),
      // a frame before the blow is out: in the air when it lands, or there is no flight to take him along on
      ...hop(0, startup - 1, startup),
      transitions: [
        // the boost is asked as the blow begins, never once it is under way
        { when: ["held:boost", "!frames:1", `!ki:${boostCost}`], to: release(0) },
        held(COMBO_HOLD, ["combo"]),
        held(hold(0)),
        ...others,
      ],
    },
  };
  // charging ki: a direction + Smash breaks it off into the blow, at once
  // Smash alone after every direction's, as standing
  const direction = AIMS[ender as keyof typeof AIMS] as Aim | undefined;
  for (const name of KI_CHARGE.filter((k) => states[k])) {
    const aim: Transition = { when: direction ? aimed(direction) : ["pressed:smash"], to: ender };
    const rest = (states[name].transitions ?? []).filter((t) => t.to !== ender);
    const after = direction ? 0 : rest.reduce((last, t, i) => ([t.when].flat().includes("pressed:smash") ? i + 1 : last), 0);
    states[name] = { ...states[name], transitions: [...rest.slice(0, after), aim, ...rest.slice(after)] };
  }
  const holdState = (level: number, to: string, after: number): StateDef => ({
    anim: s3.anim,
    vel: [0, 0],
    turn: false,
    holdStep: pose,
    // no blow: the animation's hit box is past the step it holds
    damage: 0,
    braces: BRACE_COST,
    charging: true,
    ...(costOf(level) > 0 && { cost: costOf(level) }),
    ...(BLINKS[level] !== undefined && { blinks: BLINKS[level] }),
    ...(CUES[level] !== undefined && { sound: CUES[level] }),
    transitions: [
      { when: "!held:smash", to: release(level) },
      // the next level not to be paid for: let go now, with this one
      ...(level < 3 && costOf(level + 1) > 0 ? [{ when: `!ki:${costOf(level + 1)}`, to: release(level) }] : []),
      { when: `frames:${after}`, to },
    ],
  });
  states[hold(0)] = holdState(0, hold(1), LEVEL_AT[0] - decide);
  states[hold(1)] = holdState(1, hold(2), LEVEL_AT[1] - LEVEL_AT[0]);
  states[COMBO_HOLD] = holdState(1, hold(2), COMBO_TO_SECOND);
  states[hold(2)] = holdState(2, hold(3), LEVEL_AT[2] - LEVEL_AT[1]);
  states[hold(3)] = holdState(3, release(3), FULL - LEVEL_AT[2]);
  for (let level = 0; level < 4; level++) {
    // the level's own launch, none of the plain blow's, and no boost of its own: it is let go of, not begun
    const { transitions: _, launches: __, boosts: ___, ...blow } = s3;
    states[release(level)] = {
      ...blow,
      ...(s3.damage !== undefined && { damage: Math.round(s3.damage * DAMAGE[level]) }),
      ...sent(level),
      // let go past the wind-up: the blow's pose comes at once
      ...lunge(level, afterPose),
      ...hop(level, Math.max(0, afterPose - 1), afterPose),
      ...(level === 3 && { hitFlash: TOP_FLASH }),
      ...(sending.breaksFrom !== undefined && level >= sending.breaksFrom && { breaksGuard: true }),
      ...(sending.push?.[level] !== undefined && { pushes: sending.push[level] }),
      // a level is let go of, not begun: no throw for the other button
      transitions: others.filter((t) => t.to !== "throw"),
    };
  }
  if (sending.chases) chased(states, [ender, ...[0, 1, 2, 3].map(release)], release(1), vanish, chase, reachOf(steps[blowStep]));
  return { ...file, states };
}

/** Sprite px ahead of him the middle of a step's hit box lies: where a vanish puts the opponent. */
function reachOf(step: AnimSteps["steps"][number] | undefined): number {
  const box = (step?.boxes ?? []).find((b) => b.type === "hit") as { x?: number; w?: number } | undefined;
  return Math.round((box?.x ?? 0) + (box?.w ?? 0) / 2);
}

/**
 * The vanish off a top that sends him flying: RB while he flies, a bar, gone
 * a moment, out past him facing him while he stands still, and `blow` again —
 * from the ender, its levels, the chase itself and about on his feet.
 */
function chased(states: Record<string, StateDef>, own: string[], blow: string, vanish: string, chase: string, reach: number): void {
  const way: Transition = { when: ["chase", "pressed:boost", `!chased:${VANISH_LIMIT}`], to: vanish };
  const struck = states[blow];
  states[vanish] = {
    anim: struck.anim,
    vel: [0, 0],
    turn: false,
    damage: 0,
    hidden: true,
    invulnerable: true,
    pushless: true,
    cost: VANISH_COST,
    vanishes: true,
    appears: reach,
    stillsFoe: true,
    transitions: [{ when: `frames:${VANISH_FRAMES}`, to: chase }],
  };
  // the blow played whole, its wind-up too: he comes out of nothing, already in reach, so no lunge
  const { velAt: _slide, holdFrames: _held, holdStep: _out, trail: _dust, ...where } = struck;
  states[chase] = { ...where, replays: true, stillsFoe: true };
  for (const name of [...CHASE_FROM, ...own, chase].filter((n) => states[n])) {
    const rest = (states[name].transitions ?? []).filter((t) => t.to !== vanish);
    states[name] = { ...states[name], transitions: [way, ...rest] };
  }
}
