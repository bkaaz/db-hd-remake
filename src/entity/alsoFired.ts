/** A state's further bolts of one frame (`fires.also`, Kakusan's three), each hitting on its own. Pure. */

import type { StateDef } from "./states";

type Fires = NonNullable<StateDef["fires"]>;

/** Each placed by `place`, and with no spawn or state of its own taking the first bolt's. */
export function alsoFired(
  fires: Fires,
  place: (at: [number, number]) => { x: number; y: number },
): { x: number; y: number; spawn: string; state?: string }[] {
  return (fires.also ?? []).map((a) => ({ ...place(a.at), spawn: a.spawn ?? fires.spawn, state: a.state ?? fires.state }));
}
