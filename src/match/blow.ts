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
  /** Frames of white screen it asks for (`hitFlash`); none when blocked. */
  flash: number;
}

/** What a landing blow needs besides the two bodies: a spark. Its noise is the defender's. */
export interface BlowContext {
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
  { effects }: BlowContext,
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
  // Before anything is applied: a blow turns the fighter taking it. Every
  // reaction's knockback is facing-relative and no airborne state keeps facing
  // current, so without this a fighter who crossed the opponent mid-jump is
  // thrown into the blow rather than away from it. It is also the genre's
  // answer — you take a hit facing whoever landed it.
  //
  // Which side that is depends on what hit you, and a projectile is the case
  // where position lies: fired point-blank, the bolt is already past the
  // victim's anchor when it connects, so reading its x turned the defender away
  // from the shooter and threw them *into* the shot (owner's recording,
  // 2026-08-25). What travels pushes the way it travels.
  if (attacker.travels) defender.turnFrom(attacker.facing);
  else defender.turnToward(attacker.placement.x);
  // A blocked blow costs nothing and only moves you. Chip damage belongs to
  // specials, which do not exist yet, so a normal attack on guard is free to
  // eat — deliberately, since a block you cannot afford is not a block.
  const blocked = defender.guarding && defender.guardHit();
  const noise = attacker.attackSounds;
  // the defender's side plays it, as the original's does ($0D:D1B7)
  defender.sound(blocked ? noise.block : noise.hit);
  // What the blow was worth, after the combo it lands in has scaled it — the
  // number the defender actually lost, which is the only one worth reporting.
  let dealt = 0;
  if (!blocked) {
    // The reaction goes first, and the order matters: both scalings read how
    // many blows have landed *before* this one, and `hurtBy` is what adds this
    // one to the count. Hitting first would scale the opener as if it were the
    // second blow.
    defender.gotHit({
      reaction: attacker.attackReaction,
      relaunch: attacker.attackRelaunch,
      hitstun: attacker.attackHitstun,
      burns: attacker.attackBurns,
    });
    dealt = defender.hurtBy(attacker.attackDamage);
  }
  // A projectile that bursts does so at the middle of the overlap, a spark at
  // the deepest point of the blow — see impactPoint. Neither is where the
  // cartridge puts them (ADR 0044).
  const burst = attacker.attackBurst;
  if (burst) effects.spawn(burst, where.x + where.w / 2, where.y + where.h / 2);
  else {
    const at = impactPoint(where, attacker.facing);
    effects.spawn(blocked ? attacker.attackGuardFx : attacker.attackFx, at.x, at.y);
  }
  // Both sides pause, not just the one taking it: freezing only the defender
  // lets the attacker walk on through the moment of contact.
  const stop = attacker.attackHitstop;
  attacker.freeze(stop);
  defender.freeze(stop);
  return { attack, damage: dealt, blocked, took, flash: blocked ? 0 : attacker.attackFlash };
}
