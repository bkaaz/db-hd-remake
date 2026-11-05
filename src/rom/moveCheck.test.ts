import { describe, expect, it } from "vitest";
import { afterInput, byMove, commandTokens, differences, moveCases, readFight } from "./moveCheck";

describe("commandTokens", () => {
  it("reads a command's directions oldest first, the button on the newest", () => {
    // Vegetto's Big Bang: ← ↙ ↓ ↘ → A
    expect(commandTokens(["0082", "0100", "0500", "0400", "0600", "0200"])).toEqual([
      "back 3", "down back 3", "down 3", "down fwd 3", "fwd 3", "fwd blast 3",
    ]);
  });

  it("does not wait on a stick going up, or he leaves the floor", () => {
    expect(commandTokens(["8002", "0900", "0600"])).toEqual(["down back 3", "up fwd 1", "up fwd smash 3"]);
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
    expect(byMove([run("aa", 40, 5), run("aa", 2, 1), run("00", 1)])).toEqual([run("aa", 42, 6), run("00", 1)]);
  });

  it("agrees within its slack, and says what is off beyond it", () => {
    expect(differences([run("aa", 40, 10)], [run("aa", 42, 12)])).toEqual([]);
    expect(differences([run("aa", 40)], [run("aa", 50)])).toEqual(["aa lasts 40 / ours 50"]);
    expect(differences([run("aa", 40)], [run("9e", 40)])[0]).toContain("moves aa / ours 9e");
  });
});

describe("readFight", () => {
  const body = (who: string, move: string, step: number, x: number) => `  ${who} ${move}  ${step}  0 d000 x ${x} y 200 sy 200 vx  0.00 vy  0.00 face=00 hp=400 stun=20 f25=00 f96=00`;
  const frame = (n: number, x: number, step = n) => [`f${n} hit=00 front=1 cam=0,0`, body("P1", "0a", step, x), body("P2", "00", step, 320)].join("\n");

  it("leaves out a frame on which nothing moved, as the game had no time for it", () => {
    const fight = readFight([frame(1, 190), frame(2, 193), frame(3, 193, 2), frame(4, 196, 3)].join("\n"));
    expect(fight.P1).toEqual([{ move: "0a", frames: 3, dx: 6, dy: 0 }]);
  });

  it("counts a hit pause, whose counter moves though the bodies stand", () => {
    const line = (n: number, hit: string) => [`f${n} hit=${hit} front=1 cam=0,0`, body("P1", "16", 1, 300), body("P2", "00", 1, 320)].join("\n");
    expect(readFight([line(1, "08"), line(2, "07"), line(3, "06")].join("\n")).P1[0].frames).toBe(3);
  });
});
