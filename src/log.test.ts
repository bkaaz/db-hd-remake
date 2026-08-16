import { afterEach, describe, expect, it, vi } from "vitest";
import { describes, logEvent, startRecording, stopRecording } from "./log";

/** Every line the module has tried to write, in order, with its `reset` flag. */
function capture(): { lines: string[]; resets: boolean[] } {
  const lines: string[] = [];
  const resets: boolean[] = [];
  vi.stubGlobal("fetch", (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as { lines: string[]; reset: boolean };
    lines.push(...body.lines);
    resets.push(body.reset);
    return Promise.resolve({ ok: true });
  });
  return { lines, resets };
}

afterEach(() => {
  stopRecording();
  describes([]);
  vi.unstubAllGlobals();
});

describe("what a recording says it is of", () => {
  it("puts the situation at the top of the file", () => {
    // Without it a log says only when it was made, and the debug scene's mode 0
    // is edited freely — two recordings a week apart would both call themselves
    // "mode 0" and describe different fights.
    const out = capture();
    describes(['debug mode 2: {"p2":{"does":["medium 20"]}}']);
    startRecording();
    expect(out.lines[0]).toContain("# recording started");
    expect(out.lines[1]).toBe('# debug mode 2: {"p2":{"does":["medium 20"]}}');
    expect(out.resets[0]).toBe(true);
  });

  it("survives having nothing to say", () => {
    const out = capture();
    startRecording();
    expect(out.lines).toHaveLength(1);
  });

  it("notes a change of situation instead of leaving the file lying", () => {
    // Stepping to another mode with M rebuilds the scene while the recording
    // runs on. Silence there would make every line after it describe something
    // the header does not.
    const out = capture();
    startRecording();
    describes(["debug mode 3: {}"]);
    stopRecording();
    expect(out.lines.some((l) => l.includes("— now debug mode 3: {}"))).toBe(true);
  });

  it("says nothing at all when no recording is running", () => {
    const out = capture();
    describes(["debug mode 1: {}"]);
    logEvent("P1 idle → punch");
    expect(out.lines).toHaveLength(0);
  });
});
