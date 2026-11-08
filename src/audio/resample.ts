/**
 * The chip's 32 kHz brought to the page's rate, by drawing a straight line
 * between two of its samples. The browser's own resampling (an AudioContext
 * made at 32 kHz) would do it better but would move every sound of the page
 * to that rate, the effects' buffers included.
 */

export class Resampler {
  /** How far between `prev` and `next` the next output falls, in chip samples. */
  private at = 1;
  private readonly step: number;
  private prev = [0, 0];
  private next = [0, 0];

  /** `pull` hands over the chip's next stereo sample each time it is called. */
  constructor(from: number, to: number, private readonly pull: () => [number, number]) {
    this.step = from / to;
  }

  /** Fill `left` and `right` with the next samples at the page's rate. */
  fill(left: Float32Array, right: Float32Array): void {
    for (let i = 0; i < left.length; i++) {
      while (this.at >= 1) {
        this.prev = this.next;
        this.next = this.pull();
        this.at -= 1;
      }
      left[i] = this.prev[0] + (this.next[0] - this.prev[0]) * this.at;
      right[i] = this.prev[1] + (this.next[1] - this.prev[1]) * this.at;
      this.at += this.step;
    }
  }
}
