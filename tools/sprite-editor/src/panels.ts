import {
  state,
  emitChange,
  selectedAnim,
  selectedFrame,
  addAnim,
  renameAnim,
  removeAnim,
  renameFrame,
  deleteFrame,
} from "./store";

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

    const nameInput = el("input", { className: "name", value: f.id });
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
        anim.steps.push({ frame: f.id, dur: 4 });
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
    const row = el("div", { className: "row step-row" });
    row.append(el("span", { className: "idx", textContent: String(i) }));

    const frameSel = el("select");
    for (const f of state.frames) {
      const opt = el("option", { value: f.id, textContent: f.id });
      if (f.id === step.frame) opt.selected = true;
      frameSel.append(opt);
    }
    frameSel.addEventListener("change", () => {
      step.frame = frameSel.value;
      emitChange();
    });

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

    row.append(frameSel, el("label", { textContent: "dur" }), dur, up, down, rm);
    container.append(row);
  });

  const addStep = el("button", { textContent: "＋ add step" });
  addStep.addEventListener("click", () => {
    const target = selectedFrame() ?? state.frames[0];
    if (target) {
      anim.steps.push({ frame: target.id, dur: 4 });
      emitChange();
    }
  });
  container.append(addStep);
}
