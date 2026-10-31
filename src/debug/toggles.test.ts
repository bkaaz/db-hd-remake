import { describe, expect, it } from "vitest";
import { REMEMBERED_TOGGLES, Toggles, type Memory } from "./toggles";

function memory(start: Record<string, string> = {}): Memory & { kept: Record<string, string> } {
  const kept = { ...start };
  return { kept, getItem: (k) => kept[k] ?? null, setItem: (k, v) => void (kept[k] = v) };
}

describe("Toggles", () => {
  it("starts with the boxes and the readout on, the dummy and the recording off", () => {
    const t = new Toggles(null);
    expect([t.get("boxes"), t.get("readout"), t.get("dummy"), t.get("recording")]).toEqual([true, true, false, false]);
  });

  it("comes back as it was left", () => {
    const m = memory();
    new Toggles(m).flip("boxes");
    expect(new Toggles(m).get("boxes")).toBe(false);
  });

  it("never remembers a recording", () => {
    const m = memory({ [REMEMBERED_TOGGLES]: JSON.stringify({ recording: true }) });
    const t = new Toggles(m);
    expect(t.get("recording")).toBe(false);
    t.set("recording", true);
    expect(new Toggles(m).get("recording")).toBe(false);
  });

  it("tells whoever listens, once per real change", () => {
    const t = new Toggles(null);
    const heard: string[] = [];
    t.onChange((toggle, on) => heard.push(`${toggle} ${on}`));
    t.flip("dummy");
    t.set("dummy", true);
    expect(heard).toEqual(["dummy true"]);
  });

  it("ignores a memory that does not read", () => {
    expect(new Toggles(memory({ [REMEMBERED_TOGGLES]: "{nope" })).get("boxes")).toBe(true);
  });
});
