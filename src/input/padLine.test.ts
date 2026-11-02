import { describe, expect, it } from "vitest";
import { PAD, PadHistory } from "./command";
import { arrow, pressedNames, stickLine } from "./padLine";

function history(frames: number[]): PadHistory {
  const h = new PadHistory();
  for (const held of frames) h.record({ pressed: 0, held });
  return h;
}

describe("the pad, as the recording writes it", () => {
  it("runs the stick oldest first, a count a direction", () => {
    const { back, down, fwd } = PAD;
    const h = history([back, back, back | down, down, down | fwd, fwd, fwd]);
    expect(stickLine(h, 7)).toBe("←2 ↙1 ↓1 ↘1 →2");
  });

  it("names both ways at once, which a pad cannot hold", () => {
    expect(arrow(PAD.fwd | PAD.back | PAD.down)).toBe("↓↔");
    expect(arrow(0)).toBe("·");
  });

  it("names the buttons gone down", () => {
    expect(pressedNames(PAD.A | PAD.Y)).toEqual(["attack", "blast"]);
  });
});
