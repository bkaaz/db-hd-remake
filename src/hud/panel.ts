import { textDots, textWidth } from "./font";
import { flashStep, layersOf, LAYER } from "./health";
import { kiMarks } from "./ki";

/**
 * One side's corner of the HUD, drawn in the game's pixels: a single outline
 * round the portrait, the ki marks above the health, the layers' count and
 * the fatigue line under it, the name below. Player two's is player one's
 * mirrored; the letters and the face are only placed, never mirrored.
 */

export interface PanelState {
  name: string;
  /** His face, 32 × 32, facing as player one's should; null before it is drawn. */
  face: CanvasImageSource | null;
  shown: number;
  ki: number;
  frame: number;
}

/** The panels' height: nothing of them reaches lower. */
export const PANEL_HEIGHT = 44;

const LINE = "#efefef";
const BLACK = "#000000";
const DARK = "#302420";
const KI = { full: "#63c6ff", filling: "#2a5a80", empty: "#203040" };
/** The layers, the last first: the original's yellow, then darker shades of it. */
const LAYERS = ["#ffff6b", "#f7d639", "#deb521", "#bd9410"];
/** The last layer's flash ($00:C6DE): dark red, yellow, orange, red. */
const FLASH = ["#630000", "#ffff6b", "#ffad10", "#e73100"];

/** The outline, player one's way round; every edge level, upright or at 45°. */
const SHAPE: [number, number][] = [[3, 3], [101, 3], [109, 11], [126, 11], [126, 24], [87, 24], [81, 30], [41, 30], [41, 40], [3, 40]];

function inside(px: number, py: number): boolean {
  let at = false;
  for (let i = 0, j = SHAPE.length - 1; i < SHAPE.length; j = i++) {
    const [xi, yi] = SHAPE[i];
    const [xj, yj] = SHAPE[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) at = !at;
  }
  return at;
}
/** The pixels inside the outline, worked out once. */
const INSIDE: [number, number][] = [];
for (let y = 3; y <= 40; y++) for (let x = 3; x <= 126; x++) if (inside(x + 0.5, y + 0.5)) INSIDE.push([x, y]);

export function drawPanel(g: CanvasRenderingContext2D, side: 0 | 1, s: PanelState): void {
  const width = g.canvas.width;
  const X = (x: number, w: number) => (side ? width - x - w : x);
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    if (w <= 0 || h <= 0) return;
    g.fillStyle = c;
    g.fillRect(X(x, w), y, w, h);
  };
  const line = ([x0, y0]: [number, number], [x1, y1]: [number, number], c: string) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) rect(x0 + Math.round(((x1 - x0) * k) / n), y0 + Math.round(((y1 - y0) * k) / n), 1, 1, c);
  };
  const outline = (dx: number, dy: number, c: string) => SHAPE.forEach((p, k) => line([p[0] + dx, p[1] + dy], [SHAPE[(k + 1) % SHAPE.length][0] + dx, SHAPE[(k + 1) % SHAPE.length][1] + dy], c));

  // the frame: a black line outside the white one, so it reads on any arena, and black inside
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) outline(dx, dy, BLACK);
  for (const [x, y] of INSIDE) rect(x, y, 1, 1, BLACK);
  outline(0, 0, LINE);
  line([41, 4], [41, 29], LINE);

  if (s.face) {
    const at = X(6, 32);
    g.save();
    if (side) {
      g.translate(2 * at + 32, 0);
      g.scale(-1, 1);
    }
    g.drawImage(s.face, at, 6);
    g.restore();
  }

  // ki: six `>` marks
  kiMarks(s.ki).forEach((v, k) => {
    const c = v >= 1 ? KI.full : v > 0 ? KI.filling : KI.empty;
    [0, 1, 2, 1, 0].forEach((o, r) => rect(45 + 9 * k + o, 5 + r, 4, 1, c));
  });

  // health: the top layer drains over the next; the last is the original's yellow, and flashes
  const { count, left } = layersOf(s.shown);
  const flash = flashStep(s.shown, s.frame);
  rect(44, 13, 80, 1, LINE);
  rect(44, 19, 80, 1, LINE);
  if (count > 1) rect(45, 15, 78, 3, LAYERS[count - 2]);
  if (count > 0) rect(45, 15, Math.round((78 * left) / LAYER), 3, count === 1 && flash !== null ? FLASH[flash] : LAYERS[count - 1]);

  // how many layers are left: a slanted block each, in its shade
  LAYERS.forEach((c, k) => {
    for (let r = 24; r <= 28; r++) rect(46 + 9 * k + Math.floor((28 - r) / 2), r, 6, 1, k < count ? c : DARK);
  });

  // fatigue: its line, empty — TODO the mechanic (plan.md) fills it, and reddens it as it does
  rect(90, 20, 34, 4, BLACK);
  rect(91, 21, 32, 2, DARK);

  // the name, outlined in black
  const left0 = X(45, textWidth(s.name));
  const dots = textDots(s.name);
  g.fillStyle = BLACK;
  for (const [x, y] of dots) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1]]) g.fillRect(left0 + x + dx, 34 + y + dy, 1, 1);
  g.fillStyle = "#ffffff";
  for (const [x, y] of dots) g.fillRect(left0 + x, 34 + y, 1, 1);
}
