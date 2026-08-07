import { state } from "./store";
import { getSource } from "./imageProcess";

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

/**
 * Export the atlas PNG (keyed source, so background transparency is baked in),
 * so it ships next to the JSON.
 */
export function downloadAtlas(): void {
  const source = getSource();
  if (!source) return;
  const c = document.createElement("canvas");
  c.width = source.width;
  c.height = source.height;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0);
  c.toBlob((blob) => {
    if (blob) triggerDownload(blob, state.atlasFilename);
  });
}

/** The keyed atlas as a PNG data URL (for saving to the repo). */
export function getAtlasDataURL(): string | null {
  const source = getSource();
  if (!source) return null;
  const c = document.createElement("canvas");
  c.width = source.width;
  c.height = source.height;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0);
  return c.toDataURL("image/png");
}

/** Save the character JSON + keyed atlas to the repo via the dev-server API. */
export async function saveToRepo(): Promise<{ ok: boolean; message: string }> {
  const character = buildCharacter();
  const atlasPngBase64 = getAtlasDataURL();
  try {
    const res = await fetch("/api/character", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: state.charName, character, atlasPngBase64 }),
    });
    const data = (await res.json()) as { error?: string; atlasWritten?: boolean };
    if (!res.ok) return { ok: false, message: data.error ?? "save failed" };
    return {
      ok: true,
      message:
        `Saved public/characters/${state.charName}.character.json` +
        (data.atlasWritten ? ` + public/atlases/${state.charName}.png` : ""),
    };
  } catch (e) {
    return { ok: false, message: `No editor server (run npm run editor) — ${String(e)}` };
  }
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
