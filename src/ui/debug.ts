import { Application, Text } from "pixi.js";
import { RELAUNCH_LIMIT } from "../combat/combo";
import { damageScale } from "../combat/scaling";
import type { EntityDebug } from "../entity/entity";

/**
 * What the engine thinks, in words, for both fighters — toggled with `D`.
 *
 * **Two fixed columns rather than text above each head.** Attached labels tell
 * you whose they are, which matters when there are many bodies; with exactly two
 * they only cost. Fighters stand 30–60 px apart during a combo, which is
 * precisely when these numbers are being read, so attached blocks would overlap
 * and jitter exactly then — and swap sides on a cross-up. Left is always the
 * player, right always the opponent.
 *
 * This is scaffolding. It reads `Entity.debug` and nothing else, so deleting
 * this file and that getter removes it completely.
 */
export interface DebugFrame {
  player: EntityDebug;
  opponent: EntityDebug | null;
}

const TOP = 52;
const INSET = 20;

export class DebugPanel {
  private readonly left: Text;
  private readonly right: Text;

  constructor(private readonly app: Application) {
    [this.left, this.right] = [make(), make()];
    this.left.x = INSET;
    this.right.anchor.set(1, 0);
    for (const t of [this.left, this.right]) {
      t.y = TOP;
      app.stage.addChild(t);
    }
  }

  draw(frame: DebugFrame | null): void {
    const on = frame !== null;
    for (const t of [this.left, this.right]) t.visible = on;
    if (!frame) return;

    this.right.x = this.app.screen.width - INSET;
    // The player's inputs close their own block. Only theirs: the opponent is
    // the dummy, and a timeline it was handed is not an input anybody made.
    this.left.text = `${block("P1", frame.player)}\n${frame.player.inputs}`;
    this.right.text = frame.opponent ? block("P2", frame.opponent) : "";
  }

  destroy(): void {
    for (const t of [this.left, this.right]) t.destroy();
  }
}

const make = (): Text =>
  new Text({ text: "", style: { fill: "#7f9fbf", fontFamily: "monospace", fontSize: 12 } });

/**
 * One fighter, five short lines. Fewer numbers, each of which answers a question.
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
    `${d.hitConfirmed ? "hit ✓" : "hit —"} · freeze ${d.freeze} · stun ${d.stun} · hp ${d.hp}`,
    `vx ${d.vx.toFixed(1)} · buf ${buffer}`,
    `combo ${d.combo.hits} hits · ${d.combo.damage} dmg · next ×${damageScale(d.combo.hits).toFixed(1)}` +
      ` · lift ${d.combo.lifts}/${RELAUNCH_LIMIT}`,
  ].join("\n");
}
