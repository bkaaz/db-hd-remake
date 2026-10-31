/**
 * A one-off notice over the game's screen: the scene failed to build, or
 * built with something wrong in its data. Loud and centred when the game
 * cannot run, small and at the top when it can. HTML over the canvas rather
 * than drawn into it, so it stays readable at any scale (ADR 0041).
 */
export interface Notice {
  destroy(): void;
}

export function showMessage(into: HTMLElement, text: string, subtle = false): Notice {
  const element = document.createElement("div");
  element.className = subtle ? "notice" : "notice loud";
  element.textContent = text;
  into.append(element);
  return { destroy: () => element.remove() };
}
