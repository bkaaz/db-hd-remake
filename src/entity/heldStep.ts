/** Whether a state keeps its animation on a step past that step's time: `holdStep`, for good or until `holdFrames`. Pure. */

import type { StateDef } from "./states";

export function staysOnStep(def: StateDef | undefined, step: number, elapsed: number): boolean {
  if (def?.holdStep !== step) return false;
  return def.holdFrames === undefined || elapsed < def.holdFrames;
}
