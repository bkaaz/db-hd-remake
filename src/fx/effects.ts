import type { Application } from "pixi.js";
import type { Bounds } from "../combat/push";
import { Entity, NO_INPUT } from "../entity/entity";
import { loadEntityDef, type EntityDef } from "../entity/entityDef";

/**
 * The sparks a blow leaves behind: entities with no state machine — one
 * animation, played once, then gone.
 *
 * They are generated rather than ripped (`npm run fx`), so a clone of this repo
 * that has not run the script has no atlas for them. That is not fatal; the
 * game says so once and fights on without sparks.
 */
export class Effects {
  private readonly defs = new Map<string, EntityDef>();
  private readonly live: Entity[] = [];

  private constructor(
    private readonly app: Application,
    private readonly scale: number,
  ) {}

  /** Load the named effects, tolerating any that have not been generated. */
  static async load(app: Application, names: string[], scale: number): Promise<Effects> {
    const effects = new Effects(app, scale);
    for (const name of names) {
      try {
        effects.defs.set(name, await loadEntityDef(name));
      } catch (e) {
        console.warn(`[fx] no "${name}" — run \`npm run fx\` to generate it. ${String(e)}`);
      }
    }
    return effects;
  }

  /**
   * Put an effect on screen, centred on a point in the world.
   *
   * An effect's animations are interchangeable variants, so one is picked at
   * random: four squashed sparks stop a combo looking like the same stamp
   * printed over and over. The mirror doubles that for free and, unlike a
   * rotation, is exact — it moves whole pixels, so nothing is resampled.
   */
  spawn(name: string, x: number, y: number): void {
    const def = this.defs.get(name);
    if (!def) return;
    const variants = Object.keys(def.animations);
    if (variants.length === 0) return;
    const fx = new Entity(def, this.scale);
    fx.preview(variants[Math.floor(Math.random() * variants.length)]);
    fx.facing = Math.random() < 0.5 ? 1 : -1;
    fx.x = x;
    fx.y = y;
    this.app.stage.addChild(fx.view);
    this.live.push(fx);
  }

  /**
   * One game frame for every live effect, and the finished ones swept away.
   *
   * A hit pause holds them too: a spark that kept animating through hitstop
   * would be the one thing on screen giving the freeze away. The sweep still
   * runs while paused — nothing can finish during a freeze, so it costs a walk
   * over a short list and keeps the rule in one place.
   */
  update(paused: boolean, bounds: Bounds): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const fx = this.live[i];
      if (!paused) fx.update(NO_INPUT, null, bounds);
      if (fx.finished) {
        fx.view.destroy({ children: true });
        this.live.splice(i, 1);
      }
    }
  }

  /** Sweep away whatever is still in the air when the scene ends. */
  destroy(): void {
    for (const fx of this.live) fx.view.destroy({ children: true });
    this.live.length = 0;
  }

  /** Effects never show their boxes — they have none worth looking at. */
  render(): void {
    for (const fx of this.live) fx.render(false);
  }
}
