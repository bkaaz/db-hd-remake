import { guardStateFor, type StateDef, type StatesFile } from "./states";

/**
 * How a blow arriving now would be blocked: in the stance's block reaction,
 * or where he stands for ki in a state that `braces` (a charged S3 holding),
 * the state going on, pushed as the stance's block pushes — or not at all.
 * Pure.
 */
export type Block = { reaction: string } | { cost: number; shove: number } | null;

export function blockOf(current: StateDef | undefined, file: StatesFile | null | undefined, ki: number, airborne: boolean): Block {
  if (airborne) return null;
  const braces = current?.braces;
  if (braces !== undefined) {
    if (ki < braces) return null;
    const stance = guardStateFor(undefined, file);
    return { cost: braces, shove: (stance !== undefined ? file?.states[stance]?.shove : undefined) ?? 0 };
  }
  const reaction = guardStateFor(current, file);
  return current?.guarding && reaction !== undefined ? { reaction } : null;
}
