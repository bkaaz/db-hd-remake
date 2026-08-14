import {
  state,
  emitChange,
  selectedAnim,
  selectedStep,
  selectedFrame,
  addAnim,
  renameAnim,
  removeAnim,
  renameFrame,
  deleteFrame,
  type BoxType,
} from "./store";
import { validateStates } from "../../../src/entity/states";

/** Tiny typed DOM helper. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of children) node.append(c);
  return node;
}

// --- Frames panel --------------------------------------------------------

export function renderFrames(container: HTMLElement): void {
  container.replaceChildren();

  if (state.frames.length === 0) {
    container.append(el("p", { className: "hint", textContent: "No frames yet." }));
    return;
  }

  for (const f of state.frames) {
    const row = el("div", {
      className: "row frame-row" + (f.id === state.selectedFrameId ? " selected" : ""),
    });

    // Frame ids are numbers; typing one here renumbers the frame, swapping with
    // whichever frame already holds that number.
    const nameInput = el("input", {
      className: "num",
      type: "number",
      min: "0",
      step: "1",
      value: f.id,
      title: "Frame number — type another to renumber (swaps if taken)",
    });
    nameInput.addEventListener("change", () => {
      if (!renameFrame(f.id, nameInput.value.trim())) nameInput.value = f.id;
      emitChange();
    });

    const dims = el("span", {
      className: "dims",
      textContent: `${f.w}x${f.h} @${f.x},${f.y} ⚓${f.anchor[0]},${f.anchor[1]}`,
    });

    const selectBtn = el("button", { textContent: "select" });
    selectBtn.addEventListener("click", () => {
      state.selectedFrameId = f.id;
      emitChange();
    });

    const addBtn = el("button", { textContent: "＋anim", title: "Append as a step to the selected animation" });
    addBtn.addEventListener("click", () => {
      const anim = selectedAnim();
      if (anim) {
        anim.steps.push({ frame: f.id, dur: 4, boxes: [] });
        emitChange();
      }
    });

    const delBtn = el("button", { className: "danger", textContent: "✕" });
    delBtn.addEventListener("click", () => {
      deleteFrame(f.id);
      emitChange();
    });

    row.append(nameInput, dims, selectBtn, addBtn, delBtn);
    container.append(row);
  }
}

// --- Animations panel ----------------------------------------------------

export function renderAnims(container: HTMLElement): void {
  container.replaceChildren();

  const newBtn = el("button", { textContent: "＋ new animation" });
  newBtn.addEventListener("click", () => {
    addAnim();
    emitChange();
  });
  container.append(el("div", { className: "row" }, [newBtn]));

  if (state.anims.length === 0) {
    container.append(
      el("p", { className: "hint", textContent: "No animations. Create one, then add frames as steps." }),
    );
    return;
  }

  const select = el("select");
  for (const a of state.anims) {
    const opt = el("option", { value: a.name, textContent: a.name });
    if (a.name === state.selectedAnimName) opt.selected = true;
    select.append(opt);
  }
  select.addEventListener("change", () => {
    state.selectedAnimName = select.value;
    state.selectedStepIndex = null;
    state.selectedBoxIndex = null;
    emitChange();
  });
  container.append(el("div", { className: "row" }, [el("label", { textContent: "Animation:" }), select]));

  const anim = selectedAnim();
  if (!anim) return;

  const nameInput = el("input", { value: anim.name });
  nameInput.addEventListener("change", () => {
    if (!renameAnim(anim.name, nameInput.value.trim())) nameInput.value = anim.name;
    emitChange();
  });
  const loop = el("input", { type: "checkbox" });
  loop.checked = anim.loop;
  loop.addEventListener("change", () => {
    anim.loop = loop.checked;
    emitChange();
  });
  const delAnim = el("button", { className: "danger", textContent: "delete" });
  delAnim.addEventListener("click", () => {
    removeAnim(anim.name);
    emitChange();
  });
  container.append(
    el("div", { className: "row" }, [
      el("label", { textContent: "Name:" }),
      nameInput,
      el("label", { textContent: "loop" }),
      loop,
      delAnim,
    ]),
  );

  if (anim.steps.length === 0) {
    container.append(el("p", { className: "hint", textContent: "No steps yet." }));
  }

  anim.steps.forEach((step, i) => {
    const selected = state.selectedStepIndex === i;
    const row = el("div", { className: "row step-row" + (selected ? " selected" : "") });

    // Clicking the index selects this step for box editing.
    const idx = el("span", { className: "idx", textContent: String(i) });
    idx.style.cursor = "pointer";
    idx.title = "Select this step for box editing";
    idx.addEventListener("click", () => {
      state.selectedStepIndex = i;
      state.selectedBoxIndex = null;
      emitChange();
    });
    row.append(idx);

    // A dropdown of every frame is unusable at 200+ frames — type the number.
    const frameInput = el("input", {
      className: "num",
      type: "number",
      min: "0",
      step: "1",
      value: step.frame,
      title: "Frame number",
    });
    frameInput.addEventListener("change", () => {
      const wanted = frameInput.value.trim();
      if (state.frames.some((f) => f.id === wanted)) step.frame = wanted;
      else frameInput.value = step.frame; // no such frame — put it back
      emitChange();
    });
    if (!state.frames.some((f) => f.id === step.frame)) frameInput.classList.add("bad");

    const dur = el("input", { type: "number", className: "dur", value: String(step.dur) });
    dur.min = "1";
    dur.addEventListener("change", () => {
      const v = parseInt(dur.value, 10);
      step.dur = Number.isFinite(v) && v > 0 ? v : 1;
      emitChange();
    });

    const up = el("button", { textContent: "↑" });
    up.addEventListener("click", () => {
      if (i > 0) {
        [anim.steps[i - 1], anim.steps[i]] = [anim.steps[i], anim.steps[i - 1]];
        emitChange();
      }
    });
    const down = el("button", { textContent: "↓" });
    down.addEventListener("click", () => {
      if (i < anim.steps.length - 1) {
        [anim.steps[i + 1], anim.steps[i]] = [anim.steps[i], anim.steps[i + 1]];
        emitChange();
      }
    });
    const rm = el("button", { className: "danger", textContent: "✕" });
    rm.addEventListener("click", () => {
      anim.steps.splice(i, 1);
      emitChange();
    });

    const boxCount = el("span", {
      className: "dims",
      textContent: step.boxes.length ? `▢${step.boxes.length}` : "",
    });

    row.append(frameInput, el("label", { textContent: "dur" }), dur, up, down, rm, boxCount);
    container.append(row);
  });

  const addStep = el("button", { textContent: "＋ add step" });
  addStep.addEventListener("click", () => {
    const target = selectedFrame() ?? state.frames[0];
    if (target) {
      anim.steps.push({ frame: target.id, dur: 4, boxes: [] });
      emitChange();
    }
  });
  container.append(addStep);
}

// --- States panel (read-only) --------------------------------------------

/**
 * Shows `states.json` and flags broken references. Deliberately read-only:
 * states are relational data that reads and edits well as text, so we buy the
 * part that text cannot give us — validation — and skip the editing UI until
 * the format settles (see docs/decisions.md).
 */
export function renderStates(container: HTMLElement): void {
  container.replaceChildren();

  const file = state.states;
  if (!file) {
    container.append(
      el("p", {
        className: "hint",
        textContent:
          "No states.json for this entity. Load a sheet whose entity has one, or author it by hand — see docs/data-format.md.",
      }),
    );
    return;
  }

  const known = new Set(state.anims.map((a) => a.name));
  const byName = Object.fromEntries(
    state.anims.map((a) => [a.name, { loop: a.loop, steps: a.steps }]),
  );
  const { errors, warnings } = validateStates(file, byName);

  const summary = el("p", {
    className: errors.length > 0 ? "err" : "hint",
    textContent:
      errors.length > 0
        ? `${errors.length} problem(s) — the state machine will not behave as authored:`
        : `${Object.keys(file.states).length} states, no problems found.`,
  });
  container.append(summary);
  for (const e of errors) container.append(el("p", { className: "err msg", textContent: `• ${e}` }));
  for (const w of warnings) container.append(el("p", { className: "warn msg", textContent: `• ${w}` }));

  for (const [name, def] of Object.entries(file.states)) {
    const head = el("div", { className: "row state-row" });
    head.append(el("strong", { textContent: name }));
    if (name === file.initial) head.append(el("span", { className: "badge", textContent: "initial" }));

    const animOk = !!def.anim && known.has(def.anim);
    head.append(
      el("span", {
        className: animOk ? "dims" : "err",
        textContent: `anim: ${def.anim || "—"}`,
      }),
    );
    const vel = def.vel ?? [0, 0];
    if (vel[0] !== 0 || vel[1] !== 0) {
      head.append(el("span", { className: "dims", textContent: `vel ${vel[0]},${vel[1]}` }));
    }
    if (def.turn) head.append(el("span", { className: "dims", textContent: "turn" }));
    container.append(head);

    const transitions = def.transitions ?? [];
    if (transitions.length === 0) {
      container.append(el("div", { className: "row trans-row dims", textContent: "no transitions" }));
    }
    transitions.forEach((t, i) => {
      const row = el("div", { className: "row trans-row" });
      row.append(el("span", { className: "idx", textContent: String(i) }));
      row.append(el("span", { className: "dims", textContent: t.when }));
      row.append(el("span", { className: "dims", textContent: "→" }));
      row.append(
        el("span", {
          className: file.states[t.to] ? "dims" : "err",
          textContent: t.to || "—",
        }),
      );
      container.append(row);
    });
  }
}

// --- Boxes panel ---------------------------------------------------------

const BOX_TYPES: BoxType[] = ["hit", "hurt", "push"];

/** Panel for the selected animation step's collision boxes. */
export function renderBoxes(container: HTMLElement): void {
  container.replaceChildren();

  // Type picker for new boxes.
  const typeRow = el("div", { className: "row" });
  typeRow.append(el("span", { className: "lbl", textContent: "Draw:" }));
  for (const t of BOX_TYPES) {
    const b = el("button", {
      className: "boxtype " + t + (state.boxType === t ? " active" : ""),
      textContent: t,
    });
    b.addEventListener("click", () => {
      state.boxType = t;
      emitChange();
    });
    typeRow.append(b);
  }
  container.append(typeRow);

  const step = selectedStep();
  if (!step) {
    container.append(
      el("p", {
        className: "hint",
        textContent: "Select a step (click its number in Animations) to edit its boxes. Then drag on the canvas.",
      }),
    );
    return;
  }

  if (step.boxes.length === 0) {
    container.append(el("p", { className: "hint", textContent: "No boxes. Drag on the canvas to add one." }));
  }

  step.boxes.forEach((box, i) => {
    const row = el("div", { className: "row box-row" + (state.selectedBoxIndex === i ? " selected" : "") });

    const sel = el("select", { className: "boxtype-sel " + box.type });
    for (const t of BOX_TYPES) {
      const opt = el("option", { value: t, textContent: t });
      if (t === box.type) opt.selected = true;
      sel.append(opt);
    }
    sel.addEventListener("change", () => {
      box.type = sel.value as BoxType;
      emitChange();
    });

    const dims = el("span", {
      className: "dims",
      textContent: `${box.w}×${box.h} @${box.x},${box.y}`,
    });

    const selectBtn = el("button", { textContent: "select" });
    selectBtn.addEventListener("click", () => {
      state.selectedBoxIndex = i;
      emitChange();
    });

    const rm = el("button", { className: "danger", textContent: "✕" });
    rm.addEventListener("click", () => {
      step.boxes.splice(i, 1);
      if (state.selectedBoxIndex === i) state.selectedBoxIndex = null;
      emitChange();
    });

    row.append(sel, dims, selectBtn, rm);
    container.append(row);
  });
}
