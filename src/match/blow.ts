import type { Audio } from "../audio/playback";
import { contact, impactPoint } from "../combat/hit";
import type { Entity } from "../entity/entity";
import type { Effects } from "../fx/effects";

/** What a landing blow needs besides the two bodies: a noise and a spark. */
export interface BlowContext {
  audio: Audio;
  effects: Effects;
}

/**
 * One attacker's active hit boxes against one defender's hurt boxes, and
 * everything a connection costs.
 *
 * Called once per direction per frame, so it must be cheap to ask and quiet
 * when nothing touches. On a connection the attack is spent — one swing lands
 * once, however many frames its box stays out.
 */
export function landBlow(attacker: Entity, defender: Entity, { audio, effects }: BlowContext): void {
  if (!attacker.canHit) return;
  const boxes = attacker.boxes("hit");
  if (boxes.length === 0) return;
  const where = contact(
    { boxes, at: attacker.placement },
    { boxes: defender.boxes("hurt"), at: defender.placement },
  );
  if (!where) return;

  attacker.markHit();
  // A blocked blow costs nothing and only moves you. Chip damage belongs to
  // specials, which do not exist yet, so a normal attack on guard is free to
  // eat — deliberately, since a block you cannot afford is not a block.
  const blocked = defender.guarding && defender.guardHit();
  const noise = attacker.attackSounds;
  audio.play(blocked ? noise.block : noise.hit);
  if (!blocked) {
    defender.hurtBy(attacker.attackDamage);
    defender.gotHit(attacker.attackReaction);
  }
  // The spark belongs at the deepest point of the blow, not at either fighter's
  // anchor and not at the middle of the overlap — see impactPoint.
  const at = impactPoint(where, attacker.facing);
  effects.spawn(attacker.attackFx, at.x, at.y);
  // Both sides pause, not just the one taking it: freezing only the defender
  // lets the attacker walk on through the moment of contact.
  const stop = attacker.attackHitstop;
  attacker.freeze(stop);
  defender.freeze(stop);
}
