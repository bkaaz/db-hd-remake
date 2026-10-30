import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Rgba } from "../sprites/png";
import { ARENAS, exportArena } from "./arena";
import { ROM_PATH } from "./cartridge";
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

  it("scrolls the sky at half the camera's speed, lined up at x 128", () => {
    const sky = tournament.file.layers[0];
    expect(sky.name).toBe("sky");
    const [speed, offset] = sky.scroll;
    expect(128 * speed + offset).toBe(128);
    expect(speed).toBe(0.5);
  });
});
