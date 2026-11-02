import { describe, expect, it } from "vitest";
import { commandMet, commandsMet, PAD, padFrame, PadHistory, type CommandDef } from "./command";

/**
 * Frames oldest first, as a player does them: a direction glyph, then the
 * buttons pressed that frame (`+B`), or held from before (`~B`).
 */
function pad(...frames: string[]): PadHistory {
  const history = new PadHistory();
  const DIRS: Record<string, number> = {
    "·": 0, "→": PAD.fwd, "←": PAD.back, "↓": PAD.down, "↑": PAD.up,
    "↘": PAD.down | PAD.fwd, "↙": PAD.down | PAD.back, "↗": PAD.up | PAD.fwd,
  };
  const BUTTONS: Record<string, number> = { B: PAD.B, Y: PAD.Y, A: PAD.A, X: PAD.X, R: PAD.R };
  for (const frame of frames) {
    const [dir, ...rest] = frame.split(/(?=[+~])/);
    let pressed = 0;
    let held = DIRS[dir];
    for (const part of rest) {
      const bit = BUTTONS[part.slice(1)];
      held |= bit;
      if (part[0] === "+") pressed |= bit;
    }
    history.record({ pressed, held });
  }
  return history;
}

const def = (...words: string[]): CommandDef => ({ move: "00", where: "ground", words });
/** Vegeta's Sliding Kick, `a4`: ↓ ↘ → B. */
const SLIDE = def("8002", "0100", "0500", "0400");
const times = (n: number, frame: string) => Array<string>(n).fill(frame);

describe("commandMet", () => {
  it("meets ↓ ↘ → B, and not B alone", () => {
    expect(commandMet(SLIDE, pad("↓", "↘", "→", "→+B"))).toBe(true);
    expect(commandMet(SLIDE, pad("·", "·", "·", "·+B"))).toBe(false);
  });

  it("counts the button for 5 frames, not more", () => {
    expect(commandMet(SLIDE, pad("↓", "↘", "→", "·+B", ...times(4, "·")))).toBe(true);
    expect(commandMet(SLIDE, pad("↓", "↘", "→", "·+B", ...times(5, "·")))).toBe(false);
  });

  it("wants each direction within 12 frames of the one after it", () => {
    expect(commandMet(SLIDE, pad("↓", "↘", ...times(11, "→"), "→+B"))).toBe(true);
    expect(commandMet(SLIDE, pad("↓", "↘", ...times(12, "→"), "→+B"))).toBe(false);
  });

  it("wants each direction exactly, with no button held", () => {
    expect(commandMet(SLIDE, pad("↓", "↘~Y", "→", "→+B"))).toBe(false);
    expect(commandMet(SLIDE, pad("↓", "↓", "→", "→+B"))).toBe(false);
  });

  it("wants a direction held with the press when the button word says so (0008)", () => {
    // Goku's Double Kick, a2: → + B
    const kick = def("8108");
    expect(commandMet(kick, pad("→+B"))).toBe(true);
    expect(commandMet(kick, pad("↘+B"))).toBe(false);
    expect(commandMet(kick, pad("·+B"))).toBe(false);
  });

  it("wants any one of its directions or shoulders held when the word says so (1000)", () => {
    // Vegeta's Driving Elbow, a2: R + Y
    const elbow = def("5010");
    expect(commandMet(elbow, pad("·~R", "·~R+Y"))).toBe(true);
    expect(commandMet(elbow, pad("·+Y"))).toBe(false);
  });

  it("holds a charge for 48 frames, unless it is free (0001)", () => {
    const charge = def("8002", "0201");
    expect(commandMet(charge, pad(...times(48, "←"), "·+B"))).toBe(true);
    expect(commandMet(charge, pad(...times(47, "←"), "·+B"))).toBe(false);
    expect(commandMet(charge, pad("←", "·+B"), true)).toBe(true);
  });

  it("is also met on the button held now, for sequences read that way", () => {
    const held = { ...def("8002"), held: true };
    expect(commandMet(held, pad(...times(10, "·~B")))).toBe(true);
    expect(commandMet(def("8002"), pad(...times(10, "·~B")))).toBe(false);
  });
});

describe("padFrame", () => {
  const OFF = { attack: false, smash: false, strike: false, blast: false, dash: false };

  it("writes our buttons as the pad's, a press held too", () => {
    const frame = padFrame({ fwd: true, back: false, up: false, down: true }, { ...OFF, smash: true }, { ...OFF, dash: true });
    expect(frame).toEqual({ pressed: PAD.B, held: PAD.fwd | PAD.down | PAD.B | PAD.R });
  });

  it("reads back and forward together as neither, as a pad cannot hold both", () => {
    const frame = padFrame({ fwd: true, back: true, up: false, down: true }, OFF, OFF);
    expect(frame.held).toBe(PAD.down);
  });
});

describe("commandsMet", () => {
  const defs: CommandDef[] = [
    { move: "a4", where: "ground", words: ["8002", "0100", "0500", "0400"] },
    { move: "b1", where: "air", words: ["0082", "0200", "0600", "0400"] },
  ];

  it("names each move met on its own ground, with the button of ours it took", () => {
    const rolled = pad("↓", "↘", "→", "→+B");
    expect(commandsMet(defs, "ground", rolled)).toEqual(new Map([["a4", "smash"]]));
    expect(commandsMet(defs, "air", rolled)).toEqual(new Map());
  });
});
