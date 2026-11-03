import { describe, expect, it } from "vitest";
import type { Rgb } from "../entity/palettesFile";
import { recolour, setVariants } from "./recolour";

/** Vegeta's colours 6, 7, 12, 13 by day, the rest black. */
const day: Rgb[] = Array.from({ length: 16 }, () => [0, 0, 0] as Rgb);
day[6] = [248, 224, 88];
day[7] = [224, 152, 24];
day[12] = [144, 248, 224];
day[13] = [104, 176, 248];
const night = day.map(([r, g, b]) => [r / 2, g / 2, b / 2] as Rgb);
const gold = { "12": 6, "13": { from: 7, own: [240, 184, 40] as Rgb } };

describe("recolour", () => {
  it("puts his own colour where a set names an index, and its literal colour in his own palette", () => {
    const out = recolour(gold, day, day);
    expect([out[12], out[13], out[6]]).toEqual([day[6], [240, 184, 40], day[6]]);
  });

  it("scales a literal colour in another palette as its `from` colour is scaled there", () => {
    expect(recolour(gold, night, day)[13]).toEqual([120, 96, 24]);
  });

  it("names a set's variants after the ones it is drawn over", () => {
    expect(Object.keys(setVariants({ sets: { gold } }, { "": day, night }))).toEqual(["gold", "night_gold"]);
  });
});
