import { chainLinks, type AnimSteps } from "../../../src/combat/chains";
import type { StatesFile } from "../../../src/entity/states";
import { state } from "./store";
import { getSource } from "./imageProcess";
import { drawEdges, type GraphNode } from "./chainEdges";

/**
 * The cancel graph: which attack leads into which, and whether the link holds.
 *
 * `states.json` is a graph written down as a list — the relationships live in
 * scattered `to` fields, so reading a string means assembling it in your head.
 * That is the one question about states nothing else answers, and it is why this
 * view replaced a panel that pretty-printed the file you can already open.
 *
 * **A view, never a second format.** Every number here is computed by
 * `src/combat/chains.ts`, the same function the test asserts on and
 * `npm run chains` prints — so the picture cannot disagree with the check.
 *
 * Columns are depth: openers on the left, enders on the right. That is the whole
 * layout algorithm, and it is enough because depth is already computed.
 */

export function renderChainGraph(
  container: HTMLElement,
  file: StatesFile,
  anims: Record<string, AnimSteps>,
  baseHitstun: number,
): void {
  const links = chainLinks(file, anims, baseHitstun);
  if (links.length === 0) {
    container.append(
      el("p", {
        className: "hint",
        textContent: 'No cancels: no transition asks for "cancelable", so every attack stands alone.',
      }),
    );
    return;
  }

  const depths = new Map<string, number>();
  for (const l of links) {
    depths.set(l.from, Math.max(depths.get(l.from) ?? 0, l.depth));
    depths.set(l.to, Math.max(depths.get(l.to) ?? 0, l.depth + 1));
  }

  container.append(legend());

  const board = el("div", { className: "chain-board" });
  const edges = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  edges.classList.add("chain-edges");
  board.append(edges);

  const nodes = new Map<string, GraphNode>();
  const columns = Math.max(...depths.values()) + 1;
  for (let depth = 0; depth < columns; depth++) {
    const column = el("div", { className: "chain-col" });
    for (const [name, at] of depths) {
      if (at !== depth) continue;
      const shot = hitFrameOf(file.states[name]?.anim ?? "");
      const box = el("div", { className: "chain-node" }, [
        ...(shot ? [shot] : []),
        el("strong", { textContent: name }),
        el("span", {
          className: "dims",
          textContent: `hitstun ${file.states[name]?.hitstun ?? baseHitstun}`,
        }),
      ]);
      box.dataset.node = name;
      column.append(box);
      nodes.set(name, { name, depth, el: box });
    }
    board.append(column);
  }
  container.append(board);

  highlightOnHover(board);

  // Positions are only known once the browser has laid the boxes out, and they
  // move with every resize of the pane — so the edges are drawn from measured
  // geometry rather than from anything this module decides.
  const draw = (): void => drawEdges(edges, board, nodes, links);
  requestAnimationFrame(draw);
  new ResizeObserver(draw).observe(board);
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

/**
 * Hovering a node dims everything it does not touch.
 *
 * With nine attacks and nineteen cancels the picture is honest but crowded, and
 * the question you actually arrive with is about one move: *what can I do out of
 * this, and what gets me here*. Dimming answers it without a click, and without
 * a second view.
 */
function highlightOnHover(board: HTMLElement): void {
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

/**
 * What the arrows mean, shown with the arrows themselves rather than described
 * in words: a sample of each stroke beside the sentence about it, because "red"
 * and "dashed" are only names for something the reader can just be shown.
 */
function legend(): HTMLElement {
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
  key.append(el("div", { className: "chain-key-row dims" }, [el("span", { textContent: "Hover an arrow for the whole sum: window, start-up, hitstun, depth." })]));
  return key;
}

/**
 * The frame this attack actually hits on, cut out of the sheet.
 *
 * A name tells you nothing about a blow and a picture tells you everything, so
 * the node *is* the pose — which is also the only thing that makes this read as
 * a combo rather than as a diagram of a state machine.
 */
function hitFrameOf(anim: string): HTMLCanvasElement | null {
  const steps = state.anims.find((a) => a.name === anim)?.steps ?? [];
  const step = steps.find((s) => s.boxes.some((b) => b.type === "hit")) ?? steps[0];
  const frame = state.frames.find((f) => f.id === step?.frame);
  // The keyed canvas, not the raw sheet: the same source the preview and the
  // atlas export use, so the pose sits on the node's own background instead of
  // a rectangle of whatever colour the rip happened to have.
  const sheet = getSource();
  if (!frame || !sheet) return null;

  const scale = Math.min(SHOT / frame.w, SHOT / frame.h, 2);
  const canvas = document.createElement("canvas");
  canvas.className = "chain-shot";
  canvas.width = Math.round(frame.w * scale);
  canvas.height = Math.round(frame.h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, frame.x, frame.y, frame.w, frame.h, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Longest side of a node's picture, in screen px. */
const SHOT = 96;
