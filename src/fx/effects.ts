import type { Container } from "pixi.js";
import type { Bounds } from "../combat/push";
import { Entity, NO_INPUT } from "../entity/entity";
import { loadEntityDef, type EntityDef } from "../entity/entityDef";
import { copyOffset } from "./burst";
import { followedFrame } from "./follow";

/**
 * The sparks a blow leaves behind: entities with no state machine — one
 * animation, played once, then gone.
 *
 * They are generated rather than ripped (`npm run fx`), so a clone of this repo
 * that has not run the script has no sheet for them. That is not fatal; the
 * game says so once and fights on without sparks.
 */
/** One effect on screen, and what is left of its copies (`attributes.copies`). */
interface Live {
  fx: Entity;
  name: string;
  copiesLeft: number;
  copied: boolean;
  /** For one that `follows`: whom, from where, in which of his animations — it goes when he leaves it. */
  owner?: { entity: Entity; at: [number, number]; anim: string };
}

export class Effects {
  private readonly defs = new Map<string, EntityDef>();
  private readonly live: Live[] = [];

  private constructor(
    /** The game's world, in game px. */
    private readonly world: Container,
    private readonly scale: number,
  ) {}

  /** Load the named effects, tolerating any that have not been generated. */
  static async load(world: Container, names: string[], scale: number): Promise<Effects> {
    const effects = new Effects(world, scale);
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
  spawn(name: string, x: number, y: number, copiesLeft?: number, facing?: 1 | -1, owner?: { entity: Entity; at: [number, number] }): void {
    const def = this.defs.get(name);
    if (!def) return;
    const variants = Object.keys(def.animations);
    if (variants.length === 0) return;
    const fx = new Entity(def, this.scale);
    fx.preview(variants[Math.floor(Math.random() * variants.length)]);
    // what its spawner's script put out faces the spawner's way, as the
    // original mirrors a b0's object with the fighter's facing ($01:873F)
    fx.facing = facing ?? (def.attributes.mirrors && Math.random() < 0.5 ? -1 : 1);
    fx.x = x;
    fx.y = y;
    this.world.addChild(fx.view);
    const rides = def.attributes.follows && owner ? { ...owner, anim: owner.entity.animation } : undefined;
    this.live.push({ fx, name, copiesLeft: copiesLeft ?? def.attributes.copies.count, copied: false, owner: rides });
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
      const live = this.live[i];
      const { fx } = live;
      if (!paused) fx.update(NO_INPUT, null, bounds);
      if (live.owner && !this.ride(live)) {
        fx.view.destroy({ children: true });
        this.live.splice(i, 1);
        continue;
      }
      const copies = this.defs.get(live.name)?.attributes.copies;
      if (copies && !live.copied && live.copiesLeft > 0 && fx.animStep >= copies.step) {
        live.copied = true;
        const [dx, dy] = [copyOffset(Math.random(), copies.spread), copyOffset(Math.random(), copies.spread)];
        this.spawn(live.name, fx.x + dx * this.scale, fx.y + dy * this.scale, live.copiesLeft - 1);
      }
      // a follower ends with its owner's drawing, not its own animation
      if (fx.finished && !live.owner) {
        fx.view.destroy({ children: true });
        this.live.splice(i, 1);
      }
    }
  }

  /** Put a follower on its owner for this frame; false once it is gone ($0F:B8F2). */
  private ride(live: Live): boolean {
    const { fx, owner } = live;
    if (!owner || owner.entity.animation !== owner.anim) return false;
    const frame = followedFrame(owner.entity.frameId);
    if (frame === null) return false;
    const { entity, at } = owner;
    fx.facing = entity.facing;
    fx.x = entity.x + entity.facing * at[0] * this.scale;
    fx.y = entity.y + at[1] * this.scale;
    fx.showFrame(frame);
    return true;
  }

  /** Sweep away whatever is still in the air when the scene ends. */
  destroy(): void {
    for (const { fx } of this.live) fx.view.destroy({ children: true });
    this.live.length = 0;
  }

  /** Effects never show their boxes — they have none worth looking at. */
  render(): void {
    for (const { fx } of this.live) fx.render(false);
  }
}
