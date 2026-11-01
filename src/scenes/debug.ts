import { soundIdCollisions, validateSounds } from "../audio/sounds";
import { loadEntityDef, type EntityDef } from "../entity/entityDef";
import { effectsNamed, spawnsNamed, validateStates } from "../entity/states";
import { Effects } from "../fx/effects";
import type { Keyboard } from "../input/keyboard";
import { Fighters } from "../match/fighters";
import { Projectiles } from "../match/projectiles";
import type { DebugRequest, Scene, SceneContext, SceneRequest } from "../scene";
import { Dummy } from "../debug/dummy";
import { loadMode } from "../debug/mode";
import { Camera } from "../camera/camera";
import { CameraNotes } from "../camera/note";
import { Shake } from "../camera/shake";
import { Stage } from "../stage";
import { ArenaBackdrop, loadArena } from "../arena/arena";
import { GridBackdrop } from "../arena/grid";
import { GameView, VIEW } from "../view";
import { describes, tickLog } from "../log";
import { Readouts } from "../ui/debug";
import { Hud } from "../hud/hud";
import { showMessage, type Notice } from "../ui/notices";

/**
 * Sprites are drawn at their own size: the world is in game px and the view
 * scales the whole screen (src/view.ts). The entities' `scale` stays a
 * parameter only until nothing passes them anything else.
 */
const SPRITE_SCALE = 1;

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
    /** What built this scene, and how many modes there are to step through. */
    private readonly req: DebugRequest,
    private readonly modes: number,
    private readonly effects: Effects,
    /** The original's HUD; null when it has not been exported, which a notice says. */
    private readonly hud: Hud | null,
    private readonly readouts: Readouts,
    /** Notices about broken data; they belong to this scene and go with it. */
    private readonly notices: Notice[],
  ) {}

  static async create(
    ctx: SceneContext,
    req: DebugRequest,
  ): Promise<Scene | string> {
    // First, so a mode that does not exist says so instead of quietly running
    // the scene as if nothing had been asked for.
    const loaded = await loadMode(req.mode);
    if (typeof loaded === "string") return loaded;
    const { mode, count } = loaded;

    // What a recording made from here is a recording *of* — the number alone
    // means nothing, because mode 0 is the everyday scratch setup.
    describes([
      `debug mode ${req.mode}: ${JSON.stringify(mode)}`,
      `p1=${req.p1} p2=${req.p2}` +
        (req.arena ? ` arena=${req.arena}${req.time ? ` time=${req.time}` : ""}` : "") +
        (req.hp1 !== undefined ? ` hp1=${req.hp1}` : "") +
        (req.hp2 !== undefined ? ` hp2=${req.hp2}` : ""),
    ]);

    const dummy = Dummy.from(mode.p2);
    if (typeof dummy === "string") return `mode ${req.mode}: ${dummy}`;

    const p1 = await loadFighter(req.p1);
    if (typeof p1 === "string") return p1;
    const p2 = req.p2 === req.p1 ? p1 : await loadFighter(req.p2);
    if (typeof p2 === "string") return p2;
    // Each definition once, though two Gokus play from one.
    const defs = p1 === p2 ? [p1] : [p1, p2];

    // Before anything is put on screen, so a missing arena leaves nothing behind.
    const arena = req.arena ? await loadArena(req.arena, req.time ?? null) : null;
    if (typeof arena === "string") return arena;

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
      [...new Set([...defs.flatMap((d) => effectsNamed(d.states, d.animations)), ...projectiles.effectsNeeded()])],
      SPRITE_SCALE,
    );
    const fighters = new Fighters({ world: view.world, p1, p2, scale: SPRITE_SCALE, audio: ctx.audio, effects, projectiles });
    fighters.start(stage, { p1: mode.p1?.at, p2: mode.p2?.at });
    if (req.hp1 !== undefined) fighters.player.setHealth(req.hp1);
    if (req.hp2 !== undefined) fighters.opponent?.setHealth(req.hp2);
    if (arena && arena.time !== arena.times[0]) {
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
    if (typeof hud === "string") notices.push(showMessage(ctx.page.notices, hud, true));

    return new DebugScene(
      view,
      stage,
      camera,
      new CameraNotes(camera),
      new Shake(),
      fighters,
      dummy,
      req,
      count,
      effects,
      typeof hud === "string" ? null : hud,
      new Readouts(ctx.page),
      notices,
    );
  }

  /** One game frame, in the order the parts of it have to happen. */
  step(keyboard: Keyboard): SceneRequest | null {
    this.fighters.update(
      keyboard.frame(),
      this.dummy.input({
        on: keyboard.toggles.get("dummy"),
        facing: this.fighters.opponent?.facing ?? -1,
        // Read before the bodies move, which is the freeze this frame will use.
        frozen: this.fighters.frozen,
      }),
      { bodies: this.camera.world, shots: this.camera.screen },
    );
    // Pushed apart before the camera reads the moves, as the original evens
    // out two bodies' speeds before its camera ($0D:C8F0): a camera that saw
    // the walk and not the push would scroll every other frame.
    this.fighters.pushApart(this.camera.world);
    this.fighters.keepInView(this.camera);
    if (keyboard.takeRefill()) this.fighters.refill();
    this.fighters.exchangeBlows();
    this.stage.flash(this.fighters.takeFlash());
    const { health, dial } = this.fighters.status();
    this.hud?.tick(health, dial);
    const shake = this.fighters.takeShake();
    if (shake) this.shake.start(shake);
    this.shake.tick();
    this.stage.tick();
    this.fighters.note();
    this.cameraNotes.note(this.camera);
    this.cameraNotes.shake(this.shake.offset);
    tickLog();
    this.effects.update(this.fighters.frozen, this.camera.screen);
    return this.nextMode(keyboard);
  }

  /**
   * `M` steps to the next mode by asking to be rebuilt, which is the machinery
   * the character select already uses — so the address bar always says which
   * setup is running and can be copied straight into a bug report. Everything
   * reloads with it: health, positions and the timeline all start over, which
   * for a written-down situation is the point rather than the price.
   */
  private nextMode(keyboard: Keyboard): SceneRequest | null {
    if (!keyboard.takeModeStep() || this.modes < 2) return null;
    return { ...this.req, scene: "debug", mode: (this.req.mode + 1) % this.modes };
  }

  render(keyboard: Keyboard): void {
    this.hud?.draw();
    this.readouts.draw(keyboard.toggles.get("readout") ? this.fighters.debug() : null);
    this.view.scroll(this.camera.x, this.camera.y);
    this.stage.scroll(this.camera.x, this.camera.y, this.shake.offset);
    this.fighters.render(keyboard.toggles.get("boxes"));
    this.effects.render();
  }

  destroy(): void {
    this.stage.destroy();
    this.fighters.destroy();
    this.effects.destroy();
    this.hud?.destroy();
    this.readouts.destroy();
    for (const notice of this.notices) notice.destroy();
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

/** A fighter's definition, or why it cannot fight. */
async function loadFighter(name: string): Promise<EntityDef | string> {
  const def = await loadEntityDef(name).catch(() => null);
  if (!def) return `Could not load "${name}". Save it from the entity editor first.`;
  if (Object.keys(def.animations).length === 0) return `${def.name}: no animations`;
  return def;
}
