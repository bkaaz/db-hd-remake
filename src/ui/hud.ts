import { Application, Graphics, Text, type Container } from "pixi.js";
import { VIEW } from "../view";

/** Everything the status line needs that does not change between frames. */
export interface HudSetup {
  /** Entity name, shown first in the status line. */
  name: string;
  /** A message already occupies the top line, so the status line moves below it. */
  belowMessage: boolean;
}

/** What the HUD reads off the world once per rendered frame. */
export interface HudFrame {
  playerHealth: number;
  /** The player's ki meter, 0..1. A separate pool from health — see combat.md. */
  playerKi: number;
  /** Null when there is no opponent — the preview has none. */
  opponentHealth: number | null;
  /** The player's current state, so the name of what you are doing is visible. */
  state: string;
  dummyAttacks: boolean;
  /** A gameplay recording is running — worth seeing, since it writes a file. */
  recording: boolean;
}

/** The bars are in game px, inside the game's screen; the gap between them is twice the inset. */
const BAR_HEIGHT = 5;
const BAR_TOP = 8;
const BAR_INSET = 8;
const BAR_WIDTH = VIEW.width / 2 - 2 * BAR_INSET;
const LOW_HEALTH = 0.3;
/**
 * The ki meter, under the player's health and deliberately unlike it: half the
 * height, blue, and it fills from the left rather than draining toward the
 * centre. Two bars that look alike and move oppositely is how somebody reads
 * "nearly dead" off a full meter.
 */
const KI_HEIGHT = 2;
const KI_GAP = 1;

/**
 * Health bars, in the game's screen, and the status line, which is ours and
 * stays outside it in window px.
 *
 * The bars drain **toward the centre**, the way fighters have always drawn
 * them, so the widening gap between the two reads as who is winning without
 * anyone having to compare two numbers.
 */
export class Hud {
  private readonly bars = new Graphics();
  private readonly label: Text;

  constructor(
    app: Application,
    screen: Container,
    private readonly setup: HudSetup,
  ) {
    screen.addChild(this.bars);
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

  destroy(): void {
    this.bars.destroy();
    this.label.destroy();
  }

  private drawBars({ playerHealth, playerKi, opponentHealth }: HudFrame): void {
    this.bars.clear();
    this.drawBar(BAR_INSET, BAR_WIDTH, playerHealth, false);
    this.drawKi(BAR_INSET, BAR_WIDTH, playerKi);
    if (opponentHealth !== null) {
      this.drawBar(VIEW.width - BAR_INSET - BAR_WIDTH, BAR_WIDTH, opponentHealth, true);
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

  private drawKi(x: number, width: number, fraction: number): void {
    const y = BAR_TOP + BAR_HEIGHT + KI_GAP;
    this.bars
      .rect(x, y, width, KI_HEIGHT)
      .fill({ color: 0x101828 })
      .stroke({ color: 0x4a5a7a, width: 1 });
    const filled = Math.max(0, Math.round(width * fraction));
    if (filled > 0) this.bars.rect(x, y, filled, KI_HEIGHT).fill({ color: 0x4aa8f0 });
  }

  private statusLine({ state, dummyAttacks, recording }: HudFrame): string {
    const { name } = this.setup;
    return (
      `${name} · [←/→] walk · [↑] jump · [↓] crouch · [A] attack [S] smash [X] ki [Z] guard · [A+Z] charge · ` +
      `[B] boxes · [D] debug · [L] record: ${recording ? "ON" : "off"} · [T] dummy: ${dummyAttacks ? "on" : "off"} · state: ${state}`
    );
  }
}

/**
 * A one-off notice drawn straight onto the stage: the entity failed to load, or
 * loaded with something wrong in it. Loud and centred when the game cannot run,
 * small and out of the way at the top when it can.
 */
export function showMessage(app: Application, text: string, subtle = false): Text {
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
  return label;
}
