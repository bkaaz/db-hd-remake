/**
 * The debug switches — the boxes, the state readout, the dummy's attacks and
 * the recording — in one place, so that a key and the panel's switch are two
 * ways of flipping the same value and each sees what the other did. Three are
 * remembered across a reload; the recording never is, or every reload would
 * start one unasked (owner, ADR 0040).
 */

export type Toggle = "boxes" | "readout" | "dummy" | "recording";

/** Under this key in localStorage, as JSON. */
export const REMEMBERED_TOGGLES = "db-hd-remake.toggles";

const REMEMBERED: readonly Toggle[] = ["boxes", "readout", "dummy"];
const START: Record<Toggle, boolean> = { boxes: true, readout: true, dummy: false, recording: false };

/** What `Toggles` needs of localStorage, so a test can hand it a map. */
export type Memory = Pick<Storage, "getItem" | "setItem">;

export class Toggles {
  private readonly values: Record<Toggle, boolean> = { ...START };
  private readonly listeners: ((toggle: Toggle, on: boolean) => void)[] = [];

  constructor(private readonly memory: Memory | null) {
    const kept = readKept(memory?.getItem(REMEMBERED_TOGGLES) ?? null);
    for (const t of REMEMBERED) if (typeof kept[t] === "boolean") this.values[t] = kept[t];
  }

  get(toggle: Toggle): boolean {
    return this.values[toggle];
  }

  set(toggle: Toggle, on: boolean): void {
    if (this.values[toggle] === on) return;
    this.values[toggle] = on;
    if (REMEMBERED.includes(toggle))
      this.memory?.setItem(REMEMBERED_TOGGLES, JSON.stringify(Object.fromEntries(REMEMBERED.map((t) => [t, this.values[t]]))));
    for (const listen of this.listeners) listen(toggle, on);
  }

  flip(toggle: Toggle): void {
    this.set(toggle, !this.values[toggle]);
  }

  /** Called after every change, from a key or from the panel. */
  onChange(listen: (toggle: Toggle, on: boolean) => void): void {
    this.listeners.push(listen);
  }
}

/** What was kept, or nothing when it does not read — a switch is not worth an error. */
function readKept(text: string | null): Partial<Record<Toggle, unknown>> {
  try {
    const kept: unknown = JSON.parse(text ?? "{}");
    return kept && typeof kept === "object" ? kept : {};
  } catch {
    return {};
  }
}
