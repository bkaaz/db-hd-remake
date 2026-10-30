import { logEvent } from "../log";
import type { Camera } from "./camera";

/**
 * The camera's lines in a recording: when it starts or stops scrolling, and
 * when it turns up or down — events, like the rest of the log, never a
 * position per frame.
 */
export class CameraNotes {
  private x: number;
  private rise: number;
  private sideways = 0;
  private upward = 0;

  constructor(camera: Camera) {
    this.x = camera.x;
    this.rise = camera.rise;
  }

  note(camera: Camera): void {
    const sideways = Math.sign(camera.x - this.x);
    if (sideways !== this.sideways) {
      const way = sideways > 0 ? "right" : "left";
      logEvent(sideways === 0 ? `camera stops at x ${round(camera.x)}` : `camera scrolls ${way} from x ${round(this.x)}`);
      this.sideways = sideways;
    }
    // Upward it eases a pixel at a time and pauses as the target creeps, so
    // only a turn and the return to the floor are worth a line.
    const upward = Math.sign(camera.rise - this.rise);
    if (upward !== 0 && upward !== this.upward) {
      logEvent(`camera ${upward > 0 ? "rises" : "sinks"} from ${this.rise} px up`);
      this.upward = upward;
    } else if (upward === 0 && camera.rise === 0 && this.upward !== 0) {
      logEvent("camera back on the floor");
      this.upward = 0;
    }
    this.x = camera.x;
    this.rise = camera.rise;
  }
}

function round(x: number): string {
  return x.toFixed(1);
}
