import { Rectangle, Sprite, Texture, type Container } from "pixi.js";
import { BAND_SCREEN } from "./bands";
import { cartridge } from "../cartridge/romFile";
import { bandsImage } from "../cartridge/romBackdrops";
import { toCanvas } from "../cartridge/canvas";

/** The journey's bands on screen: one screen of the picture at a time, over the hidden arena. */
export class BandsView {
  private sprite: Sprite | null = null;
  private readonly screens: Texture[];

  private constructor(private readonly sheet: Texture) {
    const count = sheet.height / BAND_SCREEN.height;
    this.screens = Array.from(
      { length: count },
      (_, i) => new Texture({ source: sheet.source, frame: new Rectangle(0, i * BAND_SCREEN.height, BAND_SCREEN.width, BAND_SCREEN.height) }),
    );
  }

  /** Every screen of them, drawn from the cartridge (ADR 0090). */
  static async load(): Promise<BandsView> {
    const sheet = Texture.from(toCanvas(bandsImage(await cartridge())));
    sheet.source.scaleMode = "nearest";
    return new BandsView(sheet);
  }

  /** Show screen `n`, or nothing. Put over whatever `parent` holds when first shown, so over the black. */
  show(parent: Container, n: number | null): void {
    if (n === null) {
      if (this.sprite) this.sprite.visible = false;
      return;
    }
    if (!this.sprite) {
      this.sprite = new Sprite(this.screens[n]);
      parent.addChild(this.sprite);
    }
    this.sprite.texture = this.screens[n];
    this.sprite.visible = true;
  }

  destroy(): void {
    this.sprite?.destroy();
    for (const t of this.screens) t.destroy();
    this.sheet.destroy(true);
  }
}
