import type { GrabDef } from "../entity/states";
import type { PortReport } from "./port";

/**
 * A throw's `grab` for its state (ADR 0035), from the move's report: where
 * each opponent is held, and the launch — `reaction` the state that plays
 * the move the opponent is put in. The launch's x is backwards, as he faces:
 * `$0F:B321` moves him by its facing argument — the thrower's turned (Goku's:
 * over his back, then facing his way, $20:8285) or the thrower's own
 * (Vegeta's: ahead of him, still facing him — `ahead`).
 */
export function grabOf(report: PortReport, reaction: string): GrabDef | null {
  const l = report.launch;
  if (!l) return null;
  return {
    at: Object.fromEntries(report.holds.map((h) => [h.against, h.at])),
    launch: { frame: l.frame, damage: l.damage, reaction, vel: [-l.vx, l.vy], ...(!turned(l.facing) && { ahead: true }) },
  };
}

/** The facing `$0F:B321` was given is the thrower's turned (`EOR #$40`). */
function turned(facing: NonNullable<PortReport["launch"]>["facing"]): boolean {
  return "eor" in facing && ((facing.eor ?? 0) & 0x40) !== 0;
}
