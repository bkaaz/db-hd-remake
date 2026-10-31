import "./page.css";
import type { Memory } from "../debug/toggles";
import { VIEW } from "../view";
import { layout, readScale, REMEMBERED_SCALE, type ScaleChoice } from "./scale";

/**
 * The page around the game's screen: the parts our tools are put into, and
 * how big the screen is drawn. The canvas holds the game and nothing else
 * (ADR 0041); the rest is HTML that CSS lays out around it — `index.html`
 * holds the parts, `page.css` places them. Drawing stays the caller's: this
 * file hands the renderer a size and nothing else.
 */
export class Page {
  /** Over the game: what the scene is and where it is fought. */
  readonly setup = part("setup");
  /** Each player's column, left and right: their readout, their picks under it. */
  readonly sides = (["p1", "p2"] as const).map((p) => ({ readout: part(`${p}-readout`), setup: part(`${p}-setup`) }));
  readonly inputs = part("inputs");
  readonly bar = part("bar");
  /** Laid over the game's screen: what went wrong with the scene. */
  readonly notices = part("notices");

  private readonly root = part("page");
  private readonly game = part("game");
  private choice: ScaleChoice;
  private resize: (width: number, height: number) => void = () => {};

  constructor(private readonly memory: Memory | null) {
    this.choice = readScale(memory?.getItem(REMEMBERED_SCALE) ?? null);
  }

  /** Put the canvas in, and size it now and whenever the window changes. */
  mount(canvas: HTMLCanvasElement, resize: (width: number, height: number) => void): void {
    this.game.prepend(canvas);
    this.resize = resize;
    window.addEventListener("resize", this.fit);
    this.fit();
  }

  get scale(): ScaleChoice {
    return this.choice;
  }

  set scale(choice: ScaleChoice) {
    this.choice = choice;
    this.memory?.setItem(REMEMBERED_SCALE, String(choice));
    this.fit();
  }

  private readonly fit = (): void => {
    const room = { width: window.innerWidth, height: window.innerHeight };
    const { scale, sideBySide } = layout(this.choice, room, CHROME, VIEW);
    this.root.classList.toggle("stacked", !sideBySide);
    this.root.style.setProperty("--game-width", `${VIEW.width * scale}px`);
    this.resize(VIEW.width * scale, VIEW.height * scale);
  };
}

/**
 * Window px left for the bars above and below the game when `auto` fits it:
 * two lines of setup, the input strip, the switches, `page.css`'s gaps. A
 * budget, not a measurement — measured, the bars are empty until the panel
 * has loaded, and their height changes with the scale being chosen.
 */
const CHROME = 160;

function part(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`index.html has no #${id}`);
  return element;
}
