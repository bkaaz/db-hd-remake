import type { DebugRequest, SceneRequest } from "../scene";
import { arenaList, colourSets, dataDirs, readData } from "../data/files";
import { field, line, picker, segmented, type Choice } from "./controls";
import type { Page } from "./page";
import { SCALES, type ScaleChoice } from "./scale";
import { cartridge } from "../cartridge/romFile";
import { fightSongIds } from "../apu/music";
import type { Music } from "../audio/music";
import { readSongPick } from "../match/song";

/**
 * The picks that set a scene up, each where it belongs: over the game's
 * screen what the scene is and where it is fought; under each readout that
 * player's fighter and health. A pick is a new request handed to `go`, which
 * rebuilds the scene from it as an address would (ADR 0008) — this holds no
 * state the request does not. The scale is the page's (`Page.scale`), not
 * the scene's: changing it rebuilds nothing.
 */

interface Arena {
  name: string;
  times: string[];
}

const FIRST_DEBUG: DebugRequest = { scene: "debug", p1: "goku", p2: "goku", mode: 0 };
/**
 * Health to start from; none lit is full, and picking the lit one again goes
 * back to it (owner). Above a fighter's own full it is full.
 */
const HEALTHS = [50, 80, 150, 200, 400];
/** A fighter's palette: the original's rule, his own, or his second set; then his sets of ours. */
const COLOURS: Choice[] = [["", "auto"], ["1", "1"], ["2", "2"]];

export class SetupBar {
  private request: SceneRequest;
  /** What the debug scene was last, for switching back to it. */
  private debug: DebugRequest = FIRST_DEBUG;
  private notice = "";
  private fighters: string[] = [];
  /** Each fighter's colour sets of our own (`palettes.json`), offered beside 1 and 2. */
  private colourSets: Record<string, string[]> = {};
  private arenas: Arena[] = [];
  private modes = 1;
  /** The songs a fight plays, as the original's pre-fight choice offers them. */
  private songs: number[] = [];

  constructor(
    request: SceneRequest,
    private readonly go: (request: SceneRequest) => void,
    private readonly page: Page,
    private readonly music: Music,
  ) {
    this.request = request;
    this.show(request);
    void this.load();
  }

  /** The scene now running, as the bar shows it. */
  show(request: SceneRequest): void {
    this.request = request;
    if (request.scene === "debug") this.debug = request;
    this.render();
  }

  /** A line under the controls: what the bar could not use. */
  say(notice: string): void {
    this.notice = notice;
    this.render();
  }

  private async load(): Promise<void> {
    // the songs on their own: a player still picking his ROM keeps the rest of the bar
    void cartridge().then((rom) => {
      this.songs = fightSongIds(rom);
      this.render();
    });
    const [sets, arenas, debug] = await Promise.all([colourSets(), arenaList(), readData<{ modes?: unknown[] }>("debug.json")]);
    this.fighters = dataDirs("entities");
    this.colourSets = sets;
    this.arenas = arenas;
    this.modes = debug?.modes?.length ?? 1;
    this.render();
  }

  private render(): void {
    const r = this.request;
    const general = line(field("scene", segmented(r.scene, [["select", "select"], ["debug", "debug"]], (v) => this.go(v === "debug" ? this.debug : { scene: "select" }))));
    const arenaLine = line();
    const sides: HTMLElement[][] = [[], []];
    if (r.scene === "debug") {
      const change = (to: Partial<DebugRequest>) => this.go({ ...r, ...to });
      const modes = Array.from({ length: this.modes }, (_, i): Choice => [String(i), String(i)]);
      general.append(field("mode", segmented(String(r.mode), modes, (v) => change({ mode: Number(v) }))));

      const arena = this.arenas.find((a) => a.name === r.arena);
      const arenas: Choice[] = [["", "grid"], ...this.arenas.map((a): Choice => [a.name, a.name])];
      arenaLine.append(field("arena", picker(r.arena ?? "", arenas, (v) => this.go({ ...without(r, "arena", "time"), ...(v && { arena: v }) }))));
      if (arena) arenaLine.append(field("time", segmented(r.time ?? arena.times[0] ?? "", arena.times.map((t): Choice => [t, t]), (time) => change({ time }))));
      // the page's pick, not the scene's: a new one is heard at once and rebuilds nothing
      const songs: Choice[] = [["none", "none"], ["random", "random"], ...this.songs.map((s): Choice => [String(s), String(s)])];
      arenaLine.append(field("music", picker(String(this.music.pick), songs, (v) => (this.music.pick = readSongPick(v)))));

      const fighters: Choice[] = this.fighters.map((f) => [f, f]);
      const healths: Choice[] = HEALTHS.map((h) => [String(h), String(h)]);
      (["p1", "p2"] as const).forEach((who, i) => {
        const key = who === "p1" ? "hp1" : "hp2";
        const now = r[key] === undefined ? "" : String(r[key]);
        const pal = who === "p1" ? "pal1" : "pal2";
        sides[i].push(
          field("fighter", picker(r[who], fighters, (name) => change({ [who]: name }))),
          // auto is the original's: player two's second set when both are the same fighter
          // a set of ours shows as the next number after the cartridge's two, its name in the address
          field("palette", segmented(r[pal] ?? "", [...COLOURS, ...(this.colourSets[r[who]] ?? []).map((c, n): Choice => [c, String(n + 3)])], (v) => this.go(v ? { ...r, [pal]: v } : without(r, pal)))),
          field("hp", segmented(now, healths, (v) => this.go(v === now ? without(r, key) : { ...r, [key]: Number(v) }))),
        );
      });
    }
    arenaLine.append(field("scale", this.scalePicker()));
    const notice = this.notice ? [noticeLine(this.notice)] : [];
    this.page.setup.replaceChildren(general, arenaLine, ...notice);
    this.page.sides.forEach((side, i) => side.setup.replaceChildren(...sides[i]));
  }

  private scalePicker(): HTMLElement {
    const options: Choice[] = [["auto", "auto"], ...SCALES.map((s): Choice => [String(s), `×${s}`])];
    return segmented(String(this.page.scale), options, (v) => {
      this.page.scale = v === "auto" ? "auto" : (Number(v) as ScaleChoice);
      this.render();
    });
  }
}

function noticeLine(text: string): HTMLElement {
  const element = document.createElement("div");
  element.className = "notice-line";
  element.textContent = text;
  return element;
}

/** The request without some of its optional parameters. */
function without(r: DebugRequest, ...keys: ("arena" | "time" | "hp1" | "hp2" | "pal1" | "pal2")[]): DebugRequest {
  const copy = { ...r };
  for (const k of keys) delete copy[k];
  return copy;
}
