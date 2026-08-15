import type { Audio } from "../audio/playback";
import { contact, impactPoint } from "../combat/hit";
import type { Entity } from "../entity/entity";
import type { Effects } from "../fx/effects";

/**
 * What happened, for whoever wants to say so out loud — the recording, and one
 * day a hit counter. Returned rather than swallowed because `exchangeBlows`
 * currently cannot tell whether anything occurred, which is a gap regardless of
 * who is reading.
 */
export interface BlowResult {
  /** The attacker's state, which is the move by name. */
  attack: string;
  damage: number;
  blocked: boolean;
  /** The state the defender was in when it arrived. */
  took: string;
}

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
export function landBlow(
  attacker: Entity,
  defender: Entity,
  { audio, effects }: BlowContext,
): BlowResult | null {
  if (!attacker.canHit) return null;
  // Before anything is spent or spawned: an invulnerable defender is not hit
  // for nothing, they are **not hit**. The swing keeps its active frames and
  // may still land the moment they are touchable again — which is what makes
  // pressure on a wake-up a matter of timing rather than of holding a button.
  if (defender.invulnerable) return null;
  const boxes = attacker.boxes("hit");
  if (boxes.length === 0) return null;
  const where = contact(
    { boxes, at: attacker.placement },
    { boxes: defender.boxes("hurt"), at: defender.placement },
  );
  if (!where) return null;

  const attack = attacker.state;
  const took = defender.state;
  attacker.markHit();
  // A blocked blow costs nothing and only moves you. Chip damage belongs to
  // specials, which do not exist yet, so a normal attack on guard is free to
  // eat — deliberately, since a block you cannot afford is not a block.
  const blocked = defender.guarding && defender.guardHit();
  const noise = attacker.attackSounds;
  audio.play(blocked ? noise.block : noise.hit);
  if (!blocked) {
    defender.hurtBy(attacker.attackDamage);
    defender.gotHit({
      reaction: attacker.attackReaction,
      smash: attacker.attackSmash,
      hitstun: attacker.attackHitstun,
    });
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
  return { attack, damage: blocked ? 0 : attacker.attackDamage, blocked, took };
}
