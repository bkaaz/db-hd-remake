import { Application, Text } from "pixi.js";

/**
 * Entry point. For now this only boots PixiJS and confirms the render pipeline
 * works — no game logic yet. Mechanics, scenes and the game loop come later,
 * once we've agreed on the design in docs/.
 */
async function boot(): Promise<void> {
  const app = new Application();

  await app.init({
    background: "#101018",
    resizeTo: window,
    antialias: false, // pixel-art game — keep edges hard
  });

  const mount = document.getElementById("app");
  if (!mount) throw new Error('Missing #app mount element in index.html');
  mount.appendChild(app.canvas);

  // Temporary placeholder so we can visually confirm the setup runs.
  const label = new Text({
    text: "DBZ: Hyper Dimension — Remake\n(setup OK — no game yet)",
    style: {
      fill: "#f0f0f0",
      fontFamily: "monospace",
      fontSize: 20,
      align: "center",
    },
  });
  label.anchor.set(0.5);
  label.x = app.screen.width / 2;
  label.y = app.screen.height / 2;
  app.stage.addChild(label);

  app.renderer.on("resize", () => {
    label.x = app.screen.width / 2;
    label.y = app.screen.height / 2;
  });
}

void boot();
