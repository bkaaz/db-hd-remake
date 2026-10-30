import type { Application } from "pixi.js";
import type { Audio } from "../audio/playback";
import type { Bounds } from "../combat/push";
import { Entity, NO_INPUT } from "../entity/entity";
import { effectsNamed } from "../entity/states";
import { loadEntityDef, type EntityDef } from "../entity/entityDef";
import { landBlow, type BlowContext, type BlowResult } from "./blow";

/** One bolt in the air, the only body it may hit, and who is owed the news. */
interface Live {
  bolt: Entity;
  foe: Entity;
  /**
   * Told when this bolt leaves the world, and nothing else. The bolt itself
   * still has no way to reach him (ADR 0014) — this is bookkeeping held out
   * here, so that a fighter can hold a pose until what he threw is gone.
   */
  owner: Entity;
  /** What came out beside it (`fires.with`): drawn and moved, never hitting, gone with it. */
  companions: Entity[];
  /** Whether the owner draws a band to it — only this bolt may say where its head is. */
  beam: boolean;
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
  /** Companions whose bolt is gone, playing their `onRelease` state out. */
  private readonly leaving: Entity[] = [];

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
  spawn(
    from: {
      spawn: string;
      state?: string;
      x: number;
      y: number;
      facing: 1 | -1;
      size: number;
      with: { spawn: string; x: number; y: number }[];
      beam: boolean;
    },
    owner: Entity,
    foe: Entity,
  ): void {
    const def = this.defs.get(from.spawn);
    // Nothing to spawn is still an ending: a fighter holding a pose until his
    // bolt is gone would hold it for ever if the bolt never existed.
    if (!def) {
      owner.spawnEnded();
      return;
    }
    const bolt = new Entity(def, this.scale, this.audio);
    // Bigger, not faster. `size` multiplies the drawing and the boxes placed
    // through it; the world scale that turns px-per-frame into movement is the
    // scene's, or a fully charged bolt would cross the stage in half the time.
    bolt.size = from.size;
    // One drawing, two flights: which one is the move's choice, and the flight
    // itself is authored in the bolt's own states.
    if (from.state) bolt.forceState(from.state);
    bolt.facing = from.facing;
    // Its blows come from where it is heading, not from where it is: see
    // `Entity.travels`.
    bolt.travels = true;
    bolt.groundY = from.y;
    bolt.x = from.x;
    bolt.y = from.y;
    this.app.stage.addChild(bolt.view);
    const companions = from.with.flatMap((w) => {
      const companion = this.defs.get(w.spawn);
      if (!companion) return [];
      const e = new Entity(companion, this.scale, this.audio);
      e.facing = from.facing;
      e.groundY = e.y = w.y;
      e.x = w.x;
      this.app.stage.addChild(e.view);
      return [e];
    });
    this.live.push({ bolt, foe, owner, companions, beam: from.beam });
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
      const { bolt, foe, owner, companions, beam } = this.live[i];
      if (!paused) bolt.update(NO_INPUT, null, bounds);
      if (!paused) for (const c of companions) c.update(NO_INPUT, null, bounds);
      // the thrower draws the band to it, if its state has one (combat/band.ts)
      if (beam) owner.beamReaches(bolt.x);
      const result = paused ? null : landBlow(bolt, foe, impact);
      if (result) hits.push({ result, foe });
      // Off the end of the stage, where `Entity` has clamped it: nothing here
      // is allowed to hang in a corner waiting for someone to walk into it.
      const stranded = bolt.x <= bounds.min || bolt.x >= bounds.max;
      if (result || stranded) {
        bolt.view.destroy({ children: true });
        for (const c of companions) this.release(c);
        this.live.splice(i, 1);
        if (beam) owner.beamReaches(null);
        owner.spawnEnded();
      }
    }
    for (let i = this.leaving.length - 1; i >= 0; i--) {
      const c = this.leaving[i];
      if (!paused) c.update(NO_INPUT, null, bounds);
      if (c.finished) {
        c.view.destroy({ children: true });
        this.leaving.splice(i, 1);
      }
    }
    return hits;
  }

  /** A companion whose bolt is gone: into its way out if it has one, else gone now. */
  private release(c: Entity): void {
    const out = c.releaseState;
    if (out && c.forceState(out)) this.leaving.push(c);
    else c.view.destroy({ children: true });
  }

  render(showBoxes: boolean): void {
    for (const { bolt, companions } of this.live) for (const e of [bolt, ...companions]) e.render(showBoxes);
    for (const c of this.leaving) c.render(showBoxes);
  }

  /** Sweep away whatever is still in the air when the scene ends. */
  destroy(): void {
    for (const { bolt, owner, companions } of this.live) {
      for (const e of [bolt, ...companions]) e.view.destroy({ children: true });
      owner.spawnEnded();
    }
    for (const c of this.leaving) c.view.destroy({ children: true });
    this.live.length = 0;
    this.leaving.length = 0;
  }
}
