import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodePng } from "../sprites/png";
import { BURST_LOADS, ROM_PATH } from "./cartridge";
import { drawingAtSpawn, spawnerLoads } from "./objectTiles";
import { fighterNamed } from "./roster";
import type { ScriptOp } from "./script";

/** Their sheets hold no pixel, so they fly unseen: `docs/bugs.md`. Delete as each is put right; Mr. Buu's `8` stay, their picture is a circle (`rom.md`). */
const DRAWS_NOTHING = new Set(["buu_9_17", "buu_9_18", "buu_9_19", "freeza_6_15", "mr_buu_8_0f", "mr_buu_8_10", "mr_buu_8_11", "mr_buu_8_12"]);

const spawn = (anim: number): ScriptOp => ({ op: "spawn", counter: 0, type: 1, anim, tiles: 0, palette: 0, dx: 0, dy: 0, timer: 0, vx: 0, vy: 0 });

describe("drawingAtSpawn", () => {
  it("takes the drawing of the step after the spawn, not the one before it", () => {
    const ops: ScriptOp[] = [{ op: "show", frames: 4, drawing: 0x11 }, spawn(8), { op: "sound", id: 0x0b }, { op: "show", frames: 21, drawing: 0x7d }];
    expect(drawingAtSpawn(ops, 1, 8)).toBe(0x7d);
  });

  it("skips a step that keeps the drawing up, and says null when none follows", () => {
    expect(drawingAtSpawn([spawn(8), { op: "show", frames: 2, drawing: null }, { op: "show", frames: 2, drawing: 0x80 }], 1, 8)).toBe(0x80);
    expect(drawingAtSpawn([spawn(8)], 1, 8)).toBeNull();
  });
});

describe.skipIf(!existsSync(ROM_PATH))("spawnerLoads, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const vegeta = fighterNamed(rom, "vegeta");

  it("takes what the move loads: Big Bang's resource 4f at $6C00", () => {
    expect(spawnerLoads(rom, vegeta, 1, 4)).toEqual([{ resource: 0x4f, vram: 0x6c00 }]);
  });

  it("takes his sprite when the move loads nothing: Jumping Bomb's drawing 7d, Energy Dash's 80", () => {
    expect(spawnerLoads(rom, vegeta, 1, 8)).toEqual([{ resource: 0x255, vram: 0x6000 }]);
    expect(spawnerLoads(rom, vegeta, 1, 9)).toEqual([{ resource: 0x259, vram: 0x6000 }]);
  });

  it("takes the shared tiles for a type a object, whatever its move loads: Kakusan's two", () => {
    const mrBuu = fighterNamed(rom, "mr_buu");
    expect(spawnerLoads(rom, mrBuu, 0xa, 0x25)).toEqual(BURST_LOADS);
    expect(spawnerLoads(rom, mrBuu, 0xa, 0x26)).toEqual(BURST_LOADS);
  });

  it("says nothing for a move that loads nothing but draws past base 0: af's shots count on ae's load", () => {
    expect(spawnerLoads(rom, vegeta, 1, 0xe)).toEqual([]);
  });
});

describe("the objects' sheets, as exported", () => {
  const drafted = readdirSync("data/entities")
    .filter((fighter) => existsSync(`data/entities/${fighter}/objects.json`))
    .flatMap((fighter) => JSON.parse(readFileSync(`data/entities/${fighter}/objects.json`, "utf8")) as { name: string }[])
    .map((o) => o.name)
    .filter((name) => existsSync(`assets/sheets/spawns/${name}.png`));

  it("each shows something: a bolt with a blank sheet still flies and strikes", () => {
    const wrong = drafted.filter((name) => {
      const sheet = decodePng(readFileSync(`assets/sheets/spawns/${name}.png`));
      const blank = sheet.data.every((value, i) => i % 4 !== 3 || value === 0);
      // one put right must leave the list, or the list stops meaning anything
      return blank !== DRAWS_NOTHING.has(name);
    });
    expect(wrong).toEqual([]);
  });
});
