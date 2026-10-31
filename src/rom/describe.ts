import { FIGHTER_FIELDS } from "./cartridge";
import type { Value } from "./cpu";
import type { HandlerFact } from "./handler";

/** A handler's fact in words, with what it waits on: "from frame 52, when its object 0a/15 is gone: jumps to move frame 124". */

const FACING = 0x12;
const hex = (n: number) => n.toString(16).padStart(2, "0");

export function describeFact(f: HandlerFact): string {
  const { under, what } = factParts(f);
  return under ? `${under}: ${what}` : what;
}

/** What a fact waits on ("" for nothing) and what it does, apart — for a list that says a shared condition once. */
export function factParts(f: HandlerFact): { under: string; what: string } {
  const did =
    f.to !== undefined ? `jumps to move frame ${f.to}`
    : f.sound !== undefined ? `plays sound ${hex(f.sound)}`
    : f.move !== undefined ? `sets move ${hex(f.move)}`
    : f.vx !== undefined ? `sets vx ${f.vx}`
    : f.counter !== undefined ? `sets the spawn counter to ${hex(f.counter)}`
    : f.shake !== undefined ? `shakes the stage: pattern ${f.shake.pattern}, ${f.shake.frames} frames`
    : f.facing !== undefined ? `faces ${say(f.facing)}`
    : f.hold !== undefined ? `holds the opponent (table $${(f.hold >> 16).toString(16)}:${(f.hold & 0xffff).toString(16).padStart(4, "0")})`
    : f.launch !== undefined ? launch(f.launch)
    : f.what;
  const under = [
    ...(f.frame === 0 ? ["once the script has run out"] : []),
    ...(f.from !== undefined ? [`from frame ${f.from}`] : []),
    ...(f.when ?? []),
  ];
  return { under: under.join(", "), what: f.who === "opponent" ? `the opponent ${did}` : did };
}

function launch(l: NonNullable<HandlerFact["launch"]>): string {
  return `throws the opponent: damage ${l.damage} (less defence), ${l.stun} off the stun gauge, move ${hex(l.move)}, vx ${l.vx}, vy ${l.vy}, facing ${say(l.facing)}`;
}

/** A value as the code made it: "the mover's way, turned" for a facing EORed with 0x40. */
function say(v: Value): string {
  if ("n" in v) return hex(v.n);
  const whose = v.who === "opponent" ? "the opponent's" : v.who === "mover" ? "the mover's" : "someone's";
  if (v.field === FACING) return `${whose} way${v.eor ? (v.eor & 0x40 ? ", turned" : `, ^ ${hex(v.eor)}`) : ""}`;
  const name = FIGHTER_FIELDS[v.field] ?? `field ${hex(v.field)}`;
  return `${whose} ${name}${v.eor ? ` ^ ${hex(v.eor)}` : ""}`;
}
