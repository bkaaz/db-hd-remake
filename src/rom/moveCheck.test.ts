import { describe, expect, it } from "vitest";
import { afterInput, byMove, commandTokens, differences, moveCases } from "./moveCheck";

describe("commandTokens", () => {
  it("reads a command's directions oldest first, the button on the newest", () => {
    // Vegetto's Big Bang: ← ↙ ↓ ↘ → A
    expect(commandTokens(["0082", "0100", "0500", "0400", "0600", "0200"])).toEqual([
      "back 3", "down back 3", "down 3", "down fwd 3", "fwd 3", "fwd blast 3",
    ]);
  });

  it("takes a direction out of the button word when there is no sequence", () => {
    expect(commandTokens(["8108"])).toEqual(["fwd smash 3"]);
    expect(commandTokens(["9010"])).toEqual(["smash dash 3"]);
  });
});

describe("moveCases", () => {
  it("jumps first for a command of the air", () => {
    const [air] = moveCases([{ move: "a8", where: "air", words: ["8002", "0400", "0100"] }]);
    expect(air.does).toContain("up fwd 3");
    expect(air.before).toContain("05");
  });
});

describe("the comparison", () => {
  const run = (move: string, frames: number, dx = 0, dy = 0) => ({ move, frames, dx, dy });

  it("starts past what led up to it and stops at his return to idle", () => {
    expect(afterInput([run("01", 50), run("00", 8), run("aa", 40), run("00", 9), run("01", 3)], ["00", "01"])).toEqual([run("aa", 40)]);
  });

  it("merges a move cut in two", () => {
    expect(byMove([run("aa", 40, 5), run("aa", 2, 1), run("13", 1)])).toEqual([run("aa", 42, 6), run("13", 1)]);
  });

  it("agrees within its slack, and says what is off beyond it", () => {
    expect(differences([run("aa", 40, 10)], [run("aa", 42, 12)])).toEqual([]);
    expect(differences([run("aa", 40)], [run("aa", 50)])).toEqual(["aa lasts 40 / ours 50"]);
    expect(differences([run("aa", 40)], [run("9e", 40)])[0]).toContain("moves aa / ours 9e");
  });
});
