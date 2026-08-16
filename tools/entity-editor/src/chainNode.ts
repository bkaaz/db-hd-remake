import { state } from "./store";
import { getSource } from "./imageProcess";

/**
 * The picture on a node.
 *
 * Apart from the graph because it is about the sheet, not about the chain: it
 * answers "what does this move look like", which is the only reason the graph
 * reads as a combo instead of as a state diagram.
 */

/**
 * The frame this attack actually hits on, cut out of the sheet.
 *
 * A name tells you nothing about a blow and a picture tells you everything, so
 * the node *is* the pose — which is also the only thing that makes this read as
 * a combo rather than as a diagram of a state machine.
 */
export function hitFrameOf(anim: string): HTMLCanvasElement | null {
  const steps = state.anims.find((a) => a.name === anim)?.steps ?? [];
  const step = steps.find((s) => s.boxes.some((b) => b.type === "hit")) ?? steps[0];
  const frame = state.frames.find((f) => f.id === step?.frame);
  // The keyed canvas, not the raw sheet: the same source the preview and the
  // atlas export use, so the pose sits on the node's own background instead of
  // a rectangle of whatever colour the rip happened to have.
  const sheet = getSource();
  if (!frame || !sheet) return null;

  const scale = Math.min(SHOT / frame.w, SHOT / frame.h, 2);
  const canvas = document.createElement("canvas");
  canvas.className = "chain-shot";
  canvas.width = Math.round(frame.w * scale);
  canvas.height = Math.round(frame.h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, frame.x, frame.y, frame.w, frame.h, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Longest side of a node's picture, in screen px. */
const SHOT = 96;
