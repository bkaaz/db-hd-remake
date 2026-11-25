import type { Link } from "../combat/chains";
import { HIT_TYPES } from "../combat/hitTypes";
import { labelOf, picksLine, picksOf, readPicks, writePicks } from "../combat/rushAddress";
import { candidates } from "../combat/blowCandidates";
import { CLOSE, ENDERS, RUSH, rushLinks, SLOTS, stepOf, withRush, type BlowAnim, type Picks, type Slot } from "../combat/rushSlots";
import { readData } from "../data/files";
import { BASIC } from "../entity/basics";
import type { StatesFile } from "../entity/states";
import { blowPicker, button, effectPicker, type BlowList } from "./blowPicker";
import { blowThumbs } from "./blowThumb";
import { cartridge } from "../cartridge/romFile";
import { drawFighter } from "../cartridge/romSheets";
import { toCanvas } from "../cartridge/canvas";
import type { FrameDef } from "../entity/entityFile";
import { field, segmented, type Choice } from "./controls";
import { TEMPOS, withTempo } from "../combat/rushTempo";

/** What the panel asks of player one's rush: its picks as the address spells them, and its tempo. */
export interface RushAsk {
  rush?: string;
  tempo?: number;
}

/**
 * Player one's rush under his readout: a blow and an effect for each slot —
 * Attack's A1–A4, Smash's S1–S3 off each depth — what each link between them
 * makes, and the line to hand over. It tries a rush, never keeps one: a pick
 * is the scene's address (`rush1`), as every pick of the bar is (`setup.ts`),
 * and the fighter's data stays as it is.
 */

interface Fighter extends BlowList {
  states: StatesFile;
  hitstun: number;
  frames: Record<string, FrameDef>;
  /** His sheet drawn from the cartridge, for the thumbnails; null until it is. */
  sheet: HTMLCanvasElement | null;
}

export class RushPicks {
  private readonly loaded = new Map<string, Fighter | null>();

  constructor(private readonly redraw: () => void) {}

  /**
   * The slots for `name`, playing the rush and tempo the address asks, his own
   * where it asks none; nothing until his files are read. `go` takes what
   * changes, `undefined` for back to his own.
   */
  fields(name: string, asking: RushAsk, go: (to: RushAsk) => void): HTMLElement[] {
    const f = this.fighter(name);
    if (!f) return [];
    const { rush, tempo = 1 } = asking;
    const pick = (to: string | undefined) => go({ ...asking, rush: to });
    const asked = rush === undefined ? null : readPicks(rush, f.anims, HIT_TYPES);
    const picks = asked && typeof asked !== "string" ? asked : picksOf(f.states);
    const anims = withTempo(f.anims, picks, tempo);
    const made = withRush(f.states, anims, f.hitstun, picks, stepOf(f.states));
    const change = (slot: Slot, to: Picks[Slot]) => pick(writePicks({ ...picks, [slot]: to }));
    // a blow moves a place at a time, by trading with the slot under it in its own row of the tree
    const below = (slot: Slot): Slot | undefined => {
      if (slot === CLOSE) return undefined;
      const row: readonly Slot[] = (RUSH as readonly Slot[]).includes(slot) ? RUSH : ENDERS;
      return row[row.indexOf(slot) + 1];
    };
    const swap = (slot: Slot, other: Slot) => pick(writePicks({ ...picks, [slot]: picks[other], [other]: picks[slot] }));
    const slots = SLOTS.map((slot) => {
      const now = picks[slot];
      const row = document.createElement("span");
      row.className = "stepper";
      row.append(
        blowPicker(now?.anim, f, slot !== RUSH[0], (anim) => change(slot, anim ? { ...now, anim } : undefined)),
        effectPicker(now?.type, now?.type ? undefined : made.states[slot]?.type, !now, (type) => now && change(slot, { anim: now.anim, ...(type && { type }) })),
        swapButton(slot, below(slot), swap),
      );
      return field(labelOf(slot), row);
    });
    const order = (l: Link) => `${labelOf(l.from as Slot).slice(1)}${labelOf(l.to as Slot)}`;
    const links = text(rushLinks(made, anims, f.hitstun).sort((a, b) => order(a).localeCompare(order(b))).map(verdict).join(" · "));
    const pace = segmented(String(tempo), TEMPOS.map((t): Choice => [String(t), `${Math.round(t * 100)}`]), (v) => go({ ...asking, tempo: Number(v) === 1 ? undefined : Number(v) }));
    const handOver = text(picksLine(name, picks));
    handOver.title = "the picks, to hand over";
    const own = segmented(rush === undefined && tempo === 1 ? "own" : "", [["own", "his own"]], () => go({}));
    const preview = blowThumbs(picks, f.anims, f.sheet, f.frames);
    return [...slots, field("blows", preview), field("tempo %", pace), field("links", links), field("rush", handOver), own];
  }

  private fighter(name: string): Fighter | undefined {
    if (!this.loaded.has(name)) {
      this.loaded.set(name, null);
      void load(name).then((f) => {
        this.loaded.set(name, f);
        if (!f) return;
        this.redraw();
        // the lists first; the sheet after, for the thumbnails
        void cartridge().then((rom) => {
          const drawn = drawFighter(rom, name);
          f.sheet = drawn && toCanvas(drawn.sheet);
          this.redraw();
        });
      });
    }
    return this.loaded.get(name) ?? undefined;
  }
}

async function load(name: string): Promise<Fighter | null> {
  const [anims, states, attributes, common, frames] = await Promise.all([
    readData<Record<string, BlowAnim>>(`entities/${name}/animations.json`),
    readData<StatesFile>(`entities/${name}/states.json`),
    readData<{ hitstun: number }>(`entities/${name}/attributes.json`),
    readData<StatesFile>("template/states.json"),
    readData<Record<string, FrameDef>>(`entities/${name}/frames.json`),
  ]);
  if (!anims || !states || !attributes) return null;
  const shared = new Set(Object.values(common?.states ?? {}).map((d) => d.anim));
  const played = new Set([...shared, ...Object.values(states.states).map((d) => d.anim)]);
  const all = candidates(anims, played);
  const basic = (a: string) => a.startsWith(BASIC);
  return {
    anims,
    states,
    hitstun: attributes.hitstun,
    frames: frames ?? {},
    sheet: null,
    basics: all.filter(basic),
    normals: all.filter((a) => !basic(a) && shared.has(a)),
    others: all.filter((a) => !basic(a) && !shared.has(a)),
  };
}

/** ⇅: trade places with the slot under it; none under it, nothing to trade. */
function swapButton(slot: Slot, under: Slot | undefined, swap: (a: Slot, b: Slot) => void): HTMLButtonElement {
  const element = button("⇅", under === undefined, () => under && swap(slot, under));
  element.title = under ? `trade with ${labelOf(under)}` : "";
  return element;
}

function verdict(l: Link): string {
  const how = l.opens > l.closes ? "never opens" : l.margin < 0 ? `drops ${l.margin}` : `+${l.margin}`;
  return `${labelOf(l.from as Slot)}→${labelOf(l.to as Slot)} ${how}`;
}

function text(content: string): HTMLElement {
  const element = document.createElement("code");
  element.textContent = content;
  return element;
}
