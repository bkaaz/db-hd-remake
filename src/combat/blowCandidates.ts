import type { AnimSteps } from "./swing";
import type { BlowAnim } from "./rushSlots";

/**
 * The blows a rush slot may hold, as the debug panel lists them
 * (`ui/rushPicks.ts`). Pure.
 */

const pose = (step: { frame: string }): string => step.frame.split("_")[0];
const hits = (step: AnimSteps["steps"][number]): boolean => (step.boxes ?? []).some((b) => b.type === "hit");

/**
 * The animations a slot may hold: every one that hits. Whether it is a whole
 * blow — one a fighter can stop on, since he cannot know another press is
 * coming — is the owner's to see: a blow ending in its own pose is no test,
 * the original's often end on a recovery pose of their own. Of animations
 * drawn alike, the one a state plays, else the first by name; the one-frame
 * steps of an object's parts are no fighter's blow.
 */
export function candidates(anims: Record<string, BlowAnim>, played: ReadonlySet<string>): string[] {
  const kept = new Map<string, string>();
  for (const name of Object.keys(anims).sort()) {
    const { loop, steps } = anims[name];
    if (loop || !steps.some(hits) || steps.every((s) => s.dur === 1)) continue;
    const drawn = JSON.stringify(steps.map((s) => [pose(s), s.dur, hits(s)]));
    const before = kept.get(drawn);
    if (before === undefined || (!played.has(before) && played.has(name))) kept.set(drawn, name);
  }
  return [...kept.values()].sort();
}
