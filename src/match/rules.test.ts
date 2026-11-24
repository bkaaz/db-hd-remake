import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readRules } from "./rules";

describe("readRules", () => {
  it("reads whether the combo rules are on", () => {
    expect(readRules({ comboLimits: true })).toEqual({ comboLimits: true });
    expect(readRules({ comboLimits: false })).toEqual({ comboLimits: false });
  });

  it("refuses a file that does not say it, rather than guessing", () => {
    expect(readRules({})).toMatch(/comboLimits/);
    expect(readRules({ comboLimits: "no" })).toMatch(/comboLimits/);
    expect(readRules(null)).toMatch(/not an object/);
  });

  it("reads the game's own data/rules.json", () => {
    expect(typeof readRules(JSON.parse(readFileSync("data/rules.json", "utf8")))).toBe("object");
  });
});
