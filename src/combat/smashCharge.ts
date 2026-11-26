import type { StateDef, StatesFile, Transition } from "../entity/states";
import { HIT_TYPES } from "./hitTypes";
import { aimed } from "./rushEntries";
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
 * With RB (boost) held it is the top at once, for what the whole charge costs
 * and a bar more: the charge played fast, every level's flash and sound and
 * nothing of the boost's own, while the opponent and every bolt stand still
 * and the art dims (owner, 2026-11-26). Without the ki it is the plain blow,
 * at once all the same.
 *
 * Laid over the states `withRush` made, from the ender as it is there, so a
 * new pick of it is charged as it was. Pure: plain data in and out.
 */

/**
 * How each level of an ender sends him, over the reaction it is taken with:
 * that much higher (`lift`) and further (`send`), none to three. A `type` from
 * level `from` on takes the blow another way: S1's charged levels send him off
 * flat to the wall, its tap still staggers him; S3's tap lifts him low, so he
 * is soon down (owner, 2026-11-26).
 */
interface Sending {
  lift: readonly number[];
  send: readonly number[];
  type?: { name: string; from: number };
}
const SENDING: Record<string, Sending> = {
  smash_1: { lift: [1, 1, 1.1, 1.2], send: [1, 1, 1.25, 1.6], type: { name: "sendoff", from: 1 } },
  smash_3: { lift: [0.5, 1.1, 1.2, 1.35], send: [1, 1.3, 1.6, 2] },
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
/** Frames each level takes, the charge played fast with RB: the world stands still the three of them. */
const BOOST_LEVEL = 6;
/** The ki charge (LB), which a direction + Smash breaks off into the blow at once. */
const KI_CHARGE = ["charge_start", "charge"];
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
export function withCharge(file: StatesFile, anims: Record<string, AnimSteps>, ender: string): StatesFile {
  const sending = SENDING[ender];
  if (!sending) throw new Error(`${ender} does not charge: ${CHARGEABLE.join(", ")} do`);
  const s3 = file.states[ender];
  if (!s3) throw new Error(`${ender} is not picked: nothing to charge`);
  const hold = (n: number) => `${ender}_charge_${n}`;
  const COMBO_HOLD = `${ender}_charge_1_combo`;
  const release = (n: number) => `${ender}_lv${n}`;
  const atOnce = `${ender}_max`;
  const boost = (n: number) => `${ender}_boost_${n}`;
  // what this puts on the ender, to take out before putting it back
  const ours = (t: Transition) =>
    t.to.startsWith(`${ender}_charge_`) || t.to.startsWith(`${ender}_boost_`) || (t.to === release(0) && [t.when].flat().join() === "held:boost");
  const startup = startupOf(anims[s3.anim]);
  // asked while the wind-up's first pose still has frames to run, or there is nothing to stop on
  const decide = startup - 2;
  if (decide < 1) throw new Error(`${s3.anim}'s wind-up is ${startup} frames: too short to stop on`);
  const others = (s3.transitions ?? []).filter((t) => !ours(t));
  const held = (to: string, extra: string[] = []): Transition => ({ when: [`frames:${decide}`, "held:smash", ...extra], to });
  // the reaction each level sends him into, and how far: its own launch scaled
  const scaled = (v: number | null, by: number) => (v === null ? null : Math.round(v * by * 100) / 100);
  const sent = (level: number): Partial<StateDef> => {
    const retyped = sending.type && level >= sending.type.from ? sending.type.name : undefined;
    const reaction = HIT_TYPES[retyped ?? s3.type ?? ""]?.onHit;
    const base = reaction ? file.states[reaction]?.launch : undefined;
    const launch = base && [scaled(base[0], sending.send[level]), scaled(base[1], sending.lift[level])];
    return {
      ...(retyped && { type: retyped }),
      ...(reaction && launch && { launches: { ...s3.launches, [reaction]: launch as [number | null, number | null] } }),
    };
  };
  const boostCost = AT_ONCE_COST + [1, 2, 3].reduce((sum, level) => sum + costOf(level), 0);
  const states: Record<string, StateDef> = {
    ...file.states,
    // RB held: the charge played fast, or the plain blow at once where he cannot pay for it (owner, 2026-11-26)
    [ender]: {
      ...s3,
      ...sent(0),
      transitions: [
        { when: ["held:boost", `ki:${boostCost}`], to: boost(1) },
        { when: "held:boost", to: release(0) },
        held(COMBO_HOLD, ["combo"]),
        held(hold(0)),
        ...others,
      ],
    },
  };
  // charging ki: a direction + Smash breaks it off into the blow, at once
  for (const name of KI_CHARGE.filter((k) => states[k])) {
    const aim: Transition = { when: aimed(AIMS[ender as keyof typeof AIMS]), to: ender };
    const rest = (states[name].transitions ?? []).filter((t) => t.to !== ender);
    states[name] = { ...states[name], transitions: [aim, ...rest] };
  }
  const holdState = (level: number, to: string, after: number): StateDef => ({
    anim: s3.anim,
    vel: [0, 0],
    turn: false,
    holdStep: 0,
    // no blow: the animation's hit box is past the step it holds
    damage: 0,
    braces: BRACE_COST,
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
  // the same levels played fast with RB, the world standing still: the bar paid with the first
  for (const level of [1, 2, 3]) {
    const { braces: _, transitions: __, ...pose } = holdState(level, "", 0);
    states[boost(level)] = {
      ...pose,
      cost: costOf(level) + (level === 1 ? AT_ONCE_COST : 0),
      ...(level === 1 && { freezesFoe: 3 * BOOST_LEVEL, screen: [[0, "dim"]] as [number, "dim"][] }),
      transitions: [{ when: `frames:${BOOST_LEVEL}`, to: level < 3 ? boost(level + 1) : atOnce }],
    };
  }
  for (let level = 0; level < 4; level++) {
    const { transitions: _, ...blow } = s3;
    states[release(level)] = {
      ...blow,
      ...(s3.damage !== undefined && { damage: Math.round(s3.damage * DAMAGE[level]) }),
      ...sent(level),
      ...(level === 3 && { hitFlash: TOP_FLASH }),
      transitions: others,
    };
  }
  // the top, the world going on again
  states[atOnce] = { ...states[release(3)], screen: [[0, "bright"]] };
  return { ...file, states };
}
