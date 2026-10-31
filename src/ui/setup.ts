import type { DebugRequest, SceneRequest } from "../scene";
import { picker, segmented, type Choice } from "./controls";
import type { Page } from "./page";
import { SCALES, type ScaleChoice } from "./scale";

/**
 * The bar over the game's screen: what scene runs, with whom and where, and
 * how big it is drawn. A pick is a new request handed to `go`, which rebuilds
 * the scene from it as an address would (ADR 0008) — the bar holds no state
 * the request does not. The scale is the page's (`Page.scale`), not the
 * scene's: changing it rebuilds nothing.
 */

interface Arena {
  name: string;
  times: string[];
}

const FIRST_DEBUG: DebugRequest = { scene: "debug", p1: "goku", p2: "goku", mode: 0 };
/** Health to start from, besides full (owner): above a fighter's own full it is full. */
const HEALTHS = [50, 80, 150, 200, 400];

export class SetupBar {
  private request: SceneRequest;
  /** What the debug scene was last, for switching back to it. */
  private debug: DebugRequest = FIRST_DEBUG;
  private notice = "";
  private fighters: string[] = [];
  private arenas: Arena[] = [];
  private modes = 1;

  constructor(
    request: SceneRequest,
    private readonly go: (request: SceneRequest) => void,
    private readonly page: Page,
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
    const json = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    const [entities, arenas, debug] = await Promise.all([json("/api/entities"), json("/api/arenas"), json("/api/debug")]);
    this.fighters = (entities as { fighters?: string[] }).fighters ?? [];
    this.arenas = (arenas as { arenas?: Arena[] }).arenas ?? [];
    this.modes = (debug as { modes?: unknown[] }).modes?.length ?? 1;
    this.render();
  }

  private render(): void {
    const r = this.request;
    const fields: HTMLElement[] = [];
    const field = (label: string, control: HTMLElement) => fields.push(labelled(label, control));

    field("scene", segmented(r.scene, [["select", "select"], ["debug", "debug"]], (v) => this.go(v === "debug" ? this.debug : { scene: "select" })));
    if (r.scene === "debug") {
      const change = (to: Partial<DebugRequest>) => this.go({ ...r, ...to });
      const fighters: Choice[] = this.fighters.map((f) => [f, f]);
      field("p1", picker(r.p1, fighters, (p1) => change({ p1 })));
      field("p2", picker(r.p2, fighters, (p2) => change({ p2 })));
      const arena = this.arenas.find((a) => a.name === r.arena);
      field(
        "arena",
        picker(r.arena ?? "", [["", "grid"], ...this.arenas.map((a): Choice => [a.name, a.name])], (v) =>
          this.go({ ...without(r, "arena", "time"), ...(v && { arena: v }) }),
        ),
      );
      if (arena) field("time", segmented(r.time ?? arena.times[0] ?? "", arena.times.map((t): Choice => [t, t]), (time) => change({ time })));
      const modes = Array.from({ length: this.modes }, (_, i): Choice => [String(i), String(i)]);
      field("mode", segmented(String(r.mode), modes, (v) => change({ mode: Number(v) })));
      for (const key of ["hp1", "hp2"] as const) {
        const now = r[key];
        const options: Choice[] = [["", "full"], ...HEALTHS.map((h): Choice => [String(h), String(h)])];
        field(
          `${key === "hp1" ? "p1" : "p2"} hp`,
          segmented(now === undefined ? "" : String(now), options, (v) => this.go(v ? { ...r, [key]: Number(v) } : without(r, key))),
        );
      }
    }
    field("scale", this.scalePicker());
    if (this.notice) {
      const line = document.createElement("span");
      line.className = "notice-line";
      line.textContent = this.notice;
      fields.push(line);
    }
    this.page.setup.replaceChildren(...fields);
  }

  private scalePicker(): HTMLElement {
    const options: Choice[] = [["auto", "auto"], ...SCALES.map((s): Choice => [String(s), `×${s}`])];
    return segmented(String(this.page.scale), options, (v) => {
      this.page.scale = v === "auto" ? "auto" : (Number(v) as ScaleChoice);
      this.render();
    });
  }
}

function labelled(label: string, control: HTMLElement): HTMLElement {
  const field = document.createElement("span");
  field.className = "field";
  const name = document.createElement("span");
  name.className = "lbl";
  name.textContent = label;
  field.append(name, control);
  return field;
}

/** The request without some of its optional parameters. */
function without(r: DebugRequest, ...keys: ("arena" | "time" | "hp1" | "hp2")[]): DebugRequest {
  const copy = { ...r };
  for (const k of keys) delete copy[k];
  return copy;
}
