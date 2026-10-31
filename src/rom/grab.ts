import type { GrabDef } from "../entity/states";
import type { PortReport } from "./port";

/**
 * A throw's `grab` for its state (ADR 0035), from the move's report: where
 * each opponent is held, and the launch — `reaction` the state that plays
 * the move the opponent is put in. The launch's x is backwards: he leaves
 * facing the thrower's way ($20:8285) and moves away from the thrower's
 * front, which the cartridge says as "facing turned, vx forward".
 */
export function grabOf(report: PortReport, reaction: string): GrabDef | null {
  const l = report.launch;
  if (!l) return null;
  return {
    at: Object.fromEntries(report.holds.map((h) => [h.against, h.at])),
    launch: { frame: l.frame, damage: l.damage, reaction, vel: [-l.vx, l.vy] },
  };
}
