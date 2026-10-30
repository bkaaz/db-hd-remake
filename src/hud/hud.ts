import { Container, Rectangle, Sprite, Texture } from "pixi.js";
import { barColour, barTiles, digits, stepShown } from "./health";
import type { Cell, HudFile } from "./hudFile";

/** What the HUD reads off the fight each game frame: each side's health and name. */
export interface HudFighter {
  name: string;
  health: number;
}

/**
 * The original's HUD in the game's screen: its band, and the cells the
 * fight rewrites — each side's health as a number and a bar, and its name
 * (`rom.md`, The HUD). Read from `data/hud/` and `assets/hud/`, written by
 * `npm run rom -- export`.
 */
export class Hud {
  private readonly view = new Container();
  /** The health each side shows, trailing the real one. */
  private shown: [number, number | null];
  /** Game frames counted, as the original's frame count paces the bar's flashing. */
  private frame = 0;
  private readonly numbers: Sprite[][] = [];
  private readonly bars: Sprite[][] = [];
  private readonly dials: Sprite[][] = [];
  /** Where each side's charging dial stands. */
  private dial: [number, number | null] = [0, null];
  /** Each tile as drawn in each part's row, cut once. */
  private readonly glyphs = new Map<string, Texture>();

  private constructor(
    parent: Container,
    private readonly file: HudFile,
    private readonly sheet: Texture,
    fighters: [HudFighter, HudFighter | null],
  ) {
    this.view.addChild(new Sprite(this.cut(0, 0, 256, file.band)));
    this.shown = [Math.round(fighters[0].health), fighters[1] && Math.round(fighters[1].health)];
    fighters.forEach((fighter, side) => {
      if (!fighter) return;
      this.numbers.push(this.cells(file.number.at[side], 3, 2));
      this.bars.push(this.cells(file.bar.at[side], 10, 1));
      this.dials.push(file.dial.cells[side].map((at) => this.cells(at, 1, 1)[0]));
      const name = file.names[fighter.name] ?? [];
      this.cells(file.name.at[side], 9, 1).forEach((sprite, i) => (sprite.texture = this.glyph(file.rows.name, name[i] ?? 0)));
    });
    parent.addChild(this.view);
    this.draw();
  }

  /** Read the HUD, or say why there is none. */
  static async load(parent: Container, fighters: [HudFighter, HudFighter | null]): Promise<Hud | string> {
    const res = await fetch("/api/hud");
    if (!res.ok) return "no HUD — run `npm run rom -- export`";
    const file = (await res.json()) as HudFile;
    const img = new Image();
    img.src = "/api/hud?image";
    await img.decode();
    const sheet = Texture.from(img);
    sheet.source.scaleMode = "nearest";
    return new Hud(parent, file, sheet, fighters);
  }

  /** One game frame: the shown health steps toward the real one; the dials stand where charging left them. */
  tick(health: [number, number | null], dial: [number, number | null]): void {
    this.frame++;
    this.dial = dial;
    this.shown = [stepShown(this.shown[0], health[0]), this.shown[1] === null || health[1] === null ? null : stepShown(this.shown[1], health[1])];
  }

  draw(): void {
    this.shown.forEach((shown, side) => {
      if (shown === null) return;
      const { file } = this;
      const number = this.numbers[side];
      digits(shown).forEach((d, i) => {
        number[i].texture = this.glyph(file.rows.number, file.number.tile + 2 * d);
        number[3 + i].texture = this.glyph(file.rows.number, file.number.tile + 2 * d + 1);
      });
      // player two's bar runs from the middle out, right to left ($00:C6A2)
      const tiles = barTiles(shown, file.bar);
      if (side === 1) tiles.reverse();
      const row = file.rows.bar[barColour(shown, this.frame, file.bar.flash)][side];
      tiles.forEach((t, i) => (this.bars[side][i].texture = this.glyph(row, t)));
      const dial = file.dial.tile + 3 * (this.dial[side] ?? 0);
      this.dials[side].forEach((sprite, i) => (sprite.texture = this.glyph(row, dial + i)));
    });
  }

  destroy(): void {
    this.view.destroy({ children: true });
    this.sheet.destroy(true);
  }

  /** `cols` × `rows` sprites on the band's grid from `at`, row by row. */
  private cells([col, row]: Cell, cols: number, rows: number): Sprite[] {
    const out: Sprite[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const sprite = new Sprite();
        sprite.position.set(8 * (col + c), 8 * (row + r));
        this.view.addChild(sprite);
        out.push(sprite);
      }
    }
    return out;
  }

  private glyph(row: number, tile: number): Texture {
    const key = `${row}:${tile}`;
    let texture = this.glyphs.get(key);
    if (!texture) this.glyphs.set(key, (texture = this.cut(8 * tile, row, 8, 8)));
    return texture;
  }

  private cut(x: number, y: number, w: number, h: number): Texture {
    return new Texture({ source: this.sheet.source, frame: new Rectangle(x, y, w, h) });
  }
}
