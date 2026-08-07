import { Application, Texture, Rectangle, Sprite, Text, Graphics } from "pixi.js";

/**
 * Game entry point. Loads an entity produced by the entity editor
 * (docs/data-format.md) — atlas + frame rects + timed animations — and plays it
 * in PixiJS. This is the first real rendering of our authored data; combat logic
 * comes later.
 */

interface FrameDef {
  x: number;
  y: number;
  w: number;
  h: number;
  anchor: [number, number];
}
interface Box {
  type: "hit" | "hurt" | "push";
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Step {
  frame: string;
  dur: number;
  boxes?: Box[];
}

const BOX_COLORS: Record<string, number> = {
  hit: 0xff3b3b,
  hurt: 0x4be04b,
  push: 0x4b9bff,
};
interface Anim {
  loop: boolean;
  steps: Step[];
}
interface EntityFile {
  name: string;
  atlas: string;
  frames: Record<string, FrameDef>;
  animations: Record<string, Anim>;
}

const ENTITY = "goku";
const SCALE = 3; // SNES sprites are small — scale up, nearest-neighbour.

interface FrameTex {
  tex: Texture;
  anchor: [number, number];
  w: number;
  h: number;
}

async function boot(): Promise<void> {
  const app = new Application();
  await app.init({ background: "#101018", resizeTo: window, antialias: false });

  const mount = document.getElementById("app");
  if (!mount) throw new Error("Missing #app mount element");
  mount.appendChild(app.canvas);

  let data: EntityFile;
  try {
    const res = await fetch(`/api/entity?name=${ENTITY}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = ((await res.json()) as { entity: EntityFile }).entity;
  } catch (e) {
    showMessage(app, `Could not load entity "${ENTITY}".\nSave it from the entity editor first (npm run editor).\n${String(e)}`);
    return;
  }

  const atlasImg = new Image();
  atlasImg.src = `/api/atlas?name=${ENTITY}`;
  await atlasImg.decode();
  const atlas = Texture.from(atlasImg);
  atlas.source.scaleMode = "nearest";

  // Build a sub-texture per frame.
  const frameTex = new Map<string, FrameTex>();
  for (const [id, f] of Object.entries(data.frames)) {
    frameTex.set(id, {
      tex: new Texture({ source: atlas.source, frame: new Rectangle(f.x, f.y, f.w, f.h) }),
      anchor: f.anchor,
      w: f.w,
      h: f.h,
    });
  }

  // Ground line.
  const ground = new Graphics();
  app.stage.addChild(ground);

  const sprite = new Sprite();
  sprite.scale.set(SCALE);
  app.stage.addChild(sprite);

  // Collision-box overlay (toggle with B).
  const boxG = new Graphics();
  app.stage.addChild(boxG);
  let showBoxes = true;
  let currentStep: Step | null = null;

  const drawBoxes = (): void => {
    boxG.clear();
    if (!showBoxes || !currentStep?.boxes) return;
    const facingLeft = sprite.scale.x < 0;
    for (const b of currentStep.boxes) {
      // Mirror box X around the anchor when the sprite faces left.
      const bx = facingLeft ? sprite.x - (b.x + b.w) * SCALE : sprite.x + b.x * SCALE;
      boxG
        .rect(bx, sprite.y + b.y * SCALE, b.w * SCALE, b.h * SCALE)
        .stroke({ color: BOX_COLORS[b.type] ?? 0xffffff, width: 1 });
    }
  };

  let groundY = 0;
  const place = (): void => {
    sprite.x = app.screen.width / 2;
    groundY = Math.round(app.screen.height * 0.8);
    sprite.y = groundY;
    ground
      .clear()
      .moveTo(0, groundY)
      .lineTo(app.screen.width, groundY)
      .stroke({ color: 0x333340, width: 1 });
    drawBoxes();
  };
  place();
  app.renderer.on("resize", place);

  const applyFrame = (id: string): void => {
    const ft = frameTex.get(id);
    if (!ft) return;
    sprite.texture = ft.tex;
    sprite.anchor.set(ft.anchor[0] / ft.w, ft.anchor[1] / ft.h);
  };

  if (Object.keys(data.animations).length === 0) {
    // No animation — just show the first frame so the sprite is visible.
    const first = Object.keys(data.frames)[0];
    if (first) applyFrame(first);
    showMessage(app, `${data.name}: ${Object.keys(data.frames).length} frames, no animation`, true);
    return;
  }

  // --- Animation player that can switch animations at runtime ------------
  let curAnim: Anim | null = null;
  let curName = "";
  let stepIndex = 0;
  let remaining = 0;
  let acc = 0;

  const stepDur = (): number =>
    curAnim ? Math.max(1, curAnim.steps[Math.min(stepIndex, curAnim.steps.length - 1)].dur) : 0;

  const applyStep = (): void => {
    if (!curAnim || curAnim.steps.length === 0) return;
    const step = curAnim.steps[Math.min(stepIndex, curAnim.steps.length - 1)];
    applyFrame(step.frame);
    currentStep = step;
    drawBoxes();
  };

  const setAnim = (name: string): void => {
    if (name === curName || !data.animations[name]) return;
    curName = name;
    curAnim = data.animations[name];
    stepIndex = 0;
    remaining = stepDur();
    acc = 0;
    applyStep();
  };

  const advanceAnim = (): void => {
    if (!curAnim || curAnim.steps.length === 0) return;
    remaining -= 1;
    if (remaining <= 0) {
      stepIndex += 1;
      if (stepIndex >= curAnim.steps.length) {
        stepIndex = curAnim.loop ? 0 : curAnim.steps.length - 1;
      }
      remaining = stepDur();
      applyStep();
    }
  };

  const animKeys = Object.keys(data.animations);
  // Idle = ?anim override, else the first non-"walk" animation, else the first.
  const wanted = new URL(location.href).searchParams.get("anim");
  const idleName =
    wanted && data.animations[wanted]
      ? wanted
      : (animKeys.find((k) => k !== "walk") ?? animKeys[0]);
  const hasWalk = !!data.animations["walk"];
  setAnim(idleName);

  // =====================================================================
  // TEMPORARY input + movement — placeholder to see walking.
  // Left/Right arrows move the character and play the "walk" animation;
  // releasing them returns to idle. A fighter keeps a FIXED facing (it faces
  // its opponent) — moving away = walking backward, no turn. Facing will flip
  // only when crossing to the opponent's other side (no opponent yet).
  // This is throwaway glue: it will be replaced by the proper command +
  // state-machine systems (docs/entity-editor.md, phases D/E) — input ->
  // command -> a "walk" state that owns the animation, velocity, facing, etc.
  // =====================================================================
  let left = false;
  let right = false;
  const WALK_SPEED = 2.5; // screen px per game frame (~150 px/s at 60 FPS)
  const clampX = (x: number): number => Math.max(40, Math.min(app.screen.width - 40, x));

  app.ticker.add((ticker) => {
    acc += ticker.deltaMS / 1000;
    const frameTime = 1 / 60;
    let guard = 0;
    while (acc >= frameTime && guard++ < 600) {
      acc -= frameTime;

      const dir = (right ? 1 : 0) - (left ? 1 : 0);
      if (dir !== 0 && hasWalk) {
        // Facing stays fixed (opponent-relative, added later); just move.
        setAnim("walk");
        sprite.x = clampX(sprite.x + dir * WALK_SPEED);
        drawBoxes();
      } else {
        setAnim(idleName);
      }

      advanceAnim();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") left = true;
    else if (e.key === "ArrowRight") right = true;
    else if (e.key === "b" || e.key === "B") {
      showBoxes = !showBoxes;
      drawBoxes();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft") left = false;
    else if (e.key === "ArrowRight") right = false;
  });

  const label = new Text({
    text: `${data.name} · [←/→] walk · [B] boxes`,
    style: { fill: "#88aa88", fontFamily: "monospace", fontSize: 14 },
  });
  label.x = 8;
  label.y = 8;
  app.stage.addChild(label);
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
