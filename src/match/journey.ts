import type { Departure } from "../arena/travel";
import { flightPlan, type FlightFrame } from "../arena/flight";
import { BandClock } from "../arena/bands";
import type { Way } from "../arena/ways";
import type { Camera } from "../camera/camera";
import type { Stage } from "../stage";
import type { Container } from "pixi.js";
import type { Fighters } from "./fighters";

/** What he is drawn as while he flies, by the way he was sent ($0D:D3F3, D46E, D4D4). */
const FLYING: Record<Way, string> = { up: "sent_up", side: "sent_side", down: "sent_down" };

/** What a journey moves: the scene's, lent for its length. */
export interface JourneyWorld {
  stage: Stage;
  camera: Camera;
  fighters: Fighters;
  /** Where the next arena's backdrop goes. */
  backdrop: Container;
}

/**
 * A sender's journey played out (`arena/flight.ts`): the fight stands still
 * while the defender flies off, the old arena goes, he flies in and hangs, and
 * both are put down on the new one. The attacker keeps his pose until he
 * goes with the old arena. Between the two, sideways, the bands (`arena/bands.ts`);
 * up and down, black.
 */
export class Journey {
  private readonly plan: FlightFrame[];
  private at = 0;
  /** Sideways only: up and down the original shows no bands ($01:8962 asks for `$37` 45–49). */
  private readonly bands: BandClock | null;

  constructor(
    private readonly go: Departure,
    private readonly world: JourneyWorld,
  ) {
    const { camera } = world;
    const { defender, way } = go.sent;
    const towardLeft = way === "side" && go.facesLeft;
    this.plan = flightPlan(way, towardLeft, { x: defender.x - camera.x, y: defender.y - camera.y });
    this.bands = way === "side" ? new BandClock(towardLeft) : null;
    defender.forceState(FLYING[way]);
  }

  /** One frame of it; false on the frame they are put down, when the fight goes on. */
  step(): boolean {
    const { stage, camera, fighters, backdrop } = this.world;
    const { sent } = this.go;
    const frame = this.plan[this.at++];
    if (!frame) {
      this.go.bands?.show(backdrop, null);
      stage.blank(false);
      stage.change(this.go.backdrop(backdrop));
      fighters.light(this.go.time);
      fighters.plainShadows(false);
      fighters.arrive(sent, this.go.at);
      camera.centreOn(fighters.player.x, fighters.opponent?.x ?? fighters.player.x);
      return false;
    }
    stage.blank(frame.blank);
    // with the old arena gone a shadow has no arena's light: not the ruins' red, from the bands on
    fighters.plainShadows(frame.blank);
    this.go.bands?.show(backdrop, frame.blank && this.bands ? this.bands.next() : null);
    sent.attacker.hide(frame.blank);
    sent.defender.hide(frame.defender === null);
    if (frame.defender) {
      sent.defender.x = camera.x + frame.defender.x;
      sent.defender.y = camera.y + frame.defender.y;
    }
    stage.tick();
    return true;
  }
}
