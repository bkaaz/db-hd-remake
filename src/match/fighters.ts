import type { Application } from "pixi.js";
import type { Audio } from "../audio/playback";
import { separate, type Bounds } from "../combat/push";
import { Entity, type WorldInput } from "../entity/entity";
import type { EntityDef } from "../entity/entityDef";
import type { Effects } from "../fx/effects";
import type { Stage } from "../stage";
import { landBlow, type BlowContext } from "./blow";
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
}

/** What the HUD needs to know about the pair, once per rendered frame. */
export interface FightersStatus {
  playerHealth: number;
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
  readonly player: Entity;
  /** Null in preview mode: one fighter, nobody to hit. */
  readonly opponent: Entity | null;

  /** Passed to every blow that lands: what it sounds like and what it leaves. */
  private readonly impact: BlowContext;
  /** Turns what happens between the two into lines — see ./record.ts. */
  private readonly recorder = new Recorder();

  constructor({ app, def, scale, audio, effects, solo }: FightersSetup) {
    this.impact = { audio, effects };
    this.player = new Entity(def, scale, audio);
    this.opponent = solo ? null : new Entity(def, scale, audio);
    app.stage.addChild(this.player.view);
    if (this.opponent) app.stage.addChild(this.opponent.view);
  }

  /** True while a hit pause holds either body — everything else must hold too. */
  get frozen(): boolean {
    return this.player.frozen || !!this.opponent?.frozen;
  }

  /** Opening corners, and the floor to stand on. */
  start(stage: Stage): void {
    this.player.groundY = stage.groundY;
    this.player.x = stage.xAt(this.opponent ? 0.35 : 0.5);
    if (this.opponent) {
      this.opponent.groundY = stage.groundY;
      this.opponent.x = stage.xAt(0.65);
    }
  }

  /** After a resize: the new floor, and nobody left standing outside the field. */
  fit(stage: Stage): void {
    for (const fighter of this.both()) {
      fighter.groundY = stage.groundY;
      fighter.x = Math.max(stage.bounds.min, Math.min(stage.bounds.max, fighter.x));
    }
  }

  /** One game frame for each body. Each is told where the other one stands. */
  update(playerInput: WorldInput, opponentInput: WorldInput, bounds: Bounds): void {
    this.player.update(playerInput, this.opponent?.x ?? null, bounds);
    this.opponent?.update(opponentInput, this.player.x, bounds);
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
    // In SPRITE px, like every reach, box and knockback in the project. World
    // positions are kept in screen px at a fixed scale, and a gap quoted in
    // those cannot be compared with the numbers it exists to be compared with.
    const gap = Math.abs(this.opponent.x - this.player.x) / this.player.placement.scale;
    const named = this.named();
    this.recorder.blow(landBlow(this.player, this.opponent, this.impact), "P1", "P2", gap, named);
    this.recorder.blow(landBlow(this.opponent, this.player, this.impact), "P2", "P1", gap, named);
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
  }

  /** Take both bodies off the stage; a scene that leaves them leaves ghosts. */
  destroy(): void {
    for (const fighter of this.both()) fighter.view.destroy({ children: true });
  }

  status(): FightersStatus {
    return {
      playerHealth: this.player.healthFraction,
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
