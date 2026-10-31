import { Application, type Text } from "pixi.js";
import { loadSoundBank } from "./audio/bank";
import { Toggles } from "./debug/toggles";
import { Keyboard } from "./input/keyboard";
import { startRecording, stopRecording } from "./log";
import { queryFor, type Scene, type SceneContext, type SceneRequest } from "./scene";
import { firstRequest, REMEMBERED } from "./sceneSource";
import { DebugScene } from "./scenes/debug";
import { SelectScene } from "./scenes/select";
import { Panel } from "./ui/panel";
import { showMessage } from "./ui/status";

/**
 * Game entry point: put a renderer on the page, load what every scene needs,
 * run the first scene, and turn the crank.
 *
 * Nothing here knows what a fight is. A scene asks to be replaced by returning
 * a request, and this is the only place that turns a request into a scene —
 * which is also why the address bar can do it (ADR 0008).
 */

const FRAME_TIME = 1 / 60;
/** Ten seconds of catch-up. Unreachable in practice — see the loop below. */
const MAX_CATCH_UP = 600;

async function boot(): Promise<void> {
  const app = new Application();
  await app.init({ background: "#101018", resizeTo: window, antialias: false });

  const mount = document.getElementById("app");
  if (!mount) throw new Error("Missing #app mount element");
  mount.appendChild(app.canvas);

  const toggles = new Toggles(localStorage);
  // the recording is a file being written, not only a flag
  toggles.onChange((toggle, on) => {
    if (toggle === "recording") (on ? startRecording : stopRecording)();
  });
  const keyboard = new Keyboard(toggles);
  const ctx: SceneContext = { app, bank: await loadSoundBank(), keyboard };

  /** Null while a scene is being loaded: the crank turns, nothing happens. */
  let scene: Scene | null = null;
  let loading = false;
  /** Why the last scene could not be built — taken down by the next pick. */
  let failure: Text | null = null;
  let builds = 0;

  function go(request: SceneRequest): void {
    // Remembered rather than written into the address: a reload lands where
    // you were, and the address stays short (ADR 0040).
    localStorage.setItem(REMEMBERED, queryFor(request));
    panel.show(request);
    scene?.destroy();
    scene = null;
    failure?.destroy();
    failure = null;
    loading = true;
    // Two picks in quick succession build two scenes; only the last may run.
    const ticket = ++builds;
    void build(ctx, request).then((result) => {
      if (ticket !== builds) {
        if (typeof result !== "string") result.destroy();
        return;
      }
      loading = false;
      if (typeof result === "string") failure = showMessage(app, result);
      else scene = result;
    });
  }

  const first = firstRequest(new URL(location.href), localStorage.getItem(REMEMBERED));
  if (typeof first.request === "string") {
    showMessage(app, first.request);
    return;
  }
  // What the address asked for is remembered now, so it can go: an old link
  // left in the bar would undo every pick made since on the next reload.
  history.replaceState(null, "", location.pathname);
  const panel = new Panel(first.request, go, toggles);
  if (first.notice) panel.say(first.notice);
  go(first.request);

  // The clock. Real time arrives in whatever lumps the monitor delivers and is
  // spent in whole 1/60 steps: everything the game knows — animation timings,
  // hitstop, the input buffer — is counted in frames, so the same fight must
  // play identically at 60Hz and at 144Hz. The guard is belt and braces; Pixi
  // already caps a lump at 100ms, so six steps is the real ceiling.
  let acc = 0;
  app.ticker.add((ticker) => {
    acc += ticker.deltaMS / 1000;
    let guard = 0;
    while (acc >= FRAME_TIME && guard++ < MAX_CATCH_UP) {
      acc -= FRAME_TIME;
      if (!scene) continue;
      const next = scene.step(keyboard);
      if (next) {
        go(next);
        break;
      }
    }
    scene?.render(keyboard);
    if (loading) acc = 0; // Do not bank the wait as frames the new scene owes.
  });
}

/** The only place that knows which class serves which request. */
function build(ctx: SceneContext, request: SceneRequest): Promise<Scene | string> {
  switch (request.scene) {
    case "debug":
      return DebugScene.create(ctx, request);
    case "select":
      return SelectScene.create(ctx);
  }
}

void boot();
