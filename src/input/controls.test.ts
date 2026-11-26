import { describe, expect, it } from "vitest";
import { Toggles } from "../debug/toggles";
import { Controls } from "./controls";
import { Keyboard } from "./keyboard";
import { Pad, type PadState } from "./pad";

const noWindow = { addEventListener: () => {} } as unknown as Window;
const lb: PadState = { buttons: [...Array(17)].map((_, i) => ({ pressed: i === 4 })), axes: [-1, 0] };

describe("Controls", () => {
  it("counts what the pad does when the keyboard does nothing", () => {
    const controls = new Controls(new Keyboard(new Toggles(null), noWindow), new Pad(() => [lb]));
    const input = controls.frame();
    expect([input.left, input.charge, input.holding.charge]).toEqual([true, true, true]);
  });
});
