import type { Application } from "pixi.js";
import type { Audio } from "../audio/playback";
import { separate, type Bounds } from "../combat/push";
import { Entity, type WorldInput } from "../entity/entity";
import type { EntityDef } from "../entity/entityDef";
import type { Effects } from "../fx/effects";
import type { Stage } from "../stage";
import { landBlow, type BlowContext } from "./blow";
import type { Projectiles } from "./projectiles";
import { Recorder } from "./record";
import type { DebugFrame } from "../ui/debug";

export interface FightersSetup {
  app: Application;
  def: EntityDef;
  scale: number;
  audio: Audio;
  effects: Effects;
  /** Preview mode shows one body and no fight, so there is no opponent to make. */
  solo: boolean;
  /** The bolts in the air. They belong here: a bolt is one fighter hitting the other. */
  projectiles: Projectiles;
}

/** What the HUD needs to know about the pair, once per rendered frame. */
export interface FightersStatus {
  playerHealth: number;
  playerKi: number;
  opponentHealth: number | null;
  state: string;
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
  readonly player: Entity;
  /** Null in preview mode: one fighter, nobody to hit. */
  readonly opponent: Entity | null;

  /** Passed to every blow that lands: what it sounds like and what it leaves. */
  private readonly impact: BlowContext;
  /** Turns what happens between the two into lines — see ./record.ts. */
  private readonly recorder = new Recorder();
  private readonly projectiles: Projectiles;

  constructor({ app, def, scale, audio, effects, solo, projectiles }: FightersSetup) {
    this.impact = { audio, effects };
    this.projectiles = projectiles;
    this.player = new Entity(def, scale, audio);
    this.opponent = solo ? null : new Entity(def, scale, audio);
    app.stage.addChild(this.player.view);
    if (this.opponent) app.stage.addChild(this.opponent.view);
  }

  /** True while a hit pause holds either body — everything else must hold too. */
  get frozen(): boolean {
    return this.player.frozen || !!this.opponent?.frozen;
  }

  /**
   * Opening corners, and the floor to stand on.
   *
   * `at` is a fraction of the stage, and a debug mode may set either side — the
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

  /** After a resize: the new floor, and nobody left standing outside the field. */
  fit(stage: Stage): void {
    for (const fighter of this.both()) {
      fighter.groundY = stage.groundY;
      fighter.x = Math.max(stage.bounds.min, Math.min(stage.bounds.max, fighter.x));
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
  update(playerInput: WorldInput, opponentInput: WorldInput, bounds: Bounds): void {
    this.player.update(playerInput, this.opponent?.x ?? null, bounds);
    this.opponent?.update(opponentInput, this.player.x, bounds);

    for (const hit of this.projectiles.update(this.frozen, bounds, this.impact)) {
      this.flash = Math.max(this.flash, hit.result.flash);
      const [from, to] = hit.foe === this.player ? ["P2 bolt", "P1"] : ["P1 bolt", "P2"];
      this.recorder.blow(hit.result, from, to, this.gap(), this.named());
    }
    if (this.opponent) {
      this.fire(this.player, this.opponent);
      this.fire(this.opponent, this.player);
    }
  }

  /** A fighter who entered a state that `fires` puts a bolt in the world. */
  private fire(owner: Entity, foe: Entity): void {
    const shot = owner.takeFired();
    if (shot) this.projectiles.spawn(shot, owner, foe);
  }

  /**
   * Bodies cannot overlap — but only while both are `solid`, so a jump can
   * carry you over the opponent instead of being blocked by them. A hit pause
   * suspends this too, or "frozen" would mean everything except the push.
   */
  pushApart(bounds: Bounds): void {
    const { player, opponent } = this;
    if (!opponent) return;
    if (!player.solid || !opponent.solid || player.frozen || opponent.frozen) return;
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

  /** Both meters full: the debug key, so a move that costs ki can be tried. */
  fillKi(): void {
    for (const fighter of this.both()) fighter.fillKi();
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
      playerHealth: this.player.healthFraction,
      playerKi: this.player.kiFraction,
      opponentHealth: this.opponent?.healthFraction ?? null,
      state: this.player.state,
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
