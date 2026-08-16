/**
 * Hovering a node dims everything it does not touch.
 *
 * With nine attacks and nineteen cancels the picture is honest but crowded, and
 * the question you actually arrive with is about one move: *what can I do out of
 * this, and what gets me here*. Dimming answers it without a click, and without
 * a second view.
 */
export function highlightOnHover(board: HTMLElement): void {
  board.addEventListener("mouseover", (e) => {
    const node = (e.target as HTMLElement).closest<HTMLElement>(".chain-node");
    const name = node?.dataset.node;
    board.classList.toggle("focusing", !!name);
    if (!name) return;

    const touching = new Set<string>([name]);
    for (const edge of board.querySelectorAll<SVGElement>("[data-from]")) {
      const from = edge.dataset.from ?? "";
      const to = edge.dataset.to ?? "";
      const on = from === name || to === name;
      edge.classList.toggle("on", on);
      if (on) touching.add(from).add(to);
    }
    for (const box of board.querySelectorAll<HTMLElement>(".chain-node")) {
      box.classList.toggle("on", touching.has(box.dataset.node ?? ""));
    }
  });
  board.addEventListener("mouseleave", () => board.classList.remove("focusing"));
}
