import type { Toggle, Toggles } from "../debug/toggles";
import { keyFor, keySheet } from "../input/keyboard";
import { pill, RecordButton } from "./controls";
import type { Page } from "./page";

/**
 * The bar under the game's screen: the debug switches, the recording, and
 * the keys folded away. A key and a switch here flip the same value
 * (`src/debug/toggles.ts`), so the bar redraws on either. Every key shown is
 * read from `input/keyboard.ts`, which is the only file that knows them.
 */

const SWITCHES: [Toggle, string][] = [
  ["boxes", "boxes"],
  ["readout", "readout"],
  ["dummy", "dummy attacks"],
];

export class SwitchBar {
  private readonly pills = document.createElement("span");
  private readonly record: RecordButton;

  constructor(
    page: Page,
    private readonly toggles: Toggles,
  ) {
    this.pills.className = "field";
    this.record = new RecordButton(keyFor("recording"), () => toggles.flip("recording"));
    this.record.show(toggles.get("recording"));
    toggles.onChange((toggle, on) => {
      if (toggle === "recording") this.record.show(on);
      else this.draw();
    });
    const spacer = document.createElement("span");
    spacer.className = "spacer";
    page.bar.append(this.pills, this.record.element, spacer, keys());
    this.draw();
  }

  private draw(): void {
    this.pills.replaceChildren(
      ...SWITCHES.map(([toggle, label]) => pill(keyFor(toggle), label, this.toggles.get(toggle), () => this.toggles.flip(toggle))),
    );
  }
}

/** The keys, folded: a list that is read once and then only looked up. */
function keys(): HTMLElement {
  const details = document.createElement("details");
  details.className = "keys";
  const summary = document.createElement("summary");
  summary.textContent = "keys";
  // a focused summary would open and close on Space, which refills ki
  details.addEventListener("toggle", () => summary.blur());
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  for (const [key, does] of keySheet()) {
    const kbd = document.createElement("kbd");
    kbd.textContent = key;
    const what = document.createElement("span");
    what.textContent = does;
    sheet.append(kbd, what);
  }
  details.append(summary, sheet);
  return details;
}
