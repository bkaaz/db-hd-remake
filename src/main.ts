import { Application, Graphics } from "pixi.js";
import { Entity, NO_INPUT } from "./entity/entity";
import { loadEntityDef, type EntityDef } from "./entity/entityDef";
import { Audio } from "./audio/playback";
import { contact, impactPoint } from "./combat/hit";
import { separate } from "./combat/push";
import { validateSounds } from "./audio/sounds";
import { validateStates } from "./entity/states";
import { Keyboard } from "./input/keyboard";
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

  // sounds.json is hand-authored too, and a broken spec is silent rather than
  // loud — exactly the sort of thing nobody notices until they wonder why one
  // move has no impact.
  for (const problem of validateSounds(def.sounds)) console.error(`[sounds] ${problem}`);

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

  const audio = new Audio(def.sounds);
  const player = new Entity(def, SCALE, audio);
  const dummy = previewing ? null : new Entity(def, SCALE, audio);
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

  const keyboard = new Keyboard();
  const hud = new Hud(app, {
    name: def.name,
    previewAnim: previewing ? preview : null,
    belowMessage: noStates,
  });

  // The dummy has no input, so nothing it does can be seen — you cannot practise
  // blocking against someone who never swings. This is a **training fixture,
  // not an opponent**: on a timer it throws each attack in turn, so every
  // reaction, spark and knockback shows up without pretending to be an AI.
  // A real second player on the same keyboard is Stage 3.
  const DUMMY_ROTATION = ["punch", "kick", "punchHeavy", "kickHeavy"] as const;
  const DUMMY_PERIOD = 90;
  let dummyTimer = 0;
  let dummyNext = 0;

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
    // A blocked blow costs nothing and only moves you. Chip damage belongs to
    // specials, which do not exist yet, so a normal attack on guard is free to
    // eat — deliberately, since a block you cannot afford is not a block.
    const blocked = defender.guarding && defender.guardHit();
    const noise = attacker.attackSounds;
    audio.play(blocked ? noise.block : noise.hit);
    if (!blocked) {
      defender.hurtBy(attacker.attackDamage);
      defender.gotHit(attacker.attackReaction);
    }
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
      player.update(keyboard.frame(), dummy ? dummy.x : null, bounds);
      const dummyInput = { ...NO_INPUT };
      if (!keyboard.dummyAttacks) dummyTimer = 0;
      else if (dummy && ++dummyTimer >= DUMMY_PERIOD) {
        dummyTimer = 0;
        dummyInput[DUMMY_ROTATION[dummyNext]] = true;
        dummyNext = (dummyNext + 1) % DUMMY_ROTATION.length;
      }
      dummy?.update(dummyInput, player.x, bounds);
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
    hud.draw({
      playerHealth: player.healthFraction,
      dummyHealth: dummy ? dummy.healthFraction : null,
      state: player.state,
      dummyAttacks: keyboard.dummyAttacks,
    });
    player.render(keyboard.showBoxes);
    dummy?.render(keyboard.showBoxes);
    for (const fx of effects) fx.render(false);
  });
}

void boot();
