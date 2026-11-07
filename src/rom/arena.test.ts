import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Rgb } from "../entity/palettesFile";
import type { Rgba } from "../sprites/png";
import { altPalettes, ARENAS, exportArena, glowPalettes, introPalettes, lightingPalettes, lightingShift, relitRun } from "./arena";
import { GOKU, ROM_PATH, toFile } from "./cartridge";
import { fighterNamed } from "./roster";
import { drawLayer, drawStage, loadStage, stack, stageRecord } from "./stage";

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

/** `$0560` as a round opens (`$00:B877`). */
const START_X = 128;

describe.skipIf(!existsSync(ROM_PATH))("arenas, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const tournament = exportArena(rom, ARENAS.tournament);

  it.each(Object.entries(ARENAS))("%s: its layers, lined up at the camera's start, are the whole stage in every lighting", (_, source) => {
    const { images, file } = exportArena(rom, source);
    for (const layer of file.layers) expect(layer.scroll[0] * START_X + layer.scroll[1]).toBe(START_X);
    for (const [time, id] of Object.entries(source.ids)) {
      const stage = loadStage(rom, id);
      const leftOut = (source.leftOut ?? []).map(([map, part]) => drawLayer(stage, map, part));
      const layered = stack(...file.layers.map((layer) => images[`${layer.name}@${time}`]), ...leftOut);
      expect(Buffer.compare(layered.data, drawStage(stage).data)).toBe(0);
    }
  });

  it("takes the palace from stage ids 9, 10, 11, its sky and far domes at a quarter of the camera's speed ($00:BE6B)", () => {
    expect([9, 10, 11].map((id) => stageRecord(rom, id).arena)).toEqual([3, 3, 3]);
    const palace = exportArena(rom, ARENAS.palace);
    expect(palace.file.layers).toEqual([
      { name: "sky", scroll: [0.25, 96] },
      { name: "palace", scroll: [1, 0] },
    ]);
    expect(drawn(palace.images["palace@day"], 224, 256)).toBe(false);
    expect(at(palace.images["sky@day"], 10, 10)[3]).toBe(255);
  });

  describe("the plains", () => {
    const plains = exportArena(rom, ARENAS.plains);

    it("come from stage ids 13, 14, 15: a half-speed sky and the plains, the silhouettes left out on purpose", () => {
      expect([13, 14, 15].map((id) => stageRecord(rom, id).arena)).toEqual([5, 5, 5]);
      expect(plains.file.layers.map((l) => [l.name, l.scroll])).toEqual([
        ["sky", [0.5, 64]],
        ["plains", [1, 0]],
      ]);
    });

    it("draw no silhouette: below BG2's sky there is nothing but the plains", () => {
      expect(drawn(plains.images["sky@day"], 160, 256)).toBe(false);
      expect(Object.keys(plains.images).filter((n) => n.startsWith("front"))).toEqual([]);
    });

    it("mark only the sky as holding the palette that steps", () => {
      expect(plains.file.layers.filter((l) => l.numbered).map((l) => l.name)).toEqual(["sky"]);
      expect(Object.keys(plains.images)).toContain("sky-numbers@night");
      expect(Object.keys(plains.images)).not.toContain("plains-numbers@day");
    });

    it("start on the step that is the day's own palette, so that nothing jumps", () => {
      const stage = loadStage(rom, ARENAS.plains.ids.day);
      const { start } = plains.file.cycles![0];
      for (let colour = 1; colour < 16; colour++) {
        const [r, g, b] = at(plains.images["cycle0@day"], colour, start);
        expect([r, g, b]).toEqual(stage.colours[4 * 16 + colour]);
      }
    });

    it("take each lighting's steps from its own table", () => {
      const reds = (time: string) => at(plains.images[`cycle0@${time}`], 1, 0)[0];
      expect(new Set(["day", "evening", "night"].map(reds)).size).toBe(3);
    });
  });

  describe("the shore", () => {
    const shore = exportArena(rom, ARENAS.shore);

    it("comes from stage id 17 alone, in the night's lighting, the silhouettes left out on purpose", () => {
      expect(stageRecord(rom, 17).arena).toBe(7);
      expect(shore.file.times).toEqual(["night"]);
      expect(shore.file.layers.map((l) => [l.name, l.scroll])).toEqual([
        ["sky", [0.5, 64]],
        ["shore", [1, 0]],
      ]);
      // the fighters' palette record: the same lighting as the night of the arenas that have three
      expect(lightingPalettes(rom, GOKU).night).toBe(0xb0080);
    });

    it("has its far rocks in the half-speed sky, and no silhouette below it", () => {
      expect(drawn(shore.images["sky@night"], 96, 152)).toBe(true);
      expect(drawn(shore.images["sky@night"], 160, 256)).toBe(false);
      expect(Object.keys(shore.images).filter((n) => n.startsWith("front"))).toEqual([]);
    });

    it("steps palettes 2, 3 and 4 from one table at their own places, and 7 from another", () => {
      expect(shore.file.cycles!.map((c) => [c.palette, c.start, c.steps])).toEqual([[2, 0, 16], [3, 4, 16], [4, 10, 16], [7, 0, 8]]);
      expect(shore.images["cycle0@night"].data).toEqual(shore.images["cycle2@night"].data);
    });

    it("holds the steps by the cartridge's table ($00:C41F)", () => {
      const table = [...rom.subarray(toFile(0x00c41f)!, toFile(0x00c41f)! + 16)];
      expect(shore.file.cycles![0].hold).toEqual(table.map((t) => t + 1));
    });
  });

  it("gives an arena with nothing stepping no cycles and no pictures of numbers", () => {
    const { file, images } = exportArena(rom, ARENAS.palace);
    expect(file.cycles).toBeUndefined();
    expect(Object.keys(images).filter((n) => n.includes("numbers") || n.startsWith("cycle"))).toEqual([]);
  });

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
