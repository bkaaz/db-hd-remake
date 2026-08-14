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
const sheetSelect = byId<HTMLSelectElement>("sheet-select");
const sheetLoadBtn = byId("sheet-load");
const entityNameInput = byId<HTMLInputElement>("entity-name");
const atlasNameInput = byId<HTMLInputElement>("atlas-name");
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

const sheet = new SheetView(sheetCanvas);
const preview = new Preview(previewCanvas);
const boxEditor = new BoxEditor(boxCanvas);

// Which tab is active; the Save button saves that section (set in setTab).

entityNameInput.value = state.entityName;
atlasNameInput.value = state.atlasFilename;

entityNameInput.addEventListener("change", () => {
  state.entityName = entityNameInput.value.trim() || "entity";
  emitChange();
});
atlasNameInput.addEventListener("change", () => {
  state.atlasFilename = atlasNameInput.value.trim() || "atlas.png";
});

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

sheetLoadBtn.addEventListener("click", () => loadFromRepo(sheetSelect.value));
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
  state.atlasFilename = fileName;
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

  entityNameInput.value = state.entityName;
  atlasNameInput.value = state.atlasFilename;
}


/**
 * Pull the entity's section files from the repo into editor state, remembering
 * each section's mtime so a later save can tell it would overwrite a newer file.
 * Used both after loading a sheet and by "Reload data" (which keeps the image).
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
  entityNameInput.value = state.entityName;
  atlasNameInput.value = state.atlasFilename;
  return true;
}

/** Load a sheet from the repo, and hydrate any existing entity JSON. */
function loadFromRepo(fileName: string): void {
  if (!fileName) return;
  const img = new Image();
  img.onload = async () => {
    applyNewImage(img, fileName);
    try {
      if (await hydrateFromRepo()) {
        rebuildKeyed();
        statusEl.textContent = `Loaded ${fileName} + existing entity data.`;
      } else {
        // Nothing on disk to compare against, so the empty entity is the
        // baseline: the first frame drawn then counts as an unsaved change.
        markEntitySaved();
        statusEl.textContent = `Loaded ${fileName} (new entity).`;
      }
    } catch {
      statusEl.textContent = `Loaded ${fileName}.`;
    }
    emitChange();
  };
  img.onerror = () => {
    statusEl.textContent = `Failed to load ${fileName} from repo.`;
  };
  img.src = `/api/sheet?name=${encodeURIComponent(fileName)}`;
}

async function refreshSheetList(): Promise<void> {
  try {
    const res = await fetch("/api/sheets");
    const data = (await res.json()) as { sheets: string[] };
    sheetSelect.replaceChildren();
    if (data.sheets.length === 0) {
      sheetSelect.append(new Option("(none in sprite-sheets/)", ""));
    } else {
      for (const name of data.sheets) sheetSelect.append(new Option(name, name));
    }
  } catch {
    sheetSelect.replaceChildren(new Option("(editor server not running)", ""));
  }
}

function render(): void {
  sheet.resize();
  sheet.redraw();
  renderFrames(framesPanel);
  renderAnims(animsPanel);
  renderBoxes(boxesPanel);
  renderStates(statesPanel);
  refreshTabMarks();
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
  tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  tabPanes.forEach((p) => p.classList.toggle("active", p.dataset.pane === name));
  // The bank is independent of the loaded entity, so it redraws when the tab
  // is opened rather than on every entity change — which would throw away a
  // half-typed field.
  if (name === "sounds") renderEntitySounds(entitySoundsPanel);
  if (name === "global-sounds") renderGlobalSounds(globalSoundsPanel);

  refreshTabMarks();
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
setTab("sprites");

// The bank belongs to the game rather than to the loaded entity, so it is
// fetched once at start-up instead of arriving with /api/entity.
void loadBank().then(() => renderGlobalSounds(globalSoundsPanel));

onChange(render);
render();

// Populate the sheet dropdown; optionally auto-load a sheet from ?sheet=.
void refreshSheetList().then(() => {
  const preselect = new URL(location.href).searchParams.get("sheet");
  if (preselect) {
    const match = [...sheetSelect.options].find(
      (o) => o.value === preselect || o.value === `${preselect}.png`,
    );
    if (match) {
      sheetSelect.value = match.value;
      loadFromRepo(match.value);
    }
  }
});
