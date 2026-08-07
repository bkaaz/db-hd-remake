import { state, emitChange, onChange, deleteFrame } from "./store";
import { SheetView } from "./sheetView";
import { Preview } from "./preview";
import { renderFrames, renderAnims } from "./panels";
import { downloadJSON, downloadAtlas } from "./exporter";

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
}

const sheetCanvas = byId<HTMLCanvasElement>("sheet");
const previewCanvas = byId<HTMLCanvasElement>("preview");
const framesPanel = byId("frames-panel");
const animsPanel = byId("anims-panel");
const fileInput = byId<HTMLInputElement>("file");
const charNameInput = byId<HTMLInputElement>("char-name");
const atlasNameInput = byId<HTMLInputElement>("atlas-name");
const zoomLabel = byId("zoom-label");
const statusEl = byId("status");
const dropZone = byId("sheet-wrap");
const modeFrameBtn = byId("mode-frame");
const modeAnchorBtn = byId("mode-anchor");

const sheet = new SheetView(sheetCanvas);
const preview = new Preview(previewCanvas);

charNameInput.value = state.charName;
atlasNameInput.value = state.atlasFilename;

charNameInput.addEventListener("change", () => {
  state.charName = charNameInput.value.trim() || "character";
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

byId("export-json").addEventListener("click", () => downloadJSON());
byId("export-atlas").addEventListener("click", () => downloadAtlas());
byId("play").addEventListener("click", () => preview.play());
byId("stop").addEventListener("click", () => preview.stop());

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) loadImageFile(file);
});
dropZone.addEventListener("dragover", (e) => e.preventDefault());
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (file) loadImageFile(file);
});

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

function loadImageFile(file: File): void {
  const img = new Image();
  img.onload = () => {
    state.image = img;
    state.atlasFilename = file.name;
    atlasNameInput.value = file.name;
    emitChange();
  };
  img.onerror = () => {
    statusEl.textContent = "Failed to load image.";
  };
  img.src = URL.createObjectURL(file);
}

function render(): void {
  sheet.resize();
  sheet.redraw();
  renderFrames(framesPanel);
  renderAnims(animsPanel);

  modeFrameBtn.classList.toggle("active", state.mode === "frame");
  modeAnchorBtn.classList.toggle("active", state.mode === "anchor");
  zoomLabel.textContent = `${Math.round(state.scale * 100)}%`;
  statusEl.textContent = state.image
    ? `${state.image.width}x${state.image.height}px · ${state.frames.length} frames · ${state.anims.length} anims · mode: ${state.mode}`
    : "Load a sprite sheet to begin.";
}

onChange(render);
render();
