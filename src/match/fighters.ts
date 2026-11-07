import type { Container } from "pixi.js";
import type { Audio } from "../audio/playback";
import type { Camera } from "../camera/camera";
import type { ShakeDef } from "../camera/shake";
import type { ScreenCue } from "../screen";
import { bodyOverlap, pushApart, separate, type Bounds } from "../combat/push";
import { contact } from "../combat/hit";
import { Entity, type WorldInput } from "../entity/entity";
import { VIEW } from "../view";
import type { EntityDef } from "../entity/entityDef";
import type { Effects } from "../fx/effects";
import type { Stage } from "../stage";
import type { Way } from "../arena/ways";
import { landBlow, type BlowContext } from "./blow";
import { parries } from "./parry";
import type { Projectiles } from "./projectiles";
import { Recorder } from "./record";
import { Seizures } from "./seize";
import { Finales } from "./finales";
import { passedShove } from "../combat/corner";
import { backToFront } from "../fx/slots";
import { throwFoe, Throws } from "./throw";
import type { DebugFrame } from "../ui/debug";

/** Where things may go this frame: bodies within the world, bolts within the screen — whose edge a shove meets. */
/** Where a round puts the two, in world px: 64 either side of the screen's middle under the camera at 128 ($01:8B2E). */
const ROUND_START = { left: 0xc0, right: 0x140 };

export interface Field {
  bodies: Bounds;
  shots: Bounds;
  /** The screen's top-left in the world: an object strayed too far from its middle is gone. */
  view: { x: number; y: number };
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
  /** Whether a sending blow has somewhere to send him — see `BlowContext.opens`. */
  opens?: BlowContext["opens"];
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
/** How far over the floor he falls from at the end of a sideways journey: recorded, y 196. */
const SIDE_DROP = 4;
/**
 * Where each comes in from on a floor's arena, in world y, and how fast
 * ($01:8D46, $01:8D80 with `$0552` clear): up, from below it at −15, the
 * defender knocked down (`1b`) and the attacker jumping (`05`, ours his fall);
 * down, from above it, the attacker thrown up first at −8.
 */
const ARRIVAL = {
  up: { defender: { y: 0x140, vy: -15 }, attacker: { y: 0x1a0, vy: -15 } },
  down: { defender: { y: -8, vy: 0 }, attacker: { y: -0x20, vy: -8 } },
};

/** A sending blow that landed, and on whom. */
export interface Sent {
  way: Way;
  attacker: Entity;
  defender: Entity;
}

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
  private readonly seizures = new Seizures();
  private readonly finales = new Finales();
  /** A blow that sends the defender to another arena landed: for `takeSent`. */
  private sent: Sent | null = null;
  /** What a scene asked of the screen this frame, for `takeScreen`. */
  private readonly screenCues: ScreenCue[] = [];
  /** The camera as the last frame left it: where a scene's bursts may fall. */
  private lastCamera: Camera | null = null;
  private readonly projectiles: Projectiles;
  /** Where each body stood before this frame moved it — what the camera reads its push from. */
  private from: [number, number] = [0, 0];
  /**
   * The body drawn over the other: the one who last armed a blow — the
   * original keeps one bit for the pair (`$30B0` bit 0, `$00:812E`) and
   * arming a blow sets it to the mover (`$0D:D8A2`). Player one at first.
   */
  private inFront: Entity;

  constructor({ world, p1, p2, scale, audio, effects, projectiles, opens }: FightersSetup) {
    this.impact = { effects, opens };
    this.projectiles = projectiles;
    // a side each, so that one's sound never cuts the other's (src/audio/playback.ts)
    this.player = new Entity(p1, scale, audio.side("p1", p1.sounds));
    this.opponent = p2 ? new Entity(p2, scale, audio.side("p2", p2.sounds)) : null;
    // the same fighter on both sides: player two takes the next palette ($01:82F2)
    if (this.opponent && p2!.name === p1.name) this.opponent.alt = true;
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

  /** Both shadows in their own colours, or back in the arena's: between two arenas, by the owner's word. */
  plainShadows(on: boolean): void {
    for (const f of this.both()) f.plainShadow = on;
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
    const alone = stage.xAt(0.5);
    this.player.x = at.p1 !== undefined ? stage.xAt(at.p1) : this.opponent ? ROUND_START.left : alone;
    if (this.opponent) {
      this.opponent.groundY = stage.groundY;
      this.opponent.x = at.p2 !== undefined ? stage.xAt(at.p2) : ROUND_START.right;
      // facing each other from the start: a state that does not turn (an
      // intro) would otherwise begin with player two's back to player one
      this.player.turnToward(this.opponent.x);
      this.opponent.turnToward(this.player.x);
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
    // the screen's middle, as the original's $0571 + $80
    if (this.lastCamera) for (const fighter of [this.player, this.opponent]) fighter?.centreOn(this.lastCamera.x + VIEW.width / 2);
    if (this.opponent) {
      const around = {
        effect: (name: string, x: number, y: number) => this.impact.effects.spawn(name, x, y),
        flash: (frames: number) => (this.flash = Math.max(this.flash, frames)),
      };
      this.throws.update(this.player, this.opponent, around);
      this.throws.update(this.opponent, this.player, around);
      // one body's state lets the other's held script go on ($0F:A545, ADR 0057)
      if (this.player.freesNow) this.opponent.free();
      if (this.opponent.freesNow) this.player.free();
      const world = {
        dust: (x: number, y: number) => this.impact.effects.spawn("dust", x, y),
        effect: (name: string, x: number, y: number) => this.impact.effects.spawn(name, x, y),
        drop: (fx: Entity) => this.impact.effects.drop(fx),
        flash: (frames: number) => (this.flash = Math.max(this.flash, frames)),
        // one short of the camera's: logs/run-volleyball-hit.txt, walls at 268 and 496
        left: () => (this.lastCamera?.x ?? 0) - 1,
        // the screen's corner plus a random byte each way, as $0F:F284 does — some fall below it
        anywhere: (name: string) => {
          if (this.lastCamera)
            this.impact.effects.spawn(name, this.lastCamera.x + Math.random() * 256, this.lastCamera.y + Math.random() * 256);
        },
        screen: (c: ScreenCue) => this.screenCues.push(c),
        shake: (s: ShakeDef) => (this.shake = s),
      };
      this.seizures.update(this.player, this.opponent, world);
      this.seizures.update(this.opponent, this.player, world);
      this.finales.update(this.player, this.opponent, world);
      this.finales.update(this.opponent, this.player, world);
      throwFoe(this.player, this.opponent, world.effect);
      throwFoe(this.opponent, this.player, world.effect);
      this.passShoves(field.shots);
    }

    for (const hit of this.projectiles.update(this.frozen, field.view, this.impact)) {
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
      for (const s of backToFront(fighter.takeStepSpawns())) this.impact.effects.spawn(s.name, s.x, s.y, undefined, s.facing, { entity: fighter, at: s.at });
    }
  }

  /**
   * Let the camera follow this frame's moves, and stand where it says: it may
   * stop a body at the screen's edge, or put one back that drifted past it.
   */
  keepInView(camera: Camera): void {
    this.lastCamera = camera;
    const { player, opponent } = this;
    const placed = camera.follow(
      { from: this.from[0], to: player.x },
      opponent ? { from: this.from[1], to: opponent.x } : null,
    );
    player.x = placed.a;
    if (opponent && placed.b !== null) opponent.x = placed.b;
    if (!this.both().some((f) => f.holdsCamera)) camera.lift(this.both().map((f) => f.y));
  }

  /**
   * A shove into the screen's edge passes to the other, reversed (`corner.ts`):
   * player one's if he has one, else player two's, as the original asks.
   */
  private passShoves(screen: Bounds): void {
    const { player, opponent } = this;
    if (!opponent) return;
    const [a, b] = player.shoved.shove !== 0 ? [player, opponent] : [opponent, player];
    const passed = passedShove(a.shoved, b, screen);
    if (passed === null) return;
    b.setShove(passed);
    a.setShove(0);
  }

  /** A fighter who entered a state that `fires` puts a bolt in the world. */
  private fire(owner: Entity, foe: Entity): void {
    const shot = owner.takeFired();
    if (!shot) return;
    this.projectiles.spawn(shot, owner, foe);
    for (const place of shot.also) this.projectiles.spawn({ ...shot, ...place, with: [] }, owner, foe);
  }

  /**
   * Bodies cannot overlap. Two with push boxes meet wherever those touch, in
   * the air too ($2A:80ED); otherwise only while both are `solid`, so a
   * hand-built jump carries over the opponent. A hit pause suspends this too,
   * or "frozen" would mean everything except the push; so does either being
   * `pushless` ($2A:80F5).
   */
  pushApart(bounds: Bounds): void {
    const { player, opponent } = this;
    if (!opponent) return;
    if (player.frozen || opponent.frozen) return;
    if (player.pushless || opponent.pushless) {
      player.setPressed(false);
      opponent.setPressed(false);
      return;
    }
    const [a, b] = [player.pushBodies, opponent.pushBodies];
    if (a && b) {
      const overlap = bodyOverlap(a, b, player.x <= opponent.x);
      // a blow still on him keeps them pressed after the bodies part, but does not press them:
      // Tornado Hip slows from close, where the bodies met first, and not from afar (recorded; $2A:8188, bit 6)
      const onHim = (from: Entity, to: Entity) => contact({ boxes: from.boxes("hit"), at: from.placement }, { boxes: to.boxes("hurt"), at: to.placement }) !== null;
      const pressed = overlap > 0 || (player.isPressed && (onHim(player, opponent) || onHim(opponent, player)));
      player.setPressed(pressed);
      opponent.setPressed(pressed);
      const { ax, bx } = pushApart(player.x, opponent.x, overlap, bounds);
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
      if (parries(d, a)) {
        const where = contact({ boxes: d.boxes("hit"), at: d.placement }, { boxes: a.boxes("hit"), at: a.placement })!;
        d.forceState(d.parry!.to);
        this.impact.effects.spawn(a.attackGuardFx, where.x + where.w / 2, where.y + where.h / 2);
        a.sound("hit_09");
        continue;
      }
      const result = landBlow(a, d, this.impact);
      if (result) this.flash = Math.max(this.flash, result.flash);
      if (result?.sends) this.sent = { way: result.sends, attacker: a, defender: d };
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

  /** What the fighters' states and scenes asked of the screen this frame, in order — taken once. */
  takeScreen(): ScreenCue[] {
    return [...this.both().flatMap((f) => f.takeScreen()), ...this.screenCues.splice(0)];
  }

  /** The sending blow landed this frame, or null — taken once. */
  takeSent(): Sent | null {
    const sent = this.sent;
    this.sent = null;
    return sent;
  }

  /**
   * The two put down on another arena, facing each other. Sideways the attacker
   * stands where his run in ends and the defender falls from where he hung; up,
   * both come in from below the floor, thrown up; down, both drop in from above
   * (`ARRIVAL`).
   */
  arrive({ attacker, defender, way }: Sent, at: { attacker: number; defender: number }): void {
    attacker.x = at.attacker;
    defender.x = at.defender;
    for (const fighter of [attacker, defender]) fighter.hide(false);
    if (way === "side") {
      defender.forceState("down_fall");
      defender.still();
      attacker.forceState("idle");
      attacker.still();
      defender.y = defender.groundY - SIDE_DROP;
    } else {
      const { defender: d, attacker: a } = ARRIVAL[way];
      // knocked down as he rises, with no cry: he gave it when the blow landed
      defender.forceState(way === "up" ? "rise_in" : "down_fall");
      attacker.forceState("jump_fall");
      defender.still(d.vy);
      attacker.still(a.vy);
      defender.y = d.y;
      attacker.y = a.y;
    }
    attacker.turnToward(defender.x);
    defender.turnToward(attacker.x);
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

  /** Nothing the two have thrown is still in the air. */
  get quiet(): boolean {
    return this.projectiles.empty;
  }

  /** Both bodies, player one first — what a round watches. */
  get bodies(): Entity[] {
    return this.both();
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
    // added light over all of it, effects put out this frame included —
    // Saiyan Meteor's ball over the hair beside it (owner, 2026-11-01)
    if (world) for (const fighter of this.both()) world.addChild(fighter.addedLight);
  }

  /** Take both bodies off the stage; a scene that leaves them leaves ghosts. */
  destroy(): void {
    for (const fighter of this.both()) {
      fighter.addedLight.destroy();
      fighter.view.destroy({ children: true });
    }
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
