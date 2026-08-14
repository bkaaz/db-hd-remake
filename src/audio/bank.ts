import type { Sounds } from "./sounds";

/**
 * Loading side of the game's sound bank (`data/audio/sounds.json`).
 *
 * One bank for the whole game: impacts, swings, blocks, landings — everything
 * that belongs to nobody in particular. A fighter's own file holds only their
 * voice, and the two share one id space (see `soundIdCollisions`).
 *
 * Served by the dev-server plugin like every other piece of our data, so the
 * game and the editor read it the same way.
 */
export async function loadSoundBank(): Promise<Sounds> {
  const res = await fetch("/api/sounds");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as Sounds;
}

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
