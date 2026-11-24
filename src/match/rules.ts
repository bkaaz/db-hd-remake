import { readData } from "../data/files";

/**
 * The rules of the game, `data/rules.json`: what holds for both sides of a
 * fight alike. Not a fighter's attributes — a rule one fighter could opt out
 * of is not a rule.
 */
export interface Rules {
  /**
   * Our combo rules — damage and hitstun scaling and the relaunch budget
   * (`combat.md` §3–4). Off while the port stands, so the cartridge's numbers
   * hold while they are compared with the original's.
   */
  comboLimits: boolean;
}

/** What a `rules.json` says, or what is wrong with it. */
export function readRules(raw: unknown): Rules | string {
  if (!raw || typeof raw !== "object") return "data/rules.json is not an object";
  const { comboLimits } = raw as Record<string, unknown>;
  if (typeof comboLimits !== "boolean") return "data/rules.json: \"comboLimits\" must be true or false";
  return { comboLimits };
}

/** The game's rules, or why they cannot be read. */
export async function loadRules(): Promise<Rules | string> {
  const raw = await readData<unknown>("rules.json");
  return raw === null ? "there is no data/rules.json" : readRules(raw);
}
