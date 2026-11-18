import { describe, expect, it } from "vitest";
import { Toggles, type Toggle } from "../debug/toggles";
import { readFileSync } from "node:fs";
import type { StatesFile } from "../entity/states";
import { Keyboard, keyFor, keySheet } from "./keyboard";

/** A window that only collects the keyboard's listeners, so a test can press. */
function fakeWindow() {
  const listeners: Record<string, (e: Partial<KeyboardEvent>) => void> = {};
  const target = { addEventListener: (type: string, listen: (e: Partial<KeyboardEvent>) => void) => (listeners[type] = listen) };
  return {
    target: target as unknown as Window,
    press: (key: string) => listeners.keydown({ key, repeat: false }),
    blur: () => listeners.blur({}),
  };
}

describe("Keyboard", () => {
  it("lets go of what was held when the window loses focus", () => {
    const { target, press, blur } = fakeWindow();
    const keyboard = new Keyboard(new Toggles(null), target);
    press("ArrowRight");
    press("a");
    blur();
    const input = keyboard.frame();
    expect([input.right, input.holding.attack]).toEqual([false, false]);
  });
});

describe("keyFor", () => {
  it("names the key that really flips each switch", () => {
    const { target, press } = fakeWindow();
    const toggles = new Toggles(null);
    new Keyboard(toggles, target);
    for (const toggle of ["boxes", "readout", "dummy", "recording"] as Toggle[]) {
      const was = toggles.get(toggle);
      press(keyFor(toggle).toLowerCase());
      expect([toggle, toggles.get(toggle)]).toEqual([toggle, !was]);
    }
  });
});

describe("keySheet", () => {
  it("names the keys a fighter's states charge on", () => {
    // the sheet once said A+Z while every fighter charged on A+S
    const { states } = JSON.parse(readFileSync("data/entities/goku/states.json", "utf8")) as StatesFile;
    const charge = states.idle.transitions!.find((t) => t.to === "charge_start")!;
    const held = [charge.when].flat().map((w) => w.replace("held:", ""));
    const keyOf = Object.fromEntries(keySheet().map(([key, does]) => [does, key]));
    expect(keySheet()).toContainEqual([held.map((b) => keyOf[b]).join("+"), "charge"]);
  });
});
