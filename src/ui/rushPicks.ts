import type { Link } from "../combat/chains";
import { candidates, picksLine, picksOf, readPicks, rushLinks, SLOTS, stepOf, withRush, type BlowAnim } from "../combat/rushSlots";
import { readData } from "../data/files";
import { BASIC } from "../entity/basics";
import type { StatesFile } from "../entity/states";
import { field, segmented } from "./controls";

/**
 * Player one's rush slots under his readout: three picks of his blows, what
 * each link between them makes, and the line to hand over. It tries a rush,
 * never keeps one — a pick is the scene's address (`rush1`), as every pick of
 * the bar is (`setup.ts`), and the fighter's data stays as it is.
 */

interface Fighter {
  anims: Record<string, BlowAnim>;
  states: StatesFile;
  hitstun: number;
  /** His blows: the basics cut for a rush first, then those the common states play, then the rest. */
  basics: string[];
  normals: string[];
  others: string[];
}

export class RushPicks {
  private readonly loaded = new Map<string, Fighter | null>();

  constructor(private readonly redraw: () => void) {}

  /** The slots for `name`, playing `rush` when the address asks one; nothing until his files are read. */
  fields(name: string, rush: string | undefined, pick: (rush: string | undefined) => void): HTMLElement[] {
    const f = this.fighter(name);
    if (!f) return [];
    const asked = rush === undefined ? null : readPicks(rush, f.anims);
    const picks = asked && typeof asked !== "string" ? asked : picksOf(f.states);
    const slots = SLOTS.map((_, i) =>
      field(`A${i + 1}`, select(picks[i], f, (v) => pick(picks.map((p, j) => (j === i ? v : p)).join(",")))),
    );
    const made = withRush(f.states, f.anims, f.hitstun, picks, stepOf(f.states));
    const links = text(rushLinks(made, f.anims, f.hitstun).map(verdict).join(" · "));
    const handOver = text(picksLine(name, picks));
    handOver.title = "the picks, to hand over";
    const own = segmented(rush === undefined ? "own" : "", [["own", "his own"]], () => pick(undefined));
    return [...slots, field("links", links), field("rush", handOver), own];
  }

  private fighter(name: string): Fighter | undefined {
    if (!this.loaded.has(name)) {
      this.loaded.set(name, null);
      void load(name).then((f) => {
        this.loaded.set(name, f);
        if (f) this.redraw();
      });
    }
    return this.loaded.get(name) ?? undefined;
  }
}

async function load(name: string): Promise<Fighter | null> {
  const [anims, states, attributes, common] = await Promise.all([
    readData<Record<string, BlowAnim>>(`entities/${name}/animations.json`),
    readData<StatesFile>(`entities/${name}/states.json`),
    readData<{ hitstun: number }>(`entities/${name}/attributes.json`),
    readData<StatesFile>("template/states.json"),
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
    basics: all.filter(basic),
    normals: all.filter((a) => !basic(a) && shared.has(a)),
    others: all.filter((a) => !basic(a) && !shared.has(a)),
  };
}

/** The select, and ▲ ▼ beside it for the blow before and after — no list to open and search by eye. */
function select(value: string, f: Fighter, pick: (value: string) => void): HTMLElement {
  const all = [...f.basics, ...f.normals, ...f.others];
  const at = all.indexOf(value);
  const step = (label: string, by: number) => {
    const button = document.createElement("button");
    button.className = "step";
    button.textContent = label;
    const to = all[at + by];
    button.disabled = at < 0 || to === undefined;
    button.addEventListener("click", () => {
      button.blur();
      if (to !== undefined) pick(to);
    });
    return button;
  };
  const row = document.createElement("span");
  row.className = "stepper";
  row.append(list(value, f, pick), step("▲", -1), step("▼", 1));
  return row;
}

/** A select of his blows, the common ones first, each named with the poses it draws. */
function list(value: string, f: Fighter, pick: (value: string) => void): HTMLSelectElement {
  const element = document.createElement("select");
  for (const [label, names] of [["basics", f.basics], ["normals", f.normals], ["others", f.others]] as const) {
    const group = document.createElement("optgroup");
    group.label = label;
    for (const name of names) group.append(new Option(`${name}  ${poses(f.anims[name])}`, name, false, name === value));
    element.append(group);
  }
  if (![...f.basics, ...f.normals, ...f.others].includes(value)) element.append(new Option(`${value} (not a blow)`, value, false, true));
  element.addEventListener("change", () => {
    element.blur();
    pick(element.value);
  });
  return element;
}

/** At most this many poses named, or a long scene's widens the column off the page. */
const POSES_SHOWN = 6;

/** `70>74>70`: the poses in order, a pose held over several steps once; a long one cut with `…`. */
function poses(anim: BlowAnim | undefined): string {
  const drawn = (anim?.steps ?? []).map((s) => s.frame.split("_")[0]);
  const once = drawn.filter((p, i) => p !== drawn[i - 1]);
  return once.slice(0, POSES_SHOWN).join(">") + (once.length > POSES_SHOWN ? ">…" : "");
}

function verdict(l: Link): string {
  const slot = (s: string) => `A${SLOTS.indexOf(s as (typeof SLOTS)[number]) + 1}`;
  const how = l.opens > l.closes ? "never opens" : l.margin < 0 ? `drops ${l.margin}` : `+${l.margin}`;
  return `${slot(l.from)}→${slot(l.to)} ${how}`;
}

function text(content: string): HTMLElement {
  const element = document.createElement("code");
  element.textContent = content;
  return element;
}
