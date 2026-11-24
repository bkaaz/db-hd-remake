import { Container, Graphics, Text, type Application } from "pixi.js";
import { Entity, NO_INPUT, type WorldInput } from "../entity/entity";
import { loadEntityDef } from "../entity/entityDef";
import { dataDirs, readData } from "../data/files";
import type { Controls } from "../input/controls";
import type { Scene, SceneContext, SceneRequest } from "../scene";
import { reachOf, widest, type Reach } from "./reach";

/** Small enough that ten of them fit, big enough to tell who is who. */
const SCALE = 2;
const GAP = 8;
/** Under a fighter's feet, for his name. */
const LABEL_ROOM = 22;
/** Around him, inside his cell's border. */
const PAD = 6;
/** Over the grid, for the line that says whose pick it is. */
const PROMPT_ROOM = 36;

/** A slot in the grid: a name, and whether there is anything behind it yet. */
interface Slot {
  id: string | null;
  available: boolean;
  entity: Entity | null;
}

/**
 * The character select: a grid of who you could be.
 *
 * The grid comes from `data/roster.json` and is authored, not alphabetical —
 * it names the **whole intended roster**, while `data/entities/` decides what
 * can actually be picked. So a fighter's place is reserved from the start and
 * adding them is adding a directory.
 *
 * Fighters stand in their own slots playing `idle`, which is a stand-in for the
 * portraits that will replace them. It also proves something worth proving:
 * entities load and animate outside a fight.
 */
export class SelectScene implements Scene {
  private readonly view = new Container();
  private readonly frames = new Graphics();
  private readonly prompt: Text;
  private readonly picked: string[] = [];
  private cursor = 0;
  /** Last frame's directions, so a held key moves the cursor once, not always. */
  private was: WorldInput = NO_INPUT;

  /** A cell, sized to hold the widest, tallest fighter: `reach.ts`. */
  private readonly cellW: number;
  private readonly cellH: number;
  /** From a cell's top to the floor its fighter stands on. */
  private readonly floor: number;

  private constructor(
    private readonly app: Application,
    private readonly slots: Slot[],
    private readonly columns: number,
    private readonly labels: Text[],
    reach: Reach,
  ) {
    this.cellW = 2 * (reach.half * SCALE + PAD);
    this.floor = PAD + reach.up * SCALE;
    this.cellH = this.floor + reach.down * SCALE + LABEL_ROOM;
    this.view.addChild(this.frames);
    for (const label of this.labels) this.view.addChild(label);
    for (const slot of this.slots) if (slot.entity) this.view.addChild(slot.entity.view);
    this.prompt = new Text({
      text: "",
      style: { fill: "#e8e8f0", fontFamily: "monospace", fontSize: 16 },
    });
    this.prompt.anchor.set(0.5, 0);
    this.view.addChild(this.prompt);
    app.stage.addChild(this.view);
    app.renderer.on("resize", this.place);
    this.place();
  }

  static async create(ctx: SceneContext): Promise<Scene | string> {
    const grid = await fetchGrid();
    if (typeof grid === "string") return grid;
    const ready = new Set(await fetchFighters());

    const columns = Math.max(...grid.map((row) => row.length));
    const slots: Slot[] = [];
    const labels: Text[] = [];
    const reaches: Reach[] = [];
    for (const row of grid) {
      for (let c = 0; c < columns; c++) {
        const id = row[c] ?? null;
        const available = !!id && ready.has(id);
        // Only a fighter that exists gets a body; the rest are names on a box.
        const def = available && id ? await loadEntityDef(id).catch(() => null) : null;
        // stands as the fight starts him: the cartridge names animations by move, not "idle"
        const standing = def?.states?.states[def.states.initial]?.anim;
        const entity = def && standing && def.animations[standing] ? new Entity(def, SCALE) : null;
        if (entity && standing) {
          entity.preview(standing);
          reaches.push(reachOf(def.animations[standing], def.frames));
        }
        slots.push({ id, available: available && !!entity, entity });
        labels.push(
          new Text({
            text: id ?? "",
            style: {
              fill: available ? "#e8e8f0" : "#6a6a7a",
              fontFamily: "monospace",
              fontSize: 12,
            },
          }),
        );
      }
    }
    if (!slots.some((s) => s.available)) return "No fighters to choose from.";
    return new SelectScene(ctx.app, slots, columns, labels, widest(reaches));
  }

  step(controls: Controls): SceneRequest | null {
    const input = controls.frame();
    const pressed = (key: keyof WorldInput): boolean => input[key] && !this.was[key];

    if (pressed("right")) this.cursor = (this.cursor + 1) % this.slots.length;
    if (pressed("left")) this.cursor = (this.cursor - 1 + this.slots.length) % this.slots.length;
    if (pressed("down")) this.cursor = (this.cursor + this.columns) % this.slots.length;
    if (pressed("up")) {
      this.cursor = (this.cursor - this.columns + this.slots.length) % this.slots.length;
    }
    this.was = input;

    // Attacks are already edge-triggered, so any of the four confirms.
    const confirm = input.attack || input.guard || input.smash || input.blast || input.strike;
    const slot = this.slots[this.cursor];
    if (confirm && slot.available && slot.id) {
      this.picked.push(slot.id);
      if (this.picked.length === 2) {
        // Mode 0 is the everyday setup: a pick from the roster is not asking
        // for a written-down situation, it is asking for two fighters.
        return { scene: "debug", p1: this.picked[0], p2: this.picked[1], mode: 0 };
      }
    }
    for (const s of this.slots) s.entity?.update(NO_INPUT, null, { min: 0, max: 0 });
    return null;
  }

  render(): void {
    this.prompt.text =
      this.picked.length === 0
        ? "Player 1 — arrows to move, any attack to choose"
        : `Player 1: ${this.picked[0]}   ·   Player 2 — choose`;
    this.drawFrames();
    for (const slot of this.slots) slot.entity?.render(false);
  }

  destroy(): void {
    this.app.renderer.off("resize", this.place);
    this.view.destroy({ children: true });
  }

  /**
   * Centre the grid, and put each fighter on the floor of their own cell. The
   * canvas is the game's screen at the page's scale (ADR 0041); a grid wider
   * than it is shrunk to fit — this screen is a stand-in, and a fraction of a
   * scale blurring it is cheaper than a second layout.
   */
  private readonly place = (): void => {
    const rows = Math.ceil(this.slots.length / this.columns);
    const width = this.columns * this.cellW + (this.columns - 1) * GAP;
    const height = PROMPT_ROOM + rows * (this.cellH + GAP);
    const { width: screenW, height: screenH } = this.app.screen;
    const shrink = Math.min(1, screenW / width, screenH / height);
    this.view.scale.set(shrink);
    const left = Math.round((screenW / shrink - width) / 2);
    const top = Math.round((screenH / shrink - height) / 2) + PROMPT_ROOM;

    this.slots.forEach((slot, i) => {
      const { x, y } = this.cellAt(i, left, top);
      this.labels[i].x = x + 6;
      this.labels[i].y = y + this.cellH - 18;
      if (slot.entity) {
        slot.entity.x = x + this.cellW / 2;
        slot.entity.y = y + this.floor;
        slot.entity.groundY = slot.entity.y;
      }
    });
    this.prompt.x = Math.round(screenW / shrink / 2);
    this.prompt.y = top - PROMPT_ROOM;
    this.left = left;
    this.top = top;
  };

  private left = 0;
  private top = 0;

  private cellAt(i: number, left: number, top: number): { x: number; y: number } {
    return {
      x: left + (i % this.columns) * (this.cellW + GAP),
      y: top + Math.floor(i / this.columns) * (this.cellH + GAP),
    };
  }

  private drawFrames(): void {
    this.frames.clear();
    this.slots.forEach((slot, i) => {
      const { x, y } = this.cellAt(i, this.left, this.top);
      this.frames
        .rect(x, y, this.cellW, this.cellH)
        .fill({ color: slot.available ? 0x201828 : 0x18181e })
        .stroke({ color: i === this.cursor ? 0xf0c040 : 0x3a3a48, width: i === this.cursor ? 2 : 1 });
    });
  }
}

async function fetchGrid(): Promise<(string | null)[][] | string> {
  try {
    const data = await readData<{ grid?: (string | null)[][] }>("roster.json");
    if (!data) return "there is no data/roster.json";
    if (!Array.isArray(data.grid)) return "data/roster.json has no grid";
    return data.grid;
  } catch (e) {
    return `Could not read data/roster.json — ${String(e)}`;
  }
}

/** What is actually in data/ decides what can be picked. */
async function fetchFighters(): Promise<string[]> {
  return dataDirs("entities");
}
