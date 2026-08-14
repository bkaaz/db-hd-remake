/**
 * Which sections differ from what is on disk.
 *
 * Worked out by **comparison, not bookkeeping**: every place that can change a
 * section would otherwise have to remember to flag it, and the one that forgets
 * is the one that loses an edit. Instead each section is snapshotted as it is
 * read or written, and "modified" is that snapshot not matching what the
 * section serialises to now. It cannot drift, because there is nothing to keep
 * in step.
 *
 * The data involved is small — a few hundred lines of JSON — and it is compared
 * when the panel redraws, not per frame.
 */

const onDisk = new Map<string, string>();

/** Record a section as matching disk: it has just been loaded or just saved. */
export function markSaved(section: string, data: unknown): void {
  onDisk.set(section, JSON.stringify(data ?? null));
}

/** A section never snapshotted counts as clean — nothing has been loaded yet. */
export function isModified(section: string, data: unknown): boolean {
  const known = onDisk.get(section);
  return known !== undefined && known !== JSON.stringify(data ?? null);
}
