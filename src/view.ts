import { Container, Graphics, type Application } from "pixi.js";

/**
 * The game's screen: the original's size, in the game's pixels. Everything a
 * player sees is drawn into it and nothing outside knows the window's size —
 * which is what keeps changing the size one edit here (ADR 0029).
 */
export const VIEW = { width: 256, height: 224 };

/** How many window pixels one game pixel takes. The only place it is chosen. */
export const SCALE = 3;

/**
 * The screen as a Pixi container, centred in the window and scaled by
 * `SCALE`, with what lies past its edges clipped.
 *
 * Three layers, back to front: the backdrop, the world and the HUD. The
 * world scrolls with the camera, the backdrop's layers each at their own
 * speed and with the shake (`rom.md`, The camera), the HUD not at all.
 */
export class GameView {
  readonly backdrop = new Container();
  readonly world = new Container();
  readonly hud = new Container();

  private readonly screen = new Container();
  private readonly mask = new Graphics().rect(0, 0, VIEW.width, VIEW.height).fill(0xffffff);

  constructor(private readonly app: Application) {
    this.screen.addChild(this.backdrop, this.world, this.hud, this.mask);
    this.screen.mask = this.mask;
    this.screen.scale.set(SCALE);
    app.stage.addChild(this.screen);
    this.centre();
    app.renderer.on("resize", this.centre);
  }

  /**
   * Where the screen's left edge and top stand in the world, in game px. The
   * backdrop is not moved here: its layers scroll at their own speeds
   * (`Stage.scroll`).
   */
  scroll(x: number, y: number): void {
    this.world.position.set(-x, -y);
  }

  destroy(): void {
    this.app.renderer.off("resize", this.centre);
    this.screen.destroy({ children: true });
  }

  private readonly centre = (): void => {
    const { width, height } = this.app.screen;
    this.screen.position.set(
      Math.round((width - VIEW.width * SCALE) / 2),
      Math.round((height - VIEW.height * SCALE) / 2),
    );
  };
}
