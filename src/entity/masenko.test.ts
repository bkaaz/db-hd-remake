import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fall } from "./air";
import { DEFAULT_ATTRIBUTES } from "./entityFile";

const read = (file: string) => JSON.parse(readFileSync(`data/spawns/gohan_masenko/${file}`, "utf8"));

describe("Masenko's shot", () => {
  it("climbs at b0's speed the whole flight, as logs/objects-gohan.txt shows it", () => {
    const { gravity } = { ...DEFAULT_ATTRIBUTES, ...read("attributes.json") };
    const { launch, lasts } = read("states.json").states.fly;
    let vy: number = launch[1];
    for (let frame = 0; frame < lasts; frame++) {
      expect(vy).toBe(-3);
      vy = fall({ aloft: true, gravity: "own", toApex: false, vx: launch[0], vy }, gravity);
    }
  });
});
