/**
 * Which song a fight plays: the one picked, none, or the original's random
 * pick (`$0E:81D3`, `rom.md`, A fight's song) — never the arena's, which has
 * none.
 */

/** A song by its number, none at all, or the original's random one. */
export type SongPick = number | "none" | "random";

/** Under this key in localStorage: the page's pick, as the scale is (`ui/scale.ts`). */
export const REMEMBERED_SONG = "db-hd-remake.song";

/** A pick that was kept, or random — the original's default — when it does not read as one. */
export function readSongPick(text: string | null): SongPick {
  if (text === "none") return "none";
  const n = Number(text);
  return text !== null && Number.isInteger(n) && n >= 1 ? n : "random";
}

/** The song for the game's random byte: its low four bits, less 8 from 9, plus 1. */
export function randomSong(byte: number): number {
  const n = byte & 0x0f;
  return (n >= 9 ? n - 8 : n) + 1;
}

/** `picked`, null for none, or a random one as the original makes it. */
export function fightSong(picked: SongPick, random: () => number = Math.random): number | null {
  if (picked === "none") return null;
  return picked === "random" ? randomSong(Math.floor(random() * 256)) : picked;
}
