import {
  state,
  emitChange,
  onChange,
  deleteFrame,
  addFrameFromRect,
  clearAll,
  loadEntity,
  type EntityFileIn,
} from "./store";
import { SheetView } from "./sheetView";
import { Preview } from "./preview";
import { BoxEditor } from "./boxEditor";
import { renderFrames, renderAnims, renderBoxes, renderStates } from "./panels";
import {
  currentEntity,
  findEntity,
  firstEntity,
  imageUrlFor,
  loadEntityList,
  modifiedSections,
  renderEntityRail,
  setCurrentEntity,
  type EntityRef,
} from "./entities";
import {
  loadBank,
  renderEntitySounds,
  renderGlobalSounds,
  globalSoundsModified,
} from "./sounds";
import {
  animationsModified,
  entitySoundsModified,
  framesModified,
  markEntitySaved,
  saveAnimations,
  saveFrames,
} from "./exporter";
import { setImage, pickColorAt, rebuildKeyed } from "./imageProcess";
import { detectAll } from "./detect";

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
}

const sheetCanvas = byId<HTMLCanvasElement>("sheet");
const previewCanvas = byId<HTMLCanvasElement>("preview");
const framesPanel = byId("frames-panel");
const animsPanel = byId("anims-panel");
const boxesPanel = byId("boxes-panel");
const statesPanel = byId("states-panel");
const entitySoundsPanel = byId("entity-sounds-panel");
const globalSoundsPanel = byId("global-sounds-panel");
const boxCanvas = byId<HTMLCanvasElement>("box-canvas");
const rail = byId("rail");
const railToggle = byId("rail-toggle");
const openLabel = byId("open-entity");
const zoomLabel = byId("zoom-label");
const statusEl = byId("status");
const modeFrameBtn = byId("mode-frame");
const modeAnchorBtn = byId("mode-anchor");
const bgEnabled = byId<HTMLInputElement>("bg-enabled");
const bgSwatch = byId("bg-swatch");
const bgTol = byId<HTMLInputElement>("bg-tol");
const bgPickBtn = byId("bg-pick");
const detectAllBtn = byId("detect-all");
const detectClickBtn = byId("detect-click");
const detectGap = byId<HTMLInputElement>("detect-gap");
const detectMin = byId<HTMLInputElement>("detect-min");

/**
 * What is open and which tab is showing, kept in the URL so a reload lands
 * where you left off. `replaceState` rather than `pushState`: switching tab is
 * not navigation, and filling the back button with it would make Back useless.
 */
const TABS = ["sprites", "animations", "states", "sounds", "global-sounds"];
let activeTab = TABS[0];

function rememberInUrl(): void {
  const url = new URL(location.href);
  const ref = currentEntity();
  // Only ever written, never cleared: at start-up this runs before anything is
  // open, and clearing would throw away the ?entity= that says what to open.
  if (ref) url.searchParams.set("entity", ref.name);
  url.searchParams.set("tab", activeTab);
  history.replaceState(null, "", url);
}

const sheet = new SheetView(sheetCanvas);
const preview = new Preview(previewCanvas);
const boxEditor = new BoxEditor(boxCanvas);


modeFrameBtn.addEventListener("click", () => {
  state.mode = "frame";
  emitChange();
});
modeAnchorBtn.addEventListener("click", () => {
  state.mode = "anchor";
  emitChange();
});

byId("zoom-in").addEventListener("click", () => {
  state.scale = Math.min(8, state.scale * 2);
  emitChange();
});
byId("zoom-out").addEventListener("click", () => {
  state.scale = Math.max(0.25, state.scale / 2);
  emitChange();
});

bgEnabled.addEventListener("change", () => {
  state.bgKeyEnabled = bgEnabled.checked;
  rebuildKeyed();
  emitChange();
});
bgTol.addEventListener("change", () => {
  const v = parseInt(bgTol.value, 10);
  state.bgTolerance = Number.isFinite(v) && v >= 0 ? v : 0;
  rebuildKeyed();
  emitChange();
});
bgPickBtn.addEventListener("click", () => {
  if (state.image) {
    state.mode = "bg";
    emitChange();
  }
});

detectAllBtn.addEventListener("click", () => {
  if (!state.image) return;
  const rects = detectAll({ gap: state.detectGap, minSide: state.detectMinSide });
  // Skip rects that exactly match an existing frame, so repeats don't duplicate.
  const seen = new Set(state.frames.map((f) => `${f.x},${f.y},${f.w},${f.h}`));
  for (const r of rects) {
    const key = `${r.x},${r.y},${r.w},${r.h}`;
    if (seen.has(key)) continue;
    seen.add(key);
    addFrameFromRect(r);
  }
  emitChange();
});
detectClickBtn.addEventListener("click", () => {
  if (state.image) {
    state.mode = "detect";
    emitChange();
  }
});
byId("frames-clear").addEventListener("click", () => {
  clearAll();
  emitChange();
});
detectGap.addEventListener("change", () => {
  const v = parseInt(detectGap.value, 10);
  state.detectGap = Number.isFinite(v) && v >= 0 ? v : 0;
  emitChange();
});
detectMin.addEventListener("change", () => {
  const v = parseInt(detectMin.value, 10);
  state.detectMinSide = Number.isFinite(v) && v >= 1 ? v : 1;
  emitChange();
});

byId("play").addEventListener("click", () => preview.play());
byId("stop").addEventListener("click", () => preview.stop());

// Each section is saved from the panel that owns it, so where the button is
// says what it writes. A single global Save had to be read together with the
// active tab to know what a click would do.
function wireSave(id: string, save: () => Promise<{ message: string }>): void {
  byId(id).addEventListener("click", async () => {
    statusEl.textContent = "Saving…";
    statusEl.textContent = (await save()).message;
    render();
  });
}
wireSave("save-frames", saveFrames);
wireSave("save-animations", saveAnimations);

// Delete key removes the selected frame (only when not typing in a field).
window.addEventListener("keydown", (e) => {
  if (
    (e.key === "Delete" || e.key === "Backspace") &&
    state.selectedFrameId &&
    document.activeElement === document.body
  ) {
    deleteFrame(state.selectedFrameId);
    emitChange();
  }
});

/**
 * Apply a freshly-loaded image as the current sheet. A new sheet invalidates
 * existing frames/animations (they reference the previous sheet's coordinates),
 * so we start fresh, then auto-key the background.
 */
function applyNewImage(img: HTMLImageElement, fileName: string): void {
  state.frames = [];
  state.anims = [];
  state.states = null;
  state.sectionMtimes = {};
  state.selectedFrameId = null;
  state.selectedAnimName = null;
  state.mode = "frame";

  state.image = img;
  state.entityName = fileName.replace(/\.[^.]+$/, "") || "entity";

  const hasAlpha = setImage(img);
  if (hasAlpha) {
    state.bgKeyEnabled = false;
    state.bgColor = null;
  } else {
    pickColorAt(0, 0);
    state.bgTolerance = 0;
    state.bgKeyEnabled = true;
  }
  rebuildKeyed();
}

/**
 * Pull the entity's section files from the repo into editor state, remembering
 * each section's mtime so a later save can tell it would overwrite a newer file.
 */
async function hydrateFromRepo(): Promise<boolean> {
  const res = await fetch(`/api/entity?name=${encodeURIComponent(state.entityName)}`);
  if (!res.ok) return false;
  const data = (await res.json()) as { entity: EntityFileIn; mtimes?: Record<string, number> };
  loadEntity(data.entity);
  state.sectionMtimes = data.mtimes ?? {};
  // "Modified" means changed since this entity was opened, not "differs from
  // an empty editor" — so the baseline is taken here, at the moment it arrives.
  markEntitySaved();
  return true;
}

/**
 * Open an entity: its data and its picture, in one gesture.
 *
 * Switching throws away unsaved section edits, which is fine as long as it is
 * said out loud — and it can be said precisely, because the editor knows which
 * sections differ from disk. The game's sound bank is not an entity section and
 * survives untouched.
 */
function openEntity(ref: EntityRef): void {
  const dirty = modifiedSections();
  if (dirty.length > 0) {
    const ok = confirm(
      `Unsaved changes in ${dirty.join(", ")}.\n\nOpening "${ref.name}" discards them.`,
    );
    if (!ok) return;
  }

  const img = new Image();
  img.onload = async () => {
    applyNewImage(img, `${ref.name}.png`);
    setCurrentEntity(ref);
    rememberInUrl();
    try {
      if (await hydrateFromRepo()) {
        rebuildKeyed();
        statusEl.textContent = `Opened ${ref.name}.`;
      } else {
        // Nothing on disk to compare against, so the empty entity is the
        // baseline: the first frame drawn then counts as an unsaved change.
        markEntitySaved();
        statusEl.textContent = `Opened ${ref.name} (no data on disk yet).`;
      }
    } catch {
      statusEl.textContent = `Opened ${ref.name}.`;
    }
    // The sounds panel is not redrawn by the normal change notification — that
    // would throw away a half-typed field on every unrelated edit. A different
    // entity is the one moment it has to catch up.
    renderEntitySounds(entitySoundsPanel);
    emitChange();
  };
  img.onerror = () => {
    statusEl.textContent =
      ref.kind === "spawn"
        ? `No atlas for "${ref.name}" — run npm run fx.`
        : `No sheet assets/sheets/${ref.name}.png.`;
  };
  img.src = imageUrlFor(ref);
}


function render(): void {
  sheet.resize();
  sheet.redraw();
  renderFrames(framesPanel);
  renderAnims(animsPanel);
  renderBoxes(boxesPanel);
  renderStates(statesPanel);
  refreshTabMarks();
  renderEntityRail(rail);
  openLabel.textContent = currentEntity()?.name ?? "nothing open";
  boxEditor.redraw();

  modeFrameBtn.classList.toggle("active", state.mode === "frame");
  modeAnchorBtn.classList.toggle("active", state.mode === "anchor");
  bgPickBtn.classList.toggle("active", state.mode === "bg");
  detectClickBtn.classList.toggle("active", state.mode === "detect");
  detectGap.value = String(state.detectGap);
  detectMin.value = String(state.detectMinSide);
  bgEnabled.checked = state.bgKeyEnabled;
  bgTol.value = String(state.bgTolerance);
  bgSwatch.style.background = state.bgColor
    ? `rgb(${state.bgColor[0]}, ${state.bgColor[1]}, ${state.bgColor[2]})`
    : "transparent";
  zoomLabel.textContent = `${Math.round(state.scale * 100)}%`;
  statusEl.textContent = state.image
    ? `${state.image.width}x${state.image.height}px · ${state.frames.length} frames · ${state.anims.length} anims · mode: ${state.mode}`
    : "Load a sprite sheet to begin.";
}

// Tab switching (Sprites / Animations / States; the rest are placeholders).
// The Save button saves only the active tab's section, and its label reflects
// it. States is read-only, so there Save is disabled rather than misleading.
const tabButtons = document.querySelectorAll<HTMLButtonElement>("#tabs .tab");
const tabPanes = document.querySelectorAll<HTMLElement>(".tab-pane");
function setTab(name: string): void {
  activeTab = name;
  tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  tabPanes.forEach((p) => p.classList.toggle("active", p.dataset.pane === name));
  // The bank is independent of the loaded entity, so it redraws when the tab
  // is opened rather than on every entity change — which would throw away a
  // half-typed field.
  if (name === "sounds") renderEntitySounds(entitySoundsPanel);
  if (name === "global-sounds") renderGlobalSounds(globalSoundsPanel);

  refreshTabMarks();
  rememberInUrl();
}

/**
 * A dot on a tab whose section has edits that are not on disk. With Save living
 * in the panels, this is what stops an edit in a tab you have left from being
 * forgotten — it is the other half of moving the button.
 */
const MODIFIED: Record<string, () => boolean> = {
  sprites: framesModified,
  animations: animationsModified,
  sounds: entitySoundsModified,
  "global-sounds": globalSoundsModified,
};
function refreshTabMarks(): void {
  tabButtons.forEach((b) => {
    const name = b.dataset.tab;
    b.dataset.label ??= b.textContent ?? "";
    const base = b.dataset.label;
    b.textContent = name && MODIFIED[name]?.() ? `${base} •` : base;
  });
}

tabButtons.forEach((b) => {
  const name = b.dataset.tab;
  if (!b.disabled && name) b.addEventListener("click", () => setTab(name));
});
const wantedTab = new URL(location.href).searchParams.get("tab");
setTab(wantedTab && TABS.includes(wantedTab) ? wantedTab : TABS[0]);

// The bank belongs to the game rather than to the loaded entity, so it is
// fetched once at start-up instead of arriving with /api/entity.
void loadBank().then(() => renderGlobalSounds(globalSoundsPanel));

onChange(render);
render();

// The rail is the way in: pick an entity and its data and picture arrive
// together. `?entity=goku` opens one straight away.
void loadEntityList(openEntity).then(() => {
  renderEntityRail(rail);
  const wanted = new URL(location.href).searchParams.get("entity");
  const ref = (wanted ? findEntity(wanted) : null) ?? firstEntity();
  if (ref) openEntity(ref);
  else if (wanted) statusEl.textContent = `No entity called "${wanted}".`;
});

railToggle.addEventListener("click", () => {
  document.querySelector("main")?.classList.toggle("rail-hidden");
});
