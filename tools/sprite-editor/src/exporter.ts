import { state } from "./store";

/**
 * Builds the on-disk character file (docs/data-format.md) from editor state
 * and downloads it. For this MVP the loaded sheet *is* the atlas — frames
 * reference rects straight into it — so no repacking happens yet.
 */

interface FrameOut {
  x: number;
  y: number;
  w: number;
  h: number;
  anchor: [number, number];
}
interface StepOut {
  frame: string;
  dur: number;
}
interface AnimOut {
  loop: boolean;
  steps: StepOut[];
}
interface CharacterOut {
  name: string;
  atlas: string;
  frames: Record<string, FrameOut>;
  animations: Record<string, AnimOut>;
}

export function buildCharacter(): CharacterOut {
  const frames: Record<string, FrameOut> = {};
  for (const f of state.frames) {
    frames[f.id] = { x: f.x, y: f.y, w: f.w, h: f.h, anchor: f.anchor };
  }
  const animations: Record<string, AnimOut> = {};
  for (const a of state.anims) {
    animations[a.name] = {
      loop: a.loop,
      steps: a.steps.map((s) => ({ frame: s.frame, dur: s.dur })),
    };
  }
  return {
    name: state.charName,
    atlas: state.atlasFilename,
    frames,
    animations,
  };
}

export function downloadJSON(): void {
  const json = JSON.stringify(buildCharacter(), null, 2);
  triggerDownload(
    new Blob([json], { type: "application/json" }),
    `${state.charName}.character.json`,
  );
}

/** Re-encode the loaded sheet as the atlas PNG, so it ships next to the JSON. */
export function downloadAtlas(): void {
  if (!state.image) return;
  const c = document.createElement("canvas");
  c.width = state.image.width;
  c.height = state.image.height;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(state.image, 0, 0);
  c.toBlob((blob) => {
    if (blob) triggerDownload(blob, state.atlasFilename);
  });
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
