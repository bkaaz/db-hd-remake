import { RELAUNCH_LIMIT } from "../combat/combo";
import { damageScale } from "../combat/scaling";
import type { EntityDebug } from "../entity/entity";
import type { Page } from "./page";

/**
 * What the engine thinks, in words, for both fighters — toggled with `I`.
 *
 * **Two fixed blocks beside the game rather than text above each head.**
 * Attached labels tell you whose they are, which matters when there are many
 * bodies; with exactly two they only cost. Fighters stand 30–60 px apart
 * during a combo, which is precisely when these numbers are being read, so
 * attached blocks would overlap and jitter exactly then — and swap sides on a
 * cross-up. Left is always the player, right always the opponent.
 *
 * This is scaffolding. It reads `Entity.debug` and nothing else, so deleting
 * this file and that getter removes it completely.
 */
export interface DebugFrame {
  player: EntityDebug;
  opponent: EntityDebug | null;
}

export class Readouts {
  private readonly left = make("readout");
  private readonly right = make("readout");
  /** The player's inputs, in a strip under the game: one line that grows sideways. */
  private readonly inputs = make();

  constructor(page: Page) {
    page.sides[0].readout.append(this.left);
    page.sides[1].readout.append(this.right);
    page.inputs.append(this.inputs);
  }

  draw(frame: DebugFrame | null): void {
    // Only the player's inputs: the opponent is the dummy, and a timeline it
    // was handed is not an input anybody made.
    show(this.left, frame ? block("P1", frame.player) : "");
    show(this.right, frame?.opponent ? block("P2", frame.opponent) : "");
    show(this.inputs, frame?.player.inputs ?? "");
  }

  destroy(): void {
    for (const element of [this.left, this.right, this.inputs]) element.remove();
  }
}

function make(className = ""): HTMLPreElement {
  const element = document.createElement("pre");
  element.className = className;
  return element;
}

/** Sixty times a second: the page is only touched when the words change. */
function show(element: HTMLElement, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}

/**
 * One fighter, six short lines. Fewer numbers, each of which answers a question.
 *
 * `framesLeft` is deliberately not among them: it counts down every frame and
 * restarts at every step, so on screen it is a blur. It is still in
 * `EntityDebug`, because `logs/session.log` prints it once per event, which is
 * where a per-frame number can actually be read.
 */
function block(who: string, d: EntityDebug): string {
  const buffer = d.buffer.length === 0 ? "—" : d.buffer.map(([b, f]) => `${b} ${f}`).join("  ");
  return [
    `${who}  ${d.state}`,
    `step ${d.step + 1}/${d.steps} · rank ${d.rank}`,
    `${d.hitConfirmed ? "hit ✓" : "hit —"} · freeze ${d.freeze} · stun ${d.stun}`,
    `hp ${d.hp} · ki ${d.ki}`,
    `vx ${d.vx.toFixed(1)} · buf ${buffer}`,
    `combo ${d.combo.hits} hits · ${d.combo.damage} dmg · next ×${damageScale(d.combo.hits).toFixed(1)}` +
      ` · lift ${d.combo.lifts}/${RELAUNCH_LIMIT}`,
  ].join("\n");
}
