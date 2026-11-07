import {
  state,
  emitChange,
  onChange,
  loadEntity,
  type EntityFileIn,
} from "./store";
import { SheetView } from "./sheetView";
import { Preview } from "./preview";
import { BoxEditor } from "./boxEditor";
import { renderFrames, renderAnims, renderBoxes, renderStates } from "./panels";
import { renderChainGraph } from "./chainGraph";
import { withHitTypes } from "../../../src/combat/hitTypes";
import {
  currentEntity,
  findEntity,
  firstEntity,
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
  markEntitySaved,
  saveAnimations,
} from "./exporter";
import { cartridge } from "../../../src/cartridge/romFile";
import { drawFighter, drawSpawnLook } from "../../../src/cartridge/romSheets";

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
}

const sheetCanvas = byId<HTMLCanvasElement>("sheet");
const sheetWrap = byId("sheet-wrap");
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
// what the editor holds, redrawn by every render; a message stays until the next one
const summaryEl = byId("status-summary");
const messageEl = byId("status-message");

/**
 * What is open and which tab is showing, kept in the URL so a reload lands
 * where you left off. `replaceState` rather than `pushState`: switching tab is
 * not navigation, and filling the back button with it would make Back useless.
 */
const TABS = ["sprites", "animations", "combos", "sounds", "global-sounds"];
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


byId("zoom-in").addEventListener("click", () => {
  state.scale = Math.min(8, state.scale * 2);
  emitChange();
});
byId("zoom-out").addEventListener("click", () => {
  state.scale = Math.max(0.25, state.scale / 2);
  emitChange();
});

byId("play").addEventListener("click", () => preview.play());
byId("stop").addEventListener("click", () => preview.stop());

// Each section is saved from the panel that owns it, so where the button is
// says what it writes. A single global Save had to be read together with the
// active tab to know what a click would do.
function wireSave(id: string, save: () => Promise<{ message: string }>): void {
  byId(id).addEventListener("click", async () => {
    messageEl.textContent = "Saving…";
    messageEl.textContent = (await save()).message;
    render();
  });
}
wireSave("save-animations", saveAnimations);

/** The sheet as the ROM draws it, for an entity the cartridge holds: a fighter or a spawn with its `look.json`. */
async function drawnSheet(entity: EntityFileIn): Promise<HTMLCanvasElement | null> {
  const rom = await cartridge();
  const drawn = entity.look ? drawSpawnLook(rom, entity.look) : drawFighter(rom, entity.name, entity.palettes);
  if (!drawn) return null;
  const canvas = document.createElement("canvas");
  canvas.width = drawn.sheet.width;
  canvas.height = drawn.sheet.height;
  canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(drawn.sheet.data), drawn.sheet.width, drawn.sheet.height), 0, 0);
  return canvas;
}

/**
 * Pull the entity's section files from the repo into editor state, remembering
 * each section's mtime so a later save can tell it would overwrite a newer file.
 */
async function hydrateFromRepo(name: string): Promise<EntityFileIn | null> {
  const res = await fetch(`/api/entity?name=${encodeURIComponent(name)}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { entity: EntityFileIn; mtimes?: Record<string, number> };
  loadEntity(data.entity);
  state.sectionMtimes = data.mtimes ?? {};
  // "Modified" means changed since this entity was opened, not "differs from
  // an empty editor" — so the baseline is taken here, at the moment it arrives.
  markEntitySaved();
  return data.entity;
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

  state.selectedFrameId = null;
  state.selectedAnimName = null;
  state.image = null;
  setCurrentEntity(ref);
  rememberInUrl();
  void (async () => {
    try {
      const entity = await hydrateFromRepo(ref.name);
      state.image = entity ? await drawnSheet(entity) : null;
      messageEl.textContent = !entity
        ? `No data for ${ref.name}.`
        : state.image
          ? `Opened ${ref.name}.`
          : `${ref.name} is not drawn from the ROM: it has no look.json.`;
    } catch (e) {
      messageEl.textContent = `Could not open ${ref.name} — ${String(e)}`;
    }
    // The sounds panel is not redrawn by the normal change notification — that
    // would throw away a half-typed field on every unrelated edit. A different
    // entity is the one moment it has to catch up.
    renderEntitySounds(entitySoundsPanel);
    emitChange();
  })();
}


function render(): void {
  sheet.resize();
  sheet.redraw();
  renderFrames(framesPanel);
  renderAnims(animsPanel);
  renderBoxes(boxesPanel);
  renderStates(statesPanel);
  drawChains();
  refreshTabMarks();
  renderEntityRail(rail);
  openLabel.textContent = currentEntity()?.name ?? "nothing open";
  boxEditor.redraw();

  zoomLabel.textContent = `${Math.round(state.scale * 100)}%`;
  summaryEl.textContent = state.image
    ? `${state.image.width}x${state.image.height}px · ${state.frames.length} frames · ${state.anims.length} anims`
    : "Pick an entity to open.";
}

/**
 * The Combos tab takes the middle of the window: a graph needs the room the
 * sheet normally has, and the side panel — 300 px wide — turns one into
 * overlapping labels. The panel keeps the validation, which is a list and
 * belongs in a column.
 */
const chainWrap = byId("chain-wrap");
function drawChains(): void {
  const showing = activeTab === "combos";
  chainWrap.hidden = !showing;
  sheetWrap.hidden = showing;
  if (!showing) return;
  chainWrap.replaceChildren();
  const byName = Object.fromEntries(state.anims.map((a) => [a.name, { loop: a.loop, steps: a.steps }]));
  if (state.states) renderChainGraph(chainWrap, withHitTypes(state.states), byName, state.baseHitstun);
}

// Tab switching (Sprites / Animations / Combos; the rest are placeholders).
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
  drawChains();
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
  else if (wanted) messageEl.textContent = `No entity called "${wanted}".`;
});

railToggle.addEventListener("click", () => {
  document.querySelector("main")?.classList.toggle("rail-hidden");
});
