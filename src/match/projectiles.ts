import type { Container } from "pixi.js";
import type { Bounds } from "../combat/push";
import { Entity, NO_INPUT } from "../entity/entity";
import { effectsNamed, spawnsNamed } from "../entity/states";
import { loadEntityDef, type EntityDef } from "../entity/entityDef";
import { landBlow, type BlowContext, type BlowResult } from "./blow";
import { objectGone } from "../camera/camera";
import { logEvent } from "../log";
import { nextRadius } from "../combat/ball";
import { keepAround } from "./around";
import { leftMove, movesHeld } from "./thrownIn";

/** No edge holds a bolt back: it is gone once it strays too far (`objectGone`). */
const ANYWHERE: Bounds = { min: -Infinity, max: Infinity };
/** How far from the camera's x a `keptOnScreen` bolt may go ($0F:C6D3, $0F:C6ED). */
const SCREEN_EDGE = { left: 0x10, right: 0xf0 };

/** One bolt in the air, the only body it may hit, and who is owed the news. */
interface Live {
  /** Its spawn's name, for the log. */
  name: string;
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
  /** Of those, the ones that keep their place beside it (`around`). */
  kept: Map<Entity, [number, number]>;
  /** Whether the owner draws a band to it — only this bolt may say where its head is. */
  beam: boolean;
  /** `rides`: where it stays on its owner, forward of him and down from him, in game px. */
  ride: { ahead: number; down: number } | null;
  /** `endsWithMove`: the owner's moves it lives through; gone when he leaves them. */
  thrownIn: readonly string[] | null;
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
 * opponent to turn toward. It flies until it connects or strays off the screen.
 */
export class Projectiles {
  private readonly defs = new Map<string, EntityDef>();
  private readonly live: Live[] = [];
  /** Companions whose bolt is gone, playing their `onRelease` state out. */
  private readonly leaving: Entity[] = [];
  /** Balls a hit let go, shrinking where it struck. */
  private fading: { owner: Entity; x: number; y: number; radius: number }[] = [];

  private constructor(
    /** The game's world, in game px. */
    private readonly world: Container,
    private readonly scale: number,
  ) {}

  /** Load the named spawns, tolerating any that are missing, like effects. */
  static async load(
    world: Container,
    names: string[],
    scale: number,
  ): Promise<Projectiles> {
    const projectiles = new Projectiles(world, scale);
    const queue = [...names];
    for (let name = queue.shift(); name; name = queue.shift()) {
      if (projectiles.defs.has(name)) continue;
      try {
        const def = await loadEntityDef(name);
        projectiles.defs.set(name, def);
        // what it becomes is a bolt too, and only it says so
        queue.push(...spawnsNamed(def.states));
      } catch (e) {
        console.warn(`[projectiles] no "${name}" — run \`npm run lift\`. ${String(e)}`);
      }
    }
    return projectiles;
  }

  /** Nothing in the air: a round does not end over a shot that could still land. */
  get empty(): boolean {
    return this.live.length === 0;
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
      with: { spawn: string; x: number; y: number; around?: [number, number] }[];
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
    // it sounds on its thrower's side, as the original plays it by the thrower
    const bolt = new Entity(def, this.scale, owner.sounds);
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
    // one that falls has the floor under it, not the height it left from (Vertical Ki)
    const above = bolt.burstsAbove;
    bolt.groundY = above === undefined ? (bolt.fallsToFloor ? owner.groundY : from.y) : owner.groundY - above * this.scale;
    bolt.x = from.x;
    bolt.y = from.y;
    this.world.addChild(bolt.view);
    const kept = new Map<Entity, [number, number]>();
    const companions = from.with.flatMap((w) => {
      const companion = this.defs.get(w.spawn);
      if (!companion) return [];
      const e = new Entity(companion, this.scale, owner.sounds);
      e.facing = w.around ? 1 : from.facing;
      e.groundY = e.y = w.y;
      e.x = w.x;
      if (w.around) kept.set(e, w.around);
      this.world.addChild(e.view);
      return [e];
    });
    const ride = bolt.rides ? { ahead: (bolt.x - owner.x) * from.facing, down: bolt.y - owner.y } : null;
    this.live.push({ name: from.spawn, bolt, foe, owner, companions, kept, beam: from.beam, ride, thrownIn: bolt.endsWithMove ? movesHeld(bolt.endsWithMove, owner.animation) : null });
    logEvent(`bolt ${from.spawn} out at x ${Math.round(bolt.x)}`);
  }

  /**
   * Fly, hit, and sweep away whatever is finished.
   *
   * A hit pause holds the bolts too — a blow that freezes the fighters while a
   * second bolt keeps travelling would give the freeze away. A bolt that lands
   * is gone in the same frame: it left its burst behind through `hitFx`, which
   * is the effect machinery doing what it already did for sparks.
   */
  update(paused: boolean, view: { x: number; y: number }, impact: BlowContext): ProjectileHit[] {
    const hits: ProjectileHit[] = [];
    // the first to land stops the rest where they are: Kakusan's three take their turns ($30B2)
    let halted = paused;
    // oldest first, as the original's slots: of Kakusan's three, the first to be put out strikes first
    for (const shot of [...this.live]) {
      const { name, bolt, foe, owner, companions, kept, beam, ride, thrownIn } = shot;
      if (!paused || bolt.throughPause) {
        bolt.aimAt(foe.y);
        bolt.update(NO_INPUT, null, ANYWHERE);
      }
      if (bolt.keptOnScreen) bolt.x = Math.max(view.x + SCREEN_EDGE.left, Math.min(view.x + SCREEN_EDGE.right, bolt.x));
      // the original's object takes its thrower's place every frame (Energy Field, $0F:BBB3)
      if (ride) {
        bolt.x = owner.x + ride.ahead * owner.facing;
        bolt.y = bolt.groundY = owner.y + ride.down;
      }
      if (!paused) for (const c of companions) c.update(NO_INPUT, null, ANYWHERE);
      for (const [c, around] of kept) keepAround(c, bolt, around, this.scale);
      // the thrower draws the band to it, if its state has one (combat/band.ts)
      if (beam) owner.beamReaches(bolt.x);
      const result = halted ? null : landBlow(bolt, foe, impact);
      if (result) halted = true;
      // one blow between them ($0F:E0D7): the set's others are spent with it, the next set armed afresh
      if (result && bolt.sharesBlow) for (const other of this.live) if (other !== shot && other.name === name && other.owner === owner) other.bolt.markHit();
      if (result) hits.push({ result, foe });
      // the pause is the whole game's ($30B2): his hand stops too, as a blast of his lasts 65 frames on a hit and 56 without
      const opened = result && !result.blocked && bolt.opens;
      if (result && !opened) owner.freeze(bolt.attackHitstop);
      if (opened) owner.opensScene(opened);
      // up until the scene's light takes the same circle next frame: the slot goes and his `37` comes with nothing between
      if (opened && bolt.ballNow > 0) owner.showThrownBall({ x: bolt.x, y: bolt.y, radius: bolt.ballNow });
      // strayed too far from the screen's middle, off a side or the top ($0F:B47D)
      const stranded = objectGone(bolt.x, bolt.y, view);
      // and is gone the moment he leaves the move that put it out ($0F:BB51)
      const orphaned = thrownIn !== null && bolt.endsWithMove !== undefined && leftMove(thrownIn, owner.animation);
      // down on its floor: its burst where it is, as the original rewrites the slot ($0F:BB05)
      const floored = bolt.burstsAbove !== undefined && bolt.hasLanded;
      const burst = bolt.attackBurst;
      if (floored && !result && burst && bolt.landsAs.length === 0) {
        impact.effects.spawn(bolt.onFloor.burst ?? burst, bolt.x, bolt.y + (bolt.burstsBelow ?? 0) * this.scale);
        if (bolt.onFloor.sound) foe.sound(bolt.onFloor.sound);
        else if (bolt.burstsBelow !== undefined) foe.sound(bolt.attackSounds.hit);
      }
      if (floored && !result) {
        for (const next of bolt.landsAs) {
          owner.spawnAdded();
          this.spawn({ spawn: next, x: bolt.x, y: owner.groundY, facing: bolt.facing, size: 1, with: [], beam: false }, owner, foe);
        }
      }
      if (bolt.expired && !result && bolt.burstsAtEnd && burst) {
        impact.effects.spawn(burst, bolt.x, bolt.y);
        foe.sound(bolt.attackSounds.hit);
      }
      if ((result && !bolt.outlivesHit) || floored || stranded || orphaned || bolt.expired) {
        // the scene it opens draws on the same circle at once: no ball left to fade (`$0F:A417`)
        if (result && !opened && bolt.ballNow > 0) this.fading.push({ owner, x: bolt.x, y: bolt.y, radius: bolt.ballNow });
        const why = result ? "hit" : floored ? "floored" : stranded ? "strayed" : orphaned ? "orphaned" : "expired";
        logEvent(`bolt ${name} gone (${why}) at x ${Math.round(bolt.x)}, screen x ${Math.round(bolt.x - view.x)}`);
        bolt.view.destroy({ children: true });
        for (const c of companions) this.release(c);
        this.live.splice(this.live.indexOf(shot), 1);
        if (beam) owner.beamReaches(null);
        owner.spawnEnded();
      }
    }
    this.fadeBalls();
    for (let i = this.leaving.length - 1; i >= 0; i--) {
      const c = this.leaving[i];
      if (!paused) c.update(NO_INPUT, null, ANYWHERE);
      if (c.finished) {
        c.view.destroy({ children: true });
        this.leaving.splice(i, 1);
      }
    }
    return hits;
  }

  /** One step of each ball a hit let go: where it was, through the hit's pause too (Mightiness Bomber, `$2A:A597`). */
  private fadeBalls(): void {
    this.fading = this.fading.filter((ball) => {
      ball.radius = nextRadius(ball.radius, undefined, 0);
      ball.owner.showThrownBall(ball.radius > 0 ? ball : null);
      return ball.radius > 0;
    });
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
