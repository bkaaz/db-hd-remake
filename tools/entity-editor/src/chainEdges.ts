import type { Link } from "../../../src/combat/chains";

/**
 * Where the arrows go — the half of the chain graph that is geometry rather
 * than data.
 *
 * It exists apart from `chainGraph.ts` because routing is a different job from
 * choosing what to draw: this file never asks what a link *means*, only which
 * boxes it joins and how to get there without crossing a third one.
 */

/** A node the browser has already placed; the routing measures it, never moves it. */
export interface GraphNode {
  name: string;
  depth: number;
  el: HTMLElement;
}

export function drawEdges(svg: SVGSVGElement, board: HTMLElement, nodes: Map<string, GraphNode>, links: Link[]): void {
  const origin = board.getBoundingClientRect();
  svg.replaceChildren();

  /**
   * A link that skips columns is routed through its own lane **below** the row
   * of nodes, instead of flying across the boxes in between — which is the
   * layered-drawing trick of giving a long edge waypoints in every layer it
   * crosses, at our scale where a lane per edge is enough.
   */
  const long = links.filter((l) => columnsApart(l, nodes) > 1);
  const lane = new Map<Link, number>();
  long
    .slice()
    .sort((a, b) => columnsApart(b, nodes) - columnsApart(a, nodes))
    .forEach((l, i) => lane.set(l, i));

  const nodesBottom = Math.max(
    ...[...nodes.values()].map((n) => n.el.getBoundingClientRect().bottom - origin.top),
  );
  const LANE_GAP = 26;
  const height = nodesBottom + LANE_GAP * (long.length + 1);
  board.style.paddingBottom = `${LANE_GAP * (long.length + 1)}px`;
  svg.setAttribute("viewBox", `0 0 ${origin.width} ${height}`);

  for (const link of links) {
    const from = nodes.get(link.from)?.el.getBoundingClientRect();
    const to = nodes.get(link.to)?.el.getBoundingClientRect();
    if (!from || !to) continue;
    const x1 = from.right - origin.left;
    const y1 = from.top + from.height / 2 - origin.top;
    const x2 = to.left - origin.left;
    const y2 = to.top + to.height / 2 - origin.top;

    const at = lane.get(link);
    let d: string;
    let label: [number, number];
    if (at === undefined) {
      // Neighbouring columns: nothing to fly over, so a plain curve.
      const cx = (x1 + x2) / 2;
      d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
      label = [cx, (y1 + y2) / 2 - 6];
    } else {
      const y = nodesBottom + LANE_GAP * (at + 1);
      const bend = 14;
      d =
        `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x1 + bend} ${y}, ${x1 + bend * 2} ${y}` +
        ` L ${x2 - bend * 2} ${y}` +
        ` C ${x2 - bend} ${y}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
      label = [(x1 + x2) / 2, y - 6];
    }

    const line = svgEl("path", {
      d,
      class: `chain-edge${link.margin < 0 ? " bad" : ""}${link.launcher ? " ends" : ""}`,
      "data-from": link.from,
      "data-to": link.to,
    });
    line.append(svgEl("title", {}, tooltip(link)));
    svg.append(line);
    svg.append(
      svgEl(
        "text",
        {
          x: String(label[0]),
          y: String(label[1]),
          class: `chain-label${link.margin < 0 ? " bad" : ""}`,
          "data-from": link.from,
          "data-to": link.to,
        },
        `${link.on ?? "—"} ${link.margin >= 0 ? "+" : ""}${link.margin}`,
      ),
    );
  }
}

/** How many columns a link crosses — 1 is a neighbour, more is a fly-over. */
function columnsApart(link: Link, nodes: Map<string, GraphNode>): number {
  const from = nodes.get(link.from)?.depth ?? 0;
  const to = nodes.get(link.to)?.depth ?? 0;
  return to - from;
}

/** The arithmetic behind one link, for whoever hovers it. */
function tooltip(l: Link): string {
  return [
    `${l.from} → ${l.to} on ${l.on ?? "—"}`,
    `window ${l.window} + start-up ${l.startup} = ${l.worst} frames at worst`,
    `hitstun ${l.hitstun} at depth ${l.depth} → ${l.margin >= 0 ? "+" : ""}${l.margin} to spare`,
    l.launcher ? "the reaction floors them: the chain ends here anyway" : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function svgEl(tag: string, attrs: Record<string, string>, text = ""): SVGElement {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text) node.textContent = text;
  return node;
}
