/**
 * The page's controls, as the browser draws them: a select for a list that
 * grows, a row of buttons for a few fixed choices, a lit button for a switch,
 * and the recording's button. Their look is `page.css`.
 * Each hands the focus back once used — the game listens on the window, so its keys arrive anyway,
 * but a focused select would also step through its options on every arrow.
 */

/** A value and the text shown for it. */
export type Choice = [value: string, text: string];

/** A select of `options`, `value` picked. */
export function picker(value: string, options: Choice[], pick: (value: string) => void): HTMLSelectElement {
  const select = document.createElement("select");
  // a value the lists no longer hold (a fighter deleted) stays visible, so it can be picked away
  const all = options.some(([v]) => v === value) ? options : [...options, [value, `${value} (missing)`] as Choice];
  for (const [v, text] of all) select.append(new Option(text, v, false, v === value));
  select.addEventListener("change", () => {
    select.blur();
    pick(select.value);
  });
  return select;
}

/**
 * A few fixed choices as a row of buttons, `value` lit: all of them visible
 * and one click to pick, where a select would take two and hide the rest.
 */
export function segmented(value: string, options: Choice[], pick: (value: string) => void): HTMLElement {
  const row = document.createElement("span");
  row.className = "seg";
  for (const [v, text] of options) {
    const button = document.createElement("button");
    button.textContent = text;
    button.classList.toggle("on", v === value);
    onClick(button, () => pick(v));
    row.append(button);
  }
  return row;
}

/** A switch, lit when on, naming the key that flips it too. */
export function pill(key: string, label: string, on: boolean, flip: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "pill";
  button.classList.toggle("on", on);
  const kbd = document.createElement("kbd");
  kbd.textContent = key;
  button.append(kbd, label);
  onClick(button, flip);
  return button;
}

/** A click that hands the focus back, as every control here does. */
function onClick(button: HTMLButtonElement, act: () => void): void {
  button.addEventListener("click", () => {
    button.blur();
    act();
  });
}

/**
 * Play and stop for the recording, with how long it has run: a recording is
 * a file being written, and a clock that runs says so — and that it is gone
 * with the page. One for the page's life, so a redrawn bar keeps its clock.
 */
export class RecordButton {
  readonly element = document.createElement("button");
  private since: number | null = null;

  constructor(
    private readonly key: string,
    press: () => void,
  ) {
    this.element.className = "record";
    onClick(this.element, press);
    setInterval(() => this.draw(), 1000);
    this.draw();
  }

  show(recording: boolean): void {
    if (recording && this.since === null) this.since = performance.now();
    if (!recording) this.since = null;
    this.draw();
  }

  private draw(): void {
    this.element.classList.toggle("on", this.since !== null);
    const kbd = document.createElement("kbd");
    kbd.textContent = this.key;
    this.element.replaceChildren(kbd, this.since === null ? "● rec" : `■ stop ${clock(performance.now() - this.since)}`);
  }
}

/** Milliseconds as minutes and seconds, `m:ss`. */
export function clock(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
