import { Rectangle, Sprite, Texture, type Container } from "pixi.js";
import { BAND_SCREEN, BANDS } from "./bands";

/** The journey's bands on screen: one screen of the exported picture at a time, over the hidden arena. */
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

  /** Null where the export has not drawn them: the journey then crosses a black screen. */
  static async load(): Promise<BandsView | null> {
    const img = new Image();
    img.src = `/api/arena?name=${BANDS.arena}&layer=${BANDS.layer}&time=${BANDS.time}`;
    try {
      await img.decode();
    } catch {
      return null;
    }
    const sheet = Texture.from(img);
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
