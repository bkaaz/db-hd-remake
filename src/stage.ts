import { Graphics, type Container } from "pixi.js";
import { VIEW } from "./view";

/** The original's arena, in game px: 512 wide, the floor at 200 (`rom.md`, The camera). */
export const WORLD = { width: 512, floor: 200 };
/**
 * Whether a blow's `hitFlash` turns the backdrop white, as the original
 * whitens its stage's art. Off until there is an arena to whiten: the
 * placeholder going white is blinding (owner, 2026-10-29).
 */
const SCREEN_FLASH = false;

/** What stands behind the fighters: the debug grid, or an arena (`src/arena/`). */
export interface Backdrop {
  /** Place it for the screen standing at `x`, `y` in the world — each layer at its own speed. */
  scroll(x: number, y: number): void;
  destroy(): void;
}

/**
 * The playfield: how wide the world is, where the floor is, and the backdrop
 * that shows them. Where the screen stands over it is the camera's.
 *
 * It owns those numbers and nothing else — deliberately, the stage does not
 * know there are bodies standing on it. Whoever owns the bodies places them.
 */
export class Stage {
  readonly groundY = WORLD.floor;
  readonly width = WORLD.width;

  /** Over the backdrop and under the fighters, the whole screen: the flash. */
  private readonly white = new Graphics().rect(0, 0, VIEW.width, VIEW.height).fill(0xffffff);
  private flashLeft = 0;

  constructor(
    layer: Container,
    private readonly backdrop: Backdrop,
  ) {
    this.white.visible = false;
    layer.addChild(this.white);
  }

  /** The screen's place in the world, and how far a shake pushes the backdrop's scroll. */
  scroll(x: number, y: number, shake: number): void {
    this.backdrop.scroll(x, y + shake);
  }

  /** A horizontal position as a fraction across the world — 0.5 is the middle. */
  xAt(fraction: number): number {
    return WORLD.width * fraction;
  }

  /** Turn the backdrop white for `frames` — the flash of a big hit. */
  flash(frames: number): void {
    if (SCREEN_FLASH) this.flashLeft = Math.max(this.flashLeft, frames);
  }

  /** One game frame of the flash, if one is running. */
  tick(): void {
    this.white.visible = this.flashLeft > 0;
    if (this.flashLeft > 0) this.flashLeft--;
  }

  destroy(): void {
    this.backdrop.destroy();
    this.white.destroy();
  }
}
