import type { Application } from "pixi.js";
import { Graphics } from "pixi.js";
import type { Bounds } from "./combat/push";

/** How far from the edge of the window a fighter may walk. */
const EDGE_MARGIN = 40;
/** The floor sits four fifths down, leaving room above for jumps and the HUD. */
const GROUND_FRACTION = 0.8;

/**
 * The playfield: where the floor is, how far a fighter may walk, and the line
 * that shows the floor.
 *
 * It owns those numbers and nothing else — deliberately, the stage does not
 * know there are bodies standing on it. Whoever owns the bodies places them,
 * so a resize never reaches through here to move a fighter.
 */
export class Stage {
  groundY = 0;
  bounds: Bounds = { min: EDGE_MARGIN, max: EDGE_MARGIN };

  private readonly ground = new Graphics();
  private readonly resized: (() => void)[] = [];

  constructor(private readonly app: Application) {
    app.stage.addChild(this.ground);
    this.measure();
    app.renderer.on("resize", this.handleResize);
  }

  /** Run `fn` after each resize, once the new floor and edges are known. */
  onResize(fn: () => void): void {
    this.resized.push(fn);
  }

  /** A horizontal position as a fraction across the field — 0.5 is the middle. */
  xAt(fraction: number): number {
    return this.app.screen.width * fraction;
  }

  /** Give the window back its listener; a stage that outlives its scene moves ghosts. */
  destroy(): void {
    this.app.renderer.off("resize", this.handleResize);
    this.ground.destroy();
    this.resized.length = 0;
  }

  private readonly handleResize = (): void => {
    this.measure();
    for (const fn of this.resized) fn();
  };

  private measure(): void {
    const { width, height } = this.app.screen;
    this.groundY = Math.round(height * GROUND_FRACTION);
    this.bounds = { min: EDGE_MARGIN, max: Math.max(EDGE_MARGIN, width - EDGE_MARGIN) };
    this.ground
      .clear()
      .moveTo(0, this.groundY)
      .lineTo(width, this.groundY)
      .stroke({ color: 0x333340, width: 1 });
  }
}
