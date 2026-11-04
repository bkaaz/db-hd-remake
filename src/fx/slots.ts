/**
 * What a step puts out, in the order to add it to the stage. The first object
 * takes the lowest free slot, and a lower slot goes into OAM first, so in
 * front (`$00:80E8`, `rom.md`) — the opposite of a stage, where the last one
 * added is on top. Gohan's intro: his dust, `2/05`, over the body, `2/06`.
 */
export function backToFront<T>(spawned: readonly T[]): T[] {
  return [...spawned].reverse();
}
