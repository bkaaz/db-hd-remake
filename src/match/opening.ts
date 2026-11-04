import type { Contender, Placard, RoundWorld } from "./round";

/**
 * How a round starts, when the debug switch asks for it: both fighters play
 * their intro together — on the arena, where the original plays them in turn
 * on a screen of its own before the fight (`3c`, $02:A242; ADR 0073) — and
 * once both stand, READY drops in and turns into FIGHT!, and the fight is on
 * (docs/rom.md, `3c`, the fighter's intro). Until then nobody's buttons count.
 *
 * Apart from `Round`, which owns the end: the two share nothing but the
 * screen they write on.
 */

/** `a/1e`'s ticks ($0F:E7C9): FIGHT! and its sound, then gone and the fight on. */
const FIGHT = 64;
const GONE = 96;
/** Its sounds: READY's on tick 1, FIGHT!'s on its tick. */
const READY_SOUND = "sfx_4d";
const FIGHT_SOUND = "sfx_3a";

/** Where READY stands on the screen, tick by tick as it drops in ($0F:E837); after, the last. */
export function readyY(tick: number): number {
  const drop = [0, 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 90, 92, 90, 88];
  return drop[Math.min(tick, drop.length - 1)];
}

export class Opening {
  private phase: "intro" | "ready" | "fight";
  private ticks = 0;
  private placard: Placard | null = null;

  /** `on`: the debug switch; off, the fight is on at once. */
  constructor(
    private readonly world: RoundWorld,
    fighters: Contender[],
    on: boolean,
  ) {
    const intros = on ? fighters.filter((f) => f.roundStates?.intro && f.forceState(f.roundStates.intro)) : [];
    this.phase = on ? (intros.length > 0 ? "intro" : "ready") : "fight";
  }

  /** The fight is on: buttons count, and blows may end it. */
  get over(): boolean {
    return this.phase === "fight";
  }

  /** Once a frame, before the fight is on. */
  step(fighters: Contender[]): void {
    if (this.phase === "intro" && fighters.every((f) => f.standing)) this.phase = "ready";
    if (this.phase !== "ready") return;
    if (!this.placard) this.placard = this.world.announce("ready");
    this.placard.at(readyY(this.ticks));
    if (this.ticks === 1) this.world.sound(READY_SOUND);
    if (this.ticks === FIGHT) this.world.sound(FIGHT_SOUND);
    if (this.ticks === GONE) this.phase = "fight";
    this.ticks++;
  }
}
