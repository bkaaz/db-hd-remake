import { describe, expect, it } from "vitest";
import { catalogue, lag, loud, presses, sounding, span } from "./soundTest";

const LOG = [
  "# header",
  "# a f10",
  "f10 sound 05",
  "f12 v7 env=127 pitch=1000 src=10",
  "f13 v7 env=90 pitch=1000 src=10",
  "# quiet f14",
  "f40 sound 27",
  "# a f50",
  "f51 sound 01",
  "f51 sound 40",
  "f51 sound 3c",
  "f53 v6 env=127 pitch=03f6 src=1a",
  "# quiet f60",
  "# a f70",
].join("\n");

describe("presses", () => {
  it("pairs each A with the quiet after it, and drops an A the log ends on", () => {
    expect(presses(LOG).map(({ a, quiet }) => ({ a, quiet }))).toEqual([
      { a: 10, quiet: 14 },
      { a: 50, quiet: 60 },
    ]);
  });

  it("takes the id asked for alone in its frame, and none from a sample streamed through the port", () => {
    expect(presses(LOG).map((p) => p.asked)).toEqual([0x05, null]);
  });
});

describe("catalogue", () => {
  it("names effects by id, then each fighter's three voices, then the lines", () => {
    expect(catalogue([0x01, 0x05, null, null, null, null, null, null, null, null], ["goku", "gohan"])).toEqual([
      "01", "05", "goku_30", "goku_31", "goku_32", "gohan_30", "gohan_31", "gohan_32", "line_00", "line_01",
    ]);
  });

  it("stops where the list wraps to its first entry", () => {
    expect(catalogue([0x01, 0x05, null, 0x01, 0x05], [])).toEqual(["01", "05", "line_00"]);
  });
});

describe("sounding", () => {
  it("marks the frames a voice sounded, and no others", () => {
    const s = sounding(LOG);
    expect([...s.keys()].filter((f) => s[f])).toEqual([12, 13, 53]);
  });
});

describe("loud", () => {
  it("marks the frames above the floor", () => {
    const samples = new Float32Array(40);
    samples.fill(0.5, 10, 20);
    expect([...loud(samples, 10)]).toEqual([0, 1, 0, 0]);
  });
});

describe("lag", () => {
  const log = Uint8Array.from([0, 1, 1, 0, 0, 1, 0, 0]);
  const shifted = (by: number) => Uint8Array.from({ length: 20 }, (_, w) => log[w - by] ?? 0);

  it("finds how far the WAV runs ahead", () => {
    expect(lag(log, shifted(7), 0, 12)).toBe(7);
  });

  it("counts silence agreeing as much as sound, so a loud stretch does not win", () => {
    const wav = Uint8Array.from([1, 1, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0]);
    expect(lag(Uint8Array.from([1, 0, 1, 0]), wav, 0, 8)).toBe(6);
  });

  it("looks only at the log's frames it is given", () => {
    // the second burst alone, in a WAV where only it moved
    const wav = Uint8Array.from({ length: 20 }, (_, w) => (w === 1 || w === 2 || w === 9 ? 1 : 0));
    expect(lag(log, wav, -2, 6, 4, 8)).toBe(4);
  });
});

describe("span", () => {
  const wav = Uint8Array.from([0, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 0]);

  it("shrinks to the loud frames around the press", () => {
    expect(span({ a: 2, quiet: 5 }, 0, wav, 1, 1)).toEqual({ from: 3, to: 6 });
  });

  it("never reaches a sound past its margin", () => {
    expect(span({ a: 2, quiet: 5 }, 0, wav, 1, 2)).toEqual({ from: 3, to: 6 });
    expect(span({ a: 2, quiet: 5 }, 0, wav, 1, 4)).toEqual({ from: 3, to: 9 });
  });

  it("is null for a number that plays nothing", () => {
    expect(span({ a: 9, quiet: 11 }, 0, wav, 0, 0)).toBeNull();
  });
});
