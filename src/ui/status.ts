import { Application, Text } from "pixi.js";

/** Everything the status line needs that does not change between frames. */
export interface StatusSetup {
  /** Entity name, shown first in the status line. */
  name: string;
  /** A message already occupies the top line, so the status line moves below it. */
  belowMessage: boolean;
}

/** What the status line reads off the world once per rendered frame. */
export interface StatusFrame {
  /** The player's ki meter, 0..1 — here until the original's HUD shows it. */
  playerKi: number;
  /** The player's current state, so the name of what you are doing is visible. */
  state: string;
  dummyAttacks: boolean;
  /** A gameplay recording is running — worth seeing, since it writes a file. */
  recording: boolean;
}

/**
 * The keys and what the debug scene is doing, in a line over the window —
 * ours, not the game's, so outside the game's screen in window px. The
 * game's own HUD is `src/hud/`.
 */
export class StatusLine {
  private readonly label: Text;

  constructor(
    app: Application,
    private readonly setup: StatusSetup,
  ) {
    this.label = new Text({
      text: "",
      style: { fill: "#88aa88", fontFamily: "monospace", fontSize: 14 },
    });
    this.label.x = 8;
    this.label.y = setup.belowMessage ? 28 : 8;
    app.stage.addChild(this.label);
  }

  draw({ playerKi, state, dummyAttacks, recording }: StatusFrame): void {
    this.label.text =
      `${this.setup.name} · [←/→] walk · [↑] jump · [↓] crouch · [A] attack [S] smash [X] ki [Z] guard · [A+Z] charge · ` +
      `[B] boxes · [D] debug · [L] record: ${recording ? "ON" : "off"} · [T] dummy: ${dummyAttacks ? "on" : "off"} · ` +
      `ki ${Math.round(100 * playerKi)}% · state: ${state}`;
  }

  destroy(): void {
    this.label.destroy();
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
