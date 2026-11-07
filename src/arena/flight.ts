/**
 * A sender's journey frame by frame, on the screen: the cartridge's handlers
 * (`rom.md`, The journey's screens) as a plan the scene plays (`match/journey.ts`).
 * Pure, so its timing is tested rather than watched.
 */

import type { Way } from "./ways";

/** One frame of the journey. A position is on the screen, in px; null hides him. */
export interface FlightFrame {
  defender: { x: number; y: number } | null;
  /** The arena is not shown: the original's screen of bands, blank in ours for now. */
  blank: boolean;
}

/** How fast he flies, either way: 8 px a frame ($01:8A0E, $01:8CA4). */
const SPEED = 8;
/** Where flying off ends ($01:8A3A, $01:8CD0): past these the old arena is let go. */
const GONE = { left: -0xc0, right: 0x1c0, top: -0xc0, bottom: 0x1c0 };
/** The frames the next arena takes to load (`$37` `C6`, `C7`), recorded. */
const LOADING = 53;
/** Flying in sideways, from off the screen to where he hangs ($01:8BB3). */
const IN = { fromLeft: -64, toRight: 0xc0, fromRight: 256 + 64, toLeft: 0x41 };
/** Hung there before he falls: field `0xF0` counted to `0x28`. */
const HANG = 0x28;

/**
 * Every frame from the end of the blow's pause to the frame before he is put
 * down on the new arena. `from` is where he was on the screen; `towardLeft`
 * is the way a sideways blow sends him.
 */
export function flightPlan(way: Way, towardLeft: boolean, from: { x: number; y: number }): FlightFrame[] {
  const frames: FlightFrame[] = [];
  let { x, y } = from;
  // the handler's first frame shows him where the blow left him, and moves him after
  const stillOn = (): boolean => {
    if (way === "up") return y >= GONE.top;
    if (way === "down") return y < GONE.bottom;
    return towardLeft ? x >= GONE.left : x < GONE.right;
  };
  while (stillOn()) {
    frames.push({ defender: { x, y }, blank: false });
    if (way === "up") y -= SPEED;
    else if (way === "down") y += SPEED;
    else x += towardLeft ? -SPEED : SPEED;
  }
  for (let i = 0; i < LOADING; i++) frames.push({ defender: null, blank: true });
  if (way !== "side") return frames;
  // in from the side he was sent off by, to hang a moment where he will fall
  y = from.y;
  x = towardLeft ? IN.fromRight : IN.fromLeft;
  const there = () => (towardLeft ? x < IN.toLeft : x >= IN.toRight);
  while (!there()) frames.push({ defender: { x: (x += towardLeft ? -SPEED : SPEED), y }, blank: true });
  for (let i = 0; i < HANG; i++) frames.push({ defender: { x, y }, blank: true });
  return frames;
}
