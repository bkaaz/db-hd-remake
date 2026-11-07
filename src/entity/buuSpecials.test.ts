import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StatesFile } from "./states";

const { states } = JSON.parse(readFileSync("data/entities/buu/states.json", "utf8")) as StatesFile;
const commands = JSON.parse(readFileSync("data/entities/buu/commands.json", "utf8")).commands as { move: string; where: string }[];

describe("Buu's Earth Stab", () => {
  it("stands its spike 32, 64 or 96 px ahead by the button ($10:D5F6), at most three in a row", () => {
    expect(states.earth_stab_1.fires?.atBy).toEqual({ attack: [32, 0], smash: [64, 0], blast: [96, 0] });
    const next = (name: string) => states[name].transitions?.map((t) => t.to) ?? [];
    expect(next("earth_stab_1")).toEqual(["earth_stab_2", "earth_stab_end"]);
    expect(next("earth_stab_2")).toEqual(["earth_stab_3", "earth_stab_end"]);
    expect(next("earth_stab_3")).toEqual(["earth_stab_end"]);
  });
});

describe("Buu's Disk Tackle", () => {
  it("is a command on the ground, whichever area of the table holds its row", () => {
    expect(commands.filter((c) => c.move === "b2").map((c) => c.where)).toEqual(["ground"]);
    expect(states.idle.transitions?.some((t) => t.when === "command:b2" && t.to === "disk_tackle")).toBe(true);
  });

  it("springs back from a blow that connects, at frame 8 of 1a ($10:D85F)", () => {
    expect(states.disk_tackle.transitions?.[0]).toEqual({ when: "connected", to: "disk_spring" });
    expect(states.disk_spring.startsAt).toBe(8);
  });
});

describe("Buu's Floater", () => {
  it("hangs until a button: no animation's end or landing lets him down", () => {
    for (const name of ["floater_still", "floater_fwd", "floater_back"]) {
      const out = states[name].transitions?.map((t) => t.when) ?? [];
      expect(out).toContain("pressed:attack");
      expect(out).not.toContain("animEnd");
      expect(out).not.toContain("landed");
      expect(states[name].air?.[0][1].gravity).toBe(0);
      // its timeline counts from the frame the state starts at, as the clock does
      expect(states[name].air?.[0][0]).toBe(states[name].startsAt ?? 0);
    }
  });
});

describe("Buu's Putty Uppercut", () => {
  it("swings with a sound whether it lands or not, and adds its own as it does ($10:D9DE, $10:DA1B)", () => {
    expect(states.putty_uppercut.soundsAt).toEqual([[8, "swing_07"]]);
    expect(states.candy_scene.sound).toBe("sfx_08");
  });
});

describe("Buu's Floater, between its two poses", () => {
  const anims = JSON.parse(readFileSync("data/entities/buu/animations.json", "utf8"));
  const steps = (anims.animations ?? anims).ma9_2.steps as { dur: number }[];

  it("goes to the moving pose at once, and back to the still one, never on to the way out ($10:D53B, $10:D58C)", () => {
    expect(states.floater_fwd.startsAt).toBe(steps[0].dur);
    expect(states.floater_back.startsAt).toBe(steps[0].dur);
    expect(states.floater_still.fromTop).toBe(true);
  });
});

describe("Buu's Energy Sphere", () => {
  it("goes on a stage up only while A is held, and lets the ball go once it has let go", () => {
    expect(states.energy_sphere_2.transitions?.map((t) => t.to)).toEqual(["energy_sphere_go_s", "energy_sphere_go_s", "energy_sphere_3"]);
    expect(states.energy_sphere_4.transitions?.map((t) => t.to)).toEqual(["energy_sphere_go_l"]);
  });
});

describe("Buu's charge", () => {
  it("lasts as long as both buttons are held, its line said once ($10:D155, recorded)", () => {
    expect(states.charge_start.muted).toBeUndefined();
    for (const name of ["charge_first", "charge"]) {
      expect(states[name].muted).toBe(true);
      expect(states[name].fromTop).toBe(true);
    }
    expect(states.charge.transitions?.map((t) => t.when)).toEqual(["!held:attack", "!held:smash", "animEnd"]);
  });
});
