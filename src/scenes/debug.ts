import { soundIdCollisions, validateSounds } from "../audio/sounds";
import type { Music } from "../audio/music";
import { loadEntityDef, type EntityDef } from "../entity/entityDef";
import { picksOf, readPicks } from "../combat/rushAddress";
import { withTempo } from "../combat/rushTempo";
import { HIT_TYPES } from "../combat/hitTypes";
import { stepOf, withRush } from "../combat/rushSlots";
import { effectsNamed, spawnsNamed, validateStates } from "../entity/states";
import { Effects } from "../fx/effects";
import type { Controls } from "../input/controls";
import { ACTIONS } from "../input/layout";
import { Fighters } from "../match/fighters";
import { Round, type RoundWorld } from "../match/round";
import { Opening } from "../match/opening";
import { NO_INPUT } from "../entity/entity";
import { Projectiles } from "../match/projectiles";
import { loadRules } from "../match/rules";
import { isColourSet, sameBut, type DebugRequest, type Scene, type SceneContext, type SceneRequest } from "../scene";
import { Dummy } from "../debug/dummy";
import { loadMode } from "../debug/mode";
import { Camera } from "../camera/camera";
import { CameraNotes } from "../camera/note";
import { Shake } from "../camera/shake";
import { Stage } from "../stage";
import { ArenaBackdrop, loadArena } from "../arena/arena";
import { Travel } from "../arena/travel";
import { Journey } from "../match/journey";
import { GridBackdrop } from "../arena/grid";
import { GameView, VIEW } from "../view";
import { describes, tickLog } from "../log";
import { Readouts } from "../ui/debug";
import { Hud } from "../hud/hud";
import { showMessage, showPrompt, type Notice } from "../ui/notices";

/**
 * Sprites are drawn at their own size: the world is in game px and the view
 * scales the whole screen (src/view.ts). The entities' `scale` stays a
 * parameter only until nothing passes them anything else.
 */
const SPRITE_SCALE = 1;

/**
 * Frames of the winner's pose before a button may fight again: a moment of it, not
 * the 304 the original plays before its next round (owner) — this scene is
 * for trying things again.
 */
const AGAIN_AFTER = 60;

/**
 * The debug scene: two bodies on a stage, hitting each other, with everything
 * about the engine on show.
 *
 * **This is not the fight, and not the training mode.** Both of those are ahead
 * of us and are for a player; this one is for whoever is building the engine, so
 * it is where the box overlays, the state readout, the log recording and the
 * scripted dummy live — none of which a player should ever reach. Keeping them
 * here is what stops them leaking into the real screens later.
 *
 * Everything that used to be the body of the game loop lives here, and the
 * order of one game frame is the whole of `step()` — the most instructive four
 * lines in the project, kept in one place on purpose.
 */
export class DebugScene implements Scene {
  private constructor(
    private readonly view: GameView,
    private readonly stage: Stage,
    private readonly camera: Camera,
    private readonly cameraNotes: CameraNotes,
    private readonly shake: Shake,
    private readonly fighters: Fighters,
    /** The second body's timeline — see src/debug/dummy.ts. */
    private readonly dummy: Dummy,
    /** Player one's, if the mode gives him one: then the keyboard does not move him. */
    private readonly dummy1: Dummy | null,
    /** What built this scene — or what it took in place since — and how many modes there are to step through. */
    private req: DebugRequest,
    private readonly modes: number,
    private readonly effects: Effects,
    private readonly hud: Hud,
    private readonly readouts: Readouts,
    /** Notices about broken data; they belong to this scene and go with it. */
    private readonly notices: Notice[],
    /** How the fight ends, when the KO switch lets it (`match/round.ts`). */
    private readonly round: Round,
    /** How it starts, when the intro switch asks for it (`match/opening.ts`). */
    private readonly opening: Opening,
    /**
     * Held on the first frame until the sound wakes — a browser wakes it on
     * the first key or click — so an intro is not played half in silence.
     */
    private waiting: { awake: () => boolean; prompt: Notice } | null,
    /** Asks the player something in the screen's middle, until taken down. */
    private readonly prompt: (text: string) => Notice,
    /** Where a blow may send the fight; null on the grid. */
    private readonly travel: Travel | null,
    /** The fight's song, from the scene's start to its end. */
    private readonly music: Music,
    /** Player one as his data has him, before any rush tried from the panel. */
    private readonly own: EntityDef,
    /** What a recording says this scene is, for a request (`describes`). */
    private readonly situation: (req: DebugRequest) => string[],
  ) {}

  /** A pick that only changes player one's rush or its tempo is tried on him where he stands; any other builds the scene again. */
  take(request: SceneRequest): boolean {
    // once the prompt is up the fight is over: nothing to try a pick on, and its
    // own request — this one, unchanged — has to build the scene again
    if (this.again) return false;
    if (request.scene !== "debug" || !sameBut(request, this.req, "rush1", "tempo1", "hitstop")) return false;
    const def = tryRush(this.own, request);
    if (typeof def === "string" || !def.states) return false;
    if (request.rush1 !== this.req.rush1 || request.tempo1 !== this.req.tempo1) this.fighters.player.playStates(def.states, def.animations);
    for (const body of this.fighters.bodies) body.hitstopScale = request.hitstop ?? 1;
    this.req = request;
    describes(this.situation(request));
    return true;
  }

  /** Frames since the scene began: half speed skips the odd ones. */
  private frame = 0;
  /** Once the round is done: any button fights it again, which this says. */
  private again: Notice | null = null;
  /** A sender's journey under way: the fight waits for it. */
  private journeying: Journey | null = null;
  /**
   * Whether the song was asked for: on the first frame, not as the scene is
   * built — a scene built and thrown away must not stop the next one's.
   */
  private playing = false;

  static async create(
    ctx: SceneContext,
    req: DebugRequest,
  ): Promise<Scene | string> {
    // First, so a mode that does not exist says so instead of quietly running
    // the scene as if nothing had been asked for.
    const loaded = await loadMode(req.mode);
    if (typeof loaded === "string") return loaded;
    const { mode, count } = loaded;

    const situation = (r: DebugRequest) => situationOf(r, mode);
    describes(situation(req));

    const dummy = Dummy.from(mode.p2);
    if (typeof dummy === "string") return `mode ${req.mode}: ${dummy}`;
    // player one's timeline, for a case that needs both to act: `npm run moves -- <f> --parry`
    const dummy1 = mode.p1?.does ? Dummy.from(mode.p1) : null;
    if (typeof dummy1 === "string") return `mode ${req.mode}: ${dummy1}`;

    const rules = await loadRules();
    if (typeof rules === "string") return rules;
    const own = await loadFighter(req.p1);
    if (typeof own === "string") return own;
    const p1 = tryRush(own, req);
    if (typeof p1 === "string") return p1;
    const p2 = req.p2 === req.p1 ? own : await loadFighter(req.p2);
    if (typeof p2 === "string") return p2;
    // Each definition once, though two Gokus play from one.
    const defs = p1 === p2 ? [p1] : [p1, p2];

    // Before anything is put on screen, so a missing arena leaves nothing behind.
    const arena = req.arena ? await loadArena(req.arena, req.time ?? null) : null;
    if (typeof arena === "string") return arena;
    const travel = await Travel.load(req.arena ?? null, arena?.time ?? null);

    // First on screen, so the notices below are drawn over the game's screen.
    const view = new GameView(ctx.app);
    const notices = defs.flatMap((def) => reportProblems(ctx, def));

    const backdrop = arena ? new ArenaBackdrop(view.backdrop, arena) : new GridBackdrop(view.backdrop);
    const stage = new Stage(view.backdrop, backdrop);
    // Projectiles first: a bolt is an entity with states of its own, so the
    // burst it leaves is named there and not in the fighter's data.
    const projectiles = await Projectiles.load(view.world, [...new Set(defs.flatMap((d) => spawnsNamed(d.states)))], SPRITE_SCALE);
    const effects = await Effects.load(
      view.world,
      [...new Set([...defs.flatMap((d) => effectsNamed(d.states, d.animations)), ...projectiles.effectsNeeded(), "ready", "ko", "double_ko"])],
      SPRITE_SCALE,
    );
    // the switch is read as each blow lands: off, every sender's way is closed
    const toggles = ctx.controls.keyboard.toggles;
    const opens = travel ? (...a: Parameters<Travel["opens"]>) => toggles.get("journeys") && travel.opens(...a) : undefined;
    const fighters = new Fighters({ world: view.world, p1, p2, scale: SPRITE_SCALE, audio: ctx.audio, effects, projectiles, opens, rules });
    fighters.start(stage, { p1: mode.p1?.at, p2: mode.p2?.at });
    if (req.hp1 !== undefined) fighters.player.setHealth(req.hp1);
    for (const body of fighters.bodies) body.hitstopScale = req.hitstop ?? 1;
    if (req.hp2 !== undefined) fighters.opponent?.setHealth(req.hp2);
    // colours asked for override the original's rule, which Fighters applied
    for (const [fighter, pal] of [[fighters.player, req.pal1], [fighters.opponent, req.pal2]] as const) {
      if (!fighter || pal === undefined) continue;
      fighter.alt = pal === "2";
      fighter.colourSet(isColourSet(pal) ? pal : null);
    }
    if (arena) {
      for (const name of new Set(fighters.light(arena.time))) {
        notices.push(showMessage(ctx.page.notices, `${name}: no sheet for "${arena.time}" — in its own colours`, true));
      }
    }
    // Over the two of them, so a mode set in a corner shows the corner.
    const camera = new Camera({ screen: VIEW.width, world: stage.width, floor: stage.groundY });
    camera.centreOn(fighters.player.x, fighters.opponent?.x ?? fighters.player.x);
    // The dummy waits for `T`, even with a timeline written in the mode
    // (owner, 2026-10-30).

    for (const def of defs) if (!def.states) notices.push(showMessage(ctx.page.notices, `${def.name}: no states.json`, true));
    const health = fighters.status().health;
    const hud = await Hud.load(view.hud, [
      { name: p1.name, health: health[0] },
      health[1] === null ? null : { name: p2.name, health: health[1] },
    ]);

    // an announcement stands in the screen's middle ($0D:EB88), at a height the round says
    const announcer = ctx.audio.side("round");
    const world: RoundWorld = {
      announce: (what) => {
        const fx = effects.spawn(what, camera.x + 128, camera.y);
        return { at: (y) => fx && (fx.y = camera.y + y) };
      },
      sound: (id) => announcer.play(id),
    };
    const round = new Round(world);
    const opening = new Opening(world, fighters.bodies, ctx.controls.keyboard.toggles.get("intro"));

    return new DebugScene(
      view,
      stage,
      camera,
      new CameraNotes(camera),
      new Shake(),
      fighters,
      dummy,
      dummy1,
      req,
      count,
      effects,
      hud,
      new Readouts(ctx.page),
      notices,
      round,
      opening,
      // only an intro has anything to lose: without one nothing sounds before a key
      opening.over || ctx.audio.awake ? null : { awake: () => ctx.audio.awake, prompt: showPrompt(ctx.page.notices, "press any key") },
      (text) => showPrompt(ctx.page.notices, text),
      travel,
      ctx.music,
      own,
      situation,
    );
  }

  /** One game frame, in the order the parts of it have to happen. */
  step(controls: Controls): SceneRequest | null {
    if (!this.playing) {
      this.playing = true;
      this.music.fight();
    }
    if (this.waiting) {
      // the key that wakes it is for waking only: Space would refill the
      // health a mode or the address set, N leave the mode
      controls.keyboard.takeRefill();
      controls.keyboard.takeModeStep();
      if (!this.waiting.awake()) return null;
      this.waiting.prompt.destroy();
      this.waiting = null;
    }
    // the pose plays on while a button is awaited
    const again = this.round.done || this.round.posed >= AGAIN_AFTER ? this.fightAgain(controls) : null;
    if (again) return again;
    // a KO's half speed: an odd frame only draws ($0E:821C)
    if (this.round.skips(this.frame++)) return this.nextMode(controls);
    // a journey moves only those it carries
    if (this.journeying) {
      if (!this.journeying.step()) this.journeying = null;
      this.effects.update(false, this.camera.screen);
      return this.nextMode(controls);
    }
    // under the announcement only the announcement moves
    if (this.round.holds) {
      this.round.step(this.fighters.bodies, true, true);
      this.effects.update(false, this.camera.screen);
      return this.nextMode(controls);
    }
    const locked = this.round.locked || !this.opening.over;
    // taken even while locked: a press keeps until someone takes it, and it
    // would otherwise be the fight's first move
    const pressed = controls.frame();
    const dummy = this.dummy.input({
      on: controls.keyboard.toggles.get("dummy"),
      facing: this.fighters.opponent?.facing ?? -1,
      // Read before the bodies move, which is the freeze this frame will use.
      frozen: this.fighters.frozen,
    });
    const one = this.dummy1?.input({
      on: controls.keyboard.toggles.get("dummy"),
      facing: this.fighters.player.facing,
      frozen: this.fighters.frozen,
    });
    this.fighters.update(
      locked ? NO_INPUT : (one ?? pressed),
      locked ? NO_INPUT : dummy,
      { bodies: this.camera.world, shots: this.camera.screen, view: { x: this.camera.x, y: this.camera.y } },
    );
    // Pushed apart before the camera reads the moves, as the original evens
    // out two bodies' speeds before its camera ($0D:C8F0): a camera that saw
    // the walk and not the push would scroll every other frame.
    this.fighters.pushApart(this.camera.world);
    this.fighters.keepInView(this.camera);
    if (controls.keyboard.takeRefill()) this.fighters.refill();
    this.fighters.exchangeBlows();
    this.depart();
    if (this.opening.over) this.round.step(this.fighters.bodies, controls.keyboard.toggles.get("ko"), this.fighters.quiet);
    else this.opening.step(this.fighters.bodies);
    this.stage.flash(this.fighters.takeFlash());
    for (const c of this.fighters.takeScreen()) this.stage.cue(c);
    const { health, ki, fatigue, landing } = this.fighters.status();
    this.hud.tick(health, ki, fatigue, landing);
    const shake = this.fighters.takeShake();
    if (shake) this.shake.start(shake);
    this.shake.tick();
    this.stage.tick();
    this.fighters.note();
    this.cameraNotes.note(this.camera);
    this.cameraNotes.shake(this.shake.offset);
    tickLog();
    this.effects.update(this.fighters.frozen, this.camera.screen);
    return this.nextMode(controls);
  }

  /**
   * The round done, or a moment into the pose: any button of the fight, on
   * the keyboard or a pad, builds the scene again as it was asked for —
   * health, places, intro and all. Not a direction: those count while held,
   * so one held through the pose would start the next fight at once. A button
   * counts only on the frame it goes down, and the press is the first taken
   * after the prompt.
   */
  private fightAgain(controls: Controls): SceneRequest | null {
    const input = controls.frame();
    const pressed = ACTIONS.some((a) => input[a]);
    if (this.again) return pressed ? { ...this.req } : null;
    this.again = this.prompt("press any button to fight again");
    return null;
  }

  /**
   * `N` steps to the next mode by asking to be rebuilt, which is the machinery
   * the character select already uses — so the address bar always says which
   * setup is running and can be copied straight into a bug report. Everything
   * reloads with it: health, positions and the timeline all start over, which
   * for a written-down situation is the point rather than the price.
   */
  private nextMode(controls: Controls): SceneRequest | null {
    if (!controls.keyboard.takeModeStep() || this.modes < 2) return null;
    return { ...this.req, scene: "debug", mode: (this.req.mode + 1) % this.modes };
  }

  render(controls: Controls): void {
    this.hud.draw();
    this.readouts.draw(controls.keyboard.toggles.get("readout") ? this.fighters.debug() : null);
    this.view.scroll(this.camera.x, this.camera.y);
    this.stage.scroll(this.camera.x, this.camera.y, this.shake.offset);
    this.fighters.render(controls.keyboard.toggles.get("boxes"));
    this.effects.render();
  }

  /** A sending blow's journey, begun once its pause is over (`match/journey.ts`). */
  private depart(): void {
    const sent = this.fighters.takeSent();
    if (!this.travel) return;
    if (sent) this.travel.sent(sent);
    const go = this.travel.step(this.fighters.frozen);
    if (go) this.journeying = new Journey(go, { stage: this.stage, camera: this.camera, fighters: this.fighters, backdrop: this.view.backdrop });
  }

  destroy(): void {
    if (this.playing) this.music.stop();
    this.stage.destroy();
    this.travel?.destroy();
    this.fighters.destroy();
    this.effects.destroy();
    this.hud.destroy();
    this.readouts.destroy();
    for (const notice of this.notices) notice.destroy();
    this.waiting?.prompt.destroy();
    this.again?.destroy();
    this.view.destroy();
  }
}

/**
 * Hand-authored data fails quietly, so it is reported loudly.
 *
 * A broken state reference shows on screen because the fight will visibly
 * misbehave; a broken sound only goes silent, which nobody notices until they
 * wonder why one move has no impact.
 */
function reportProblems(ctx: SceneContext, def: EntityDef): Notice[] {
  const notices: Notice[] = [];
  if (def.states) {
    const { errors, warnings } = validateStates(def.states, def.animations);
    for (const w of warnings) console.warn(`[states] ${w}`);
    for (const e of errors) console.error(`[states] ${e}`);
    if (errors.length > 0) {
      const shown = errors.slice(0, 5).join("\n");
      const rest = errors.length > 5 ? `\n…and ${errors.length - 5} more (see console)` : "";
      notices.push(showMessage(ctx.page.notices, `states.json — ${errors.length} problem(s):\n${shown}${rest}`));
    }
  }
  for (const p of validateSounds(def.sounds)) console.error(`[sounds] ${def.name}: ${p}`);
  for (const p of soundIdCollisions(ctx.bank, def.sounds)) console.error(`[sounds] ${p}`);
  return notices;
}

/** What a recording made from here is a recording *of*: mode 0's number alone means nothing. */
function situationOf(r: DebugRequest, mode: unknown): string[] {
  return [
    `debug mode ${r.mode}: ${JSON.stringify(mode)}`,
    `p1=${r.p1} p2=${r.p2}` +
      (r.arena ? ` arena=${r.arena}${r.time ? ` time=${r.time}` : ""}` : "") +
      (r.hp1 !== undefined ? ` hp1=${r.hp1}` : "") +
      (r.hp2 !== undefined ? ` hp2=${r.hp2}` : "") +
      (r.pal1 !== undefined ? ` pal1=${r.pal1}` : "") +
      (r.pal2 !== undefined ? ` pal2=${r.pal2}` : "") +
      (r.rush1 !== undefined ? ` rush1=${r.rush1}` : "") +
      (r.tempo1 !== undefined ? ` tempo1=${r.tempo1}` : "") +
      (r.hitstop !== undefined ? ` hitstop=${r.hitstop}` : ""),
  ];
}

/**
 * His definition playing the rush the panel tries, at its tempo — his own
 * rush when it picks none (`combat/rushSlots.ts`, `rushTempo.ts`) — or why it
 * cannot. Untouched when the panel asks for nothing.
 */
function tryRush(def: EntityDef, req: DebugRequest): EntityDef | string {
  if (req.rush1 === undefined && req.tempo1 === undefined) return def;
  if (!def.states) return `${def.name}: no states.json to try a rush on`;
  const picks = req.rush1 === undefined ? picksOf(def.states) : readPicks(req.rush1, def.animations, HIT_TYPES);
  if (typeof picks === "string") return `${def.name}: ${picks}`;
  const animations = withTempo(def.animations, picks, req.tempo1 ?? 1);
  return { ...def, animations, states: withRush(def.states, animations, def.attributes.hitstun, picks, stepOf(def.states)) };
}

/** A fighter's definition, or why it cannot fight. */
async function loadFighter(name: string): Promise<EntityDef | string> {
  const def = await loadEntityDef(name).catch(() => null);
  if (!def) return `Could not load "${name}". Save it from the entity editor first.`;
  if (Object.keys(def.animations).length === 0) return `${def.name}: no animations`;
  return def;
}
