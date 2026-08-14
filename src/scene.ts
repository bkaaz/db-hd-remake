import type { Application } from "pixi.js";
import type { Sounds } from "./audio/sounds";
import type { Keyboard } from "./input/keyboard";

/**
 * A scene is one screen of the game, and the only thing `main.ts` knows how to
 * run. The fight is one; a character select and a title will be others.
 *
 * **Every scene is built from a small serialisable request** — never from
 * objects the previous scene happened to leave behind (see `decisions.md`,
 * 2026-08-14). That is what makes jumping straight to the screen you are
 * working on free rather than a feature: if a character select can describe a
 * match in three values, so can the address bar.
 *
 * A scene asks to be replaced by *returning a request*, not by building its
 * successor. Otherwise the character select would have to know how to construct
 * a fight — its modules, its loading, its wiring — and the two screens would be
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
export type SceneRequest =
  | { scene: "select" }
  | { scene: "fight"; p1: string; p2: string };

/** What every scene is handed: the renderer, and the game-wide sound bank. */
export interface SceneContext {
  app: Application;
  bank: Sounds;
}

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
  if (request.scene === "fight") {
    q.set("p1", request.p1);
    q.set("p2", request.p2);
  }
  return `?${q.toString()}`;
}

export function requestFromUrl(url: URL): SceneRequest | string {
  const q = url.searchParams;
  const scene = q.get("scene") ?? "select";

  if (scene === "select") return { scene: "select" };
  if (scene === "fight") {
    const p1 = q.get("p1") ?? DEFAULT_FIGHTER;
    return { scene: "fight", p1, p2: q.get("p2") ?? p1 };
  }
  return `unknown scene "${scene}" — try select or fight`;
}
