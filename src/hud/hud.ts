import { Container, Sprite, Texture } from "pixi.js";
import { stepShown } from "./health";
import { drawPanel, PANEL_HEIGHT } from "./panel";
import { cartridge } from "../cartridge/romFile";
import { toCanvas } from "../cartridge/canvas";
import { readData } from "../data/files";
import { drawPortrait } from "../rom/portrait";
import { ROSTER } from "../rom/roster";

/** What the HUD reads off the fight: each side's name and health. */
export interface HudFighter {
  name: string;
  health: number;
}

/** `data/hud/faces.json`: where each fighter's face sits in his portrait, the top left of 32 × 32. */
type FacesFile = Record<string, [number, number]>;

/** The names the HUD writes; a fighter not listed goes by his entity's name. */
const NAMES: Record<string, string> = {
  goku: "Goku", vegeta: "Vegeta", gohan: "Gohan", gotenks: "Gotenks", vegetto: "Vegetto",
  piccolo: "Piccolo", freeza: "Frieza", cell: "Cell", mr_buu: "Majin Buu", buu: "Kid Buu",
};
const FACE = 32;

/**
 * The HUD (ADR 0032): both corners drawn on one canvas in the game's pixels
 * (`panel.ts`) and shown as a texture over the fight. Each frame it takes the
 * health and ki; the health it shows trails the real one as the original's does.
 */
export class Hud {
  private readonly canvas = document.createElement("canvas");
  private readonly g: CanvasRenderingContext2D;
  private readonly texture: Texture;
  private readonly sprite: Sprite;
  private shown: (number | null)[];
  private ki: (number | null)[] = [0, null];
  /** Game frames counted: they pace the last layer's flashing. */
  private frame = 0;

  private constructor(
    parent: Container,
    private readonly fighters: [HudFighter, HudFighter | null],
    private readonly faces: (HTMLCanvasElement | null)[],
  ) {
    this.canvas.width = 256;
    this.canvas.height = PANEL_HEIGHT;
    this.g = this.canvas.getContext("2d")!;
    this.texture = Texture.from(this.canvas);
    this.texture.source.scaleMode = "nearest";
    this.sprite = new Sprite(this.texture);
    parent.addChild(this.sprite);
    this.shown = fighters.map((f) => (f ? Math.round(f.health) : null));
    this.draw();
  }

  /** The HUD with each fighter's face cut from his portrait on the cartridge (`rom/portrait.ts`). */
  static async load(parent: Container, fighters: [HudFighter, HudFighter | null]): Promise<Hud> {
    const rom = await cartridge();
    const windows = (await readData<FacesFile>("hud/faces.json")) ?? {};
    const faces = fighters.map((f) => {
      const n = f ? ROSTER.indexOf(f.name as (typeof ROSTER)[number]) : -1;
      const at = f && windows[f.name];
      if (n < 0 || !at) return null;
      const face = document.createElement("canvas");
      face.width = face.height = FACE;
      const g = face.getContext("2d")!;
      g.fillStyle = "#000";
      g.fillRect(0, 0, FACE, FACE);
      g.drawImage(toCanvas(drawPortrait(rom, n)), -at[0], -at[1]);
      return face;
    });
    return new Hud(parent, fighters, faces);
  }

  /** One game frame: the shown health steps toward the real one; ki is shown as it is. */
  tick(health: [number, number | null], ki: [number, number | null]): void {
    this.frame++;
    this.shown = this.shown.map((s, side) => (s === null || health[side] === null ? null : stepShown(s, health[side]!)));
    this.ki = ki;
  }

  draw(): void {
    this.g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.fighters.forEach((f, side) => {
      const shown = this.shown[side];
      if (!f || shown === null) return;
      const name = NAMES[f.name] ?? f.name;
      drawPanel(this.g, side as 0 | 1, { name, face: this.faces[side], shown, ki: this.ki[side] ?? 0, frame: this.frame });
    });
    this.texture.source.update();
  }

  destroy(): void {
    this.sprite.destroy();
    this.texture.destroy(true);
  }
}
