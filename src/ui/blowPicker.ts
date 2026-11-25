import { HIT_TYPES } from "../combat/hitTypes";
import type { BlowAnim } from "../combat/rushSlots";

/**
 * One slot of the rush panel (`rushPicks.ts`): the blow it plays, with ▲ ▼ for
 * the one before and after — no list to open and search by eye — and how the
 * blow is taken, the rule's unless one is picked.
 */

/** A fighter's blows as the panel lists them: the basics cut for a rush, those the common states play, the rest. */
export interface BlowList {
  anims: Record<string, BlowAnim>;
  basics: string[];
  normals: string[];
  others: string[];
}

/** No blow: the slot is not in the rush. */
const NONE = "";

/** The blow `value` (none when the slot may stay empty), its neighbours a click away. */
export function blowPicker(value: string | undefined, blows: BlowList, mayBeEmpty: boolean, pick: (anim: string | undefined) => void): HTMLElement {
  const all = [...(mayBeEmpty ? [NONE] : []), ...blows.basics, ...blows.normals, ...blows.others];
  const at = all.indexOf(value ?? NONE);
  const choose = (v: string) => pick(v === NONE ? undefined : v);
  const step = (label: string, by: number) => {
    const to = all[at + by];
    return button(label, at < 0 || to === undefined, () => to !== undefined && choose(to));
  };
  const row = document.createElement("span");
  row.className = "stepper";
  row.append(list(value ?? NONE, blows, mayBeEmpty, choose), step("▲", -1), step("▼", 1));
  return row;
}

/** How the blow is taken: the rule's effect, or a hit type picked over it. */
export function effectPicker(value: string | undefined, rule: string | undefined, disabled: boolean, pick: (type: string | undefined) => void): HTMLSelectElement {
  const element = document.createElement("select");
  element.className = "effect";
  element.disabled = disabled;
  // the rule's effect in brackets, a picked one bare
  element.append(new Option(rule ? `(${rule})` : "(rule)", NONE, false, value === undefined));
  for (const type of Object.keys(HIT_TYPES)) element.append(new Option(type, type, false, type === value));
  element.addEventListener("change", () => {
    element.blur();
    pick(element.value === NONE ? undefined : element.value);
  });
  return element;
}

function list(value: string, blows: BlowList, mayBeEmpty: boolean, pick: (value: string) => void): HTMLSelectElement {
  const element = document.createElement("select");
  if (mayBeEmpty) element.append(new Option("—", NONE, false, value === NONE));
  for (const [label, names] of [["basics", blows.basics], ["normals", blows.normals], ["others", blows.others]] as const) {
    const group = document.createElement("optgroup");
    group.label = label;
    for (const name of names) group.append(new Option(`${name}  ${poses(blows.anims[name])}`, name, false, name === value));
    element.append(group);
  }
  if (value !== NONE && ![...blows.basics, ...blows.normals, ...blows.others].includes(value)) {
    element.append(new Option(`${value} (not a blow)`, value, false, true));
  }
  element.addEventListener("change", () => {
    element.blur();
    pick(element.value);
  });
  return element;
}

/** A small button of the panel's rows, which hands the focus back once clicked. */
export function button(label: string, disabled: boolean, act: () => void): HTMLButtonElement {
  const element = document.createElement("button");
  element.className = "step";
  element.textContent = label;
  element.disabled = disabled;
  element.addEventListener("click", () => {
    element.blur();
    act();
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
