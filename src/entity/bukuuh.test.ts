import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StatesFile } from "./states";

const read = (file: string) => JSON.parse(readFileSync(`data/entities/gohan/${file}`, "utf8"));
const { states } = read("states.json") as StatesFile;
const { ma9, m1a } = read("animations.json").animations ?? read("animations.json");

describe("Bukuuh Kyaku's states", () => {
  it("sounds as every other blow on contact: 09 and, on a guard, 17 ($0D:D1B7)", () => {
    expect([states.bukuuh_kyaku.hitSound, states.bukuuh_kyaku.blockSound]).toEqual(["hit_09", "block_17"]);
  });

  it("throws without a cry: nothing is asked for on the frame he goes (logs/fight-3.txt, f1085)", () => {
    expect(states.bukuuh_hits.grab!.launch.quiet).toBe(true);
  });

  it("repeats its blows at one pitch, as the original's ten 09s do: no wobble on hit_09", () => {
    const { hit_09 } = JSON.parse(readFileSync("data/audio/sounds.json", "utf8"));
    expect(hit_09.vary).toBeUndefined();
  });

  it("asks for a block first: `connected` fires on one too", () => {
    const ways = states.bukuuh_kyaku.transitions!.map((t) => t.when);
    expect(ways.indexOf("blocked")).toBeLessThan(ways.indexOf("connected"));
  });

  it("shows the six sparks its counter lets through, not the ten its script names", () => {
    expect(ma9.steps.flatMap((s: { spawns?: unknown[] }) => s.spawns ?? [])).toHaveLength(6);
  });

  it("springs back holding the script's `hold` step, the jump's fall pose (logs: 1a stays on frame 24)", () => {
    expect(states.bukuuh_spring.holdStep).toBe(6);
    expect(m1a.steps[6].frame).toBe("9");
  });

  it("throws on a9's last frame, the only one left before the state ends and lets him go unthrown", () => {
    const length = ma9.steps.reduce((n: number, s: { dur: number }) => n + s.dur, 0);
    expect(states.bukuuh_hits.grab!.launch.frame).toBe(length - 1);
  });
});
