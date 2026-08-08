import { Application, Graphics, Text } from "pixi.js";
import { Entity, NO_INPUT } from "./entity";
import { loadEntityDef, type EntityDef } from "./entityDef";
import { validateStates } from "./states";

/**
 * Game entry point. Loads an entity authored in the entity editor
 * (docs/data-format.md) and runs it as a state machine (Phase D, docs/entity-editor.md):
 * arrow keys drive the player's states, which own the animation and velocity.
 *
 * The second Goku is a static training dummy — it exists so facing can be
 * opponent-relative. There is no collision between them yet (push boxes are
 * authored but not resolved), so you can walk through it and watch both turn.
 */

const ENTITY = "goku";
const SCALE = 3; // SNES sprites are small — scale up, nearest-neighbour.
const EDGE_MARGIN = 40;
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
    const { errors, warnings } = validateStates(def.states, Object.keys(def.animations));
    for (const w of warnings) console.warn(`[states] ${w}`);
    if (errors.length > 0) {
      for (const e of errors) console.error(`[states] ${e}`);
      const shown = errors.slice(0, 5).join("\n");
      const rest = errors.length > 5 ? `\n…and ${errors.length - 5} more (see console)` : "";
      showMessage(app, `states.json — ${errors.length} problem(s):\n${shown}${rest}`);
    }
  }

  const ground = new Graphics();
  app.stage.addChild(ground);

  // `?anim=<name>` previews one animation instead of running the state machine.
  const preview = new URL(location.href).searchParams.get("anim");
  const previewing = !!preview && !!def.animations[preview];

  const player = new Entity(def, SCALE);
  const dummy = previewing ? null : new Entity(def, SCALE);
  if (previewing && preview) player.preview(preview);
  app.stage.addChild(player.view);
  if (dummy) app.stage.addChild(dummy.view);

  let groundY = 0;
  let bounds = { min: EDGE_MARGIN, max: EDGE_MARGIN };
  const place = (first: boolean): void => {
    groundY = Math.round(app.screen.height * 0.8);
    bounds = { min: EDGE_MARGIN, max: Math.max(EDGE_MARGIN, app.screen.width - EDGE_MARGIN) };
    player.y = groundY;
    if (dummy) dummy.y = groundY;
    if (first) {
      player.x = app.screen.width * (dummy ? 0.35 : 0.5);
      if (dummy) dummy.x = app.screen.width * 0.65;
    } else {
      player.x = Math.max(bounds.min, Math.min(bounds.max, player.x));
      if (dummy) dummy.x = Math.max(bounds.min, Math.min(bounds.max, dummy.x));
    }
    ground
      .clear()
      .moveTo(0, groundY)
      .lineTo(app.screen.width, groundY)
      .stroke({ color: 0x333340, width: 1 });
  };
  place(true);
  app.renderer.on("resize", () => place(false));

  const noStates = !def.states && !previewing;
  if (noStates) {
    showMessage(app, `${def.name}: no states.json — showing the first animation`, true);
  }

  const held = { left: false, right: false };
  let showBoxes = true;

  const label = new Text({
    text: "",
    style: { fill: "#88aa88", fontFamily: "monospace", fontSize: 14 },
  });
  label.x = 8;
  label.y = noStates ? 28 : 8;
  app.stage.addChild(label);

  let acc = 0;
  app.ticker.add((ticker) => {
    acc += ticker.deltaMS / 1000;
    let guard = 0;
    while (acc >= FRAME_TIME && guard++ < 600) {
      acc -= FRAME_TIME;
      player.update(held, dummy ? dummy.x : null, bounds);
      dummy?.update(NO_INPUT, player.x, bounds);
    }
    player.render(showBoxes);
    dummy?.render(showBoxes);
    label.text = previewing
      ? `${def.name} · anim ${preview} · [B] boxes`
      : `${def.name} · [←/→] walk · [B] boxes · state: ${player.state} · facing ${player.facing > 0 ? "→" : "←"}`;
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") held.left = true;
    else if (e.key === "ArrowRight") held.right = true;
    else if (e.key === "b" || e.key === "B") showBoxes = !showBoxes;
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft") held.left = false;
    else if (e.key === "ArrowRight") held.right = false;
  });
}

function showMessage(app: Application, text: string, subtle = false): void {
  const label = new Text({
    text,
    style: {
      fill: subtle ? "#88aa88" : "#ffaa66",
      fontFamily: "monospace",
      fontSize: subtle ? 14 : 18,
      align: "center",
    },
  });
  label.anchor.set(0.5);
  label.x = app.screen.width / 2;
  label.y = subtle ? 24 : app.screen.height / 2;
  if (subtle) {
    label.anchor.set(0.5, 0);
    label.y = 8;
  }
  app.stage.addChild(label);
}

void boot();
