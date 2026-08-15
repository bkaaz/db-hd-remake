import type { Entity, EntityDebug } from "../entity/entity";
import { logEvent } from "../log";
import type { BlowResult } from "./blow";

/**
 * Turns a match into lines for the recording (`src/log.ts`).
 *
 * **Every line carries what both fighters were doing**, not only the one the
 * event happened to. A log where you have to scan upwards to find out what the
 * other body was in is a log you decode instead of read, and in a fight the
 * answer is nearly always about the pair: he was still in recovery, I was
 * already out of hitstun.
 *
 * It sits beside `Fighters` rather than inside `Entity` because **this** is the
 * layer that knows which body is P1 and which is P2, and a body neither knows
 * nor should. Naming a fighter so a log line could print it would be the
 * recording changing the game to suit itself, which is the one thing it may not
 * do. It reads `Entity.debug` — the same window the on-screen readout uses — so
 * nothing anywhere exists purely for this.
 *
 * A change spotted by comparison is a change nobody had to report, which is why
 * **a blow logged with no state change after it is the signature of a refused
 * reaction**: the absence is the information.
 */
export class Recorder {
  private readonly last = new Map<string, EntityDebug>();

  /** Everything that changed since the last frame. */
  note(fighters: Named): void {
    for (const [who, fighter] of fighters) {
      const now = fighter.debug;
      const was = this.last.get(who);
      this.last.set(who, now);
      if (!was) continue;

      if (was.state !== now.state) this.say(fighters, `${who} ${was.state} → ${now.state}`);
      for (const line of pressChanges(who, was, now)) this.say(fighters, line);
      if (was.combo.hits > 0 && now.combo.hits === 0) {
        this.say(fighters, `${who} combo over — ${was.combo.hits} hits, ${was.combo.damage} dmg`);
      }
    }
  }

  /**
   * One blow. The gap — in **sprite px** — is why the follow-up will reach, or
   * will not. It is not a direct comparison with an attack's reach: a blow
   * arrives at the defender's hurt box, not at their anchor, so the defender's
   * own box (roughly 30 px) is part of the sum.
   */
  blow(result: BlowResult | null, from: string, to: string, gap: number, fighters: Named): void {
    if (!result) return;
    // The attack is already in the attacker's column; what the column cannot
    // show is what the defender was in *before* the blow, because by now it has
    // already been forced into the reaction — or refused one, in which case
    // `was` and the column agree and the refusal is visible at a glance.
    const verb = result.blocked ? "BLOCKED by" : "HITS";
    this.say(
      fighters,
      `${from} ${verb} ${to} (was ${result.took}) · ${result.damage} dmg · gap ${Math.round(gap)}`,
    );
  }

  /** One line: the situation, then what happened in it. */
  private say(fighters: Named, event: string): void {
    logEvent(`${fighters.map(([who, f]) => situation(who, f.debug)).join("  ")}  | ${event}`);
  }
}

type Named = [name: string, fighter: Entity][];

/** `P1 kick_mid 2/4 6f` — who, what, and how far through it they are. */
function situation(who: string, d: EntityDebug): string {
  const where = d.steps > 0 ? `${d.step + 1}/${d.steps}` : "-";
  const flags = [d.freeze > 0 ? `frz${d.freeze}` : "", d.hitConfirmed ? "hit✓" : ""]
    .filter(Boolean)
    .join(" ");
  return `${who} ${d.state.padEnd(16)} ${where} ${String(d.framesLeft).padStart(2)}f ${flags.padEnd(9)}`;
}

/**
 * Presses appearing and leaving the buffer — the answer to "was my input eaten".
 *
 * A press that vanishes with a frame still on it was **spent** by a transition;
 * one that vanishes on its last frame simply **expired**, which is the
 * interesting failure: the player asked and the game was not listening.
 */
export function pressChanges(who: string, was: EntityDebug, now: EntityDebug): string[] {
  const before = new Map(was.buffer);
  const after = new Map(now.buffer);
  const lines: string[] = [];
  for (const [button] of after) if (!before.has(button)) lines.push(`${who} press ${button}`);
  for (const [button, left] of before) {
    if (after.has(button)) continue;
    lines.push(`${who} press ${button} ${left > 1 ? "spent" : "EXPIRED unused"}`);
  }
  return lines;
}
