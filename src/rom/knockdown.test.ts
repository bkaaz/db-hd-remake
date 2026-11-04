import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StatesFile } from "../entity/states";
import { ROM_PATH } from "./cartridge";
import { generatedFighters } from "./fighterStates";
import { getUpFrame, highGravity, withKnockdown } from "./knockdown";
import { ROSTER } from "./roster";

describe("withKnockdown", () => {
  const states: StatesFile["states"] = {
    reel_high: { anim: "m1e" },
    high_fall: { anim: "m1e_2" },
    get_up: { anim: "m1f", inputsOf: { state: "idle", only: "buttons" } },
    idle: { anim: "m00" },
  };

  it("gives the high knockdown his gravity and frees the get-up from one frame", () => {
    const out = withKnockdown(states, 0.5, 20);
    expect(out.reel_high.air).toEqual([[0, { gravity: 0.5 }]]);
    expect(out.high_fall.air).toEqual([[0, { gravity: 0.5 }]]);
    expect(out.get_up.turnFrom).toBe(20);
    expect(out.get_up.inputsOf).toEqual({ state: "idle", only: "buttons", from: 20 });
  });

  it("leaves other states, and the file it was given, as they were", () => {
    const out = withKnockdown(states, 0.5, 20);
    expect(out.idle).toEqual({ anim: "m00" });
    expect(states.reel_high.air).toBeUndefined();
    expect(states.get_up.turnFrom).toBeUndefined();
  });
});

describe.skipIf(!existsSync(ROM_PATH))("the knockdown's tables, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("reads what logs/fight-8.txt shows of Gohan: 0.38 in 1e, free on his frame 33", () => {
    const gohan = ROSTER.indexOf("gohan");
    expect(highGravity(rom, gohan)).toBe(0x62 / 256);
    expect(getUpFrame(rom, gohan, [8, 8, 4, 4, 4, 4, 4])).toBe(32);
  });

  it("refuses a get-up with no step past his byte", () => {
    expect(() => getUpFrame(rom, ROSTER.indexOf("gohan"), [8, 8, 4])).toThrow(/none past/);
  });

  it.each(["goku", ...generatedFighters()])("%s's states carry his own numbers", (name) => {
    const character = ROSTER.indexOf(name as (typeof ROSTER)[number]);
    const { states } = JSON.parse(readFileSync(`data/entities/${name}/states.json`, "utf8")) as StatesFile;
    const animations = JSON.parse(readFileSync(`data/entities/${name}/animations.json`, "utf8")) as Record<string, { steps: { dur: number }[] }>;
    const free = getUpFrame(rom, character, animations.m1f.steps.map((s) => s.dur));
    expect(states.high_fall.air).toEqual([[0, { gravity: highGravity(rom, character) }]]);
    expect(states.get_up.turnFrom).toBe(free);
    expect(states.get_up.inputsOf?.from).toBe(free);
  });
});
