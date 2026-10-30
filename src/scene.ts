import type { Application } from "pixi.js";
import type { Sounds } from "./audio/sounds";
import type { Keyboard } from "./input/keyboard";

/**
 * A scene is one screen of the game, and the only thing `main.ts` knows how to
 * run. The debug scene is one; a character select and a title are others, and
 * the fight a player will actually play is still ahead of us.
 *
 * **Every scene is built from a small serialisable request** — never from
 * objects the previous scene happened to leave behind (ADR 0008). That is what
 * makes jumping straight to the screen you are
 * working on free rather than a feature: if a character select can describe a
 * match in three values, so can the address bar.
 *
 * A scene asks to be replaced by *returning a request*, not by building its
 * successor. Otherwise the character select would have to know how to construct
 * a match — its modules, its loading, its wiring — and the two screens would be
 * welded together. Returning a request means the select and the URL speak the
 * same language, and only `main.ts` turns that language into a scene.
 */
export interface Scene {
  /** One fixed step. Returns a request to change scene, or null to carry on. */
  step(keyboard: Keyboard): SceneRequest | null;
  /** Draw, once per rendered frame rather than per game frame. */
  render(keyboard: Keyboard): void;
  /**
   * Give everything back: display objects and, above all, listeners. A scene
   * that outlives its own resize handler moves fighters that no longer exist.
   */
  destroy(): void;
}

/** What to run, in the few values it takes to say it. */
export type SceneRequest = { scene: "select" } | DebugRequest;

export interface DebugRequest {
  scene: "debug";
  p1: string;
  p2: string;
  mode: number;
  /** An arena from `data/arenas/`; none means the debug grid. */
  arena?: string;
  /** One of that arena's lightings; none means its first. */
  time?: string;
  /**
   * Player one's health to start from, out of the full amount — which stays
   * what charging refills to, as the original's starting health does.
   */
  hp?: number;
}

/**
 * What every scene is handed: the renderer, the game-wide sound bank, and the
 * keyboard — which is here rather than only in `step` because a scene may want
 * to *set* a toggle while it is being built, not just read one every frame.
 */
export interface SceneContext {
  app: Application;
  bank: Sounds;
  keyboard: Keyboard;
}

// The cartridge's `goku` (docs/plan.md); the hand-built one is `?p1=goku_old`.
const DEFAULT_FIGHTER = "goku";

/**
 * Read a request out of the address bar.
 *
 * An unknown scene or a missing parameter is a **loud error**, never a quiet
 * fallback to the default: everything here is a string, so `p1=gokú` is the
 * realistic mistake, and silently running something else sends you debugging
 * the wrong screen.
 */
/**
 * The same request written back as a query string, so a reload lands on the
 * scene you were on rather than at the beginning.
 *
 * Deliberately the inverse of `requestFromUrl`, in the same file: two halves of
 * one vocabulary drift apart the moment they live apart.
 */
export function queryFor(request: SceneRequest): string {
  const q = new URLSearchParams({ scene: request.scene });
  if (request.scene === "debug") {
    q.set("p1", request.p1);
    q.set("p2", request.p2);
    q.set("mode", String(request.mode));
    if (request.arena) q.set("arena", request.arena);
    if (request.time) q.set("time", request.time);
    if (request.hp !== undefined) q.set("hp", String(request.hp));
  }
  return `?${q.toString()}`;
}

export function requestFromUrl(url: URL): SceneRequest | string {
  const q = url.searchParams;
  const scene = q.get("scene") ?? "select";

  if (scene === "select") return { scene: "select" };
  if (scene === "debug") {
    const p1 = q.get("p1") ?? DEFAULT_FIGHTER;
    const asked = q.get("mode");
    const mode = asked === null ? 0 : Number(asked);
    if (!Number.isInteger(mode)) return `mode "${asked}" is not a mode number`;
    const arena = q.get("arena");
    const time = q.get("time");
    if (time !== null && arena === null) return `time "${time}" needs an arena`;
    const hp = q.get("hp");
    if (hp !== null && !(Number.isInteger(Number(hp)) && Number(hp) >= 1)) return `hp "${hp}" is not a whole number of health, 1 or more`;
    return {
      scene: "debug",
      p1,
      p2: q.get("p2") ?? p1,
      mode,
      ...(arena !== null && { arena }),
      ...(time !== null && { time }),
      ...(hp !== null && { hp: Number(hp) }),
    };
  }
  return `unknown scene "${scene}" — try select or debug`;
}
