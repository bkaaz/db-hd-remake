import { Application, Graphics, Text } from "pixi.js";

/** Everything the status line needs that does not change between frames. */
export interface HudSetup {
  /** Entity name, shown first in the status line. */
  name: string;
  /** Animation being previewed via `?anim=`, or null when the game is running. */
  previewAnim: string | null;
  /** A message already occupies the top line, so the status line moves below it. */
  belowMessage: boolean;
}

/** What the HUD reads off the world once per rendered frame. */
export interface HudFrame {
  playerHealth: number;
  /** Null when there is no opponent — the preview has none. */
  opponentHealth: number | null;
  /** The player's current state, so the name of what you are doing is visible. */
  state: string;
  dummyAttacks: boolean;
}

const BAR_HEIGHT = 14;
const BAR_TOP = 24;
const BAR_INSET = 20;
const BAR_MAX_WIDTH = 320;
const LOW_HEALTH = 0.3;

/**
 * Health bars and the status line.
 *
 * The bars drain **toward the centre**, the way fighters have always drawn
 * them, so the widening gap between the two reads as who is winning without
 * anyone having to compare two numbers.
 */
export class Hud {
  private readonly bars = new Graphics();
  private readonly label: Text;

  constructor(
    private readonly app: Application,
    private readonly setup: HudSetup,
  ) {
    app.stage.addChild(this.bars);
    this.label = new Text({
      text: "",
      style: { fill: "#88aa88", fontFamily: "monospace", fontSize: 14 },
    });
    this.label.x = 8;
    this.label.y = setup.belowMessage ? 28 : 8;
    app.stage.addChild(this.label);
  }

  draw(frame: HudFrame): void {
    this.drawBars(frame);
    this.label.text = this.statusLine(frame);
  }

  private drawBars({ playerHealth, opponentHealth }: HudFrame): void {
    const width = Math.min(BAR_MAX_WIDTH, this.app.screen.width / 2 - 30);
    this.bars.clear();
    this.drawBar(BAR_INSET, width, playerHealth, false);
    if (opponentHealth !== null) {
      this.drawBar(this.app.screen.width - BAR_INSET - width, width, opponentHealth, true);
    }
  }

  private drawBar(x: number, width: number, fraction: number, fromLeft: boolean): void {
    this.bars
      .rect(x, BAR_TOP, width, BAR_HEIGHT)
      .fill({ color: 0x201820 })
      .stroke({ color: 0x6a6a7a, width: 1 });
    const filled = Math.max(0, Math.round(width * fraction));
    if (filled === 0) return;
    this.bars
      .rect(fromLeft ? x : x + width - filled, BAR_TOP, filled, BAR_HEIGHT)
      .fill({ color: fraction > LOW_HEALTH ? 0xf0c040 : 0xd04030 });
  }

  private statusLine({ state, dummyAttacks }: HudFrame): string {
    const { name, previewAnim } = this.setup;
    if (previewAnim) return `${name} · anim ${previewAnim} · [B] boxes`;
    return (
      `${name} · [←/→] walk · [↑] jump · [↓] crouch · [A/S] punch · [Z/X] kick · ` +
      `[B] boxes · [T] dummy attacks: ${dummyAttacks ? "on" : "off"} · state: ${state}`
    );
  }
}

/**
 * A one-off notice drawn straight onto the stage: the entity failed to load, or
 * loaded with something wrong in it. Loud and centred when the game cannot run,
 * small and out of the way at the top when it can.
 */
export function showMessage(app: Application, text: string, subtle = false): void {
  const label = new Text({
    text,
    style: {
      fill: subtle ? "#88aa88" : "#ffaa66",
      fontFamily: "monospace",
      fontSize: subtle ? 14 : 18,
      align: "center",
    },
  });
  label.x = app.screen.width / 2;
  if (subtle) {
    label.anchor.set(0.5, 0);
    label.y = 8;
  } else {
    label.anchor.set(0.5);
    label.y = app.screen.height / 2;
  }
  app.stage.addChild(label);
}
