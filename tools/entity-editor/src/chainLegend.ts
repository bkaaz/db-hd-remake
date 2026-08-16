/**
 * The chrome around the graph: what the arrows mean, and which state to draw
 * from.
 *
 * Apart from `chainGraph.ts` because it is the only part that is about the
 * reader rather than about the data — nothing here knows what a link is worth.
 */

/**
 * What the arrows mean, shown with the arrows themselves rather than described
 * in words: a sample of each stroke beside the sentence about it, because "red"
 * and "dashed" are only names for something the reader can just be shown.
 */
export function legend(sources: string[], from: string, pickFrom: (state: string) => void): HTMLElement {
  const rows: [string, string][] = [
    ["chain-edge", "the button that cancels, and the frames of margin"],
    ["chain-edge bad", "no margin left — the defender is up before the next blow, so it is not a combo"],
    ["chain-edge ends", "the blow floors them: the chain ends here whatever you press"],
  ];
  const key = el("div", { className: "chain-key" });
  for (const [cls, text] of rows) {
    const swatch = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    swatch.setAttribute("viewBox", "0 0 34 10");
    swatch.classList.add("chain-swatch");
    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    line.setAttribute("d", "M 1 5 C 12 5, 22 5, 33 5");
    line.setAttribute("class", cls);
    swatch.append(line);
    key.append(el("div", { className: "chain-key-row" }, [swatch, el("span", { textContent: text })]));
  }
  key.append(
    el("div", { className: "chain-key-row dims" }, [
      el("span", { textContent: "Hover an arrow for the whole sum: window, start-up, hitstun, depth." }),
    ]),
  );

  const pick = el("select", { id: "chain-from" });
  pick.append(el("option", { value: "", textContent: "every attack" }));
  for (const name of sources) pick.append(el("option", { value: name, textContent: name }));
  pick.value = from;
  pick.addEventListener("change", () => pickFrom(pick.value));
  key.append(
    el("div", { className: "chain-key-row" }, [
      el("label", { htmlFor: "chain-from", textContent: "starting from" }),
      pick,
    ]),
  );
  return key;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: (globalThis.Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of children) node.append(child);
  return node;
}
