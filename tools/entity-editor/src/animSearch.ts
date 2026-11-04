/**
 * Narrowing a fighter's animations by what is typed: hundreds of names do not
 * fit a select. Every word has to be in the name, in any order and any case.
 * What is selected stays listed, or the select would show another name than
 * the one being edited.
 */
export function matchingNames(names: readonly string[], query: string, selected: string | null): string[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return names.filter((name) => name === selected || words.every((word) => name.toLowerCase().includes(word)));
}
