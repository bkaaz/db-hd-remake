import type { Container } from "pixi.js";
import type { Audio } from "../audio/playback";
import type { Camera } from "../camera/camera";
import type { ShakeDef } from "../camera/shake";
import { bodyOverlap, pushApart, separate, type Bounds } from "../combat/push";
import { Entity, type WorldInput } from "../entity/entity";
import type { EntityDef } from "../entity/entityDef";
import type { Effects } from "../fx/effects";
import type { Stage } from "../stage";
import { landBlow, type BlowContext } from "./blow";
import type { Projectiles } from "./projectiles";
import { Recorder } from "./record";
import { Throws } from "./throw";
import type { DebugFrame } from "../ui/debug";

/** Where things may go this frame: bodies within the world, bolts within the screen. */
export interface Field {
  bodies: Bounds;
  shots: Bounds;
}

export interface FightersSetup {
  /** The layer the bodies stand in — the game's world, in game px. */
  world: Container;
  p1: EntityDef;
  /** Null shows one body and no fight: there is no opponent to make. */
  p2: EntityDef | null;
  scale: number;
  /** The game's sounds; each side adds its fighter's voice (`Audio.side`). */
  audio: Audio;
  effects: Effects;
  /** The bolts in the air. They belong here: a bolt is one fighter hitting the other. */
  projectiles: Projectiles;
}

/** What the HUD and the status line need to know about the pair. */
export interface FightersStatus {
  /** Each side's health in the original's units; null where there is no opponent. */
  health: [number, number | null];
  /** Each side's charging dial, as the HUD draws it. */
  dial: [number, number | null];
}

/**
 * The two bodies in a match, and everything that happens **between** them.
 *
 * Pushing apart, trading blows, sharing a hit pause — every rule here needs
 * both fighters at once, which is why they belong to one object instead of
 * being spelled out in the loop. The loop then reads as the order those things
 * happen in, which is the part worth being able to see at a glance.
 *
 * The boundary is narrow on purpose: this knows two fighters and nothing about
 * the HUD, the keyboard or the stage. Every future rule of combat will want to
 * move in here, and it only stays readable while that stays true.
 */
export class Fighters {
  /** The longest white screen any blow landed this frame asked for. */
  private flash = 0;
  /** The shake a state entered this frame asked for; the later of two wins, as one `$E3` holds one. */
  private shake: ShakeDef | null = null;
  readonly player: Entity;
  /** Null in preview mode: one fighter, nobody to hit. */
  readonly opponent: Entity | null;

  /** Passed to every blow that lands: what it sounds like and what it leaves. */
  private readonly impact: BlowContext;
  /** Turns what happens between the two into lines — see ./record.ts. */
  private readonly recorder = new Recorder();
  private readonly throws = new Throws();
  private readonly projectiles: Projectiles;
  /** Where each body stood before this frame moved it — what the camera reads its push from. */
  private from: [number, number] = [0, 0];
  /**
   * The body drawn over the other: the one who last armed a blow — the
   * original keeps one bit for the pair (`$30B0` bit 0, `$00:812E`) and
   * arming a blow sets it to the mover (`$0D:D8A2`). Player one at first.
   */
  private inFront: Entity;

  constructor({ world, p1, p2, scale, audio, effects, projectiles }: FightersSetup) {
    this.impact = { effects };
    this.projectiles = projectiles;
    // a side each, so that one's sound never cuts the other's (src/audio/playback.ts)
    this.player = new Entity(p1, scale, audio.side("p1", p1.sounds));
    this.opponent = p2 ? new Entity(p2, scale, audio.side("p2", p2.sounds)) : null;
    this.inFront = this.player;
    world.addChild(this.player.view);
    if (this.opponent) world.addChild(this.opponent.view);
  }

  /**
   * Both fighters in an arena's lighting. Returns the names of those with no
   * sheet for it, who keep their own colours, for the caller to say so.
   */
  light(time: string): string[] {
    return this.both()
      .filter((f) => !f.light(time))
      .map((f) => f.name);
  }

  /** True while a hit pause holds either body — everything else must hold too. */
  get frozen(): boolean {
    return this.player.frozen || !!this.opponent?.frozen;
  }

  /**
   * Opening corners, and the floor to stand on.
   *
   * `at` is a fraction of the world, and a debug mode may set either side — the
   * same value twice is legal and means "both in the corner": they start on top
   * of each other and the push that already runs every frame does the rest.
   */
  start(stage: Stage, at: { p1?: number; p2?: number } = {}): void {
    this.player.groundY = stage.groundY;
    this.player.x = stage.xAt(at.p1 ?? (this.opponent ? 0.35 : 0.5));
    if (this.opponent) {
      this.opponent.groundY = stage.groundY;
      this.opponent.x = stage.xAt(at.p2 ?? 0.65);
    }
  }

  /**
   * One game frame for each body, then for everything they have thrown.
   *
   * The bolts move here rather than in the scene because who a bolt may hit is
   * a fact about the pair, and this is the object that knows the pair. A bolt
   * fired this frame does not move or hit until the next one — it appears at
   * the hand, which is where the player is looking.
   */
  update(playerInput: WorldInput, opponentInput: WorldInput, field: Field): void {
    this.from = [this.player.x, this.opponent?.x ?? 0];
    this.player.update(playerInput, this.opponent ?? null, field.bodies);
    this.opponent?.update(opponentInput, this.player, field.bodies);
    if (this.opponent) {
      this.throws.update(this.player, this.opponent);
      this.throws.update(this.opponent, this.player);
    }

    for (const hit of this.projectiles.update(this.frozen, field.shots, this.impact)) {
      this.flash = Math.max(this.flash, hit.result.flash);
      const [from, to] = hit.foe === this.player ? ["P2 bolt", "P1"] : ["P1 bolt", "P2"];
      this.recorder.blow(hit.result, from, to, this.gap(), this.named());
    }
    if (this.opponent) {
      this.fire(this.player, this.opponent);
      this.fire(this.opponent, this.player);
    }
    for (const fighter of this.both()) {
      if (fighter.takeArmed()) this.inFront = fighter;
      // after the arming: Side Slash arms its blow and goes behind on the same entry
      const other = fighter === this.player ? this.opponent : this.player;
      if (fighter.takeBehind() && other) this.inFront = other;
      this.shake = fighter.takeShake() ?? this.shake;
      const fx = fighter.takeGroundFx();
      if (fx) this.impact.effects.spawn(fx.name, fx.x, fx.y);
    }
  }

  /**
   * Let the camera follow this frame's moves, and stand where it says: it may
   * stop a body at the screen's edge, or put one back that drifted past it.
   */
  keepInView(camera: Camera): void {
    const { player, opponent } = this;
    const placed = camera.follow(
      { from: this.from[0], to: player.x },
      opponent ? { from: this.from[1], to: opponent.x } : null,
    );
    player.x = placed.a;
    if (opponent && placed.b !== null) opponent.x = placed.b;
    camera.lift(this.both().map((f) => f.y));
  }

  /** A fighter who entered a state that `fires` puts a bolt in the world. */
  private fire(owner: Entity, foe: Entity): void {
    const shot = owner.takeFired();
    if (shot) this.projectiles.spawn(shot, owner, foe);
  }

  /**
   * Bodies cannot overlap. Two with push boxes meet wherever those touch, in
   * the air too ($2A:80ED); otherwise only while both are `solid`, so a
   * hand-built jump carries over the opponent. A hit pause suspends this too,
   * or "frozen" would mean everything except the push.
   */
  pushApart(bounds: Bounds): void {
    const { player, opponent } = this;
    if (!opponent) return;
    if (player.frozen || opponent.frozen) return;
    const [a, b] = [player.pushBodies, opponent.pushBodies];
    if (a && b) {
      const { ax, bx } = pushApart(player.x, opponent.x, bodyOverlap(a, b, player.x <= opponent.x), bounds);
      player.x = ax;
      opponent.x = bx;
      return;
    }
    if (!player.solid || !opponent.solid) return;
    const { ax, bx } = separate(
      { x: player.x, half: player.pushHalf },
      { x: opponent.x, half: opponent.pushHalf },
      bounds,
    );
    player.x = ax;
    opponent.x = bx;
  }

  /**
   * Both directions, attacker first. A genuine trade — both boxes out in the
   * same frame — therefore lands both ways, which is the intent: neither
   * fighter gets to win a clash for being checked first.
   */
  exchangeBlows(): void {
    if (!this.opponent) return;
    const gap = this.gap();
    const named = this.named();
    for (const [from, to, a, d] of [["P1", "P2", this.player, this.opponent], ["P2", "P1", this.opponent, this.player]] as const) {
      const result = landBlow(a, d, this.impact);
      if (result) this.flash = Math.max(this.flash, result.flash);
      this.recorder.blow(result, from, to, gap, named);
    }
  }

  /** The white screen a blow asked for this frame, in frames — taken, so it is asked once. */
  /** The backdrop's shake asked for this frame, or null — taken, so it starts once. */
  takeShake(): ShakeDef | null {
    const shake = this.shake;
    this.shake = null;
    return shake;
  }

  takeFlash(): number {
    const frames = this.flash;
    this.flash = 0;
    return frames;
  }

  /**
   * How far apart the two stand, in SPRITE px — like every reach, box and
   * knockback in the project. World positions are kept in screen px at a fixed
   * scale, and a gap quoted in those cannot be compared with the numbers it
   * exists to be compared with.
   */
  private gap(): number {
    if (!this.opponent) return 0;
    return Math.abs(this.opponent.x - this.player.x) / this.player.placement.scale;
  }

  /** Both fighters' health and ki full: the debug key, so a move that costs either can be tried again. */
  refill(): void {
    for (const fighter of this.both()) fighter.refill();
  }

  /** Note what changed this frame, for the recording. */
  note(): void {
    this.recorder.note(this.named());
  }

  private named(): [string, Entity][] {
    return this.opponent
      ? [
          ["P1", this.player],
          ["P2", this.opponent],
        ]
      : [["P1", this.player]];
  }

  render(showBoxes: boolean): void {
    const behind = this.inFront === this.player ? this.opponent : this.player;
    const world = this.inFront.view.parent;
    if (behind && world && world.getChildIndex(this.inFront.view) < world.getChildIndex(behind.view)) {
      world.swapChildren(this.inFront.view, behind.view);
    }
    this.player.render(showBoxes);
    this.opponent?.render(showBoxes);
    this.projectiles.render(showBoxes);
  }

  /** Take both bodies off the stage; a scene that leaves them leaves ghosts. */
  destroy(): void {
    for (const fighter of this.both()) fighter.view.destroy({ children: true });
    this.projectiles.destroy();
  }

  status(): FightersStatus {
    return {
      health: [this.player.health, this.opponent?.health ?? null],
      dial: [this.player.dial, this.opponent?.dial ?? null],
    };
  }

  /** What the debug readout shows; null when it is switched off. */
  debug(): DebugFrame {
    return {
      player: this.player.debug,
      opponent: this.opponent?.debug ?? null,
    };
  }

  private both(): Entity[] {
    return this.opponent ? [this.player, this.opponent] : [this.player];
  }
}
