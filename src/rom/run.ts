import { Dummy, type Script } from "../debug/dummy";

/**
 * A scenario for the original, `tools/re/runs/<name>.json`: a save state, and
 * what each pad does, in the debug dummy's own tokens — the same script can be
 * played by our game's mode 5 (ADR 0074). Pure: `scripts/original.ts` runs it.
 */
export interface Scenario {
  /** `raw/states/<state>.mss`. */
  state: string;
  frames: number;
  /** Health set as the state loads: an ultimate wants 80 or less. */
  hp1?: number;
  hp2?: number;
  p1?: Script;
  p2?: Script;
  /** The timeline goes on through a hit pause, as a player's hands do: what is entered during one. */
  free?: boolean;
  /** Frames to keep a picture of the screen from, `logs/run-<name>-f<frame>.png`. */
  shots?: number[];
}

/** One frame of a pad: `$4219` and `$4218` less left and right, and `dir` + fwd, − back. */
export interface PadFrame {
  high: number;
  low: number;
  dir: number;
}

const HIGH = { smash: 0x80, attack: 0x40 } as const;
const LOW = { blast: 0x80, strike: 0x40, guard: 0x20, dash: 0x10 } as const;
const UP = 0x08;
const DOWN = 0x04;

/** The pad frame by frame. Facing right, a script's fwd comes out as `right`, whichever way he looks in the game. */
export function padFrames(script: Script | undefined, frames: number): PadFrame[] | string {
  const dummy = Dummy.from({ does: [], ...script, loop: false });
  if (typeof dummy === "string") return dummy;
  return [...Array(frames)].map(() => {
    const input = dummy.input({ on: true, facing: 1, frozen: false });
    const held = (button: keyof typeof HIGH | keyof typeof LOW) => input[button] || input.holding[button];
    let high = (input.up ? UP : 0) | (input.down ? DOWN : 0);
    let low = 0;
    for (const [button, bit] of Object.entries(HIGH)) if (held(button as keyof typeof HIGH)) high |= bit;
    for (const [button, bit] of Object.entries(LOW)) if (held(button as keyof typeof LOW)) low |= bit;
    return { high, low, dir: input.right ? 1 : input.left ? -1 : 0 };
  });
}

/** The Lua table `tools/re/run.lua` reads. */
export function runTable(s: Scenario, paths: { state: string; out: string; shots: string }): string {
  const pad = (script?: Script) => {
    const frames = padFrames(script, s.frames);
    if (typeof frames === "string") throw new Error(frames);
    return `{${frames.map((f) => `{${f.high},${f.low},${f.dir}}`).join(",")}}`;
  };
  const health = [s.hp1 !== undefined ? `[1]=${s.hp1}` : "", s.hp2 !== undefined ? `[2]=${s.hp2}` : ""].filter(Boolean).join(",");
  const shots = (s.shots ?? []).map((f) => `[${f}]=true`).join(",");
  return `RUN = { state = ${JSON.stringify(paths.state)}, out = ${JSON.stringify(paths.out)}, shotsAt = ${JSON.stringify(paths.shots)}, shots = {${shots}}, frames = ${s.frames}, free = ${s.free === true}, health = {${health}}, pads = { ${pad(s.p1)}, ${pad(s.p2)} } }\n`;
}
