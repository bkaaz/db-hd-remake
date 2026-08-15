import { Container, Graphics, Text, type Application } from "pixi.js";
import { Entity, NO_INPUT, type WorldInput } from "../entity/entity";
import { loadEntityDef } from "../entity/entityDef";
import type { Keyboard } from "../input/keyboard";
import type { Scene, SceneContext, SceneRequest } from "../scene";

/** Small enough that ten of them fit, big enough to tell who is who. */
const SCALE = 2;
const CELL_W = 110;
const CELL_H = 130;
const GAP = 8;

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

  private constructor(
    private readonly app: Application,
    private readonly slots: Slot[],
    private readonly columns: number,
    private readonly labels: Text[],
  ) {
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
    for (const row of grid) {
      for (let c = 0; c < columns; c++) {
        const id = row[c] ?? null;
        const available = !!id && ready.has(id);
        // Only a fighter that exists gets a body; the rest are names on a box.
        const def = available && id ? await loadEntityDef(id).catch(() => null) : null;
        const entity = def && def.animations.idle ? new Entity(def, SCALE) : null;
        entity?.preview("idle");
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
    return new SelectScene(ctx.app, slots, columns, labels);
  }

  step(keyboard: Keyboard): SceneRequest | null {
    const input = keyboard.frame();
    const pressed = (key: keyof WorldInput): boolean => input[key] && !this.was[key];

    if (pressed("right")) this.cursor = (this.cursor + 1) % this.slots.length;
    if (pressed("left")) this.cursor = (this.cursor - 1 + this.slots.length) % this.slots.length;
    if (pressed("down")) this.cursor = (this.cursor + this.columns) % this.slots.length;
    if (pressed("up")) {
      this.cursor = (this.cursor - this.columns + this.slots.length) % this.slots.length;
    }
    this.was = input;

    // Attacks are already edge-triggered, so any of the four confirms.
    const confirm = input.light || input.medium || input.heavy || input.special;
    const slot = this.slots[this.cursor];
    if (confirm && slot.available && slot.id) {
      this.picked.push(slot.id);
      if (this.picked.length === 2) {
        return { scene: "fight", p1: this.picked[0], p2: this.picked[1] };
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

  /** Centre the grid, and put each fighter on the floor of their own cell. */
  private readonly place = (): void => {
    const rows = Math.ceil(this.slots.length / this.columns);
    const width = this.columns * CELL_W + (this.columns - 1) * GAP;
    const left = Math.round((this.app.screen.width - width) / 2);
    const top = Math.round((this.app.screen.height - rows * (CELL_H + GAP)) / 2);

    this.slots.forEach((slot, i) => {
      const { x, y } = this.cellAt(i, left, top);
      this.labels[i].x = x + 6;
      this.labels[i].y = y + CELL_H - 18;
      if (slot.entity) {
        slot.entity.x = x + CELL_W / 2;
        slot.entity.y = y + CELL_H - 24;
        slot.entity.groundY = slot.entity.y;
      }
    });
    this.prompt.x = Math.round(this.app.screen.width / 2);
    this.prompt.y = top - 36;
    this.left = left;
    this.top = top;
  };

  private left = 0;
  private top = 0;

  private cellAt(i: number, left: number, top: number): { x: number; y: number } {
    return {
      x: left + (i % this.columns) * (CELL_W + GAP),
      y: top + Math.floor(i / this.columns) * (CELL_H + GAP),
    };
  }

  private drawFrames(): void {
    this.frames.clear();
    this.slots.forEach((slot, i) => {
      const { x, y } = this.cellAt(i, this.left, this.top);
      this.frames
        .rect(x, y, CELL_W, CELL_H)
        .fill({ color: slot.available ? 0x201828 : 0x18181e })
        .stroke({ color: i === this.cursor ? 0xf0c040 : 0x3a3a48, width: i === this.cursor ? 2 : 1 });
    });
  }
}

async function fetchGrid(): Promise<(string | null)[][] | string> {
  try {
    const res = await fetch("/api/roster");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { grid?: (string | null)[][] };
    if (!Array.isArray(data.grid)) return "data/roster.json has no grid";
    return data.grid;
  } catch (e) {
    return `Could not read data/roster.json — ${String(e)}`;
  }
}

/** What is actually on disk decides what can be picked. */
async function fetchFighters(): Promise<string[]> {
  try {
    const res = await fetch("/api/entities");
    if (!res.ok) return [];
    return ((await res.json()) as { fighters?: string[] }).fighters ?? [];
  } catch {
    return [];
  }
}
