import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Rgb } from "../entity/palettesFile";
import type { Rgba } from "../sprites/png";
import { altPalettes, ARENAS, exportArena, glowPalettes, introPalettes, lightingPalettes, lightingShift, relitRun } from "./arena";
import { GOKU, ROM_PATH } from "./cartridge";
import { fighterNamed } from "./roster";
import { stageRecord } from "./stage";

/** Whether any pixel in rows [from, to) is drawn. */
function drawn(img: Rgba, from: number, to: number): boolean {
  for (let y = from; y < to; y++) {
    for (let x = 0; x < img.width; x++) if (img.data[(y * img.width + x) * 4 + 3]) return true;
  }
  return false;
}

/** The colour at one pixel, as RGBA. */
function at(img: Rgba, x: number, y: number): number[] {
  const i = (y * img.width + x) * 4;
  return [...img.data.subarray(i, i + 4)];
}

describe.skipIf(!existsSync(ROM_PATH))("arenas, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const tournament = exportArena(rom, ARENAS.tournament);

  it("takes the tournament from stage ids 0, 1, 2 — one arena, three lightings", () => {
    expect([0, 1, 2].map((id) => stageRecord(rom, id).arena)).toEqual([0, 0, 0]);
    expect(tournament.file.times).toEqual(["day", "evening", "night"]);
    expect(Object.keys(tournament.images).sort()).toEqual(
      ["court@day", "court@evening", "court@night", "sky@day", "sky@evening", "sky@night"],
    );
  });

  it("cuts the sky at world row 96, where the half-speed block ends", () => {
    const sky = tournament.images["sky@day"];
    expect([sky.width, sky.height]).toEqual([512, 256]);
    expect(drawn(sky, 0, 96)).toBe(true);
    expect(drawn(sky, 96, 256)).toBe(false);
  });

  it("puts the roof in front of where the sky is, and the court below it", () => {
    const court = tournament.images["court@day"];
    expect(at(court, 256, 48)[3]).toBe(255); // the sign on the roof, high priority
    expect(at(court, 256, 180)[3]).toBe(255); // the court's paving
    expect(at(court, 10, 10)[3]).toBe(0); // open sky
  });

  it("draws the same arena in another palette by night", () => {
    const [day, night] = [tournament.images["court@day"], tournament.images["court@night"]];
    expect(at(night, 256, 180)[3]).toBe(255);
    expect(at(night, 256, 180)).not.toEqual(at(day, 256, 180));
  });

  it("gives Goku the palettes the original loads by evening and by night, the day's being his sheet's own", () => {
    expect(lightingPalettes(rom, GOKU)).toEqual({ evening: 0xb0040, night: 0xb0080 });
  });

  it("gives Vegeta a glow 8 records on, and Goku none: his point back at his own colours", () => {
    expect(glowPalettes(rom, GOKU)).toEqual({});
    expect(glowPalettes(rom, fighterNamed(rom, "vegeta"))).toEqual({ glow: 0xb0300, evening_glow: 0xb0340, night_glow: 0xb0380 });
  });

  it("gives player two facing himself the next record, in every lighting ($01:82F2)", () => {
    expect(altPalettes(rom, GOKU)).toEqual({ alt: 0xb0020, evening_alt: 0xb0060, night_alt: 0xb00a0 });
    expect(altPalettes(rom, fighterNamed(rom, "vegeta")).glow_alt).toBe(0xb0320);
  });

  it("scrolls the sky at half the camera's speed, lined up at x 128", () => {
    const sky = tournament.file.layers[0];
    expect(sky.name).toBe("sky");
    const [speed, offset] = sky.scroll;
    expect(128 * speed + offset).toBe(128);
    expect(speed).toBe(0.5);
  });
});

describe.skipIf(!existsSync(ROM_PATH))("Freeza's intro on an arena", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const palettes = introPalettes(rom, fighterNamed(rom, "freeza"));

  it("has every record of his intro by evening and by night, in player one's colours for both, as its records are absolute", () => {
    const names = ["evening", "night"].flatMap((time) => [0, 1, 2, 3, 4, 5].map((i) => `${time}_run${i}`));
    expect(Object.keys(palettes).sort()).toEqual(names.sort());
  });

  it("keeps the colours the record leaves alone in that lighting's own", () => {
    const evening = palettes.evening_run0 as Rgb[];
    expect(evening.length).toBe(16);
    expect(evening).not.toEqual(palettes.night_run0);
  });
});

describe.skipIf(!existsSync(ROM_PATH))("Gohan's intro on an arena", () => {
  it("has the one record it plays by evening and by night", () => {
    const rom = new Uint8Array(readFileSync(ROM_PATH));
    expect(Object.keys(introPalettes(rom, fighterNamed(rom, "gohan"))).sort()).toEqual(["evening_run5", "night_run5"]);
  });
});

describe("relitRun", () => {
  // colour 0 is transparent; the bright last channel is at its limit, which must not set the shift
  const day: Rgb[] = [[0, 0, 0], [248, 200, 80], [100, 100, 100], [40, 40, 40], [80, 60, 120]];
  const lit: Rgb[] = [[9, 9, 9], [248, 184, 16], [116, 84, 36], [56, 24, 0], [96, 44, 56]];
  const run: Rgb[] = [[0, 0, 0], [88, 96, 120], [100, 100, 100], [40, 40, 40], [80, 60, 120]];

  it("finds the lighting by what most colours moved, so that one at its limit does not count", () => {
    expect(lightingShift(day, lit)).toEqual([16, -16, -64]);
  });

  it("changes only the colours the run changes, in that light", () => {
    expect(relitRun(day, run, lit)).toEqual([[9, 9, 9], [104, 80, 56], [116, 84, 36], [56, 24, 0], [96, 44, 56]]);
  });
});
