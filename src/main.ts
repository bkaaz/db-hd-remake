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
interface Step {
  frame: string;
  dur: number;
}
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
  };
  place();
  app.renderer.on("resize", place);

  const applyFrame = (id: string): void => {
    const ft = frameTex.get(id);
    if (!ft) return;
    sprite.texture = ft.tex;
    sprite.anchor.set(ft.anchor[0] / ft.w, ft.anchor[1] / ft.h);
  };

  const animName = Object.keys(data.animations)[0];
  const anim = animName ? data.animations[animName] : null;

  if (!anim || anim.steps.length === 0) {
    // No animation — just show the first frame so the sprite is visible.
    const first = Object.keys(data.frames)[0];
    if (first) applyFrame(first);
    showMessage(app, `${data.name}: ${Object.keys(data.frames).length} frames, no animation`, true);
    return;
  }

  // Fixed 60 FPS animation player driven off the render ticker.
  let stepIndex = 0;
  const stepDur = (): number => Math.max(1, anim.steps[Math.min(stepIndex, anim.steps.length - 1)].dur);
  let remaining = stepDur();
  let acc = 0;
  applyFrame(anim.steps[stepIndex].frame);

  app.ticker.add((ticker) => {
    acc += ticker.deltaMS / 1000;
    const frameTime = 1 / 60;
    let guard = 0;
    while (acc >= frameTime && guard++ < 600) {
      acc -= frameTime;
      remaining -= 1;
      if (remaining <= 0) {
        stepIndex += 1;
        if (stepIndex >= anim.steps.length) {
          stepIndex = anim.loop ? 0 : anim.steps.length - 1;
        }
        remaining = stepDur();
        applyFrame(anim.steps[stepIndex].frame);
      }
    }
  });

  const label = new Text({
    text: `${data.name} — "${animName}" (${anim.steps.length} steps, ${Object.keys(data.frames).length} frames)`,
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
