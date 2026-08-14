import { animationsModified, entitySoundsModified, framesModified } from "./exporter";

/**
 * The rail of things that can be opened: fighters and spawns.
 *
 * Both are entities and every tab works on either — a spawn is an entity is the
 * whole reason the editor needs nothing new to author one (see `decisions.md`,
 * 2026-08-14). The two groups are not decoration: they decide **where the image
 * comes from**. A fighter is cut from a ripped sheet in `assets/sheets/`; a
 * spawn is generated and its atlas is the only picture of it there is.
 */

export type EntityKind = "fighter" | "spawn";

export interface EntityRef {
  kind: EntityKind;
  name: string;
}

/** Where the picture of an entity lives, which is what the two groups encode. */
export function imageUrlFor(ref: EntityRef): string {
  const name = encodeURIComponent(ref.name);
  return ref.kind === "spawn" ? `/api/atlas?name=${name}` : `/api/sheet?name=${name}.png`;
}

let groups: { fighters: string[]; spawns: string[] } = { fighters: [], spawns: [] };
let current: EntityRef | null = null;
let failed = false;
let open: (ref: EntityRef) => void = () => {};

export async function loadEntityList(onOpen: (ref: EntityRef) => void): Promise<void> {
  open = onOpen;
  try {
    const res = await fetch("/api/entities");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    groups = (await res.json()) as typeof groups;
    failed = false;
  } catch {
    groups = { fighters: [], spawns: [] };
    failed = true;
  }
}

/** Remember what is open, so the rail can show it and a reopen is a no-op. */
export function setCurrentEntity(ref: EntityRef | null): void {
  current = ref;
}

export function currentEntity(): EntityRef | null {
  return current;
}

/** Look a name up rather than assume its kind — `?entity=spark_1` is a spawn. */
export function findEntity(name: string): EntityRef | null {
  if (groups.fighters.includes(name)) return { kind: "fighter", name };
  if (groups.spawns.includes(name)) return { kind: "spawn", name };
  return null;
}

/** What to open when the URL does not say: a fighter if there is one. */
export function firstEntity(): EntityRef | null {
  const fighter = groups.fighters[0];
  if (fighter) return { kind: "fighter", name: fighter };
  const spawn = groups.spawns[0];
  return spawn ? { kind: "spawn", name: spawn } : null;
}

/** Which entity sections hold edits that are not on disk, by name. */
export function modifiedSections(): string[] {
  return [
    framesModified() && "frames",
    animationsModified() && "animations",
    entitySoundsModified() && "sounds",
  ].filter((s): s is string => typeof s === "string");
}

export function renderEntityRail(container: HTMLElement): void {
  container.replaceChildren();
  if (failed) {
    container.append(el("p", { className: "err", textContent: "No editor server." }));
    return;
  }
  group(container, "Fighters", "fighter", groups.fighters);
  group(container, "Spawns", "spawn", groups.spawns);
}

function group(container: HTMLElement, title: string, kind: EntityKind, names: string[]): void {
  container.append(el("h4", { className: "dims", textContent: title }));
  if (names.length === 0) {
    container.append(el("p", { className: "hint", textContent: "—" }));
    return;
  }
  for (const name of names) {
    const isCurrent = current?.kind === kind && current.name === name;
    // The dot only ever appears on what is open: nothing else can be dirty,
    // because only one entity is loaded at a time.
    const dirty = isCurrent && modifiedSections().length > 0;
    const item = el("button", {
      className: "rail-item",
      textContent: dirty ? `${name} •` : name,
      title: dirty ? "Unsaved changes" : name,
    });
    if (isCurrent) item.classList.add("active");
    item.addEventListener("click", () => open({ kind, name }));
    container.append(item);
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
): HTMLElementTagNameMap[K] {
  return Object.assign(document.createElement(tag), props);
}
