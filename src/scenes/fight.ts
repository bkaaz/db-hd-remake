import { withVoices } from "../audio/bank";
import { Audio } from "../audio/playback";
import { soundIdCollisions, validateSounds } from "../audio/sounds";
import { loadEntityDef, type EntityDef } from "../entity/entityDef";
import { effectsNamed, validateStates } from "../entity/states";
import { Effects } from "../fx/effects";
import type { Keyboard } from "../input/keyboard";
import { Fighters } from "../match/fighters";
import type { Scene, SceneContext, SceneRequest } from "../scene";
import { Stage } from "../stage";
import { TrainingFixture } from "../training/fixture";
import { tickLog } from "../log";
import { DebugPanel } from "../ui/debug";
import { Hud, showMessage } from "../ui/hud";
import type { Text } from "pixi.js";

/** SNES sprites are small — scale up, nearest-neighbour. */
const SCALE = 3;

/**
 * The fight: two bodies on a stage, hitting each other.
 *
 * Everything that used to be the body of the game loop lives here, and the
 * order of one game frame is the whole of `step()` — the most instructive four
 * lines in the project, kept in one place on purpose.
 */
export class FightScene implements Scene {
  private readonly fixture = new TrainingFixture();

  private constructor(
    private readonly stage: Stage,
    private readonly fighters: Fighters,
    private readonly effects: Effects,
    private readonly hud: Hud,
    private readonly panel: DebugPanel,
    /** Notices about broken data; they belong to this scene and go with it. */
    private readonly notices: Text[],
  ) {}

  static async create(ctx: SceneContext, req: { p1: string; p2: string }): Promise<Scene | string> {
    const def = await loadEntityDef(req.p1).catch(() => null);
    if (!def) return `Could not load "${req.p1}". Save it from the entity editor first.`;
    if (Object.keys(def.animations).length === 0) return `${def.name}: no animations`;

    // Both bodies are still made from one definition. Two different fighters
    // need two defs and two `Audio`s, because a voice belongs to a fighter —
    // that lands with the character select, which is the first thing that can
    // ask for a pairing. Until then, say so rather than quietly ignoring p2.
    if (req.p2 !== req.p1) {
      console.warn(`[fight] p2="${req.p2}" ignored — both sides are ${req.p1} for now`);
    }

    const notices = reportProblems(ctx, def);

    const effects = await Effects.load(ctx.app, effectsNamed(def.states), SCALE);
    const stage = new Stage(ctx.app);
    const audio = new Audio(withVoices(ctx.bank, def.sounds));
    const fighters = new Fighters({ app: ctx.app, def, scale: SCALE, audio, effects, solo: false });
    fighters.start(stage);
    stage.onResize(() => fighters.fit(stage));

    const noStates = !def.states;
    if (noStates) notices.push(showMessage(ctx.app, `${def.name}: no states.json`, true));
    const hud = new Hud(ctx.app, { name: def.name, belowMessage: noStates });

    return new FightScene(stage, fighters, effects, hud, new DebugPanel(ctx.app), notices);
  }

  /** One game frame, in the order the parts of it have to happen. */
  step(keyboard: Keyboard): SceneRequest | null {
    this.fighters.update(
      keyboard.frame(),
      this.fixture.input(keyboard.dummyAttacks),
      this.stage.bounds,
    );
    this.fighters.pushApart(this.stage.bounds);
    this.fighters.exchangeBlows();
    this.fighters.note();
    tickLog();
    this.effects.update(this.fighters.frozen, this.stage.bounds);
    return null;
  }

  render(keyboard: Keyboard): void {
    this.hud.draw({
      ...this.fighters.status(),
      dummyAttacks: keyboard.dummyAttacks,
      recording: keyboard.recording,
    });
    this.panel.draw(keyboard.showDebug ? this.fighters.debug() : null);
    this.fighters.render(keyboard.showBoxes);
    this.effects.render();
  }

  destroy(): void {
    this.stage.destroy();
    this.fighters.destroy();
    this.effects.destroy();
    this.hud.destroy();
    this.panel.destroy();
    for (const notice of this.notices) notice.destroy();
  }
}

/**
 * Hand-authored data fails quietly, so it is reported loudly.
 *
 * A broken state reference shows on screen because the fight will visibly
 * misbehave; a broken sound only goes silent, which nobody notices until they
 * wonder why one move has no impact.
 */
function reportProblems(ctx: SceneContext, def: EntityDef): Text[] {
  const notices: Text[] = [];
  if (def.states) {
    const { errors, warnings } = validateStates(def.states, def.animations);
    for (const w of warnings) console.warn(`[states] ${w}`);
    for (const e of errors) console.error(`[states] ${e}`);
    if (errors.length > 0) {
      const shown = errors.slice(0, 5).join("\n");
      const rest = errors.length > 5 ? `\n…and ${errors.length - 5} more (see console)` : "";
      notices.push(showMessage(ctx.app, `states.json — ${errors.length} problem(s):\n${shown}${rest}`));
    }
  }
  for (const p of validateSounds(def.sounds)) console.error(`[sounds] ${def.name}: ${p}`);
  for (const p of soundIdCollisions(ctx.bank, def.sounds)) console.error(`[sounds] ${p}`);
  return notices;
}
