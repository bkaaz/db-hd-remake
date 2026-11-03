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
