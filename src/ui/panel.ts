import type { Toggle, Toggles } from "../debug/toggles";
import type { DebugRequest, SceneRequest } from "../scene";
import { addStyle, picker, RecordButton, switcher, type Choice } from "./controls";

/**
 * The scene's controls, in the page around the game's screen. Plain DOM
 * rather than PixiJS: a select is the browser's, and drawing one would be
 * building it again. A pick is a new request handed to `go`, which rebuilds
 * the scene from it as an address would (ADR 0008) — the panel holds no
 * state the request does not.
 */

interface Arena {
  name: string;
  times: string[];
}

const FIRST_DEBUG: DebugRequest = { scene: "debug", p1: "goku", p2: "goku", mode: 0 };
/** Health to start from, besides full (owner): above a fighter's own full it is full. */
const HEALTHS = [50, 80, 150, 200, 400];
/** The switches, with the key that flips each too. */
const SWITCHES: [Toggle, string][] = [["boxes", "boxes (B)"], ["readout", "readout (I)"], ["dummy", "dummy attacks (T)"]];

export class Panel {
  private readonly root = document.createElement("div");
  private request: SceneRequest;
  /** What the debug scene was last, for switching back to it from the select. */
  private debug: DebugRequest = FIRST_DEBUG;
  private notice = "";
  private fighters: string[] = [];
  private arenas: Arena[] = [];
  private modes = 1;
  private readonly record: RecordButton;

  constructor(
    request: SceneRequest,
    private readonly go: (request: SceneRequest) => void,
    private readonly toggles: Toggles,
  ) {
    this.request = request;
    addStyle();
    this.record = new RecordButton(() => toggles.flip("recording"));
    this.record.show(toggles.get("recording"));
    // a key flips a switch too, and the panel shows it
    toggles.onChange((toggle, on) => {
      if (toggle === "recording") this.record.show(on);
      else this.render();
    });
    Object.assign(this.root.style, {
      position: "fixed", left: "12px", bottom: "12px", display: "grid", gridTemplateColumns: "auto auto",
      gap: "4px 8px", alignItems: "center", font: "12px monospace", color: "#c8c8d8",
    });
    document.body.append(this.root);
    this.show(request);
    void this.load();
  }

  /** The scene now running, as the panel shows it. */
  show(request: SceneRequest): void {
    this.request = request;
    if (request.scene === "debug") this.debug = request;
    this.render();
  }

  /** A line under the controls: what the panel could not use. */
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
    const rows: HTMLElement[] = [];
    const row = (label: string, value: string, options: Choice[], pick: (value: string) => void) => {
      const name = document.createElement("span");
      name.textContent = label;
      rows.push(name, picker(value, options, pick));
    };

    row("scene", r.scene, [["select", "select"], ["debug", "debug"]], (v) => this.go(v === "debug" ? this.debug : { scene: "select" }));
    if (r.scene === "debug") {
      const change = (to: Partial<DebugRequest>) => this.go({ ...r, ...to });
      const fighters: Choice[] = this.fighters.map((f) => [f, f]);
      row("p1", r.p1, fighters, (p1) => change({ p1 }));
      row("p2", r.p2, fighters, (p2) => change({ p2 }));
      const arena = this.arenas.find((a) => a.name === r.arena);
      row("arena", r.arena ?? "", [["", "grid"], ...this.arenas.map((a): Choice => [a.name, a.name])], (v) =>
        this.go({ ...without(r, "arena", "time"), ...(v && { arena: v }) }),
      );
      if (arena) row("time", r.time ?? arena.times[0] ?? "", arena.times.map((t): Choice => [t, t]), (time) => change({ time }));
      row("mode", String(r.mode), Array.from({ length: this.modes }, (_, i): Choice => [String(i), String(i)]), (v) => change({ mode: Number(v) }));
      for (const key of ["hp1", "hp2"] as const) {
        const now = r[key];
        const options: Choice[] = [["", "full"], ...HEALTHS.map((h): Choice => [String(h), String(h)])];
        row(`${key === "hp1" ? "p1" : "p2"} hp`, now === undefined ? "" : String(now), options, (v) =>
          this.go(v ? { ...r, [key]: Number(v) } : without(r, key)),
        );
      }
    }
    if (r.scene === "debug") {
      const labelled = (label: string, control: HTMLElement) => {
        const name = document.createElement("span");
        name.textContent = label;
        rows.push(name, control);
      };
      for (const [toggle, label] of SWITCHES) labelled(label, switcher(this.toggles.get(toggle), (on) => this.toggles.set(toggle, on)));
      labelled("recording (L)", this.record.element);
    }
    if (this.notice) {
      const line = document.createElement("span");
      line.textContent = this.notice;
      line.style.gridColumn = "1 / 3";
      line.style.color = "#e0a060";
      rows.push(line);
    }
    this.root.replaceChildren(...rows);
  }
}

/** The request without some of its optional parameters. */
function without(r: DebugRequest, ...keys: ("arena" | "time" | "hp1" | "hp2")[]): DebugRequest {
  const copy = { ...r };
  for (const k of keys) delete copy[k];
  return copy;
}
