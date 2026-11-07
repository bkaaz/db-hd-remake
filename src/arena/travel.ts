import type { Container } from "pixi.js";
import { logEvent } from "../log";
import type { Sent } from "../match/fighters";
import { ArenaBackdrop, loadArena, type LoadedArena } from "./arena";
import { arrival, LINKED, wayFrom, type Way } from "./ways";
import type { Entity } from "../entity/entity";
import { WORLD } from "../stage";

/** A journey about to start: who was sent, which way, and the arena at its end. */
export interface Departure {
  sent: Sent;
  /** The attacker's facing: sideways, the way the defender goes. */
  facesLeft: boolean;
  /** Its backdrop, made when the arena is shown. */
  backdrop: (parent: Container) => ArenaBackdrop;
  time: string;
  at: { attacker: number; defender: number };
}

/**
 * The fight sent from arena to arena by a blow (`arena/ways.ts`). Every arena a
 * way can lead to is loaded with the scene, so a journey never waits on a fetch;
 * it starts once the blow's pause is over, and `match/journey.ts` plays it.
 */
export class Travel {
  private pending: { sent: Sent; to: string; facesLeft: boolean } | null = null;

  private constructor(
    private here: string,
    private readonly arenas: Map<string, LoadedArena>,
  ) {}

  /** None on the grid, or on an arena no way leads from. */
  static async load(here: string | null, time: string | null): Promise<Travel | null> {
    if (!here || !LINKED.includes(here)) return null;
    const arenas = new Map<string, LoadedArena>();
    for (const name of LINKED) {
      // the same lighting where it has one; its own where it does not (the ruins, the shore)
      let arena = await loadArena(name, time);
      if (typeof arena === "string") arena = await loadArena(name, null);
      if (typeof arena !== "string") arenas.set(name, arena);
    }
    return new Travel(here, arenas);
  }

  /** Where a blow sending him that way would take the fight now, if anywhere it can go. */
  private target(way: Way, attacker: Entity, defender: Entity): string | null {
    const to = wayFrom(this.here, way, { facesLeft: attacker.facing < 0, rightHalf: defender.x >= WORLD.width / 2 });
    return to && this.arenas.has(to) ? to : null;
  }

  /** Whether a blow sending him that way has an arena to go to: `BlowContext.opens`. */
  opens(way: Way, attacker: Entity, defender: Entity): boolean {
    return this.target(way, attacker, defender) !== null;
  }

  /** A sending blow landed: where it goes is settled now, the change kept until its pause is over. */
  sent(sent: Sent): void {
    const to = this.target(sent.way, sent.attacker, sent.defender);
    if (to) this.pending = { sent, to, facesLeft: sent.attacker.facing < 0 };
  }

  /** One frame: the journey to start now, once the pause is over. */
  step(frozen: boolean): Departure | null {
    if (!this.pending || frozen) return null;
    const { sent, to, facesLeft } = this.pending;
    this.pending = null;
    const arena = this.arenas.get(to)!;
    logEvent(`arena ${this.here} -> ${to} (${sent.way})`);
    this.here = to;
    return { sent, facesLeft, backdrop: (parent) => new ArenaBackdrop(parent, arena, true), time: arena.time, at: arrival(facesLeft) };
  }

  /** Every arena it loaded, let go — after the backdrop showing one of them. */
  destroy(): void {
    for (const arena of this.arenas.values()) for (const { texture } of arena.layers) texture.destroy(true);
  }
}
