import { Application, Graphics, Text } from "pixi.js";
import { Entity, NO_INPUT } from "./entity";
import { loadEntityDef, type EntityDef } from "./entityDef";
import { contact, impactPoint } from "./hit";
import { separate } from "./push";
import { validateStates } from "./states";

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
    const { errors, warnings } = validateStates(def.states, def.animations);
    for (const w of warnings) console.warn(`[states] ${w}`);
    if (errors.length > 0) {
      for (const e of errors) console.error(`[states] ${e}`);
      const shown = errors.slice(0, 5).join("\n");
      const rest = errors.length > 5 ? `\n…and ${errors.length - 5} more (see console)` : "";
      showMessage(app, `states.json — ${errors.length} problem(s):\n${shown}${rest}`);
    }
  }

  // Effects are entities with no states: one animation, played once, then gone.
  // They are generated (`npm run fx`), so a clone that has not run it yet is
  // missing their atlas — the game says so once and carries on without sparks.
  const fxDefs = new Map<string, EntityDef>();
  for (const name of ["fx_hit", "fx_hit_heavy"]) {
    try {
      fxDefs.set(name, await loadEntityDef(name));
    } catch (e) {
      console.warn(`[fx] no "${name}" — run \`npm run fx\` to generate it. ${String(e)}`);
    }
  }

  const ground = new Graphics();
  app.stage.addChild(ground);

  /** Live effects, removed as they finish. */
  const effects: Entity[] = [];

  /**
   * Put an effect on screen, centred on a point in the world.
   *
   * An effect's animations are interchangeable variants, so one is picked at
   * random: four squashed sparks stop a combo looking like the same stamp
   * printed over and over. The mirror doubles that for free and, unlike a
   * rotation, is exact — it moves whole pixels, so nothing is resampled.
   */
  const spawnFx = (name: string, x: number, y: number): void => {
    const fxDef = fxDefs.get(name);
    if (!fxDef) return;
    const variants = Object.keys(fxDef.animations);
    if (variants.length === 0) return;
    const fx = new Entity(fxDef, SCALE);
    fx.preview(variants[Math.floor(Math.random() * variants.length)]);
    fx.facing = Math.random() < 0.5 ? 1 : -1;
    fx.x = x;
    fx.y = y;
    app.stage.addChild(fx.view);
    effects.push(fx);
  };

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
    player.groundY = groundY;
    if (dummy) dummy.groundY = groundY;
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

  // Attack is edge-triggered: pressing the key arms one game frame, so holding
  // it does not machine-gun. Keyboard layout follows the ZSNES default
  // (A=X, B=Z, X=S, Y=A, L=C, R=D), in the usual diamond: top row punches, bottom
  // row kicks, left column light, right column heavy. Remapping comes later.
  const held = {
    left: false,
    right: false,
    up: false,
    punch: false,
    kick: false,
    punchHeavy: false,
    kickHeavy: false,
  };
  const armed = { punch: false, kick: false, punchHeavy: false, kickHeavy: false };
  let showBoxes = true;

  const label = new Text({
    text: "",
    style: { fill: "#88aa88", fontFamily: "monospace", fontSize: 14 },
  });
  label.x = 8;
  label.y = noStates ? 28 : 8;
  app.stage.addChild(label);

  /**
   * An attacker's active hit boxes against a defender's hurt boxes. On a
   * connection the defender takes the reaction the attack asks for (or its own
   * default) and the attack is spent, so one swing lands once however long its
   * box is out.
   */
  const resolveHit = (attacker: Entity, defender: Entity): void => {
    if (!attacker.canHit) return;
    const boxes = attacker.boxes("hit");
    if (boxes.length === 0) return;
    const where = contact(
      { boxes, at: attacker.placement },
      { boxes: defender.boxes("hurt"), at: defender.placement },
    );
    if (!where) return;
    attacker.markHit();
    defender.gotHit(attacker.attackReaction);
    // The spark belongs at the deepest point of the blow, not at either
    // fighter's anchor and not at the middle of the overlap — see impactPoint.
    const at = impactPoint(where, attacker.facing);
    spawnFx(attacker.attackFx, at.x, at.y);
    // Both sides pause, not just the one taking it: freezing only the defender
    // lets the attacker walk on through the moment of contact.
    const stop = attacker.attackHitstop;
    attacker.freeze(stop);
    defender.freeze(stop);
  };

  let acc = 0;
  app.ticker.add((ticker) => {
    acc += ticker.deltaMS / 1000;
    let guard = 0;
    while (acc >= FRAME_TIME && guard++ < 600) {
      acc -= FRAME_TIME;
      for (const b of ["punch", "kick", "punchHeavy", "kickHeavy"] as const) {
        held[b] = armed[b];
        armed[b] = false;
      }
      player.update(held, dummy ? dummy.x : null, bounds);
      dummy?.update(NO_INPUT, player.x, bounds);
      if (dummy) {
        // Bodies cannot overlap — but only on the ground, so a jump can carry
        // you over the opponent instead of being blocked by them. A hit pause
        // suspends this too, or "frozen" would mean everything but the push.
        if (!player.airborne && !dummy.airborne && !player.frozen && !dummy.frozen) {
          const { ax, bx } = separate(
            { x: player.x, half: player.pushHalf },
            { x: dummy.x, half: dummy.pushHalf },
            bounds,
          );
          player.x = ax;
          dummy.x = bx;
        }
        resolveHit(player, dummy);
        resolveHit(dummy, player);
      }
      // Effects run on the same fixed step as the fighters, and a hit pause
      // holds them too — a spark that kept animating through hitstop would be
      // the one thing on screen giving the freeze away.
      const paused = player.frozen || !!dummy?.frozen;
      for (let i = effects.length - 1; i >= 0; i--) {
        const fx = effects[i];
        if (!paused) fx.update(NO_INPUT, null, bounds);
        if (fx.finished) {
          fx.view.destroy({ children: true });
          effects.splice(i, 1);
        }
      }
    }
    player.render(showBoxes);
    dummy?.render(showBoxes);
    for (const fx of effects) fx.render(false);
    label.text = previewing
      ? `${def.name} · anim ${preview} · [B] boxes`
      : `${def.name} · [←/→] walk · [↑] jump · [A/S] punch · [Z/X] kick · [B] boxes · state: ${player.state} · facing ${player.facing > 0 ? "→" : "←"}`;
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") held.left = true;
    else if (e.key === "ArrowRight") held.right = true;
    else if (e.key === "ArrowUp") held.up = true;
    else if (e.key === "a" || e.key === "A") {
      // Auto-repeat must not re-arm: one press, one attack.
      if (!e.repeat) armed.punch = true;
    } else if (e.key === "z" || e.key === "Z") {
      if (!e.repeat) armed.kick = true;
    } else if (e.key === "s" || e.key === "S") {
      if (!e.repeat) armed.punchHeavy = true;
    } else if (e.key === "x" || e.key === "X") {
      if (!e.repeat) armed.kickHeavy = true;
    } else if (e.key === "b" || e.key === "B") showBoxes = !showBoxes;
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft") held.left = false;
    else if (e.key === "ArrowRight") held.right = false;
    else if (e.key === "ArrowUp") held.up = false;
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
