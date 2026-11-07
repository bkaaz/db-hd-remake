/**
 * A companion that keeps its place beside a bolt (`fires.with`'s `around`): the
 * object's code takes the bolt's slot every frame and adds a fixed offset, whichever
 * way the thrower faces (Energy Sphere's sparks, $0F:DF1D). Pure.
 */

interface Body {
  x: number;
  y: number;
  groundY: number;
}

export function keepAround(companion: Body, bolt: { x: number; y: number }, around: [number, number], scale: number): void {
  companion.x = bolt.x + around[0] * scale;
  companion.y = companion.groundY = bolt.y + around[1] * scale;
}
