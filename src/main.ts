import { Application } from "pixi.js";
import { loadSoundBank } from "./audio/bank";
import { Keyboard } from "./input/keyboard";
import {
  queryFor,
  requestFromUrl,
  type Scene,
  type SceneContext,
  type SceneRequest,
} from "./scene";
import { FightScene } from "./scenes/fight";
import { SelectScene } from "./scenes/select";
import { showMessage } from "./ui/hud";

/**
 * Game entry point: put a renderer on the page, load what every scene needs,
 * run the first scene, and turn the crank.
 *
 * Nothing here knows what a fight is. A scene asks to be replaced by returning
 * a request, and this is the only place that turns a request into a scene —
 * which is also why the address bar can do it (see `docs/decisions.md`).
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

  const ctx: SceneContext = { app, bank: await loadSoundBank() };
  const keyboard = new Keyboard();

  /** Null while a scene is being loaded: the crank turns, nothing happens. */
  let scene: Scene | null = null;
  let loading = false;

  function go(request: SceneRequest): void {
    // `replaceState`, not `pushState`: going back would have to rebuild a scene
    // from a request, which is possible but is a feature nobody asked for. This
    // only has to survive a reload.
    history.replaceState(null, "", queryFor(request));
    scene?.destroy();
    scene = null;
    loading = true;
    void build(ctx, request).then((result) => {
      loading = false;
      if (typeof result === "string") showMessage(app, result);
      else scene = result;
    });
  }

  const request = requestFromUrl(new URL(location.href));
  if (typeof request === "string") {
    showMessage(app, request);
    return;
  }
  go(request);

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
    case "fight":
      return FightScene.create(ctx, request);
    case "select":
      return SelectScene.create(ctx);
  }
}

void boot();
