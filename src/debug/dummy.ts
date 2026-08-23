import { NO_INPUT, type WorldInput } from "../entity/entity";

/**
 * The debug dummy: what the second fighter does instead of thinking.
 *
 * It is **not** an opponent and not an AI. Its value is that it is repeatable —
 * a recording is evidence only if the other body did exactly the same thing as
 * last time, so nothing here is random and nothing here reacts.
 *
 * What it plays is a **timeline**, written in the mode (`data/debug.json`): a
 * list of steps, each a few tokens saying which inputs and for how many frames.
 * The line that has to hold is that there are **no conditions in it** — the
 * moment a dummy wants "if he blocked, then…" it has become a second state
 * machine beside `states.json`, and that is the point to stop and ask why.
 *
 * Pure: no PixiJS, no entity, no clock of its own.
 */

/** What a mode may say about the dummy. */
export interface Script {
  /** Steps: `"light"`, `"back 30"`, `"up fwd"`, or a bare number of idle frames. */
  does?: (string | number)[];
  /** `always` holds back every frame, on top of whatever `does` is doing. */
  guard?: "never" | "always";
  loop?: boolean;
}

/**
 * Today's dummy as a script: wait, swing, wait, swing. It is the default so a
 * mode that says nothing about the dummy behaves the way `T` always has.
 */
const ROTATION = [90, "light", 90, "medium", 90, "heavy", 90, "special"];

/** Buttons are edges — they fire on the first frame of their step and no more. */
const BUTTONS = ["light", "medium", "heavy", "special"];
/** Directions are held, and two of them are relative to which way the dummy looks. */
const DIRECTIONS = ["fwd", "back", "up", "down"];

/** One parsed step: which input tokens, and how many frames they last. */
interface Step {
  tokens: string[];
  frames: number;
}

export class Dummy {
  private at = 0;
  private frame = 0;

  private constructor(
    private readonly steps: Step[],
    private readonly guarding: boolean,
    private readonly loops: boolean,
  ) {}

  /** Build one from a mode's script, or say what is wrong with the script. */
  static from(script: Script = {}): Dummy | string {
    const steps: Step[] = [];
    for (const raw of script.does ?? ROTATION) {
      const step = parse(raw);
      if (typeof step === "string") return step;
      steps.push(step);
    }
    return new Dummy(steps, script.guard === "always", script.loop ?? true);
  }

  /**
   * One game frame of input.
   *
   * `facing` is the dummy's own, because a script says `back` — away from the
   * opponent — while the world only knows left and right. Switched off, the
   * timeline rewinds rather than pausing: turning the dummy on has to give the
   * same sequence from the beginning every time, or two runs cannot be compared.
   *
   * **`frozen` stops the clock**, and that is what makes a script mean one
   * thing. A hit pause holds the body for ten frames while the world keeps
   * counting, so a timeline that ran through it would drift by ten frames per
   * blow — the same steps would land differently depending on how many of them
   * connected, which is the one thing a dummy exists not to do.
   */
  input({ on, facing, frozen }: { on: boolean; facing: number; frozen: boolean }): WorldInput {
    if (!on) {
      this.at = 0;
      this.frame = 0;
      return NO_INPUT;
    }
    if (frozen) return NO_INPUT;
    const step = this.steps[this.at];
    const first = this.frame === 0;
    this.advance();

    const world = { ...NO_INPUT, holding: { ...NO_INPUT.holding } };
    for (const token of step?.tokens ?? []) {
      // A button is an edge: held for a whole step it would re-press sixty
      // times a second, which is not what one step of "light" means.
      if (BUTTONS.includes(token) && !first) continue;
      press(world, token, facing);
    }
    // Guard sits on top of the timeline: a dummy that swings and blocks between
    // swings is one setup, not two.
    if (this.guarding) press(world, "back", facing);
    return world;
  }

  private advance(): void {
    const step = this.steps[this.at];
    if (!step) return;
    if (++this.frame < step.frames) return;
    this.frame = 0;
    this.at = this.at + 1 >= this.steps.length && this.loops ? 0 : this.at + 1;
  }
}

/** One token into the world's own vocabulary, which knows left and right only. */
function press(world: WorldInput, token: string, facing: number): void {
  switch (token) {
    case "fwd":
      if (facing > 0) world.right = true;
      else world.left = true;
      return;
    case "back":
      if (facing > 0) world.left = true;
      else world.right = true;
      return;
    default:
      // Every other key of WorldInput is a flat boolean; `holding` is the one
      // that is not, and no timeline token names it — the dummy presses, it
      // does not lean on a key.
      world[token as Exclude<keyof WorldInput, "holding">] = true;
  }
}

/**
 * One step of the timeline. Every token is either an input or the number of
 * frames the step lasts, so `"back 30"` holds back for half a second, `"up fwd"`
 * is one frame of both, and a bare `30` is thirty frames of nothing.
 */
function parse(raw: string | number): Step | string {
  const step: Step = { tokens: [], frames: 1 };
  for (const token of String(raw).trim().split(/\s+/).filter(Boolean)) {
    const frames = Number(token);
    if (Number.isInteger(frames)) {
      if (frames < 1) return `"${raw}": a step lasts at least one frame`;
      step.frames = frames;
    } else if (BUTTONS.includes(token) || DIRECTIONS.includes(token)) {
      step.tokens.push(token);
    } else {
      return `"${token}" is not something the dummy can do`;
    }
  }
  return step;
}
