/**
 * A body bobbing where it stands, as the original's pose above the arena
 * does it (`82`, `$0D:C40A`): its drawing raised a pixel every 4 frames to
 * 6 and lowered again, 48 frames round. Its own counter, zeroed when the
 * move starts and counted before it is read.
 */
export function hoverOffset(frame: number): number {
  const n = Math.floor(((frame + 1) % 48) / 4);
  return n < 6 ? 0 - n : n - 12;
}

/** A state's `soundsAt` due on its frame. */
export function soundsOn(soundsAt: [number, string][] | undefined, frame: number): string[] {
  return (soundsAt ?? []).filter(([at]) => at === frame).map(([, id]) => id);
}

/** A pixel back every other frame until `until` (Cell's intro, $10:C26B), 0 with no `until`. */
export function quiverOffset(frame: number, until: number | undefined): number {
  return until !== undefined && frame < until && frame % 2 === 1 ? -1 : 0;
}
