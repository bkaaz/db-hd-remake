import type { FrameDef } from "../entity/entityFile";

/**
 * Anchors for a run of frames that belong to one airborne move.
 *
 * Auto-detection puts every anchor at the bottom of the frame's rectangle,
 * which is right for a fighter standing on it and wrong for one in the air: the
 * rectangles are cut tight, so their heights differ by whatever the limbs are
 * doing, and the body pops by the difference. `hop_lunge`'s five frames sat at
 * −70, −90, −69, −59 and −72, which is a twenty-pixel jolt in the middle of a
 * jump where nothing touches the ground.
 *
 * The fix is to anchor on something the move keeps still. The **top** of the
 * rectangle will not do — in `hop_lunge` it is the head in four frames and a
 * thrown leg in the fifth — so this uses the silhouette's **centre of mass**,
 * which limbs move around rather than move.
 *
 * Only Y. The horizontal anchor is the mirroring pivot and moving it shifts
 * every authored box with it, which is a different job with different risks.
 *
 * Pure: the caller reads the sheet and hands over the masks.
 */

/**
 * Row of the silhouette's centre of mass, from the top of the frame.
 * `null` for a frame with no opaque pixels, which has no body to place.
 */
export function centreOfMass(mask: Uint8Array, frame: FrameDef): number | null {
  let sum = 0;
  let count = 0;
  for (let y = 0; y < frame.h; y++) {
    for (let x = 0; x < frame.w; x++) {
      if (mask[y * frame.w + x]) {
        sum += y;
        count++;
      }
    }
  }
  return count === 0 ? null : sum / count;
}

/**
 * New anchor Y for each frame, so the body holds one height across the run.
 *
 * **The run keeps the height it already had.** The offset applied to every frame
 * is the *median* of the offsets they have now, so this removes the jitter
 * without lifting or dropping the move as a whole — and one badly cut frame
 * cannot drag the rest with it, which a mean would allow.
 *
 * A frame with an empty mask keeps the anchor it has: there is nothing to
 * measure and inventing one would be worse than leaving it alone.
 */
export function alignedAnchorY(frames: readonly { frame: FrameDef; mask: Uint8Array }[]): number[] {
  const centres = frames.map(({ frame, mask }) => centreOfMass(mask, frame));
  const offsets = frames
    .map(({ frame }, i) => (centres[i] === null ? null : frame.anchor[1] - (centres[i] as number)))
    .filter((d): d is number => d !== null);
  if (offsets.length === 0) return frames.map(({ frame }) => frame.anchor[1]);

  const sorted = [...offsets].sort((a, b) => a - b);
  const middle = sorted[(sorted.length - 1) >> 1];
  return frames.map(({ frame }, i) =>
    centres[i] === null ? frame.anchor[1] : Math.round((centres[i] as number) + middle),
  );
}
