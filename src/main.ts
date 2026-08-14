import { Application } from "pixi.js";
import { loadEntityDef, type EntityDef } from "./entity/entityDef";
import { Audio } from "./audio/playback";
import { validateSounds } from "./audio/sounds";
import { validateStates } from "./entity/states";
import { Effects } from "./fx/effects";
import { Keyboard } from "./input/keyboard";
import { Fighters } from "./match/fighters";
import { Stage } from "./stage";
import { TrainingFixture } from "./training/fixture";
import { Hud, showMessage } from "./ui/hud";

/**
 * Game entry point. Loads an entity authored in the entity editor
 * (docs/data-format.md) and runs it as a state machine (Phase D, docs/entity-editor.md):
 * arrow keys drive the player's states, which own the animation and velocity.
 *
 * The second Goku is an input-less training dummy: it exists so facing has an
 * opponent, it pushes back, and it takes hits.
 */

const ENTITY = "goku";
const SCALE = 3; // SNES sprites are small — scale up, nearest-neighbour.
const FRAME_TIME = 1 / 60;

async function boot(): Promise<void> {
  const app = new Application();
  await app.init({ background: "#101018", resizeTo: window, antialias: false });

  const mount = document.getElementById("app");
  if (!mount) throw new Error("Missing #app mount element");
  mount.appendChild(app.canvas);

  let def: EntityDef;
  try {
    def = await loadEntityDef(ENTITY);
  } catch (e) {
    showMessage(
      app,
      `Could not load entity "${ENTITY}".\nSave it from the entity editor first (npm run editor).\n${String(e)}`,
    );
    return;
  }

  if (Object.keys(def.animations).length === 0) {
    showMessage(app, `${def.name}: ${def.frames.size} frames, no animation`, true);
    return;
  }

  // states.json is hand-authored, so a broken cross-reference must be loud
  // rather than a console warning nobody reads. We still run, so the rest of
  // the entity stays inspectable.
  if (def.states) {
    const { errors, warnings } = validateStates(def.states, def.animations);
    for (const w of warnings) console.warn(`[states] ${w}`);
    if (errors.length > 0) {
      for (const e of errors) console.error(`[states] ${e}`);
      const shown = errors.slice(0, 5).join("\n");
      const rest = errors.length > 5 ? `\n…and ${errors.length - 5} more (see console)` : "";
      showMessage(app, `states.json — ${errors.length} problem(s):\n${shown}${rest}`);
    }
  }

  // sounds.json is hand-authored too, and a broken spec is silent rather than
  // loud — exactly the sort of thing nobody notices until they wonder why one
  // move has no impact.
  for (const problem of validateSounds(def.sounds)) console.error(`[sounds] ${problem}`);

  const effects = await Effects.load(app, ["fx_hit", "fx_hit_heavy"], SCALE);

  const stage = new Stage(app);

  // `?anim=<name>` previews one animation instead of running the state machine.
  const preview = new URL(location.href).searchParams.get("anim");
  const previewing = !!preview && !!def.animations[preview];

  const audio = new Audio(def.sounds);
  const fighters = new Fighters({ app, def, scale: SCALE, audio, effects, solo: previewing });
  if (previewing && preview) fighters.preview(preview);
  fighters.start(stage);
  stage.onResize(() => fighters.fit(stage));

  const noStates = !def.states && !previewing;
  if (noStates) {
    showMessage(app, `${def.name}: no states.json — showing the first animation`, true);
  }

  const keyboard = new Keyboard();
  const hud = new Hud(app, {
    name: def.name,
    previewAnim: previewing ? preview : null,
    belowMessage: noStates,
  });

  const fixture = new TrainingFixture();

  // The clock. Real time arrives in whatever lumps the monitor delivers, and is
  // spent here in whole 1/60 steps: everything the game knows — animation
  // timings, hitstop, the input buffer — is counted in frames, so the same
  // fight must play identically at 60Hz and at 144Hz. The guard is belt and
  // braces; Pixi already caps a lump at 100ms, so six steps is the real
  // ceiling.
  let acc = 0;
  app.ticker.add((ticker) => {
    acc += ticker.deltaMS / 1000;
    let guard = 0;
    while (acc >= FRAME_TIME && guard++ < 600) {
      acc -= FRAME_TIME;
      fighters.update(keyboard.frame(), fixture.input(keyboard.dummyAttacks), stage.bounds);
      fighters.pushApart(stage.bounds);
      fighters.exchangeBlows();
      effects.update(fighters.frozen, stage.bounds);
    }
    hud.draw({ ...fighters.status(), dummyAttacks: keyboard.dummyAttacks });
    fighters.render(keyboard.showBoxes);
    effects.render();
  });
}

void boot();
