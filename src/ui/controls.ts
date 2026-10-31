/**
 * The panel's controls, as the browser draws them: a select for a choice, a
 * checkbox shaped as a switch for on and off, and the recording's button.
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

/** A checkbox drawn as a switch. */
export function switcher(on: boolean, flip: (on: boolean) => void): HTMLInputElement {
  const box = document.createElement("input");
  box.type = "checkbox";
  box.className = "switch";
  box.checked = on;
  box.addEventListener("change", () => {
    box.blur();
    flip(box.checked);
  });
  return box;
}

/**
 * Play and stop for the recording, with how long it has run: a recording is
 * a file being written, and a clock that runs says so — and that it is gone
 * with the page. One for the page's life, so a redrawn panel keeps its clock.
 */
export class RecordButton {
  readonly element = document.createElement("button");
  private since: number | null = null;

  constructor(press: () => void) {
    this.element.className = "record";
    this.element.addEventListener("click", () => {
      this.element.blur();
      press();
    });
    setInterval(() => this.draw(), 1000);
    this.draw();
  }

  show(recording: boolean): void {
    if (recording && this.since === null) this.since = performance.now();
    if (!recording) this.since = null;
    this.draw();
  }

  private draw(): void {
    this.element.textContent = this.since === null ? "● rec" : `■ stop ${clock(performance.now() - this.since)}`;
  }
}

/** Milliseconds as minutes and seconds, `m:ss`. */
export function clock(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The controls' look, once per page. */
export function addStyle(): void {
  if (document.getElementById("panel-style")) return;
  const style = document.createElement("style");
  style.id = "panel-style";
  style.textContent = `
    input.switch { appearance: none; width: 28px; height: 14px; margin: 0; border-radius: 7px;
      background: #3a3a48; position: relative; cursor: pointer; }
    input.switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 10px; height: 10px;
      border-radius: 50%; background: #c8c8d8; transition: left 0.1s; }
    input.switch:checked { background: #4a8a5a; }
    input.switch:checked::after { left: 16px; }
    button.record { font: 12px monospace; color: #c8c8d8; background: #3a3a48; border: 0; border-radius: 3px;
      padding: 2px 8px; cursor: pointer; justify-self: start; }`;
  document.head.append(style);
}
