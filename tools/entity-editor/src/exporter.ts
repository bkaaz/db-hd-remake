import { state, type Box } from "./store";
import { getSource } from "./imageProcess";

/**
 * Builds the on-disk entity file (docs/data-format.md) from editor state and
 * downloads it. For now the loaded sheet *is* the atlas — frames reference rects
 * straight into it — so no repacking happens yet.
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
  boxes?: Box[];
}
interface AnimOut {
  loop: boolean;
  steps: StepOut[];
}
interface EntityOut {
  name: string;
  atlas: string;
  frames: Record<string, FrameOut>;
  animations: Record<string, AnimOut>;
}

/** The `frames` section: id -> rect + anchor. */
export function buildFrames(): Record<string, FrameOut> {
  const frames: Record<string, FrameOut> = {};
  for (const f of state.frames) {
    frames[f.id] = { x: f.x, y: f.y, w: f.w, h: f.h, anchor: f.anchor };
  }
  return frames;
}

/** The `animations` section: name -> { loop, steps }. */
export function buildAnimations(): Record<string, AnimOut> {
  const animations: Record<string, AnimOut> = {};
  for (const a of state.anims) {
    animations[a.name] = {
      loop: a.loop,
      steps: a.steps.map((s) => {
        const out: StepOut = { frame: s.frame, dur: s.dur };
        if (s.boxes.length) out.boxes = s.boxes.map((b) => ({ ...b }));
        return out;
      }),
    };
  }
  return animations;
}

/** The whole entity (used for the Export-JSON fallback download). */
export function buildEntity(): EntityOut {
  return {
    name: state.entityName,
    atlas: state.atlasFilename,
    frames: buildFrames(),
    animations: buildAnimations(),
  };
}

export function downloadJSON(): void {
  const json = JSON.stringify(buildEntity(), null, 2);
  triggerDownload(
    new Blob([json], { type: "application/json" }),
    `${state.entityName}.entity.json`,
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

/** Write a single section file (data/entities/<name>/<section>.json). */
async function saveSection(
  section: string,
  data: unknown,
  atlasPngBase64?: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch("/api/section", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: state.entityName, section, data, atlasPngBase64 }),
    });
    const resp = (await res.json()) as { error?: string; atlasWritten?: boolean };
    if (!res.ok) return { ok: false, message: resp.error ?? "save failed" };
    return {
      ok: true,
      message:
        `Saved data/entities/${state.entityName}/${section}.json` +
        (resp.atlasWritten ? ` + assets/atlases/${state.entityName}.png` : ""),
    };
  } catch (e) {
    return { ok: false, message: `No editor server (run npm run editor) — ${String(e)}` };
  }
}

/** Save the `frames` section (+ the keyed atlas the frames index into). */
export function saveFrames(): Promise<{ ok: boolean; message: string }> {
  return saveSection("frames", buildFrames(), getAtlasDataURL() ?? undefined);
}

/** Save the `animations` section. */
export function saveAnimations(): Promise<{ ok: boolean; message: string }> {
  return saveSection("animations", buildAnimations());
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
