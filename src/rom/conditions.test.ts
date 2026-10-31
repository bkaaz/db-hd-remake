import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GOKU, ROM_PATH } from "./cartridge";
import { readCommands } from "./commands";
import { commandContext, describeConditions, type CommandContext } from "./conditions";

const CONTEXT: CommandContext = { near: 0, grab: 42, listA: [0xa5], listB: [], ungrabbable: [] };

describe("describeConditions", () => {
  it("names each bit a row asks for, by its byte", () => {
    expect(describeConditions([0x41, 0, 0], CONTEXT)).toEqual(["on the ground", "health 80 or less"]);
    expect(describeConditions([0, 0x20, 0], CONTEXT)).toEqual(["in one of its moves a5"]);
  });

  it("puts the fighter's own range into the grab", () => {
    expect(describeConditions([0, 0, 0x40], CONTEXT)).toEqual([
      "within 42 px of an opponent standing still, not in a move he cannot be grabbed in",
    ]);
  });

  it("says nothing for the bit set every frame", () => {
    expect(describeConditions([0, 0, 0x80], CONTEXT)).toEqual([]);
  });
});

describe.skipIf(!existsSync(ROM_PATH))("commands whole, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const goku = readCommands(rom, GOKU.character);
  const command = (move: number) => goku.find((c) => c.move === move && c.where === "ground")!;
  const context = commandContext(rom, GOKU.character);

  it("reads Goku's throw range, 42 px, and the moves no one can grab him in", () => {
    expect(context.grab).toBe(42);
    expect(context.ungrabbable).toEqual([0xa8, 0x9c, 0x9e]);
  });

  it("reads the throw: grounded both, the opponent free and in range; it holds him in move 30", () => {
    const thrown = command(0x9d);
    expect(describeConditions(thrown.conditions, context)).toEqual([
      "on the ground",
      "the opponent on the ground",
      "the opponent not in moves 0e, 10, 19–23, 31–3a (down, dizzy …)",
      "the opponent not reeling (moves 13–21, 42, 43)",
      "within 42 px of an opponent standing still, not in a move he cannot be grabbed in",
    ]);
    expect(thrown.opponentMove).toBe(0x30);
    expect(thrown.cost).toBe(0);
  });

  it("reads what the Kamehameha costs and what Saiyan Meteor needs", () => {
    expect(command(0xab).cost).toBe(10);
    expect(command(0xab).opponentMove).toBeNull();
    expect(describeConditions(command(0xad).conditions, context)).toContain("health 80 or less");
  });
});
