import type { Sounds } from "./sounds";

// The game's sound bank is `data/audio/sounds.json`, read by `main.ts`
// (`data/files.ts`); a fighter's own file holds only his voice, and the two
// share one id space (`soundIdCollisions`).

/**
 * The bank plus one fighter's voices, as the single map playback looks ids up in.
 *
 * The bank goes last deliberately: an entity that collides with a game-wide id
 * has already been reported as an error, and letting it quietly win the lookup
 * on top of that would be the worst of both.
 */
export function withVoices(bank: Sounds, own: Sounds | undefined): Sounds {
  return { ...(own ?? {}), ...bank };
}
