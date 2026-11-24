import { describe, expect, it } from "vitest";
import { Toggles, type Toggle } from "../debug/toggles";
import { readFileSync } from "node:fs";
import type { StatesFile } from "../entity/states";
import type { WorldInput } from "../entity/entity";
import { Keyboard, keyFor, keySheet } from "./keyboard";

/** A window that only collects the keyboard's listeners, so a test can press. */
function fakeWindow() {
  const listeners: Record<string, (e: Partial<KeyboardEvent>) => void> = {};
  const target = { addEventListener: (type: string, listen: (e: Partial<KeyboardEvent>) => void) => (listeners[type] = listen) };
  return {
    target: target as unknown as Window,
    /** A key by its place (`code`) and the letter it types (`key`), which a layout may make differ. */
    press: (code: string, key = code.replace(/^Key/, "").toLowerCase()) => listeners.keydown({ code, key, repeat: false }),
    blur: () => listeners.blur({}),
  };
}

describe("Keyboard", () => {
  it("lets go of what was held when the window loses focus", () => {
    const { target, press, blur } = fakeWindow();
    const keyboard = new Keyboard(new Toggles(null), target);
    press("ArrowRight");
    press("KeyA");
    blur();
    const input = keyboard.frame();
    expect([input.right, input.holding.attack]).toEqual([false, false]);
  });

  it("reads a play key by its place, not its letter", () => {
    // on a QWERTZ board the key in Z's place types y
    const { target, press } = fakeWindow();
    const keyboard = new Keyboard(new Toggles(null), target);
    press("KeyZ", "y");
    expect(keyboard.frame().holding.guard).toBe(true);
  });

  it("presses a button for one frame and holds it until let go", () => {
    const { target, press } = fakeWindow();
    const keyboard = new Keyboard(new Toggles(null), target);
    press("KeyS");
    const first = keyboard.frame();
    const second = keyboard.frame();
    expect([first.smash, first.holding.smash, second.smash, second.holding.smash]).toEqual([true, true, false, true]);
  });
});

describe("keyFor", () => {
  it("names the key that really flips each switch", () => {
    const { target, press } = fakeWindow();
    const toggles = new Toggles(null);
    new Keyboard(toggles, target);
    for (const toggle of ["boxes", "readout", "dummy", "recording"] as Toggle[]) {
      const was = toggles.get(toggle);
      press(`Key${keyFor(toggle)}`);
      expect([toggle, toggles.get(toggle)]).toEqual([toggle, !was]);
    }
  });
});

describe("keySheet", () => {
  it("names the key a fighter's states charge on", () => {
    // the sheet once said A+Z while every fighter charged on A+S
    const { states } = JSON.parse(readFileSync("data/entities/goku/states.json", "utf8")) as StatesFile;
    const charge = states.idle.transitions!.find((t) => t.to === "charge_start")!;
    const [button] = [charge.when].flat().map((w) => w.replace("held:", "")) as (keyof WorldInput["holding"])[];
    const { target, press } = fakeWindow();
    const keyboard = new Keyboard(new Toggles(null), target);
    const [key] = keySheet().find(([, does]) => does.startsWith(`${button} `))!;
    press(`Key${key}`);
    expect(keyboard.frame().holding[button]).toBe(true);
  });
});
