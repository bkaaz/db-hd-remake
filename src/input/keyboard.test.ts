import { describe, expect, it } from "vitest";
import { Toggles, type Toggle } from "../debug/toggles";
import { Keyboard, keyFor } from "./keyboard";

/** A window that only collects the keyboard's listeners, so a test can press. */
function fakeWindow() {
  const listeners: Record<string, (e: Partial<KeyboardEvent>) => void> = {};
  const target = { addEventListener: (type: string, listen: (e: Partial<KeyboardEvent>) => void) => (listeners[type] = listen) };
  return { target: target as unknown as Window, press: (key: string) => listeners.keydown({ key, repeat: false }) };
}

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
