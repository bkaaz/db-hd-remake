import {
  attacksIn,
  chainLinks,
  openings,
  unassigned,
  type AnimSteps,
} from "../../../src/combat/chains";
import type { StatesFile } from "../../../src/entity/states";
import { drawEdges, type Edge, type GraphNode } from "./chainEdges";
import { legend, UNASSIGNED } from "./chainLegend";
import { highlightOnHover } from "./chainFocus";
import { hitFrameOf } from "./chainNode";

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

/**
 * The state the graph is drawn *from*, or "" for all of them.
 *
 * Showing every way in at once turned out to be too much — one air attack is
 * reachable from seven states, and that is seven arrows saying the same thing.
 * Picking one answers the question you actually have ("I am crouching: what can
 * I do?") and cuts the picture down to that answer.
 */
let from: string | null = null;

export function renderChainGraph(
  container: HTMLElement,
  file: StatesFile,
  anims: Record<string, AnimSteps>,
  baseHitstun: number,
): void {
  const rebuild = (): void => {
    container.replaceChildren();
    renderChainGraph(container, file, anims, baseHitstun);
  };
  const all = chainLinks(file, anims, baseHitstun);
  const openers = openings(file);
  const sources = [...new Set(openers.flatMap((o) => o.from))].sort();
  // States only. An animation with no state at all is the animations tab's
  // question, not this one — counting it here promised a node this view has
  // nothing to build from.
  const waiting = unassigned(file);
  // The graph opens on the state the entity itself starts in — `initial` is the
  // authored answer to "where does this begin", so nothing here has to know
  // that the answer is usually called "idle". "" is the deliberate choice of
  // seeing every attack at once.
  if (from === null) from = sources.includes(file.initial) ? file.initial : "";
  // The sentinel survives this, but an emptied list does not: once the last
  // orphan is given a trigger the mode has nothing to show, so it falls back.
  if (from === UNASSIGNED && waiting.length === 0) from = "";
  if (from && from !== UNASSIGNED && !sources.includes(from)) from = "";
  const orphans = from === UNASSIGNED;
  // Copied out of the module variable, which the select is free to change from
  // under this render: everything below has to describe one picture.
  const start: string = orphans ? "" : from;

  // Chosen a state to start from: only the attacks it opens, and whatever those
  // can still cancel into. Everything else is somebody else's question.
  const entries = orphans ? [] : start ? openers.filter((o) => o.from.includes(start)) : openers;
  const attacks = orphans
    ? new Set(waiting)
    : start
      ? reachable(entries.map((e) => e.to), all)
      : attacksIn(file);
  const links = orphans ? [] : all.filter((l) => attacks.has(l.from) && attacks.has(l.to));
  // Every attack gets a node, whether or not it chains: a move that leads
  // nowhere is worth seeing, and after the moveset pass most of them will.
  const shift = start ? 1 : 0;
  const depths = new Map<string, number>();
  for (const name of attacks) depths.set(name, shift);
  for (const l of links) {
    depths.set(l.from, Math.max(depths.get(l.from) ?? 0, l.depth + shift));
    depths.set(l.to, Math.max(depths.get(l.to) ?? 0, l.depth + shift + 1));
  }
  if (start) depths.set(start, 0);

  // The ways in become edges of their own in this mode, so they are handed to
  // the same routing as the cancels rather than drawn a second way.
  const shown: Edge[] = start
    ? [
        ...links,
        ...entries.map((e) => ({
          from: start,
          to: e.to,
          on: e.when.replace(/pressed:|held:/g, ""),
          window: 0,
          startup: 0,
          worst: 0,
          depth: 0,
          hitstun: 0,
          margin: 0,
          launcher: false,
          entry: true,
        })),
      ]
    : links;

  container.append(
    legend(
      sources,
      orphans ? UNASSIGNED : start,
      (state) => {
        from = state;
        rebuild();
      },
      waiting.length,
      shown.length > 0,
    ),
  );

  // No orphan branch here on purpose: the mode is offered only while one of its
  // two lists has something in it, so "nothing is unassigned" is a sentence
  // that can only appear beside a list contradicting it.
  if (attacks.size === 0 && !orphans) {
    container.append(
      el("p", {
        className: "hint",
        textContent: start
          ? `Nothing opens from ${start}: no transition out of it starts an attack.`
          : "No attacks: no state says what it does to whoever it hits.",
      }),
    );
  }

  if (attacks.size === 0) return;

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
      const ways = start ? [] : entries.filter((e) => e.to === name);
      const box = el("div", { className: "chain-node" }, [
        // How you get in, when it is not from another attack. Without it the
        // graph says what follows what and never says where to start.
        ...ways.map((w) =>
          el("span", {
            className: "chain-entry",
            textContent: w.when.replace(/pressed:|held:/g, "").replace(/ \+ /g, " + "),
            title: `from ${w.from.join(", ")} — ${w.when}`,
          }),
        ),
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
  const draw = (): void => drawEdges(edges, board, nodes, shown);
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

/** Everything you can still get to from these attacks, following cancels only. */
function reachable(seeds: string[], links: Edge[]): Set<string> {
  const found = new Set(seeds);
  for (let added = true; added; ) {
    added = false;
    for (const l of links) {
      if (found.has(l.from) && !found.has(l.to)) {
        found.add(l.to);
        added = true;
      }
    }
  }
  return found;
}
