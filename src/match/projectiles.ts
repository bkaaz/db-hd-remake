import type { Application } from "pixi.js";
import type { Audio } from "../audio/playback";
import type { Bounds } from "../combat/push";
import { Entity, NO_INPUT } from "../entity/entity";
import { effectsNamed } from "../entity/states";
import { loadEntityDef, type EntityDef } from "../entity/entityDef";
import { landBlow, type BlowContext, type BlowResult } from "./blow";

/** One bolt in the air, and the only body it is allowed to hit. */
interface Live {
  bolt: Entity;
  foe: Entity;
}

/** A blow a bolt landed, and who took it — enough for the recording. */
export interface ProjectileHit {
  result: BlowResult;
  foe: Entity;
}

/**
 * The bolts in the air: entities that fly on their own and hit somebody.
 *
 * **An effect that can hurt you is not an effect.** A spark is played and
 * forgotten (`src/fx/effects.ts`); a bolt keeps a hit box, travels, and goes
 * through exactly the same `landBlow` a fist does — which is why it is an
 * `Entity` with a `states.json` of its own rather than a special case in the
 * engine. Its damage, its reaction and its speed are authored where every other
 * blow's are, and the editor can open it.
 *
 * What it does *not* share with a fighter: no input, no gravity, no push, no
 * opponent to turn toward. It flies until it connects or runs out of stage.
 */
export class Projectiles {
  private readonly defs = new Map<string, EntityDef>();
  private readonly live: Live[] = [];

  private constructor(
    private readonly app: Application,
    private readonly scale: number,
    private readonly audio: Audio,
  ) {}

  /** Load the named spawns, tolerating any that are missing, like effects. */
  static async load(
    app: Application,
    names: string[],
    scale: number,
    audio: Audio,
  ): Promise<Projectiles> {
    const projectiles = new Projectiles(app, scale, audio);
    for (const name of names) {
      try {
        projectiles.defs.set(name, await loadEntityDef(name));
      } catch (e) {
        console.warn(`[projectiles] no "${name}" — run \`npm run lift\`. ${String(e)}`);
      }
    }
    return projectiles;
  }

  /** The sparks the bolts themselves ask for, so the scene can load those too. */
  effectsNeeded(): string[] {
    return [...this.defs.values()].flatMap((def) => effectsNamed(def.states));
  }

  /**
   * Put a bolt in the world, aimed the way its owner faces.
   *
   * `groundY` is the height it was fired at: a bolt's state is not airborne, so
   * the engine holds it on its own ground line every frame — which is exactly
   * the flat trajectory wanted, with no gravity and no special case.
   */
  spawn(from: { spawn: string; x: number; y: number; facing: 1 | -1 }, foe: Entity): void {
    const def = this.defs.get(from.spawn);
    if (!def) return;
    const bolt = new Entity(def, this.scale, this.audio);
    bolt.facing = from.facing;
    bolt.groundY = from.y;
    bolt.x = from.x;
    bolt.y = from.y;
    this.app.stage.addChild(bolt.view);
    this.live.push({ bolt, foe });
  }

  /**
   * Fly, hit, and sweep away whatever is finished.
   *
   * A hit pause holds the bolts too — a blow that freezes the fighters while a
   * second bolt keeps travelling would give the freeze away. A bolt that lands
   * is gone in the same frame: it left its burst behind through `hitFx`, which
   * is the effect machinery doing what it already did for sparks.
   */
  update(paused: boolean, bounds: Bounds, impact: BlowContext): ProjectileHit[] {
    const hits: ProjectileHit[] = [];
    for (let i = this.live.length - 1; i >= 0; i--) {
      const { bolt, foe } = this.live[i];
      if (!paused) bolt.update(NO_INPUT, null, bounds);
      const result = paused ? null : landBlow(bolt, foe, impact);
      if (result) hits.push({ result, foe });
      // Off the end of the stage, where `Entity` has clamped it: nothing here
      // is allowed to hang in a corner waiting for someone to walk into it.
      const stranded = bolt.x <= bounds.min || bolt.x >= bounds.max;
      if (result || stranded) {
        bolt.view.destroy({ children: true });
        this.live.splice(i, 1);
      }
    }
    return hits;
  }

  render(showBoxes: boolean): void {
    for (const { bolt } of this.live) bolt.render(showBoxes);
  }

  /** Sweep away whatever is still in the air when the scene ends. */
  destroy(): void {
    for (const { bolt } of this.live) bolt.view.destroy({ children: true });
    this.live.length = 0;
  }
}
