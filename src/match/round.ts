import type { RoundStates } from "../entity/states";

/**
 * How a round ends, after the original (docs/rom.md, A KO and the round's
 * end): a fighter whose health runs out is knocked out, the fight runs at
 * half speed until he lands for the last time, and once he lies done and the
 * other stands — or both lie — the announcement goes up, everyone holds still
 * under it, and then the winner strikes his pose.
 *
 * Separate from `Fighters` because none of it is a rule *between* two
 * bodies: it watches both and steps in once, at the end. There is no next
 * round yet — after the pose nothing more happens (owner).
 */

/** What the round needs of a fighter. */
export interface Contender {
  readonly health: number;
  readonly state: string;
  /** In the state he stands in — the original's move `00`. */
  readonly standing: boolean;
  /** In a state that ends a KO's half speed early (`fullSpeed`). */
  readonly atFullSpeed: boolean;
  /** His states for the round's end; none, and he is never knocked out. */
  readonly roundStates: RoundStates | undefined;
  forceState(name: string): boolean;
  sound(id: string): void;
}

/** The announcement's two pictures (`a/1f`): K. then K.O., or DOUBLE K.O. */
export type Announcement = "ko" | "double_ko";

/** Where the round puts what it shows and plays, outside any fighter. */
export interface RoundWorld {
  announce(what: Announcement): void;
  sound(id: string): void;
  /** 0 to 1, for which of his poses the winner strikes. */
  random(): number;
}

/** `a/1f`'s ticks ($0F:E857): its second picture and sound, and when it is gone. */
const SECOND_PICTURE = 24;
const GONE = 80;
/** Its sound, on its first tick and on the second picture. */
const ANNOUNCED = "hit_09";
/** The blow that empties health plays it before the KO's voice ($0D:D0D0). */
const KNOCKED_OUT = "burst_0a";

export type Phase = "fight" | "announce" | "win" | "over";

export class Round {
  private phase: Phase = "fight";
  private readonly out = new Set<Contender>();
  /** `$30B0` bit 1: every other frame is skipped. */
  private slow = false;
  private announcing: { what: Announcement; ticks: number; winner: Contender | null } | null = null;

  constructor(private readonly world: RoundWorld) {}

  get now(): Phase {
    return this.phase;
  }

  /** A frame of the game that only draws: half speed's odd frames ($0E:821C). */
  skips(frame: number): boolean {
    return this.slow && frame % 2 === 1;
  }

  /** Under the announcement nothing moves but the announcement — `fb` keeps every drawing. */
  get holds(): boolean {
    return this.phase === "announce";
  }

  /** Once the round is decided, nobody's buttons count. */
  get decided(): boolean {
    return this.phase !== "fight";
  }

  /**
   * Once a frame, after the blows. `on`: whether a KO may happen at all — the
   * debug switch; a KO already under way plays out whatever it says.
   * `quiet`: nothing is in the air that could still hit — the round does not
   * end over a shot ($0D:EA89 waits on the object slots).
   */
  step(fighters: Contender[], on: boolean, quiet: boolean): void {
    if (this.phase === "fight") this.fight(fighters, on, quiet);
    else if (this.phase === "announce") this.announce();
  }

  private fight(fighters: Contender[], on: boolean, quiet: boolean): void {
    for (const f of fighters) {
      if (!on || this.out.has(f) || f.health > 0 || !f.roundStates) continue;
      if (!f.forceState(f.roundStates.ko)) continue;
      this.out.add(f);
      f.sound(KNOCKED_OUT);
      this.slow = true;
    }
    const lying = (f: Contender) => f.state === f.roundStates?.down;
    // one bit for both: the first of them back at full speed ends it ($10:B022, $0D:EBB8)
    for (const f of this.out) if (f.atFullSpeed || lying(f)) this.slow = false;
    if (this.out.size === 0 || !quiet) return;

    const standing = fighters.filter((f) => !this.out.has(f));
    if (![...this.out].every(lying)) return;
    if (standing.length > 0 && !standing.every((f) => f.standing)) return;
    const winner = standing[0] ?? null;
    this.announcing = { what: winner ? "ko" : "double_ko", ticks: 0, winner };
    this.phase = "announce";
    this.slow = false;
    this.world.announce(this.announcing.what);
    this.world.sound(ANNOUNCED);
  }

  private announce(): void {
    const a = this.announcing!;
    a.ticks++;
    if (a.what === "ko" && a.ticks === SECOND_PICTURE) this.world.sound(ANNOUNCED);
    if (a.ticks < GONE) return;
    // the one with health left takes a pose ($0F:B2A3) — one of his, at
    // random (owner), where the original picks by the arena; nobody, a draw
    const poses = a.winner?.roundStates?.win ?? [];
    const pose = poses[Math.floor(this.world.random() * poses.length)];
    if (a.winner && pose) a.winner.forceState(pose);
    this.phase = a.winner ? "win" : "over";
  }
}
