import { Graphics, type Container } from "pixi.js";
import { VIEW } from "./view";

/** The original's arena, in game px: 512 wide, the floor at 200 (`rom.md`, The camera). */
const WORLD_WIDTH = 512;
const FLOOR_Y = 200;
/**
 * Whether a blow's `hitFlash` turns the backdrop white, as the original
 * whitens its stage's art. Off until there is an arena to whiten: the
 * placeholder going white is blinding (owner, 2026-10-29).
 */
const SCREEN_FLASH = false;

/** The placeholder's grid, coarse enough to see it scroll. */
const GRID = 32;
/** How far the backdrop reaches past the screen: above for the camera to rise into, below for a shake. */
const SKY = 32;
const BELOW = 8;

/**
 * The playfield: how wide the world is, where the floor is, and the backdrop
 * that shows them. Where the screen stands over it is the camera's.
 *
 * It owns those numbers and nothing else — deliberately, the stage does not
 * know there are bodies standing on it. Whoever owns the bodies places them.
 */
export class Stage {
  readonly groundY = FLOOR_Y;
  readonly width = WORLD_WIDTH;

  private readonly art = new Graphics();
  private readonly white = new Graphics().rect(0, -SKY, WORLD_WIDTH, VIEW.height + SKY + BELOW).fill(0xffffff);
  private flashLeft = 0;

  constructor(backdrop: Container) {
    drawPlaceholder(this.art);
    this.white.visible = false;
    backdrop.addChild(this.art, this.white);
  }

  /** A horizontal position as a fraction across the world — 0.5 is the middle. */
  xAt(fraction: number): number {
    return WORLD_WIDTH * fraction;
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
    this.art.destroy();
    this.white.destroy();
  }
}

/** A grid over the whole world, darker below the floor, and the floor's line. */
function drawPlaceholder(g: Graphics): void {
  g.rect(0, -SKY, WORLD_WIDTH, VIEW.height + SKY + BELOW).fill(0x181824);
  g.rect(0, FLOOR_Y, WORLD_WIDTH, VIEW.height + BELOW - FLOOR_Y).fill(0x101018);
  for (let x = 0; x <= WORLD_WIDTH; x += GRID) {
    g.moveTo(x, -SKY).lineTo(x, VIEW.height + BELOW).stroke({ color: x % (GRID * 4) ? 0x24243a : 0x3a3a5a, width: 1 });
  }
  for (let y = FLOOR_Y; y > -SKY; y -= GRID) {
    g.moveTo(0, y).lineTo(WORLD_WIDTH, y).stroke({ color: 0x24243a, width: 1 });
  }
  g.moveTo(0, FLOOR_Y).lineTo(WORLD_WIDTH, FLOOR_Y).stroke({ color: 0x5a5a7a, width: 1 });
}
