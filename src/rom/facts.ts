import type { HandlerFact } from "./handler";

/**
 * What a handler's paths found, said once: `handler.ts` reads shared code
 * once per way into it, so the same fact turns up under several conditions —
 * kept apart so the walk stays about walking.
 */

/**
 * In order — by frame, then step, then as the code has them — with the
 * copies gone. `opposite`: the two answers of each test the walk met.
 */
export function tidy(found: { fact: HandlerFact; at: number }[], opposite: Map<string, string>): HandlerFact[] {
  const order = (f: HandlerFact) => [f.frame ?? -1, f.step ?? -1];
  const sorted = [...found].sort((a, b) => order(a.fact)[0] - order(b.fact)[0] || order(a.fact)[1] - order(b.fact)[1] || a.at - b.at);
  return dedupe(merge(sorted.map((f) => f.fact), opposite));
}

/** A fact found under both answers of a test does not wait on it: one copy, without. */
function merge(facts: HandlerFact[], opposite: Map<string, string>): HandlerFact[] {
  const bare = (f: HandlerFact) => JSON.stringify({ ...f, when: undefined });
  for (let changed = true; changed; ) {
    changed = false;
    for (const f of facts) {
      if (!f.when) continue;
      const twin = facts.find((g) => g !== f && g.when && bare(g) === bare(f) && g.when.length === f.when!.length &&
        f.when!.filter((w, i) => g.when![i] !== w).length === 1 &&
        f.when!.every((w, i) => g.when![i] === w || opposite.get(w) === g.when![i]));
      if (!twin) continue;
      const when = f.when!.filter((w, i) => twin.when![i] === w);
      const { when: _, ...rest } = f;
      facts = facts.filter((g) => g !== twin).map((g) => (g === f ? (when.length ? { ...rest, when } : rest) : g));
      changed = true;
      break;
    }
  }
  return facts;
}

/**
 * Code two paths share is read once per path: the same fact again is dropped,
 * and so is one under a later bound, or under an answer, than a copy of it
 * that turns up without — or on any frame, where the copy is on one.
 */
function dedupe(facts: HandlerFact[]): HandlerFact[] {
  const bare = (f: HandlerFact) => JSON.stringify({ ...f, frame: undefined, from: undefined, when: undefined });
  const weaker = (g: HandlerFact, f: HandlerFact) =>
    (g.when ?? []).every((w) => f.when?.includes(w)) &&
    (g.frame !== null ? g.frame === f.frame : (g.from ?? 0) <= (f.frame ?? f.from ?? 0));
  const kept: HandlerFact[] = [];
  for (const f of facts) {
    if (facts.some((g) => g !== f && bare(g) === bare(f) && weaker(g, f) && !(weaker(f, g) && facts.indexOf(g) > facts.indexOf(f)))) continue;
    kept.push(f);
  }
  return kept;
}
