import { Audio } from "../../../src/audio/playback";
import { validateSounds, type Sounds, type SoundSpec } from "../../../src/audio/sounds";
import { saveSounds } from "./exporter";
import { state } from "./store";

/**
 * The two sound panels: the game's bank, and the loaded entity's own sounds.
 *
 * Same panel twice, because the two files have the same shape and the same
 * validator. What differs is **scope**, which is also why they are two tabs
 * rather than one: the bank exists whatever is loaded, an entity's sounds
 * arrive and leave with the entity, and the editor's rule is that the active
 * tab decides which file Save writes. One panel over two files would have to
 * guess that from the selection.
 *
 * Which sound a *state* plays is still typed into `states.json` by hand; these
 * tabs exist to find the id and hear what it is.
 *
 * Playback reuses the game's own `Audio` — plain Web Audio, no PixiJS. Hearing
 * a variant is the whole point of keeping variants: `swing_2` and `swing_3`
 * differ by ear and by nothing else.
 */

/** A new sound has to be playable and valid the moment it exists. */
const BLANK: SoundSpec = { kind: "noise", freq: 800, decay: 0.1, gain: 0.3, vary: 0.05 };

/** Where one panel's sounds come from and where Save puts them back. */
interface Source {
  /** The map to edit, or null when there is nothing to edit yet. */
  read(): Sounds | null;
  /** Called after the map is replaced wholesale, so the owner can keep up. */
  write(sounds: Sounds): void;
  save(): Promise<string>;
  /** Shown in place of the panel when `read()` is null. */
  missing: string;
}

class SoundPanel {
  private selected: string | null = null;
  private audio = new Audio({});

  constructor(
    private readonly panelId: string,
    private readonly source: Source,
  ) {}

  /** Point the player at the current map: `Audio` caches samples per map. */
  refresh(): void {
    this.audio = new Audio(this.source.read() ?? {});
    const ids = this.ids();
    if (!this.selected || !ids.includes(this.selected)) this.selected = ids[0] ?? null;
  }

  save(): Promise<string> {
    return this.source.save();
  }

  render(container: HTMLElement): void {
    container.replaceChildren();
    const sounds = this.source.read();
    if (!sounds) {
      container.append(el("p", { className: "hint", textContent: this.source.missing }));
      return;
    }

    container.append(this.toolbar(sounds));
    for (const p of validateSounds(sounds)) {
      container.append(el("p", { className: "err msg", textContent: `• ${p}` }));
    }
    if (this.selected && sounds[this.selected]) {
      container.append(this.fields(sounds[this.selected], this.selected));
    }
    container.append(el("hr"));
    container.append(this.auditionList());
  }

  /** Which sound the fields edit, and the three things you can do to the set. */
  private toolbar(sounds: Sounds): HTMLElement {
    const picker = el("select", { title: "The sound these fields edit" });
    for (const id of this.ids()) {
      const label = sounds[id].label;
      picker.append(el("option", { value: id, textContent: label ? `${id} — ${label}` : id }));
    }
    if (this.selected) picker.value = this.selected;
    picker.addEventListener("change", () => {
      this.selected = picker.value;
      this.rerender();
    });

    const add = el("button", {
      className: "tab",
      textContent: "+ Add",
      title: "A new sound from scratch, in a category you name",
    });
    add.addEventListener("click", () => this.addSound());

    const clone = el("button", {
      className: "tab",
      textContent: "Clone",
      title: "Another variant of the selected sound, copied from it",
    });
    clone.disabled = !this.selected;
    clone.addEventListener("click", () => this.cloneSelected());

    const remove = el("button", { className: "tab", textContent: "Remove" });
    remove.disabled = !this.selected;
    remove.addEventListener("click", () => this.removeSelected());

    return el("div", { className: "row sound-pick" }, [picker, add, clone, remove]);
  }

  /** Editing mutates the map in place, so ▶ plays the change immediately. */
  private fields(spec: SoundSpec, id: string): HTMLElement {
    const box = el("div", { className: "card" });
    box.append(text("label", spec.label ?? "", (v) => (spec.label = v || undefined)));
    box.append(
      choice("kind", spec.kind ?? "", (v) => {
        spec.kind = v === "" ? undefined : (v as "noise" | "tone");
      }),
    );
    box.append(number("freq (Hz)", spec.freq, 1, (v) => (spec.freq = v)));
    box.append(number("decay (s)", spec.decay, 0.01, (v) => (spec.decay = v)));
    box.append(number("gain", spec.gain, 0.01, (v) => (spec.gain = v ?? 0)));
    box.append(number("vary", spec.vary, 0.01, (v) => (spec.vary = v)));
    // Changing the file invalidates the decoded sample the player is holding.
    box.append(
      text("file (.wav in assets/audio/sfx)", spec.file ?? "", (v) => {
        spec.file = v || undefined;
        this.refresh();
      }),
    );

    const play = el("button", { className: "tab", textContent: `▶ ${id}` });
    play.addEventListener("click", () => this.audio.play(id));
    box.append(play);
    return box;
  }

  /** Every sound as one button: hear it, and the fields above switch to it. */
  private auditionList(): HTMLElement {
    const list = el("div", { className: "row" });
    for (const id of this.ids()) {
      const item = el("button", {
        className: "tab",
        textContent: `▶ ${id}`,
        title: `Play ${id} and edit it above`,
      });
      if (id === this.selected) item.classList.add("active");
      item.addEventListener("click", () => {
        this.selected = id;
        this.audio.play(id);
        this.rerender();
      });
      list.append(item);
    }
    return list;
  }

  /** A brand-new sound: you name the category, the number is ours to hand out. */
  private addSound(): void {
    const answer = prompt(
      "Category for the new sound (e.g. swing, hit, whoosh):",
      categoryOf(this.selected ?? ""),
    );
    if (answer === null) return;
    const category = answer.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!category) return;
    this.put(this.nextIn(category), { ...BLANK, label: `${category}, new` });
  }

  /** Another of what you are hearing, so tuning a sibling starts from it. */
  private cloneSelected(): void {
    const sounds = this.source.read();
    if (!this.selected || !sounds) return;
    const from = sounds[this.selected];
    const category = categoryOf(this.selected);
    this.put(this.nextIn(category), { ...from, label: `${from.label ?? category} (copy)` });
  }

  private removeSelected(): void {
    const sounds = this.source.read();
    if (!this.selected || !sounds) return;
    // Nothing yet checks that states.json still resolves every sound it names,
    // so deleting one can silence a move with no warning anywhere.
    const ok = confirm(
      `Delete "${this.selected}"?\n\nAny state naming it will go silent — nothing checks that yet.`,
    );
    if (!ok) return;
    delete sounds[this.selected];
    this.selected = null;
    this.refresh();
    this.rerender();
  }

  private put(id: string, spec: SoundSpec): void {
    const sounds = this.source.read();
    if (!sounds) return;
    sounds[id] = spec;
    this.source.write(sounds);
    this.selected = id;
    this.refresh();
    this.selected = id;
    this.rerender();
  }

  /**
   * The next number in a category, never one that was freed. Ids are
   * append-only because `states.json` names them: reusing `swing_2` after
   * deleting it would silently repoint every state that asked for the old one.
   */
  private nextIn(category: string): string {
    const used = this.ids()
      .filter((id) => categoryOf(id) === category)
      .map((id) => Number(/_(\d+)$/.exec(id)?.[1] ?? 0));
    return `${category}_${Math.max(0, ...used) + 1}`;
  }

  /** A key starting with "_" is a note to a reader, not a sound. */
  private ids(): string[] {
    return Object.keys(this.source.read() ?? {}).filter((id) => !id.startsWith("_"));
  }

  /** Only ever redraws this panel; the rest of the editor is not ours to touch. */
  private rerender(): void {
    const panel = document.getElementById(this.panelId);
    if (panel) this.render(panel);
  }
}

// --- the game's bank -----------------------------------------------------

let bank: Sounds = {};
let bankError: string | null = null;

const globalPanel = new SoundPanel("global-sounds-panel", {
  read: () => (bankError ? null : bank),
  write: (sounds) => (bank = sounds),
  save: saveBank,
  missing: `Could not read data/audio/sounds.json — ${bankError ?? "unknown error"}`,
});

/** Read the bank from disk. Called once at start-up. */
export async function loadBank(): Promise<void> {
  try {
    const res = await fetch("/api/sounds");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    bank = (await res.json()) as Sounds;
    bankError = null;
  } catch (e) {
    bank = {};
    bankError = String(e);
  }
  globalPanel.refresh();
}

/**
 * Write the whole bank back. Problems are reported rather than blocking: a
 * half-tuned sound is a normal thing to save, and the game reports the same
 * faults at load. Saying nothing is what would be wrong.
 */
async function saveBank(): Promise<string> {
  const problems = validateSounds(bank);
  try {
    const res = await fetch("/api/sounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: bank }),
    });
    const body = (await res.json()) as { error?: string };
    if (!res.ok) return `Save failed — ${body.error ?? res.status}`;
    return problems.length === 0
      ? "Saved data/audio/sounds.json."
      : `Saved with ${problems.length} problem(s): ${problems[0]}`;
  } catch (e) {
    return `Save failed — ${String(e)}`;
  }
}

// --- the loaded entity's own sounds --------------------------------------

const entityPanel = new SoundPanel("entity-sounds-panel", {
  // An entity already loaded but with no sounds.json yet gets an empty map to
  // fill — adding the first sound is how that file comes into existence. With
  // nothing loaded there is no map at all: the entity name still defaults to
  // "entity", and saving would quietly create data/entities/entity/sounds.json.
  read: () => (entityLoaded() ? (state.sounds ??= {}) : null),
  write: (sounds) => (state.sounds = sounds),
  save: async () => (await saveSounds()).message,
  missing: "Load an entity first — its sounds are saved next to its frames.",
});

/** Something is on the canvas or came off disk, so `state.entityName` is real. */
function entityLoaded(): boolean {
  return state.frames.length > 0 || state.sounds !== null || state.states !== null;
}

export function renderGlobalSounds(container: HTMLElement): void {
  globalPanel.render(container);
}

export function renderEntitySounds(container: HTMLElement): void {
  entityPanel.refresh();
  entityPanel.render(container);
}

export function saveGlobalSounds(): Promise<string> {
  return globalPanel.save();
}

export function saveEntitySounds(): Promise<string> {
  return entityPanel.save();
}

// --- fields --------------------------------------------------------------

function text(label: string, value: string, set: (v: string) => void): HTMLElement {
  const input = el("input", { type: "text", value });
  input.addEventListener("input", () => set(input.value));
  return field(label, input);
}

function number(
  label: string,
  value: number | undefined,
  step: number,
  set: (v: number | undefined) => void,
): HTMLElement {
  const input = el("input", { type: "number", step: String(step), value: String(value ?? "") });
  input.addEventListener("input", () => set(input.value === "" ? undefined : Number(input.value)));
  return field(label, input);
}

function choice(label: string, value: string, set: (v: string) => void): HTMLElement {
  const select = el("select");
  for (const option of ["", "noise", "tone"]) {
    select.append(
      el("option", { value: option, textContent: option === "" ? "(sample only)" : option }),
    );
  }
  select.value = value;
  select.addEventListener("change", () => set(select.value));
  return field(label, select);
}

function field(label: string, input: HTMLElement): HTMLElement {
  return el("label", { className: "row" }, [
    el("span", { className: "dims", textContent: label }),
    input,
  ]);
}

/** `swing_2` -> `swing`. An id with no trailing number is its own category. */
function categoryOf(id: string): string {
  return /^(.*)_\d+$/.exec(id)?.[1] ?? id;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of children) node.append(c);
  return node;
}
