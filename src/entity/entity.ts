import { Container, Graphics, Sprite } from "pixi.js";
import { aimSpeed, aimsOn } from "./aim";
import { alsoFired } from "./alsoFired";
import { staysOnStep } from "./heldStep";
import { faceOpponent } from "./turning";
import { applyAir, fall, ON_GROUND, type AirSetting } from "./air";
import { hitAgain } from "./hitAgain";
import type { ShakeDef } from "../camera/shake";
import { OWN_COLOURS } from "../arena/arenaFile";
import type { Way } from "../arena/ways";
import { healFrame } from "../combat/heal";
import type { Anim, Box, EntityDef, Step } from "./entityDef";
import { boxToWorld, type Placement, type WorldRect } from "../combat/hit";
import type { SoundPlayer } from "../audio/playback";
import { activeBall, BALL_COLOUR, nextRadius } from "../combat/ball";
import { HitLight, PILLAR_HEIGHT } from "../combat/hitLight";
import { bandHeights, type BandDef } from "../combat/band";
import { reboundSpeed } from "../combat/rebound";
import { burnVariant, paletteVariant, shimmerVariant, shockVariant, markedVariant, runVariant } from "../combat/palettes";
import { Combo } from "../combat/combo";
import { withHitTypes } from "../combat/hitTypes";
import { Swing } from "../combat/swing";
import { shoveAfter } from "../combat/knockback";
import { pressedSpeed } from "../combat/push";
import { shadowFrame, shadowSize } from "./shadow";
import { trailAt } from "./trail";
import { pillarAt, type PillarDef } from "../combat/pillar";
import { outOfReach } from "../combat/hitGate";
import { moveStep } from "../fx/follow";
import { hoverOffset, quiverOffset, soundsOn } from "./hover";
import type { ScreenCue } from "../screen";
import type { FinaleDef } from "../match/finale";
import { moveOf, type Shoved } from "../combat/corner";
import { approachSpeed, rushing, rushStep } from "./approach";
import { afterDefence } from "../combat/scaling";
import { InputBuffer } from "../input/buffer";
import { commandsMet, padFrame, PadHistory, tablesFor } from "../input/command";
import { pressedNames, stickLine } from "../input/padLine";
import { InputHistory, MOTION_NAMES } from "../input/history";
import { Motions, type MotionName } from "../input/motion";
import {
  dipAt, groundSpeed, stoppedByContact,
  guardStateFor,
  hitFxOf,
  reactionFor,
  StateMachine,
  type CloseButton,
  type SeizeDef,
  type GrabDef,
  type RoundStates,
  type StateDef,
} from "./states";

/**
 * One live entity in the world: sprite + animation playback + state machine +
 * position/facing. Several instances share one `EntityDef` (two Gokus are two
 * entities, one definition). Everything that runs per game frame for a fighter
 * lives here.
 */

/** Movement input in **world** terms; the entity maps it to forward/back. */
export interface WorldInput {
  left: boolean;
  right: boolean;
  up: boolean;
  /** Down arrow — held, like up. */
  down: boolean;
  /**
   * The buttons — Burst Limit's attack, guard, smash and ki blast (`blast`,
   * because `ki` is the meter), then the original's X (`strike`) and L/R
   * (`dash`). Each went down **this frame** (edge, not held).
   */
  attack: boolean;
  guard: boolean;
  smash: boolean;
  blast: boolean;
  strike: boolean;
  dash: boolean;
  /**
   * Whether each button is **still down**, which the edges above cannot say.
   * A stance you hold — charging ki on A+Z — needs it: two edges would have to
   * land on one frame, and whichever arrived alone would spend itself on a blow.
   */
holding: { attack: boolean; guard: boolean; smash: boolean; blast: boolean; strike: boolean; dash: boolean };
}

/** What a fighter needs to know of the other one: where he stands, and whether he could be thrown. */
export interface Opponent {
  x: number;
  throwable: boolean;
  airborne: boolean;
  groundVx: number;
}

export const NO_INPUT: WorldInput = {
  left: false,
  right: false,
  up: false,
  down: false,
  attack: false,
  guard: false,
  smash: false,
  blast: false,
  strike: false,
  dash: false,
  holding: { attack: false, guard: false, smash: false, blast: false, strike: false, dash: false },
};

/**
 * What a landing blow asks of the body taking it.
 *
 * One object rather than three arguments because they are one thing — the blow —
 * and every rule added since has wanted to travel with the others: what reaction
 * it forces, whether it may lift a body that is already helpless, and how long
 * it holds them.
 */
export interface Blow {
  /** The reaction the attacker's state names, if any; the defender's default otherwise. */
  reaction?: string;
  /** Whether it may lift or floor a body that is already helpless. */
  relaunch: boolean;
  /** Game frames the defender is held helpless for. */
  hitstun: number;
  /** Whether it sets the defender burning (`burns`). */
  burns?: boolean;
  /** The attacker's `launches`: a reaction's launch replaced, by its name. */
  launches?: Record<string, [number | null, number | null]>;
}

/** One fighter's innards, for the debug readout only — see `Entity.debug`. */
export interface EntityDebug {
  state: string;
  x: number;
  y: number;
  rank: number;
  step: number;
  steps: number;
  framesLeft: number;
  hitConfirmed: boolean;
  freeze: number;
  /** Game frames of helplessness left — the defender's half of a combo. */
  stun: number;
  hp: number;
  vx: number;
  buffer: [button: string, framesLeft: number][];
  /** The ki meter, in points. */
  ki: number;
  /** The last few inputs as the engine saw them — see input/history.ts. */
  inputs: string;
  /** Motions complete right now, so a recording can say when one landed. */
  motions: MotionName[];
  /** The cartridge's commands met this frame, by move. */
  commands: string[];
  /** On a frame a button goes down: the stick's last frames and the buttons (`input/padLine.ts`). */
  padPress: string | null;
  /** The next part a `queued` transition has kept, or null. */
  queued: string | null;
  combo: { hits: number; damage: number; lifts: number };
}

/** The button, not the key: nothing outside `input/keyboard.ts` knows which key is which. */
const ATTACK_LABELS = [
  ["attack", "A"],
  ["guard", "G"],
  ["smash", "S"],
  ["blast", "B"],
  ["strike", "K"],
  ["dash", "D"],
] as const satisfies readonly (readonly [keyof WorldInput, string])[];

/** Frames between copies of a retriggered sound when the state names no interval. */
const HUM_EVERY = 8;
/** Half the width of a finale's band, world px: the screen's 256 and more, whoever stands where. */
const BAND_REACH = 512;

const BOX_COLORS: Record<string, number> = {
  hit: 0xff3b3b,
  hurt: 0x4be04b,
  push: 0x4b9bff,
};

export class Entity {
  /** World x of the anchor, in screen px. */
  x = 0;
  /** The ground line this entity stands on; set by the world. */
  groundY = 0;
  /** Current y of the anchor — equal to `groundY` unless airborne. */
  y = 0;
  /** +1 = facing right, −1 = facing left. */
  facing: 1 | -1 = 1;
  /**
   * Whether this body's blows arrive from the direction it **travels** rather
   * than from where it stands. Set on a projectile and on nothing else.
   *
   * A fist is attached to a body, so the side a punch came from is the side its
   * owner is on — which is exactly what turns a defender round on a crossup. A
   * bolt is born in front of its thrower and has usually flown past the
   * victim's anchor by the time it connects, so its position is the wrong
   * answer and its heading is the right one.
   */
  travels = false;

  /** Vertical velocity in sprite px per frame, negative upward. */
  private vy = 0;
  /** Horizontal velocity while airborne, facing-relative (momentum). */
  private vx = 0;
  /** Off the ground and at what gravity, as the state's `air` timeline left it (`air.ts`). */
  private air: AirSetting = ON_GROUND;
  /** What is left of the shove the current state entered with — see `shove`. */
  private shove = 0;
  /** Frames the current state has moved for — what `velAt` is keyed by. */
  private stateFrames = 0;
  /** Latched on touching the ground; cleared when the state changes. */
  private landed = false;
  /** A blow armed on entering a state, for `takeArmed`. */
  private armed = false;
  /** A state entered that sends this entity behind the opponent, for `takeBehind`. */
  private behind = false;
  /** The speed an `approach` set this state, sprite px a frame forward; null before it. */
  private approaching: number | null = null;
  /** A `rush` has set this entity down by the opponent this state. */
  private arrived = false;
  /** The opponent's state let this one's held script go on (`freed`), this state. */
  private freed = false;
  /** What this entity's `finale` has done, this state: its ball landed, it ended. */
  private finaleSaid = { ballLanded: false, finaleDone: false };
  /** Its state's clock and animation stand still — while Saiyan Meteor's ball flies. */
  private clockHeld = false;
  /** A ball it has thrown, drawn where it is in the world rather than at its hands (`match/finale.ts`). */
  private thrownBall: { x: number; y: number; radius: number } | null = null;
  /** The finale's band along the floor at world `y`, kind 4 of `size`; null for none. */
  private floorBand: { y: number; size: number } | null = null;
  private bars: { x: number; y: number; w: number; h: number }[] = [];
  private pillarRun: { def: PillarDef; t: number } | null = null;
  /** What its state asked of the screen this frame (`StateDef.screen`), until the fighters take it. */
  private screenCues: ScreenCue[] = [];
  /** Effects the animation's steps put out, until the fighters take them. */
  private readonly stepSpawns: { name: string; x: number; y: number; facing: 1 | -1; at: [number, number] }[] = [];
  /**
   * The steps that have put out their spawns since the animation started —
   * once per start, not per loop: a b0 fires on a counter the move's start
   * resets and a script's loop does not (field 0x6e). Idle's lightning.
   */
  private readonly spawnedSteps = new Set<number>();
  /** Counts animation starts, so a follower can tell this one from the next (`fx/follow.ts`). */
  private plays = 0;
  /** The speed the last fall hit the floor with — what a `rebound` goes back up at a share of. */
  private landedAt = 0;
  /** Blows taken in a row in reactions with `ifHitAgain` (the original's field `0x7b`). */
  private hitsAgain = 0;
  /**
   * Presses wait here for a few frames. Ticked below the freeze check, so a hit
   * pause cannot age a press out of existence — losing the input a player makes
   * *because* they saw the hit land is the one thing a buffer has to prevent.
   */
  private readonly buffer = new InputBuffer();
  /** What the stick has been doing, for the triggers a single frame cannot answer. */
  private readonly motions = new Motions();
  /** The pad as the cartridge's command reader sees it, a frame an entry. */
  private readonly pad = new PadHistory();
  /** The commands met this frame: move → our button. */
  private met: ReadonlyMap<string, string> = new Map();
  /** Frames since it left the ground, 0 on it: which command tables it reads (`tablesFor`). */
  private airFrames = 0;
  /** Scaffolding: the same inputs again, kept only so a person can read them. */
  private readonly history = new InputHistory();
  /** The combo being done **to** this fighter — see src/combat/combo.ts. */
  readonly combo: Combo;

  readonly view = new Container();
  private readonly sprite = new Sprite();
  /** The floor's shadow, behind him and staying on the floor as he jumps. */
  private readonly shadow = new Sprite();
  private readonly boxG = new Graphics();
  /** The charging ball, added light over the fighter — see combat/ball.ts. */
  private readonly ballG = new Graphics();
  /** The beam's band: added light too, but drawn under the objects at either end of it (owner, 2026-11-01). */
  private readonly bandG = new Graphics();
  private sweep: { apex: [number, number]; x: number; half: number; floor: number } | null = null;
  private ballRadius = 0;
  /** `setPressed`. */
  private pressed = false;
  /** Where the ball was last held, so it shrinks in place once let go. */
  private ballAt: [number, number] = [0, 0];
  /** Where the head of the beam this entity threw has got to, world px — told by the bolts. */
  private beamHead: number | null = null;
  /** Frames the current state's band has been out — it thickens with them. */
  private bandFrames = 0;
  /** A band whose head is gone, thinning where it stood whatever state comes next. */
  private fading: { band: BandDef; frames: number; gone: number; head: number } | null = null;

  private readonly sm: StateMachine | null;
  /** Set by `preview()`: play one animation and ignore the state machine. */
  private previewing = false;

  private anim: Anim | null = null;
  private animName = "";
  private stepIndex = 0;
  private remaining = 0;
  /** Latched once a non-looping animation reaches its end (drives `animEnd`). */
  private animEnded = false;
  /** The steps of this state's shove already taken: `shoveBeforePause`. */
  private shovedAhead = 0;
  /**
   * Whether this entity's current attack already landed. An attack's hit box is
   * active for several frames, but it may only connect once per entry into the
   * state — cleared whenever the state changes.
   */
  /** The attack being thrown: whether it may connect, and whether it has. */
  private readonly swing = new Swing();

  private readonly gravity: number;
  private readonly landCue: number;
  private readonly closeRange: Partial<Record<CloseButton, number>>;
  private readonly grabRange: number;
  /** Held by a thrower (`match/throw.ts`): an animation and nothing else, where he is put. */
  private held = false;
  private readonly hitLight = new HitLight();
  /** Entering a state without its sound: a throw that makes none (`GrabDef.launch.quiet`). */
  private quietEntry = false;
  private pauseDue = 0;
  private readonly pushWidth: number;
  /** Whether its animations carry `push` boxes (`pushBodies`). */
  private readonly authorsPush: boolean;
  private readonly hitstop: number;
  private readonly maxHealth: number;
  private readonly defence: number;
  private readonly maxKi: number;
  private readonly baseHitstun: number;
  /** What is left of this fighter, in health points. */
  private hp = 0;
  /** The ki meter. A separate pool from health — see combat.md. */
  private ki = 0;
  /** The charging dial the HUD shows, and the frames charged, which pace it ($0F:A020). */
  private dialAt = 0;
  private healClock = 0;
  /** Set on entering a state that `fires`; taken by whoever owns projectiles. */
  private fired: StateDef["fires"] | null = null;
  /** The `groundFx` of the state just entered, or its `trail`'s beat, until the fighters take it. */
  private groundFx: string | null = null;
  /** The `shake` of the state just entered, until the fighters take it. */
  private shake: ShakeDef | null = null;
  /** 0..1, filled by a state that charges and spent by what it throws. */
  private charge = 0;
  /**
   * How much bigger than authored this entity is drawn — a charged bolt comes
   * out large. It multiplies the drawing and the boxes, which are placed
   * through the same number, and **nothing else**: `scale` remains the world's
   * px per sprite px, so a big bolt is not also a fast one.
   */
  size = 1;
  private freeScene: SeizeDef | null = null;
  /** The speeds a `savesFlight` kept. */
  private savedFlight: [number, number] = [0, 0];
  /** How many things this entity has thrown that are still in the world. */
  private thrown = 0;
  /**
   * A sound retriggered while a state lasts — the charge hum. Id plus frames
   * until the next copy; a fresh `play` each time, so the copies overlap, which
   * is what makes a repeat sound like a sustain rather than a stutter.
   */
  private hum = { id: "", left: 0 };
  /** Game frames left of a hit pause; while it lasts nothing about the entity moves. */
  private freezeFrames = 0;
  private heldStill = false;
  private heldToScript = false;
  /** Burning, and how far into the fire palettes — counted outside hitstop, as the original's is. */
  private burning = false;
  private heldFlipped = false;
  /** The state he is in flips him as he leaves it (`flipsOnLeaving`). */
  private flipsOnLeaving = false;
  private cameraKept = false;
  /** The drawing a scene holds him in, over his animation's (`showDrawing`). */
  private heldDrawing: string | null = null;
  /** Frames into a held body's flashing (`grab.shocks`); null when it is not. */
  private shocked: number | null = null;
  private burnFrame = 0;
  /** Frames into an object's life, for its palette run (`shimmer`). */
  private shimmerFrame = 0;
  private shownVariant: string | null = null;
  /** The palette the arena's light gives it, drawn whenever it is not burning; null is its own sheet's. */
  private lighting: string | null = null;
  /** Drawn in his second colours ($01:82F2) — player two facing himself, or as asked. */
  private altColours = false;
  /** A colour set of ours over them (`palettes.json`), or none. */
  private set: string | null = null;
  /**
   * Game frames left of being held helpless by the last blow. Ticked below the
   * freeze check, like the buffer: a hit pause freezes both fighters equally, so
   * letting it eat hitstun would quietly change frame advantage — the one thing
   * a symmetric pause must not do.
   */
  private stun = 0;

  constructor(
    private readonly def: EntityDef,
    private readonly scale: number,
    private readonly audio: SoundPlayer | null = null,
  ) {
    this.gravity = def.attributes.gravity;
    this.landCue = def.attributes.landCue;
    this.closeRange = def.attributes.closeRange;
    this.grabRange = def.attributes.grabRange;
    this.pushWidth = def.attributes.pushWidth;
    this.authorsPush = Object.values(def.animations).some((a) => a.steps.some((st) => st.boxes?.some((b) => b.type === "push")));
    this.hitstop = def.attributes.hitstop;
    this.maxHealth = def.attributes.health;
    this.defence = def.attributes.defence;
    this.combo = new Combo(def.attributes.comboLimits);
    this.maxKi = def.attributes.ki;
    this.baseHitstun = def.attributes.hitstun;
    this.hp = this.maxHealth;
    this.sprite.scale.set(scale);
    if (def.attributes.adds) this.sprite.blendMode = "add";
    this.ballG.blendMode = "add";
    this.bandG.blendMode = "add";
    this.view.addChild(this.shadow, this.sprite, this.bandG, this.ballG, this.boxG);
    this.sm = def.states ? new StateMachine(withHitTypes(def.states), def.animations) : null;
    if (this.sm) this.setAnim(this.sm.def.anim);
    else this.setAnim(Object.keys(def.animations)[0] ?? "");
  }

  /** The state by name — "held" while a throw holds him, which his own machine knows nothing of. */
  get state(): string {
    if (this.held) return "held";
    return this.sm?.current ?? this.animName;
  }

  /** Off the ground — a jump arcs over the opponent instead of being blocked. */
  get airborne(): boolean {
    return !!this.sm?.def.airborne || this.air.aloft;
  }

  /** Which buttons would pick their close version with the opponent at `opponentX`. */
  private closeTo(opponentX: number | null): Partial<Record<CloseButton, boolean>> {
    if (opponentX === null) return {};
    const gap = Math.abs(opponentX - this.x) / this.scale;
    const close: Partial<Record<CloseButton, boolean>> = {};
    for (const [button, range] of Object.entries(this.closeRange) as [CloseButton, number][]) {
      close[button] = gap < range;
    }
    return close;
  }

  /** Falling, and within `landCue` of the ground: the last stretch before touchdown. */
  get nearGround(): boolean {
    return this.airborne && this.vy > 0 && this.groundY - this.y <= this.landCue * this.scale;
  }

  /**
   * Whether this entity takes part in push collision.
   *
   * Standing on the ground, always. In the air only on the way down, once
   * `nearGround` — the same threshold that cues the landing pose. High up, two
   * bodies overlap freely, which is what makes jumping over someone possible;
   * near the floor they behave like the grounded bodies they are about to be.
   * Without that second half a fighter drops *through* the opponent and lands
   * on the far side, and the push that returns on touchdown arrives as a snap.
   */
  get solid(): boolean {
    return !this.held && (!this.airborne || this.nearGround);
  }

  /** Half the body's width in world px, for push collision. */
  get pushHalf(): number {
    return (this.pushWidth / 2) * this.scale;
  }

  /**
   * The body and head this entity pushes with, in the world, from the current
   * step's `push` boxes, none while held — or null for an entity whose
   * animations author none, which pushes with `pushHalf` while `solid` instead.
   */
  get pushBodies(): WorldRect[] | null {
    if (!this.authorsPush) return null;
    if (this.held) return [];
    return this.boxes("push").map((b) => boxToWorld(b, this.placement));
  }

  /**
   * Everything the debug readout shows, in one place.
   *
   * Deliberately one getter rather than making six private fields public: this
   * exists for `src/ui/debug.ts` and nothing else, and it can be deleted in a
   * single edit when it stops earning its keep. Nothing in the game may read
   * it — if a rule needs one of these numbers, that number gets its own name.
   */
  get debug(): EntityDebug {
    return {
      state: this.state,
      x: this.x,
      y: this.y,
      rank: this.sm?.def.rank ?? 0,
      step: this.stepIndex,
      steps: this.anim?.steps.length ?? 0,
      framesLeft: this.remaining,
      hitConfirmed: this.swing.spent,
      freeze: this.freezeFrames,
      stun: this.stun,
      hp: this.hp,
      vx: this.vx,
      buffer: this.buffer.live(),
      ki: this.ki,
      inputs: this.history.line,
      motions: MOTION_NAMES.filter((m) => this.motions.has(m)),
      commands: [...this.met.keys()],
      padPress: this.padPress(),
      queued: this.sm?.queuedTo ?? null,
      combo: { hits: this.combo.hits, damage: this.combo.damage, lifts: this.combo.lifts },
    };
  }

  /** Where this entity is, for placing authored boxes in the world. */
  get placement(): Placement {
    return { x: this.x, y: this.y, facing: this.facing, scale: this.scale * this.size };
  }

  /** Boxes of one type active on the current animation step. */
  boxes(type: Box["type"]): Box[] {
    return (this.currentStep()?.boxes ?? []).filter((b) => b.type === type);
  }

  /** True while this entity's current attack can still land. */
  get canHit(): boolean {
    return this.swing.canHit;
  }

  /**
   * Whether blows pass straight through this entity right now — the floor, and
   * getting up off it. Rank already stops a blow interrupting a knockdown; this
   * is what stops it costing health while the victim can neither block nor move.
   */
  /** What the corner rule reads of this body (`combat/corner.ts`). */
  get shoved(): Shoved {
    return { x: this.x, facing: this.facing, shove: this.shove, move: moveOf(this.animation), health: this.hp };
  }

  /**
   * A blow's first step of shove, taken before its pause: the original's reel runs
   * one frame first (recordings: 320 → 323 under the pause). It counts toward `shoveFor`.
   */
  shoveBeforePause(): void {
    if (this.shove === 0) return;
    this.x += this.facing * this.shove * this.scale;
    this.shovedAhead = 1;
  }

  /** Its shove handed to the other at the screen's edge, or one taken from him ($0D:C8F0). */
  setShove(shove: number): void {
    this.shove = shove;
  }

  /** A finale of the state's own (`finales.ts`). */
  get finale(): FinaleDef | undefined {
    return this.sm?.def.finale;
  }

  /** The `throwsFoe` of the state it is in. */
  get throwsFoe(): StateDef["throwsFoe"] {
    return this.sm?.def.throwsFoe;
  }

  /** Its finale's news, for `ballLanded` / `finaleDone`, until its next state. */
  finaleSays(what: "ballLanded" | "finaleDone"): void {
    this.finaleSaid[what] = true;
  }

  /** On the frame its state's `frees` names: the opponent's held script goes on. */
  get freesNow(): boolean {
    const frees = this.sm?.def.frees;
    return frees !== undefined && this.stateFrames === frees;
  }

  /** The opponent let this one's held script go on: `freed`, until its next state. */
  free(): void {
    this.freed = true;
  }

  /** Bodies pass through each other while this one is in it (`pushless`). */
  get pushless(): boolean {
    return !!this.sm?.def.pushless;
  }

  get invulnerable(): boolean {
    return this.held || !!this.sm?.def.invulnerable || outOfReach(moveOf(this.animation), Number(this.animation.split("_")[1] ?? 1), (this.groundY - this.y) / this.scale);
  }

  /**
   * Whether a throw may take hold of this entity: standing on the ground,
   * in no reaction and no throw — the original's grab conditions ($0D:F650),
   * as far as this engine has the same things.
   */
  get throwable(): boolean {
    return !this.held && !this.airborne && !this.invulnerable && !this.sm?.def.rank && !this.sm?.def.grab;
  }

  /** The throw the state just entered makes, if it is one. */
  get grab(): GrabDef | undefined {
    return this.sm?.def.grab;
  }

  /** Its speed this frame, world sprite px, shove apart: what `pressedSpeed` averages. */
  get groundVx(): number {
    if (!this.sm) return 0;
    // knocked into the air, its speed is the shove's: the original's vx stays 0 (`1b`, recorded)
    if (this.sm.def.launch) return 0;
    if (this.airborne) return this.facing * this.vx;
    if (stoppedByContact(this.sm.def, this.swing.spent, this.stateFrames)) return 0;
    return this.facing * (this.approaching ?? groundSpeed(this.sm.def, this.stateFrames));
  }

  /** `setPressed`'s. */
  get isPressed(): boolean {
    return this.pressed;
  }

  /** Whether its body touched the other's last frame (field `0x97` bit 7, `$2A:8AFB`). */
  setPressed(pressed: boolean): void {
    this.pressed = pressed;
  }

  /** Its ball's radius now, in sprite px: 0 with none. */
  get ballNow(): number {
    return this.ballRadius;
  }

  /** Draw a ball it has thrown at (`x`, `y`) in the world, sprite-px `radius`; null for none. */
  showThrownBall(ball: { x: number; y: number; radius: number } | null): void {
    this.thrownBall = ball;
  }

  /** Draw a finale's band along the floor at world `y` ($0F:F1BC); null for none. */
  /** Draw a wedge of light from `apex` to the floor at `x`, `half` sprite px either side; null for none (`FinaleDef.sweep`). */
  showSweep(sweep: { apex: [number, number]; x: number; half: number; floor: number } | null): void {
    this.sweep = sweep;
  }

  /** Draw a scene's bars of light, world px (`match/sceneLight.ts`); none for none. */
  /** The state's light on the floor (`combat/pillar.ts`), kept on him, gone when it says. */
  private drawPillar(): void {
    if (!this.pillarRun) return;
    const shape = pillarAt(this.pillarRun.def, this.pillarRun.t);
    if (!shape) {
      this.pillarRun = null;
      return;
    }
    const k = this.scale;
    const x = this.x + this.facing * this.pillarRun.def.ahead * k;
    if (shape.half > 0) this.ballG.rect(x - shape.half * k, this.groundY - shape.height * k, 2 * shape.half * k, shape.height * k).fill(BALL_COLOUR);
  }

  showBars(bars: { x: number; y: number; w: number; h: number }[]): void {
    this.bars = bars;
  }

  showFloorBand(band: { y: number; size: number } | null): void {
    this.floorBand = band;
  }

  /**
   * Its balls — charging, thrown, exploding — as added light in world
   * coordinates, for whoever owns the world to keep over everything else:
   * the original adds it to sprites and stage alike ($2A:A29A), so the hair
   * beside Saiyan Meteor's ball does not cover it. A beam's band stays under
   * the base and head it runs between (owner, 2026-11-01).
   */
  get addedLight(): Graphics {
    return this.ballG;
  }

  /** The frame shown now, by id — the drawing's number for the cartridge's fighters. */
  get frameId(): string | undefined {
    return this.currentStep()?.frame;
  }

  /** Show the step of its animation that shows frame `id`, and stay there — an effect a follower sets (`fx/follow.ts`). */
  showFrame(id: string): void {
    const i = this.anim?.steps.findIndex((s) => s.frame === id) ?? -1;
    if (i < 0 || i === this.stepIndex) return;
    this.stepIndex = i;
    this.applyFrame();
  }

  /** Hold its state's clock and animation still, or let them run (`match/seize.ts`). */
  holdClock(on: boolean): void {
    this.clockHeld = on;
  }

  /**
   * Move its state's clock and animation on to `frame`, the next one shown —
   * as a handler sets its move's frame ($20:8E4B: 454 once the ball lands).
   * What the skipped steps would have played does not play.
   */
  jumpTo(frame: number): void {
    this.stateFrames = frame;
    this.sm?.setFrame(frame);
    const steps = this.anim?.steps ?? [];
    let left = frame;
    let i = 0;
    while (i < steps.length - 1 && left >= steps[i].dur) left -= steps[i++].dur;
    this.stepIndex = i;
    this.remaining = Math.max(1, (steps[i]?.dur ?? 1) - left);
    this.animEnded = false;
    // landing on a step's first frame is that step beginning: Mightiness Bomber's release has its sound on one
    if (left === 0) this.stepBegins();
    else this.applyFrame();
  }


  /** A bolt that stays on whoever put it out (`rides`). */
  get rides(): boolean {
    return !!this.sm?.def.rides;
  }

  /** A bolt gone when whoever put it out leaves its move (`endsWithMove`). */
  get endsWithMove(): true | string[] | undefined {
    return this.sm?.def.endsWithMove;
  }

  /** A bolt whose ground is this far above its thrower's floor, and bursts on it (`burstsAbove`). */
  get burstsAbove(): number | undefined {
    return this.sm?.def.burstsAbove;
  }

  get burstsBelow(): number | undefined {
    return this.sm?.def.burstsBelow;
  }

  get sharesBlow(): boolean {
    return !!this.sm?.def.sharesBlow;
  }

  get keptOnScreen(): boolean {
    return !!this.sm?.def.keptOnScreen;
  }

  /** Whether this body has come down since its state began. */
  get hasLanded(): boolean {
    return this.landed;
  }

  /** The bolts it is rewritten as on reaching its floor. */
  get landsAs(): readonly string[] {
    return this.sm?.def.landsAs ?? [];
  }

  /** What a bolt leaves on its floor, where it is not its blow's. */
  get onFloor(): { burst?: string; sound?: string } {
    return { burst: this.sm?.def.floorBurst, sound: this.sm?.def.floorSound };
  }

  /** A bolt whose ground is its thrower's floor (`fallsToFloor`). */
  get fallsToFloor(): boolean {
    return !!this.sm?.def.fallsToFloor;
  }

  /** A bolt that bursts as its `lasts` runs out (`burstsAtEnd`). */
  get burstsAtEnd(): boolean {
    return !!this.sm?.def.burstsAtEnd;
  }

  /** A bolt a hit pause does not hold (`throughPause`). */
  get throughPause(): boolean {
    return !!this.sm?.def.throughPause;
  }

  /** What this state turns a blow into, if it waits for one (`parry`). */
  get parry() {
    return this.sm?.def.parry;
  }

  /** A bolt that plays on where it hits (`outlivesHit`). */
  get outlivesHit(): boolean {
    return !!this.sm?.def.outlivesHit;
  }

  /** A bolt whose state's `lasts` has run out. */
  get expired(): boolean {
    const lasts = this.sm?.def.lasts;
    return lasts !== undefined && this.stateFrames >= lasts;
  }

  /** The scene the current state plays on the opponent, if it is one. */
  get seize(): SeizeDef | undefined {
    const def = this.sm?.def;
    return def?.sceneOf ? this.def.states?.states[def.sceneOf]?.seize : def?.seize;
  }

  /** Screen px per sprite px. */
  get scaleOf(): number {
    return this.scale;
  }

  /** The y of the floor under it. */
  get floor(): number {
    return this.groundY;
  }

  /** What its own falls add to vy each frame, sprite px. */
  get ownGravity(): number {
    return this.gravity;
  }

  /** Frames since the current state began. */
  get stateFrame(): number {
    return this.stateFrames;
  }

  /** The entity's name: whose `m30_<name>_<move>` a held opponent plays. */
  get name(): string {
    return this.def.name;
  }

  /** The animation playing, by name. */
  get animation(): string {
    return this.animName;
  }

  /** His step in the whole script of the move playing, across its parts (`fx/follow.ts`). */
  get moveStep(): number {
    return moveStep(this.animName, this.stepIndex, (a) => this.def.animations[a]?.steps.length);
  }

  /** Which start of an animation this is — a new one, or the same one again, counts up. */
  get animationPlay(): number {
    return this.plays;
  }

  /**
   * Be held: play `anim` if this entity has it, else keep the pose, and do
   * nothing else until let go — no input, no physics, no blows, no push.
   */
  hold(anim: string): void {
    this.held = true;
    this.previewing = true;
    this.heldStill = false;
    this.heldToScript = false;
    if (this.def.animations[anim]) this.setAnim(anim, true);
  }

  /** Upside down while held, from where he is held: `grab.flipsAt`. */
  flipHeld(on: boolean): void {
    this.heldFlipped = on;
  }

  /** The camera stays until he lands: `grab.launch.stillCamera`. */
  keepCamera(): void {
    this.cameraKept = true;
  }

  /** Whether the camera may not follow vertically for him (field 0x27 bit 0). */
  get holdsCamera(): boolean {
    if (this.cameraKept && !this.held && !this.airborne) this.cameraKept = false;
    return this.cameraKept || !!this.sm?.def.stillCamera;
  }

  /** Held in one drawing named by the mover's table, whatever he was doing ($20:E2E0). */
  showDrawing(drawing: string | undefined): void {
    if (drawing === undefined) return;
    this.heldDrawing = drawing;
    this.applyFrame();
  }

  /** Stay on the drawing he shows while held, as a script's hold does. */
  holdStill(): void {
    this.heldStill = true;
  }

  /**
   * Stop where his script holds. Each fighter's is at its own frame (his `50` at
   * 260 or 262, his `51` at 28, 32 or 34), and past it a script may run into the next.
   */
  holdToScript(): void {
    this.heldToScript = true;
  }

  /**
   * Be let go into a state — his first one when none is named, as a throw
   * cut short leaves him — at a speed set after it is entered: x
   * facing-relative, as a state's `launch`.
   */
  release(state = this.def.states?.initial ?? "", vel?: [number, number], quiet = false): void {
    this.held = false;
    this.heldDrawing = null;
    this.heldFlipped = false;
    this.previewing = false;
    this.quietEntry = quiet;
    this.forceState(state);
    this.quietEntry = false;
    if (vel) [this.vx, this.vy] = vel;
  }

  get isHeld(): boolean {
    return this.held;
  }

  /** The effect put on the floor under this entity this frame, in world px — taken once. */
  takeGroundFx(): { name: string; x: number; y: number } | null {
    const name = this.groundFx;
    this.groundFx = null;
    return name ? { name, x: this.x, y: this.groundY } : null;
  }

  /**
   * Whether a blow was armed since the last ask — a state with a blow
   * entered, which is how our parts re-arm one (ADR 0043). Taken once.
   */
  takeArmed(): boolean {
    const armed = this.armed;
    this.armed = false;
    return armed;
  }

  /** Whether a state just entered sends this entity behind the opponent (`behind`). Taken once. */
  takeBehind(): boolean {
    const behind = this.behind;
    this.behind = false;
    return behind;
  }

  /** The backdrop's shake a state just entered asked for — taken once. */
  takeShake(): ShakeDef | null {
    const shake = this.shake;
    this.shake = null;
    return shake;
  }

  /**
   * The projectile this entity just launched, in world px, or null — and taking
   * it clears it, so one entry into a state fires one bolt however many frames
   * it lasts.
   */
  takeFired(): {
    spawn: string;
    state?: string;
    x: number;
    y: number;
    facing: 1 | -1;
    size: number;
    with: { spawn: string; x: number; y: number; around?: [number, number] }[];
    also: { x: number; y: number; spawn: string; state?: string }[];
    /** Whether the thrower draws its band to this one — the state has a `band`. */
    beam: boolean;
  } | null {
    const fires = this.fired;
    if (!fires) return null;
    this.fired = null;
    this.thrown++;
    const [small, large] = fires.size ?? [1, 1];
    const size = small + (large - small) * this.charge;
    this.charge = 0;
    const placed = (at: [number, number]) => ({ x: this.x + this.facing * at[0] * this.scale, y: this.y + at[1] * this.scale });
    return {
      spawn: fires.spawn,
      state: fires.state,
      ...placed(fires.atBy?.[this.sm?.commandPress ?? ""] ?? fires.at),
      facing: this.facing,
      size,
      with: (fires.with ?? []).map((w) => ({ spawn: w.spawn, ...placed(w.at ?? fires.at), around: w.around })),
      also: alsoFired(fires, placed),
      beam: this.sm?.def.band !== undefined,
    };
  }

  /** Fill health and ki — the debug key, and nothing in a fight does this. */
  refill(): void {
    this.hp = this.maxHealth;
    this.ki = this.maxKi;
  }

  /** Where the head of what this entity threw has flown to; null once it is gone. */
  beamReaches(x: number | null): void {
    const band = this.sm?.def.band;
    if (x === null && band && this.beamHead !== null) {
      this.fading = { band, frames: this.bandFrames, gone: 0, head: this.beamHead };
    }
    if (x !== null) this.fading = null;
    this.beamHead = x;
  }

  /** A shot of his has opened the scene `name`: a state of his, or one that leaves him be (`SeizeDef.free`). */
  opensScene(name: string): void {
    const scene = this.def.states?.states[name]?.seize;
    if (scene?.free) this.freeScene = scene;
    else this.forceState(name);
  }

  /** The free scene a shot opened, once. */
  takeFreeScene(): SeizeDef | null {
    const scene = this.freeScene;
    this.freeScene = null;
    return scene;
  }

  /** One more thing of his in the world, put out by a bolt of his rather than by him (`landsAs`). */
  spawnAdded(): void {
    this.thrown++;
  }

  /** One of the things this entity threw has left the world. */
  spawnEnded(): void {
    this.thrown = Math.max(0, this.thrown - 1);
  }

  /** Record that the current attack connected; it cannot land again. */
  markHit(): void {
    this.swing.hit(this.sm?.def.rehit);
  }

  /** A hitstop to begin on arriving in the next state (`catches`), that state's first frame still played. */
  pauseInNextState(frames: number): void {
    this.pauseDue = frames;
  }

  /** A blow of this state landed at world x, y: what it lights, if it does. */
  lightHit(x: number, y: number): void {
    const kind = this.sm?.def.hitLight;
    if (kind) this.hitLight.land(kind, x, y);
  }

  /** Burning from now until it lands, as a blow's `burns` sets it: a scene's own let-go (`SeizeDef.release`). */
  setBurning(): void {
    if (this.def.attributes.burn.length > 0) this.burning = true;
  }

  /** Flash in the opponent's two palettes, or stop: Shocking Stunner's hold ($20:E552). */
  shock(on: boolean): void {
    this.shocked = on ? (this.shocked ?? -1) + 1 : null;
    this.showVariant();
  }

  /** Record that the blow it just landed was blocked: the `blocked` trigger. */
  markBlocked(): void {
    this.swing.block();
  }

  /** The last 30 frames of the stick, if a button went down this frame — why a command was missed. */
  private padPress(): string | null {
    const pressed = this.pad.at(0).pressed;
    return pressed ? `${stickLine(this.pad, 30)} + ${pressedNames(pressed).join(" + ")}` : null;
  }

  /** The reaction this entity's current attack asks of whoever it hits. */
  get attackReaction(): string | undefined {
    return this.sm?.def.onHit;
  }

  /** Whether this entity's current attack may lift a body that is already helpless. */
  get attackRelaunch(): boolean {
    return !!this.sm?.def.relaunch;
  }

  /** Frames to freeze both fighters for when this entity's attack connects. */
  /** This attack's hit is a hold's to pause, not the blow's (`catches`). */
  get attackCatches(): boolean {
    return !!this.sm?.def.catches;
  }

  get attackHitstop(): number {
    return this.sm?.def.hitstop ?? this.hitstop;
  }

  /** Frames of white screen this entity's current attack asks for when it lands. */
  get attackFlash(): number {
    return this.sm?.def.hitFlash ?? 0;
  }

  /** Which way this entity's current attack sends whoever it lands on, if anywhere. */
  get attackSends(): Way | undefined {
    return this.sm?.def.sends;
  }

  /** The launches this entity's current attack gives the reactions it sends into. */
  get attackLaunches(): Record<string, [number | null, number | null]> | undefined {
    return this.sm?.def.launches;
  }

  /** Whether this entity's current attack sets whoever it hits burning. */
  get attackBurns(): boolean {
    return !!this.sm?.def.burns;
  }

  /** Frames this entity's current attack holds whoever it hits. */
  get attackHitstun(): number {
    return this.sm?.def.hitstun ?? this.baseHitstun;
  }

  /**
   * Is this fighter blocking *right now*? Only in a state marked `guarding` —
   * the stance the guard button holds, and the blockstun it leads to — and
   * never in the air: a fighter who can block a jump-in for free has removed
   * the point of jumping in.
   */
  get guarding(): boolean {
    return (
      !!this.sm?.def.guarding &&
      !this.airborne &&
      guardStateFor(this.sm?.def, this.def.states) !== undefined
    );
  }

  /** Sound this entity's current attack makes on landing, and on being blocked. */
  get attackSounds(): { hit?: string; block?: string } {
    return { hit: this.sm?.def.hitSound, block: this.sm?.def.blockSound };
  }

  /** Health this entity's current attack takes off. */
  get attackDamage(): number {
    return this.sm?.def.damage ?? 0;
  }

  /**
   * Play a sound on this entity's side of the fight — for what happens to
   * it, like the noise of a blow it takes, which the original plays as the
   * defender's ($0D:D1B7, shifted by the defender's side).
   */
  sound(id: string | undefined): void {
    this.audio?.play(id);
  }

  /** What this entity plays through, for what it throws to play through too. */
  get sounds(): SoundPlayer | null {
    return this.audio;
  }

  /** Start from this much health, never past the full amount — a debug setting. */
  setHealth(hp: number): void {
    this.hp = Math.min(this.maxHealth, hp);
  }

  /** Where the charging dial stands — what the HUD's round dial shows. */
  get dial(): number {
    return this.dialAt;
  }

  /** How much health is left, in the original's units — what the HUD's number shows. */
  get health(): number {
    return this.hp;
  }

  /** How much of this fighter is left, 0..1 — what a health bar draws. */
  get healthFraction(): number {
    return this.maxHealth > 0 ? this.hp / this.maxHealth : 0;
  }

  /** His states for the end of a round (`match/round.ts`); none, and he cannot be knocked out. */
  get roundStates(): RoundStates | undefined {
    return this.def.states?.round;
  }

  /** His state ends a KO's half speed (`fullSpeed`). */
  get atFullSpeed(): boolean {
    return this.sm?.def.fullSpeed === true;
  }

  /** In the state he starts in and comes back to — the original's move `00`, which a round waits for. */
  get standing(): boolean {
    return !!this.sm && this.sm.current === this.def.states?.initial;
  }

  /** Effect entity this entity's current attack leaves at the point of contact. */
  get attackFx(): string {
    return hitFxOf(this.sm?.def, this.def.states);
  }

  /** The same, for the attack blocked. */
  get attackGuardFx(): string {
    return hitFxOf(this.sm?.def, this.def.states, true);
  }

  /** The effect this entity's blow becomes where it lands, if it is a projectile's (`burstsInto`). */
  get attackBurst(): string | undefined {
    return this.sm?.def.burstsInto;
  }

  /** Which step of its animation this entity is on — an effect's copies wait for one. */
  get animStep(): number {
    return this.stepIndex;
  }

  /**
   * Face whoever is at `x`. The one thing that turns a fighter outside a
   * `turn: true` state, and it exists because knockback is facing-relative:
   * no airborne state recomputes facing, so a fighter hit after crossing the
   * opponent would be thrown *toward* the blow. Turning them first makes every
   * reaction's negative `vx` mean "away" again, and stops the hurt animation
   * playing with their back to it.
   */
  turnToward(x: number): void {
    if (x === this.x) return;
    this.facing = x > this.x ? 1 : -1;
  }

  /**
   * Turn away from a blow **travelling** in `dir` — the same job as
   * `turnToward` for something that has flown past you. See `travels`.
   */
  turnFrom(dir: 1 | -1): void {
    this.facing = dir < 0 ? 1 : -1;
  }

  /**
   * Stop dead for `frames` game frames: no state changes, no movement, no
   * animation. The pause on a connecting hit, applied to both fighters so they
   * stick together for a moment instead of one sliding out of the other.
   */
  freeze(frames: number): void {
    if (frames > this.freezeFrames) this.freezeFrames = frames;
  }

  /** Mid hit pause — nothing about this entity may move, push included. */
  get frozen(): boolean {
    return this.freezeFrames > 0;
  }

  /**
   * Take a blow: enter the reaction the attacker asked for, or this entity's
   * own default. Returns false when neither names a state that exists — the
   * hit still landed, it just has nothing to show for it.
   */
  /** Enter this entity's block reaction. False when it cannot block at all. */
  guardHit(): boolean {
    const state = guardStateFor(this.sm?.def, this.def.states);
    return state !== undefined && this.forceState(state);
  }

  /**
   * Take damage, less this fighter's defence and **scaled by how long this
   * combo has already run**, and return what it actually cost. The caller
   * reports that number rather than the one it asked for: a log or a hit
   * counter showing the unscaled figure would be describing a blow nobody took.
   *
   * Health floors at zero; what comes of that is the round's (`match/round.ts`).
   */
  hurtBy(amount: number): number {
    const dealt = this.combo.worth(afterDefence(amount, this.defence));
    this.hp = Math.max(0, this.hp - dealt);
    // Counted here rather than beside the reaction, because a blow that is
    // refused a reaction — a jab at someone already on the floor — still landed
    // and is still part of the combo.
    this.combo.hit(dealt);
    return dealt;
  }

  gotHit(blow: Blow): boolean {
    if (!this.def.states) return false;
    // A relaunch spends from a budget the combo owns, and the budget is checked
    // before the reaction is chosen: a blow past the limit is refused for the
    // same reason a jab at a floored fighter is, and looks the same from here.
    if (blow.relaunch && !this.combo.canRelaunch) return false;
    const again = this.sm?.def.ifHitAgain;
    const state = reactionFor(again ? hitAgain(again, ++this.hitsAgain) : blow.reaction, this.def.states, this.sm?.def);
    if (state === undefined) return false;
    // Read before entering anything: arriving in a state can reset the combo,
    // and the hold this blow earns is decided by the beating up to it.
    const stun = this.combo.hold(blow.hitstun);
    // Counted only now, because a reaction rank refused changed nothing.
    if (blow.relaunch) this.combo.relaunch();
    if (!this.forceState(state)) return false;
    const launch = blow.launches?.[state];
    if (launch?.[0] != null) this.vx = launch[0];
    if (launch?.[1] != null) this.vy = launch[1];
    // After entering, because arriving in a state clears the clock — and this
    // blow's hold is the one thing about the reaction the blow gets to decide.
    this.stun = stun;
    if (blow.burns && this.def.attributes.burn.length > 0) {
      this.burning = true;
      // the original's counter is the game's, shared: where in the fire a burn
      // starts is no fact about the blow, so it starts anywhere
      this.burnFrame = Math.floor(Math.random() * 2 * this.def.attributes.burn.length);
      this.showVariant();
    }
    return true;
  }

  get alt(): boolean {
    return this.altColours;
  }

  set alt(on: boolean) {
    this.altColours = on;
    this.showVariant();
  }

  /** Draw him in one of his colour sets (`palettes.json`), or his own with null. */
  colourSet(name: string | null): void {
    this.set = name;
    this.showVariant();
  }

  /**
   * Be drawn in the palette an arena's lighting gives, as the original loads
   * one per stage ($01:82B5). False, and its own colours kept, when it has
   * no sheet in that palette.
   */
  light(time: string): boolean {
    if (time !== OWN_COLOURS && !this.def.variants.has(time)) return false;
    this.lighting = time === OWN_COLOURS ? null : time;
    this.showVariant();
    return true;
  }

  /**
   * Draw the current frame from the fire palette burning is on, or else in
   * the arena's light — burning over, the original reloads the fighter's own
   * palette for the stage (field `0x17`).
   */
  private showVariant(): void {
    const shimmer = this.def.attributes.shimmer;
    const glow = this.sm?.def.glow;
    const glowing = glow !== undefined && this.stateFrames >= glow;
    const win = this.sm?.def.win;
    const winning = win !== undefined && this.stateFrames >= win;
    const run = this.sm?.def.paletteRun;
    const marks = this.sm?.def.paletteAt;
    const running =
      (run && runVariant(this.altColours ? run.alt : run.plain, this.stateFrames)) ??
      (marks && markedVariant(marks, this.stateFrames, this.altColours, (v) => this.def.variants.has(v), this.lighting));
    const variant = running
      ? running
      : this.shocked !== null
      ? (shockVariant(this.def.attributes.shock ?? [], this.shocked) ?? this.lighting)
      : this.burning
      ? (burnVariant(this.def.attributes.burn, this.burnFrame) ?? this.lighting)
      : shimmer
        ? (shimmerVariant(shimmer, this.shimmerFrame) ?? null)
        : paletteVariant({ lighting: this.lighting, glow: glowing, win: winning, alt: this.altColours, set: this.set }, (v) => this.def.variants.has(v));
    if (variant === this.shownVariant) return;
    this.shownVariant = variant;
    this.applyFrame();
  }

  /** Enter a state because something happened *to* this entity (being hit). */
  forceState(name: string): boolean {
    if (!this.sm?.force(name)) return false;
    this.enterState(true);
    return true;
  }

  /**
   * Everything that happens on arriving in a state, wherever the entity came
   * from. Both routes in — a transition it chose, and a reaction forced on it —
   * must run this, or a state means different things depending on how you got
   * there. That asymmetry is what stopped a knockdown ever leaving the ground:
   * its `launch` was applied only on the transition path, and a knockdown is
   * never transitioned into.
   */
  /** `restart` plays its animation from the top even when the state names the one already playing. */
  private enterState(restart = false): void {
    if (!this.sm) return;
    // what it came in with, before it is stopped ($0F:B1EC: fields 0x80, 0x82)
    if (this.sm.def.savesFlight) this.savedFlight = [this.vx, this.vy];
    // a special starts stopped, whatever it was started from ($0D:D7A0)
    if (this.sm.startedByCommand) [this.vx, this.vy, this.shove] = [0, 0, 0];
    const sounds = this.quietEntry ? undefined : this.sm.def.sound;
    for (const id of typeof sounds === "string" ? [sounds] : (sounds ?? [])) {
      this.audio?.play(id);
    }
    // Handed over rather than restarted when the next state names the same one:
    // resetting the clock would put an audible hitch at the seam.
    const wanted = this.sm.def.loopSound ?? "";
    if (wanted !== this.hum.id) this.hum = { id: wanted, left: 0 };
    this.setAnim(this.sm.def.anim, restart || !!this.sm.def.replays);
    if (!this.sm.def.sameSwing) this.swing.reset();
    // a throw or a scene: the mover is drawn over the body he holds ($20:DF66, $20:E31F)
    if (this.sm.def.type !== undefined || this.sm.def.grab || this.sm.def.seize) this.armed = true;
    this.behind = this.sm.def.behind ?? false;
    if (this.flipsOnLeaving) this.facing = this.facing === 1 ? -1 : 1;
    this.flipsOnLeaving = !!this.sm.def.flipsOnLeaving;
    if (!this.sm.def.keepsApproach) this.approaching = null;
    this.arrived = false;
    this.freed = false;
    this.finaleSaid = { ballLanded: false, finaleDone: false };
    this.clockHeld = false;
    this.landed = false;
    // A state arrives with no hold of its own; only a blow can set one, and it
    // does so straight after forcing the reaction.
    this.stun = 0;
    // Rank 0 is anything that is not a reaction, so arriving in one is the
    // fighter getting themselves back — which is exactly when a combo ends.
    this.combo.enter(this.sm.def.rank ?? 0);
    // A launch is an impulse, applied once on entry; without one the entity
    // keeps whatever velocity it had, which is what carries a jump through its
    // take-off state into the airborne one.
    this.ki = Math.max(0, this.ki - (this.sm.def.cost ?? 0));
    // A charge survives exactly one hop — into the state that throws it. Any
    // other state clears it, so a charge interrupted by a blow is not still
    // sitting there for the next move that happens to fire something.
    if (!this.sm.def.fires) this.charge = 0;
    // Latched rather than spawned here: what a bolt is allowed to hit is a fact
    // about the pair, so the thing between the fighters takes it off the latch.
    this.fired = this.sm.def.fires ?? null;
    this.groundFx = this.sm.def.groundFx ?? null;
    // a special's price; below 1 it leaves 1, as the original does ($0D:EEF7)
    const price = this.sm.def.healthCost;
    if (price) this.hp = Math.max(1, this.hp - price);
    this.shake = this.sm.def.shake ?? null;
    this.shove = this.sm.def.shove ?? 0;
    this.shovedAhead = 0;
    this.stateFrames = 0;
    if (!this.sm.def.ifHitAgain) this.hitsAgain = 0;
    this.air = ON_GROUND;
    if (this.sm.def.resumesFlight) [this.vx, this.vy] = this.savedFlight;
    // the shot takes the ball: the original's beam effect replaces it outright
    if (this.sm.def.fires) this.ballRadius = 0;
    const launch = this.sm.def.launch;
    if (launch) {
      // A null component keeps the axis: a bounce sets how high you come back
      // up without claiming to know how fast you were already travelling.
      if (launch[0] !== null) this.vx = launch[0];
      if (launch[1] !== null) this.vy = launch[1];
    }
    const rebound = this.sm.def.rebound;
    if (rebound) this.vy = reboundSpeed(rebound, this.landedAt);
    if (this.sm.def.startsAt) this.jumpTo(this.sm.def.startsAt);
    this.freeze(this.pauseDue);
    this.pauseDue = 0;
  }

  /**
   * Play a single animation and nothing else — no state machine, no physics.
   * Used by the character select and by effects, which *are* entities
   * with no states: one animation, played once, then gone.
   */
  preview(name: string): void {
    this.previewing = true;
    this.setAnim(name);
  }

  /** The thrower's state this shot opens where it lands. */
  get opens(): string | undefined {
    return this.sm?.def.opens;
  }

  /** Not drawn while a scene has him: he goes on being where he is. */
  hide(hidden: boolean): void {
    this.view.visible = !hidden;
  }

  /** No speed left of what moved him: put down on another arena, he starts from rest. */
  still(): void {
    this.vx = 0;
    this.vy = 0;
    this.shove = 0;
  }

  /** A state with `toCentre` goes on toward `x`, the screen's middle, until it arrives. */
  centreOn(x: number): void {
    const to = this.sm?.def.toCentre;
    if (!to || this.arrived) return;
    const off = x - this.x;
    if (Math.abs(off) < to.within * this.scale) {
      this.arrived = true;
      return;
    }
    this.facing = off > 0 ? 1 : -1;
    this.x += this.facing * to.speed * this.scale;
  }

  /** A shot with an `aim` answers a body standing at `y`; anything else ignores it. */
  aimAt(y: number): void {
    const aim = this.sm?.def.aim;
    if (aim && aimsOn(aim, this.stateFrames)) this.vy = aimSpeed(aim, (this.y - y) / this.scale);
  }

  /** Where a spawn goes once its bolt is gone (`onRelease`), if anywhere. */
  get releaseState(): string | undefined {
    return this.def.states?.onRelease;
  }

  /** A non-looping animation has reached its end — for effects, time to go. */
  get finished(): boolean {
    return this.animEnded;
  }

  /** Advance one game frame (60 FPS): facing, state, movement, animation. */
  update(input: WorldInput, opponent: Opponent | null, bounds: { min: number; max: number }): void {
    const opponentX = opponent?.x ?? null;
    if (this.previewing) {
      // a hold's drawings go step for step with the thrower, who waits out a freeze too
      if (this.freezeFrames > 0) this.freezeFrames--;
      else if (!this.heldStill) this.advanceAnim();
      return;
    }
    if (!this.sm) return;

    // Edges go into the buffer; the state machine reads the buffer, not the
    // edge. This happens **above** the freeze check on purpose: a hit pause is
    // exactly when a player, having just seen the blow land, reaches for the
    // next attack, and an entity that returns before looking at its input
    // throws that press away. The buffer cannot keep what it is never handed.
    if (input.attack) this.buffer.press("attack");
    if (input.guard) this.buffer.press("guard");
    if (input.smash) this.buffer.press("smash");
    if (input.blast) this.buffer.press("blast");
    if (input.strike) this.buffer.press("strike");
    if (input.dash) this.buffer.press("dash");
    // the cartridge records the pad in a hit pause too ($0E:829C), so a
    // command's windows count the frames the pause took
    const ahead = this.facing > 0;
    this.pad.record(
      padFrame({ fwd: ahead ? input.right : input.left, back: ahead ? input.left : input.right, up: input.up, down: input.down }, input, input.holding),
    );
    this.airFrames = this.airborne ? this.airFrames + 1 : 0;

    // A hit pause freezes the whole entity, animation included — the pose the
    // blow landed on is exactly what should be held still. The buffer is not
    // ticked below either, so the pause cannot age a press out of existence.
    if (this.freezeFrames > 0) {
      this.freezeFrames--;
      if (this.sm.asksInPause && this.swing.spent && !this.swing.blocked) {
        const next = this.sm.commandInPause(commandsMet(this.def.commands, tablesFor(this.airFrames), this.pad));
        if (next) {
          if (this.sm.pressSpent) this.buffer.consume(this.sm.pressSpent);
          this.enterState(false);
          this.armed = true;
        }
      }
      return;
    }
    if (this.burning) this.burnFrame++;
    // an object's palette run, every 4 frames of its life ($01:84EF)
    if (this.def.attributes.shimmer) {
      this.shimmerFrame++;
      this.showVariant();
    }
    this.showVariant();

    if (this.stun > 0) this.stun--;
    // Below the freeze check with the stun clock: a hit pause freezes both
    // fighters equally and must not decide when the next hit of a multi-hit
    // move arrives.
    this.swing.tick();
    this.hitLight.tick();
    if (this.sm.def.behindAt === this.stateFrames - 1) this.behind = true;
    const { loopUntil: until, loopFrom: from } = this.sm.def;
    const humming = (until === undefined || this.stateFrames < until) && (from === undefined || this.stateFrames >= from);
    if (this.hum.id && humming) {
      if (this.hum.left <= 0) {
        this.audio?.play(this.hum.id);
        this.hum.left = this.sm.def.loopEvery ?? HUM_EVERY;
      }
      this.hum.left--;
    }
    // Below the freeze with every other clock: a hit pause must not pay anybody.
    const fill = this.sm.def.charge;
    if (fill) this.charge = Math.min(1, this.charge + 1 / fill);
    const perFrame = this.sm.def.ki;
    if (perFrame) this.ki = Math.max(0, Math.min(this.maxKi, this.ki + perFrame));
    const heal = this.sm.def.heal;
    if (heal) {
      const { dial, gain } = healFrame(this.dialAt, this.healClock++, heal);
      this.dialAt = dial;
      this.hp = Math.min(this.maxHealth, this.hp + gain);
    }

    // Facing is opponent-relative and only changes in states that allow it, so
    // an attack cannot turn around mid-swing.
    const turn = faceOpponent(this.sm.def, this.stateFrames, this.x, opponentX, this.facing);
    this.facing = turn.facing;
    if (turn.turnsBy) this.forceState(turn.turnsBy);

    const fwd = this.facing > 0 ? input.right : input.left;
    const back = this.facing > 0 ? input.left : input.right;
    // Below the freeze check, like the buffer's tick: a hit pause must not age
    // a motion out of existence either. Facing-relative, so turning around does
    // not turn a quarter circle into its mirror mid-input.
    const stick = { fwd, back, up: input.up, down: input.down };
    this.motions.push(stick);
    this.history.record(
      stick,
      ATTACK_LABELS.filter(([button]) => input[button]).map(([, label]) => label),
      MOTION_NAMES.filter((m) => this.motions.has(m)),
    );
    // Live conditions, not latches: true only while they hold. `falling` turns
    // on at the apex; `nearGround` narrows that to the last stretch before
    // touchdown, where the landing pose belongs.
    const falling = this.airborne && this.vy > 0;
    const nearGround = this.nearGround;

    const before = this.sm.current;
    // a held clock: the state sees the same frame again ($20:8DC6)
    if (this.clockHeld) this.sm.setFrame(this.stateFrames);
    const changed = this.sm.update(
      {
        fwd,
        back,
        up: input.up,
        down: input.down,
        attack: this.buffer.has("attack"),
        guard: this.buffer.has("guard"),
        smash: this.buffer.has("smash"),
        blast: this.buffer.has("blast"),
        strike: this.buffer.has("strike"),
        dash: this.buffer.has("dash"),
        qcf: this.motions.has("qcf"),
        qcb: this.motions.has("qcb"),
        hcf: this.motions.has("hcf"),
        dbf: this.motions.has("dbf"),
        dp: this.motions.has("dp"),
        fd: this.motions.has("fd"),
        rdp: this.motions.has("rdp"),
        hcfu: this.motions.has("hcfu"),
        fbf: this.motions.has("fbf"),
        commands: (this.met = commandsMet(this.def.commands, tablesFor(this.airFrames), this.pad)),
        holding: input.holding,
      },
      {
        animEnded: this.animEnded,
        stunEnded: this.stun === 0,
        falling,
        nearGround,
        landed: this.landed,
        close: this.closeTo(opponentX),
        grab: !!opponent?.throwable && Math.abs(opponent.x - this.x) / this.scale < this.grabRange,
        grabbable: opponent?.throwable ? Math.abs(opponent.x - this.x) / this.scale : undefined,
        distance: opponent ? Math.abs(opponent.x - this.x) / this.scale : undefined,
        // `spent` means this attack has connected — set on a hit and on a block,
        // never on a whiff, which is exactly what a chain is allowed to continue
        // from. It was already recorded for a different reason: an attack may
        // only land once per entry into its state.
        hitConfirmed: this.swing.spent,
        blocked: this.swing.blocked,
        arrived: this.arrived,
        freed: this.freed,
        ...this.finaleSaid,
        health: this.hp,
        ki: this.ki,
        spawnEnded: this.thrown === 0,
        charged: this.charge >= 1,
      },
    );
    // A press that started a move, or was kept for the next one, is spent, so
    // it cannot start a second one before the buffer has expired.
    if (this.sm.pressSpent) this.buffer.consume(this.sm.pressSpent);
    // Back into the same state is its animation played again (a loop's pass).
    if (changed) this.enterState(changed === before || !!this.sm.def.fromTop);
    // every move begun by a button arms, a blow in it or not: a throw, a shot (recorded)
    if (changed && this.sm.startedByButton) this.armed = true;
    this.buffer.tick();

    // Velocities are authored in sprite pixels, like box coordinates, and X is
    // facing-relative (+ = forward); scaling to screen px happens here so the
    // data stays independent of SCALE.
    // the move's handler first, then the body moves — the original's order
    const { vx, vy, ...air } = applyAir({ ...this.air, vx: this.vx, vy: this.vy }, this.sm.def.air, this.stateFrames);
    [this.vx, this.vy, this.air] = [vx, vy, air];
    if (this.airborne) {
      const flying = this.facing * this.vx;
      // only against a body in the air too: Goku's spin kick flies on over one on the ground, Sender `a1` slows on one it knocked up
      this.x += (this.pressed && opponent?.airborne ? pressedSpeed({ x: this.x, vx: flying }, { x: opponent.x, vx: opponent.groundVx }) : flying) * this.scale;
      this.y += this.vy * this.scale;
      this.vy = fall({ ...air, vx, vy: this.vy }, this.gravity);
      if (this.y >= this.groundY) {
        this.y = this.groundY;
        // Only the fall stops. Touching the ground does not delete horizontal
        // speed — a body skidding at 4.5 px a frame is still skidding — and
        // pretending it does made every bounce start from nothing, so the state
        // that followed had to invent a speed it could not know.
        this.landedAt = this.vy;
        this.vy = 0;
        this.landed = true;
        // the fire goes out when the body lands, its own palette back ($0D:CB47)
        this.burning = false;
      }
    } else {
      this.y = this.groundY;
      const approach = this.sm.def.approach;
      if (approach && this.stateFrames === approach.until) this.approaching = null;
      if (approach && this.stateFrames === approach.at && opponentX !== null) {
        this.turnToward(opponentX);
        this.approaching = approachSpeed(approach, (opponentX - this.x) / this.scale);
      }
      const own = this.groundVx;
      // a shove stands in for his own speed ($0D:C955), so only a body with none takes the average
      const vx = this.pressed && this.shove === 0 && opponent ? pressedSpeed({ x: this.x, vx: own }, { x: opponent.x, vx: opponent.groundVx }) : own;
      this.x += (vx + this.facing * this.shove) * this.scale;
      const rush = this.sm.def.rush;
      if (rush && !this.arrived && rushing(rush, this.stateFrames) && opponentX !== null) {
        const { dx, arrived } = rushStep(rush, (opponentX - this.x) / this.scale);
        this.x += dx * this.scale;
        this.arrived = arrived;
      }
      this.shove = shoveAfter(this.shove, this.stateFrames + 1 + this.shovedAhead, this.sm.def.shoveFor);
    }
    this.x = Math.max(bounds.min, Math.min(bounds.max, this.x));
    const ball = this.sm.def.ball;
    const up = activeBall(ball, this.stateFrames);
    if (up) this.ballAt = up.at;
    this.ballRadius = nextRadius(this.ballRadius, ball, this.stateFrames);
    this.bandFrames = this.sm.def.band && this.beamHead !== null ? this.bandFrames + 1 : 0;
    for (const [at, c] of this.sm.def.screen ?? []) if (at === this.stateFrames) this.screenCues.push(c);
    const pillar = this.sm.def.pillar;
    if (this.pillarRun && !this.clockHeld) this.pillarRun.t++;
    if (pillar && !this.clockHeld && this.stateFrames === (pillar.from ?? 0)) this.pillarRun = { def: pillar, t: 0 };
    // taken by the fighters with the entry's groundFx; a beat on the first frame replaces it
    if (trailAt(this.sm.def.trail, this.stateFrames)) this.groundFx = this.sm.def.trail!.fx;
    if (this.fading) {
      this.fading.gone++;
      const { band, frames, gone } = this.fading;
      if (bandHeights(band, frames, gone).head === 0) this.fading = null;
    }
    if (!this.clockHeld) for (const id of soundsOn(this.sm?.def.soundsAt, this.stateFrames)) this.audio?.play(id);
    if (!this.clockHeld) this.stateFrames++;

    if (!this.clockHeld) this.advanceAnim();
  }

  /** Push the simulation state into the display objects. */
  render(showBoxes: boolean): void {
    this.sprite.x = this.x + quiverOffset(this.stateFrames, this.sm?.def.quivers) * this.scale;
    const dip = dipAt(this.sm?.def.dips, this.stateFrames);
    this.sprite.y = this.y + ((this.sm?.def.hover ? hoverOffset(this.stateFrames) : 0) + dip) * this.scale;
    const flip = this.heldFlipped ? -1 : 1;
    this.sprite.scale.set(flip * this.facing * this.scale * this.size, flip * this.scale * this.size);
    this.renderShadow();

    this.ballG.clear();
    this.bandG.clear();
    const thrown = this.thrownBall;
    if (thrown && thrown.radius > 0) this.ballG.circle(thrown.x, thrown.y, thrown.radius * this.scale).fill(BALL_COLOUR);
    if (this.sweep) {
      const { apex, x, half, floor } = this.sweep;
      this.ballG.poly([apex[0], apex[1], x - half * this.scale, floor, x + half * this.scale, floor]).fill(BALL_COLOUR);
    }
    for (const b of this.bars) this.ballG.rect(b.x, b.y, b.w, b.h).fill(BALL_COLOUR);
    this.drawPillar();
    // kind 4: 2 × size tall, 2 px over the floor (y 0xC6), across the screen and past its sides
    const fb = this.floorBand;
    const { ball: hitBall, pillar } = this.hitLight;
    if (hitBall) this.ballG.circle(hitBall.x, hitBall.y, hitBall.radius * this.scale).fill(BALL_COLOUR);
    if (pillar) {
      const k = this.scale;
      this.ballG.rect(pillar.x - pillar.half * k, this.groundY + k - PILLAR_HEIGHT * k, 2 * pillar.half * k, PILLAR_HEIGHT * k).fill(BALL_COLOUR);
    }
    if (fb) this.ballG.rect(this.x - BAND_REACH, fb.y - (2 + fb.size) * this.scale, 2 * BAND_REACH, 2 * fb.size * this.scale).fill(BALL_COLOUR);
    if (this.ballRadius > 0) {
      const [dx, dy] = this.ballAt;
      const k = this.scale * this.size;
      this.ballG.circle(this.x + this.facing * dx * k, this.y + dy * k, this.ballRadius * k).fill(BALL_COLOUR);
    }
    const band = this.sm?.def.band;
    if (band && this.beamHead !== null) this.drawBand(band, this.bandFrames, 0, this.beamHead);
    else if (this.fading) this.drawBand(this.fading.band, this.fading.frames, this.fading.gone, this.fading.head);

    this.boxG.clear();
    const boxes = showBoxes ? this.currentStep()?.boxes : undefined;
    if (!boxes) return;
    // Same conversion the collision uses, so the overlay shows what actually hits.
    const at = this.placement;
    for (const b of boxes) {
      const r = boxToWorld(b, at);
      // One window pixel, however far the view scales the world.
      this.boxG.rect(r.x, r.y, r.w, r.h).stroke({ color: BOX_COLORS[b.type] ?? 0xffffff, pixelLine: true });
    }
  }

  private renderShadow(): void {
    const step = this.currentStep();
    const size = step && this.def.frames.get(step.frame)?.shadow ? shadowSize(this.y / this.scale) : null;
    const id = size === null ? null : shadowFrame(size);
    const ft = id === null ? undefined : this.def.frames.get(id);
    this.shadow.visible = ft !== undefined;
    if (!ft || id === null) return;
    const variant = this.shownVariant ? this.def.variants.get(this.shownVariant)?.get(id) : undefined;
    this.shadow.texture = variant ?? ft.tex;
    this.shadow.anchor.set(ft.anchor[0] / ft.w, ft.anchor[1] / ft.h);
    this.shadow.scale.set(this.scale);
    this.shadow.position.set(this.x, this.groundY);
  }

  private drawBand(band: BandDef, frames: number, gone: number, head: number): void {
    const k = this.scale * this.size;
    const base = this.x + this.facing * band.from[0] * k;
    const y = this.y + band.from[1] * k;
    const h = bandHeights(band, frames, gone);
    const [b, t] = [(h.base * k) / 2, (h.head * k) / 2];
    this.bandG.poly([base, y - b, head, y - t, head, y + t, base, y + b]).fill(BALL_COLOUR);
  }

  // --- animation playback --------------------------------------------------

  private currentStep(): Step | null {
    if (!this.anim || this.anim.steps.length === 0) return null;
    return this.anim.steps[Math.min(this.stepIndex, this.anim.steps.length - 1)];
  }

  private setAnim(name: string, restart = false): void {
    // The guard is what lets walk_fwd → walk_back keep one cycle running rather
    // than stutter. `restart` is for the opposite case: being hit again while
    // already reeling has to play the reaction from the top, or the second blow
    // silently fails to refresh how long the defender is helpless.
    if (name === this.animName && !restart) return;
    const anim = this.def.animations[name];
    if (!anim) {
      console.warn(`[entity] unknown animation "${name}"`);
      return;
    }
    this.animName = name;
    this.anim = anim;
    this.stepIndex = 0;
    this.animEnded = false;
    this.remaining = Math.max(1, anim.steps[0]?.dur ?? 1);
    this.plays++;
    this.spawnedSteps.clear();
    this.stepBegins();
  }

  private applyFrame(): void {
    const step = this.currentStep();
    if (!step) return;
    const frame = this.heldDrawing ?? step.frame;
    const ft = this.def.frames.get(frame);
    if (!ft) return;
    const variant = this.shownVariant ? this.def.variants.get(this.shownVariant)?.get(frame) : undefined;
    this.sprite.texture = variant ?? ft.tex;
    this.sprite.anchor.set(ft.anchor[0] / ft.w, ft.anchor[1] / ft.h);
  }

  private advanceAnim(): void {
    if (!this.anim || this.anim.steps.length === 0) return;
    this.remaining -= 1;
    if (this.remaining > 0) return;
    if (this.heldToScript && this.currentStep()?.hold) return;
    if (staysOnStep(this.sm?.def, this.stepIndex, this.stateFrames)) return;

    this.stepIndex += 1;
    if (this.stepIndex >= this.anim.steps.length) {
      if (this.anim.loop || this.sm?.def.animLoops) {
        this.stepIndex = 0;
      } else {
        this.stepIndex = this.anim.steps.length - 1;
        this.animEnded = true;
      }
    }
    this.remaining = Math.max(1, this.currentStep()?.dur ?? 1);
    // A held last step is not a new one beginning: its sound has played.
    if (!this.animEnded) this.stepBegins();
    else this.applyFrame();
  }

  private stepBegins(): void {
    this.applyFrame();
    const step = this.currentStep();
    if (!this.sm?.def.muted) for (const id of step?.sfx ?? []) this.audio?.playRom(id);
    if (step?.voice !== undefined) this.audio?.playLine(step.voice);
    // placed now, while the facing is the step's; the fighters spawn them
    if (this.spawnedSteps.has(this.stepIndex)) return;
    this.spawnedSteps.add(this.stepIndex);
    for (const { name, at: [dx, dy] } of step?.spawns ?? [])
      this.stepSpawns.push({ name, x: this.x + this.facing * dx * this.scale, y: this.y + dy * this.scale, facing: this.facing, at: [dx, dy] });
  }

  /** What its state asked of the screen since the last ask — taken once. */
  takeScreen(): ScreenCue[] {
    return this.screenCues.splice(0);
  }

  /** The effects the animation's steps put out since the last ask (`Step.spawns`), in world px — taken once. */
  takeStepSpawns(): { name: string; x: number; y: number; facing: 1 | -1; at: [number, number] }[] {
    return this.stepSpawns.splice(0);
  }
}
