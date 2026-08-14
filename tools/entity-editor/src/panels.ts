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

/**
 * The selected frame, not all of them.
 *
 * The sheet is the picker: clicking a sprite selects it, and a picture beats a
 * row of numbers every time. A list of all frames duplicated that worse — Goku
 * has 219, so it was a thousand DOM nodes rebuilt on every change, none of them
 * showing what the frame looks like. The select stays as a fallback for a
 * sprite too small or too crowded to click.
 */
export function renderFrames(container: HTMLElement): void {
  container.replaceChildren();

  if (state.frames.length === 0) {
    container.append(el("p", { className: "hint", textContent: "No frames yet." }));
    return;
  }

  container.append(
    el("p", {
      className: "hint",
      textContent: `${state.frames.length} frames — click a sprite on the sheet to select it.`,
    }),
  );

  const picker = el("select", { title: "The frame these fields edit" });
  for (const f of state.frames) {
    picker.append(el("option", { value: f.id, textContent: `${f.id} — ${f.w}x${f.h}` }));
  }
  picker.value = state.selectedFrameId ?? "";
  picker.addEventListener("change", () => {
    state.selectedFrameId = picker.value;
    emitChange();
  });
  container.append(el("div", { className: "row sound-pick" }, [picker]));

  const frame = selectedFrame();
  if (!frame) {
    container.append(el("p", { className: "hint", textContent: "Nothing selected." }));
    return;
  }

  // Frame ids are numbers; typing another renumbers, swapping with whichever
  // frame already holds it — renumbering is how an ordering mistake gets fixed.
  const number = el("input", {
    className: "num",
    type: "number",
    min: "0",
    step: "1",
    value: frame.id,
    title: "Frame number — type another to renumber (swaps if taken)",
  });
  number.addEventListener("change", () => {
    if (!renameFrame(frame.id, number.value.trim())) number.value = frame.id;
    emitChange();
  });

  const addBtn = el("button", {
    textContent: "＋anim",
    title: "Append as a step to the selected animation",
  });
  addBtn.addEventListener("click", () => {
    const anim = selectedAnim();
    if (anim) {
      anim.steps.push({ frame: frame.id, dur: 4, boxes: [] });
      emitChange();
    }
  });

  const delBtn = el("button", { className: "danger", textContent: "Delete" });
  delBtn.addEventListener("click", () => {
    deleteFrame(frame.id);
    emitChange();
  });

  container.append(
    el("div", { className: "row" }, [
      el("span", { className: "dims", textContent: "number" }),
      number,
      addBtn,
      delBtn,
    ]),
    el("p", {
      className: "dims",
      textContent: `${frame.w}x${frame.h} at ${frame.x},${frame.y} · anchor ${frame.anchor[0]},${frame.anchor[1]}`,
    }),
  );
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
