import { describe, expect, it } from "vitest";
import { BUFFER_FRAMES, InputBuffer } from "./buffer";

describe("InputBuffer", () => {
  it("keeps a press available after the frame it happened on", () => {
    const b = new InputBuffer(3);
    b.press("punch");
    b.tick();
    b.tick();
    expect(b.has("punch")).toBe(true);
  });

  it("lets a press expire once its window runs out", () => {
    const b = new InputBuffer(3);
    b.press("punch");
    for (let i = 0; i < 3; i++) b.tick();
    expect(b.has("punch")).toBe(false);
  });

  it("does not report a button that was never pressed", () => {
    expect(new InputBuffer().has("kick")).toBe(false);
  });

  it("spends a press when it is used, so one press is one move", () => {
    const b = new InputBuffer(8);
    b.press("punch");
    b.consume("punch");
    expect(b.has("punch")).toBe(false);
  });

  it("refreshes the window when the same button is pressed again", () => {
    const b = new InputBuffer(4);
    b.press("punch");
    b.tick();
    b.tick();
    b.press("punch");
    expect(b.remaining("punch")).toBe(4);
  });

  it("ages buttons independently", () => {
    const b = new InputBuffer(4);
    b.press("punch");
    b.tick();
    b.press("kick");
    b.tick();
    expect(b.remaining("punch")).toBe(2);
    expect(b.remaining("kick")).toBe(3);
  });

  it("survives a pause, because a pause does not tick it", () => {
    // The whole point: hitstop freezes the entity, the entity stops ticking its
    // buffer, and the press made during the pause is still there afterwards.
    const b = new InputBuffer(BUFFER_FRAMES);
    b.press("punch");
    // six frames of hitstop happen here, with no tick at all
    expect(b.has("punch")).toBe(true);
    b.tick();
    expect(b.has("punch")).toBe(true);
  });

  it("outlives a hitstop even when it is ticked through it", () => {
    // Belt and braces: even if something did age it for the whole pause, the
    // default window is longer than the default hitstop.
    const b = new InputBuffer();
    b.press("punch");
    for (let i = 0; i < 6; i++) b.tick();
    expect(b.has("punch")).toBe(true);
  });
});
