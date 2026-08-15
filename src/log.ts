/**
 * A recording of what the engine decided, written to a file the owner and
 * Claude can both read — started and stopped with `L`.
 *
 * It exists because the two of us cannot see the same thing. The owner plays
 * and knows how it felt; the engine knows why. Without a recording the gap is
 * bridged by the owner reading numbers aloud, which is slow and lossy.
 *
 * **Events, not frames.** Sixty frames a second times two fighters is six
 * hundred near-identical lines for ten seconds of play — unreadable, and it
 * hides the causes inside the data. What is interesting in a fight is discrete:
 * a state changed, a blow landed, a press was recorded or expired unused. One
 * attempt at a combo is twenty lines, and each of them answers a question.
 *
 * **The line says why, not only what.** `kick_mid → kick_high_chain` is half a
 * sentence; the trigger that fired it is the other half, and it is the half we
 * have spent this whole session working out by hand.
 *
 * **It describes; it never computes.** Everything logged is something the game
 * already worked out for its own reasons. The moment a field has to be added to
 * an entity so that a line can print it, the line is wrong.
 *
 * Not injected, deliberately: threading a recorder through five constructors
 * would be a larger change to the shape of the code than the recording itself,
 * and the point is that this can be pulled out again by deleting one file and
 * five one-line calls.
 */

let recording = false;
let frame = 0;
/** Frame the previous line was written on, for the gap each new line prints. */
let lastAt = 0;
let pending: string[] = [];

/** Frames between flushes — one request per event would be silly. */
const FLUSH_EVERY = 30;

export const isRecording = (): boolean => recording;

/** Begin a recording, discarding whatever the last one left behind. */
export function startRecording(): void {
  recording = true;
  frame = 0;
  lastAt = 0;
  pending = [];
  void send([`# recording started ${new Date().toISOString()}`], true);
}

export function stopRecording(): void {
  if (!recording) return;
  recording = false;
  void flush();
}

/** Advance the clock, once per game frame, and flush now and then. */
export function tickLog(): void {
  if (!recording) return;
  frame++;
  if (frame % FLUSH_EVERY === 0) void flush();
}

/**
 * Record one thing that happened. A no-op when nothing is being recorded.
 *
 * Every line carries the frame **and the gap since the previous line**, because
 * in a fighting game almost every question is "how many frames after the last
 * thing" — how long after the hit the cancel came out, how long the freeze
 * lasted, whether a press arrived before the window closed. Absolute frame
 * numbers make that arithmetic homework; the delta answers it.
 */
export function logEvent(text: string): void {
  if (!recording) return;
  const gap = pending.length === 0 && frame === 0 ? 0 : frame - lastAt;
  lastAt = frame;
  pending.push(`${String(frame).padStart(5, "0")} +${String(gap).padStart(3)}  ${text}`);
}

async function flush(): Promise<void> {
  if (pending.length === 0) return;
  const lines = pending;
  pending = [];
  await send(lines, false);
}

async function send(lines: string[], reset: boolean): Promise<void> {
  try {
    await fetch("/api/log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lines, reset }),
    });
  } catch {
    // A dev-only convenience: losing the recording must never disturb the game.
  }
}
