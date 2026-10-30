import { Graphics, type Container } from "pixi.js";
import { WORLD, type Backdrop } from "../stage";
import { VIEW } from "../view";

/** The placeholder's grid, coarse enough to see it scroll. */
const GRID = 32;
/** How far it reaches past the world: above for the camera to rise into, below for a shake. */
const SKY = 32;
const BELOW = 8;

/**
 * The debug scene's arena: a grid over the whole world, darker below the
 * floor — what any scroll looks like, with nothing of the original's in it.
 */
export class GridBackdrop implements Backdrop {
  private readonly g = new Graphics();

  constructor(parent: Container) {
    const { width, floor } = WORLD;
    const { height } = VIEW;
    const g = this.g;
    g.rect(0, -SKY, width, height + SKY + BELOW).fill(0x181824);
    g.rect(0, floor, width, height + BELOW - floor).fill(0x101018);
    for (let x = 0; x <= width; x += GRID) {
      g.moveTo(x, -SKY).lineTo(x, height + BELOW).stroke({ color: x % (GRID * 4) ? 0x24243a : 0x3a3a5a, width: 1 });
    }
    for (let y = floor; y > -SKY; y -= GRID) {
      g.moveTo(0, y).lineTo(width, y).stroke({ color: 0x24243a, width: 1 });
    }
    g.moveTo(0, floor).lineTo(width, floor).stroke({ color: 0x5a5a7a, width: 1 });
    parent.addChild(g);
  }

  scroll(x: number, y: number): void {
    this.g.position.set(-x, -y);
  }

  destroy(): void {
    this.g.destroy();
  }
}
