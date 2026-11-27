import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StatesFile } from "./states";

const read = (file: string) => JSON.parse(readFileSync(`data/entities/gohan/${file}`, "utf8"));
const { states } = read("states.json") as StatesFile;
const animations = read("animations.json");

describe("Gohan's Kamehameha", () => {
  it("ends on the script's last step, not on the animation that says his line again", () => {
    expect(states.kame_out.anim).toBe("mac_2");
    const steps = animations.mac_2.steps as { dur: number }[];
    expect(states.kame_out.startsAt).toBe(steps[0].dur);
  });
});

describe("Rushing Suki Combo", () => {
  it("runs to white and back, in the colours of either side", () => {
    expect(states.suki_combo.paletteRun).toEqual({ plain: ["run0", "run1", "run4", "run1", "run0"], alt: ["run2", "run3", "run4", "run3", "run2"] });
  });

  it("lands nine blows, as logs/fight-6.txt: the part at 118 re-arms nothing", () => {
    expect(states.suki_combo_8.sameSwing).toBe(true);
    const fresh = Object.entries(states).filter(([name, def]) => name.startsWith("suki_combo") && !def.sameSwing);
    expect(fresh).toHaveLength(9);
  });

  it("lights a ball on every blow but the last, whose light is the pillar, with 3a as it begins", () => {
    const blows = Object.keys(states).filter((name) => name.startsWith("suki_combo"));
    expect(blows.filter((name) => states[name].hitLight === "ball")).toHaveLength(9);
    expect(states.suki_combo_10.hitLight).toBe("pillar");
    expect(states.suki_combo_10.sound).toBe("sfx_3a");
  });
});
