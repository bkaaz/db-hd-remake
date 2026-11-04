/**
 * A one-off notice over the game's screen: the scene failed to build, or
 * built with something wrong in its data, or the player is asked for
 * something. Loud and centred when the game cannot run, small and at the top
 * when it can, plain and centred for a request. HTML over the canvas rather
 * than drawn into it, so it stays readable at any scale (ADR 0041).
 */
export interface Notice {
  destroy(): void;
}

/** A request to the player in the screen's middle, until whoever showed it takes it down. */
export function showPrompt(into: HTMLElement, text: string): Notice {
  return show(into, text, "notice prompt");
}

export function showMessage(into: HTMLElement, text: string, subtle = false): Notice {
  return show(into, text, subtle ? "notice" : "notice loud");
}

function show(into: HTMLElement, text: string, className: string): Notice {
  const element = document.createElement("div");
  element.className = className;
  element.textContent = text;
  into.append(element);
  return { destroy: () => element.remove() };
}
