(function() {
  "use strict";

  const imagePattern = /\.(avif|bmp|gif|jpe?g|png|svg|tiff?|webp)$/i;
  const maxDevicePixelRatio = 3;
  const minScale = 0.02;
  const maxScale = 80;
  const reorderType = "application/x-qualcmp-pane";

  const els = {
    add: document.getElementById("btn_add"),
    folder: document.getElementById("btn_folder"),
    clear: document.getElementById("btn_clear"),
    previous: document.getElementById("btn_previous"),
    next: document.getElementById("btn_next"),
    fit: document.getElementById("btn_fit"),
    actual: document.getElementById("btn_actual"),
    export: document.getElementById("btn_export"),
    index: document.getElementById("input_idx"),
    frameCount: document.getElementById("frame_count"),
    normalize: document.getElementById("input_normalize"),
    smooth: document.getElementById("input_smooth"),
    size: document.getElementById("select_size"),
    status: document.getElementById("status_text"),
    dropZone: document.getElementById("drop_zone"),
    empty: document.getElementById("empty_state"),
    pane: document.getElementById("pane"),
    fileInput: document.getElementById("file_input"),
    folderInput: document.getElementById("folder_input")
  };

  const state = {
    groups: [],
    frames: [],
    frameIndex: 0,
    view: { scale: 1, tx: 0, ty: 0 },
    objectUrls: [],
    normalize: true,
    smoothing: false,
    drag: null,
    reorder: null,
    nextGroupId: 1,
    loadToken: 0
  };

  const resizeObserver = new ResizeObserver(function() {
    window.requestAnimationFrame(function() {
      resizeCanvases();
      drawAll();
    });
  });

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    bindControls();
    updateEnabledState();
    loadConfigDataset();
  }

  function bindControls() {
    els.add.addEventListener("click", function() {
      els.fileInput.click();
    });

    els.folder.addEventListener("click", function() {
      els.folderInput.click();
    });

    els.fileInput.addEventListener("change", function(event) {
      ingestFileList(event.target.files);
      event.target.value = "";
    });

    els.folderInput.addEventListener("change", function(event) {
      ingestFileList(event.target.files);
      event.target.value = "";
    });

    els.clear.addEventListener("click", clearDataset);
    els.previous.addEventListener("click", function() {
      setFrame(state.frameIndex - 1);
    });
    els.next.addEventListener("click", function() {
      setFrame(state.frameIndex + 1);
    });
    els.index.addEventListener("change", function() {
      setFrame(Number(els.index.value) - 1);
    });
    els.fit.addEventListener("click", fitView);
    els.actual.addEventListener("click", actualSize);
    els.export.addEventListener("click", exportCanvases);

    els.normalize.addEventListener("change", function() {
      state.normalize = els.normalize.checked;
      fitView();
    });

    els.smooth.addEventListener("change", function() {
      state.smoothing = els.smooth.checked;
      drawAll();
    });

    els.size.addEventListener("change", function() {
      document.body.classList.remove("size-compact", "size-medium", "size-large");
      if (els.size.value !== "adaptive") {
        document.body.classList.add("size-" + els.size.value);
      }
      window.requestAnimationFrame(function() {
        resizeCanvases();
        fitView();
      });
    });

    els.dropZone.addEventListener("dragenter", function() {
      if (!state.reorder) {
        showDropState();
      }
    });
    els.dropZone.addEventListener("dragover", function(event) {
      if (state.reorder) {
        return;
      }
      event.preventDefault();
      showDropState();
    });
    els.dropZone.addEventListener("dragleave", function(event) {
      if (!els.dropZone.contains(event.relatedTarget)) {
        hideDropState();
      }
    });
    els.dropZone.addEventListener("drop", handleDrop);
    els.pane.addEventListener("dragover", handleGridDragOver);
    els.pane.addEventListener("drop", handleGridDrop);

    window.addEventListener("resize", function() {
      resizeCanvases();
      drawAll();
    });

    window.addEventListener("keydown", function(event) {
      if (!state.frames.length) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setFrame(state.frameIndex - 1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setFrame(state.frameIndex + 1);
      }
    });
  }

  async function handleDrop(event) {
    if (state.reorder) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    hideDropState();
    const records = await collectDroppedFiles(event.dataTransfer);
    ingestRecords(records);
  }

  function showDropState() {
    els.dropZone.classList.add("is-dragover");
  }

  function hideDropState() {
    els.dropZone.classList.remove("is-dragover");
  }

  function ingestFileList(fileList) {
    const records = Array.from(fileList || []).map(function(file) {
      return {
        file: file,
        path: file.webkitRelativePath || file.name
      };
    });
    ingestRecords(records);
  }

  function ingestRecords(records) {
    const dataset = createDatasetFromFiles(records);
    if (!dataset.groups.length) {
      setStatus("No supported image files");
      return;
    }
    appendDataset(dataset);
  }

  async function collectDroppedFiles(dataTransfer) {
    const items = Array.from(dataTransfer.items || []);
    const entries = items
      .map(function(item) {
        return item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      })
      .filter(Boolean);

    if (entries.length) {
      const nested = await Promise.all(entries.map(function(entry) {
        return walkEntry(entry, "");
      }));
      return nested.flat();
    }

    return Array.from(dataTransfer.files || []).map(function(file) {
      return { file: file, path: file.name };
    });
  }

  async function walkEntry(entry, prefix) {
    if (entry.isFile) {
      return new Promise(function(resolve) {
        entry.file(function(file) {
          resolve([{ file: file, path: prefix + file.name }]);
        });
      });
    }

    if (!entry.isDirectory) {
      return [];
    }

    const children = await readAllEntries(entry.createReader());
    const nested = await Promise.all(children.map(function(child) {
      return walkEntry(child, prefix + entry.name + "/");
    }));
    return nested.flat();
  }

  function readAllEntries(reader) {
    const entries = [];
    return new Promise(function(resolve) {
      function readBatch() {
        reader.readEntries(function(batch) {
          if (!batch.length) {
            resolve(entries);
            return;
          }
          entries.push.apply(entries, batch);
          readBatch();
        });
      }
      readBatch();
    });
  }

  function createDatasetFromFiles(records) {
    const images = (records || [])
      .filter(function(record) {
        return record.file && isImage(record.file, record.path);
      })
      .sort(function(a, b) {
        return naturalCompare(a.path || a.file.name, b.path || b.file.name);
      });

    const objectUrls = [];
    if (!images.length) {
      return { groups: [], frames: [], objectUrls: objectUrls };
    }

    const byParent = new Map();
    images.forEach(function(record) {
      const cleanPath = normalizePath(record.path || record.file.name);
      const parts = cleanPath.split("/");
      const fileName = parts.pop() || record.file.name;
      const parent = parts.join("/");
      if (!byParent.has(parent)) {
        byParent.set(parent, []);
      }
      byParent.get(parent).push({
        file: record.file,
        fileName: fileName,
        path: cleanPath
      });
    });

    if (byParent.size > 1) {
      return createFolderDataset(byParent, objectUrls);
    }

    const frameName = "Current";
    const groups = images.map(function(record, index) {
      const url = URL.createObjectURL(record.file);
      objectUrls.push(url);
      const label = uniqueLabel(stripExtension(record.file.name), index);
      return {
        id: "file-" + index,
        label: label,
        entries: new Map([[frameName, {
          src: url,
          name: record.file.name
        }]])
      };
    });

    return { groups: groups, frames: [frameName], objectUrls: objectUrls };
  }

  function createFolderDataset(byParent, objectUrls) {
    const parents = Array.from(byParent.keys()).sort(naturalCompare);
    const nameCounts = new Map();
    parents.forEach(function(parent) {
      byParent.get(parent).forEach(function(record) {
        nameCounts.set(record.fileName, (nameCounts.get(record.fileName) || 0) + 1);
      });
    });

    const sharedNames = Array.from(nameCounts.entries())
      .filter(function(entry) {
        return entry[1] > 1;
      })
      .map(function(entry) {
        return entry[0];
      });

    if (sharedNames.length) {
      const frames = Array.from(nameCounts.keys()).sort(naturalCompare);
      const groups = parents.map(function(parent, groupIndex) {
        const entries = new Map();
        byParent.get(parent).forEach(function(record) {
          const url = URL.createObjectURL(record.file);
          objectUrls.push(url);
          entries.set(record.fileName, {
            src: url,
            name: record.fileName
          });
        });
        return {
          id: "folder-" + groupIndex,
          label: parent || "Images",
          entries: entries
        };
      });
      return { groups: groups, frames: frames, objectUrls: objectUrls };
    }

    const maxLength = Math.max.apply(null, parents.map(function(parent) {
      return byParent.get(parent).length;
    }));
    const frames = Array.from({ length: maxLength }, function(_, index) {
      return String(index + 1).padStart(4, "0");
    });
    const groups = parents.map(function(parent, groupIndex) {
      const sortedRecords = byParent.get(parent).slice().sort(function(a, b) {
        return naturalCompare(a.fileName, b.fileName);
      });
      const entries = new Map();
      sortedRecords.forEach(function(record, index) {
        const url = URL.createObjectURL(record.file);
        objectUrls.push(url);
        entries.set(frames[index], {
          src: url,
          name: record.fileName
        });
      });
      return {
        id: "folder-" + groupIndex,
        label: parent || "Images",
        entries: entries
      };
    });
    return { groups: groups, frames: frames, objectUrls: objectUrls };
  }

  async function loadConfigDataset() {
    try {
      const response = await fetch("config.json?cache=" + Date.now(), { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const config = await response.json();
      const dataset = createDatasetFromConfig(config);
      if (dataset.groups.length) {
        setDataset(dataset);
      }
    } catch (error) {
      setStatus("No images loaded");
    }
  }

  function createDatasetFromConfig(config) {
    const groups = [];
    const frameNames = new Set();

    Object.keys(config || {}).sort(naturalCompare).forEach(function(label, groupIndex) {
      const list = Array.isArray(config[label]) ? config[label] : [];
      const entries = new Map();
      list.forEach(function(src, index) {
        const name = basename(src) || "Frame " + (index + 1);
        entries.set(name, { src: src, name: name });
        frameNames.add(name);
      });
      if (entries.size) {
        groups.push({
          id: "config-" + groupIndex,
          label: cleanConfigLabel(label),
          entries: entries
        });
      }
    });

    return {
      groups: groups,
      frames: Array.from(frameNames).sort(naturalCompare),
      objectUrls: []
    };
  }

  function setDataset(dataset) {
    revokeObjectUrls();
    assignGroupIds(dataset.groups);
    state.groups = dataset.groups;
    state.frames = dataset.frames;
    state.objectUrls = dataset.objectUrls || [];
    state.frameIndex = 0;
    state.view = { scale: 1, tx: 0, ty: 0 };
    renderPanes();
    updateEnabledState();
    loadFrame(0, true);
  }

  function appendDataset(dataset) {
    const currentFrame = state.frames[state.frameIndex];
    assignGroupIds(dataset.groups);
    normalizeIncomingFrames(dataset);

    state.groups = state.groups.concat(dataset.groups);
    state.objectUrls = state.objectUrls.concat(dataset.objectUrls || []);
    state.frames = collectFramesFromGroups();
    if (currentFrame) {
      const nextIndex = state.frames.indexOf(currentFrame);
      state.frameIndex = nextIndex === -1 ? 0 : nextIndex;
    }

    renderPanes();
    updateEnabledState();
    loadFrame(state.frameIndex, state.groups.length === dataset.groups.length);
  }

  function assignGroupIds(groups) {
    groups.forEach(function(group) {
      group.id = "pane-" + state.nextGroupId;
      state.nextGroupId += 1;
    });
  }

  function normalizeIncomingFrames(dataset) {
    if (!state.frames.length || dataset.frames.length !== 1 || dataset.frames[0] !== "Current") {
      return;
    }

    const currentFrame = state.frames[state.frameIndex] || state.frames[0];
    dataset.groups.forEach(function(group) {
      const entry = group.entries.get("Current");
      if (!entry) {
        return;
      }
      group.entries.delete("Current");
      group.entries.set(currentFrame, entry);
    });
    dataset.frames = [currentFrame];
  }

  function clearDataset() {
    revokeObjectUrls();
    state.groups = [];
    state.frames = [];
    state.frameIndex = 0;
    state.view = { scale: 1, tx: 0, ty: 0 };
    state.reorder = null;
    els.pane.innerHTML = "";
    updateEnabledState();
    setStatus("No images loaded");
  }

  function revokeObjectUrls() {
    state.objectUrls.forEach(function(url) {
      URL.revokeObjectURL(url);
    });
    state.objectUrls = [];
  }

  function renderPanes() {
    resizeObserver.disconnect();
    els.pane.innerHTML = "";

    state.groups.forEach(function(group) {
      const card = document.createElement("article");
      card.className = "image-card";

      const head = document.createElement("header");
      head.className = "card-head";
      head.draggable = true;
      head.setAttribute("aria-label", "Reorder " + group.label);

      const titleWrap = document.createElement("div");
      titleWrap.className = "title-wrap";

      const title = document.createElement("strong");
      title.textContent = group.label;

      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = "";

      const size = document.createElement("span");
      size.className = "size-badge";
      size.textContent = "--";

      const headActions = document.createElement("div");
      headActions.className = "card-actions";

      const removeButton = document.createElement("button");
      removeButton.className = "remove-pane";
      removeButton.type = "button";
      removeButton.textContent = "x";
      removeButton.draggable = false;
      removeButton.setAttribute("aria-label", "Remove " + group.label);
      removeButton.setAttribute("title", "Remove pane");

      const handle = document.createElement("span");
      handle.className = "reorder-handle";
      handle.setAttribute("aria-hidden", "true");
      for (let i = 0; i < 3; i += 1) {
        handle.appendChild(document.createElement("span"));
      }

      titleWrap.appendChild(title);
      titleWrap.appendChild(meta);
      headActions.appendChild(size);
      headActions.appendChild(removeButton);
      headActions.appendChild(handle);
      head.appendChild(titleWrap);
      head.appendChild(headActions);

      const viewport = document.createElement("div");
      viewport.className = "viewport";

      const canvas = document.createElement("canvas");
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", group.label);

      const missing = document.createElement("div");
      missing.className = "missing";
      missing.textContent = "Missing frame";

      viewport.appendChild(canvas);
      viewport.appendChild(missing);
      card.appendChild(head);
      card.appendChild(viewport);
      els.pane.appendChild(card);

      group.card = card;
      group.canvas = canvas;
      group.ctx = canvas.getContext("2d");
      group.viewport = viewport;
      group.meta = meta;
      group.size = size;
      group.missing = missing;
      group.image = null;
      group.currentEntry = null;

      bindPaneRemoval(group, removeButton);
      bindPaneReorder(group, head, card);
      bindCanvas(canvas);
      resizeObserver.observe(viewport);
    });

    resizeCanvases();
  }

  function bindPaneRemoval(group, removeButton) {
    removeButton.addEventListener("mousedown", function(event) {
      event.stopPropagation();
    });
    removeButton.addEventListener("dragstart", function(event) {
      event.preventDefault();
    });
    removeButton.addEventListener("click", function(event) {
      event.preventDefault();
      event.stopPropagation();
      removePane(group.id);
    });
  }

  function removePane(groupId) {
    const index = state.groups.findIndex(function(group) {
      return group.id === groupId;
    });
    if (index === -1) {
      return;
    }

    const currentFrame = state.frames[state.frameIndex];
    const removed = state.groups.splice(index, 1)[0];
    releasePaneResources(removed);

    if (state.reorder && state.reorder.sourceId === groupId) {
      state.reorder = null;
    }

    if (!state.groups.length) {
      state.frames = [];
      state.frameIndex = 0;
      state.view = { scale: 1, tx: 0, ty: 0 };
      clearPaneDropMarkers();
      updateEnabledState();
      setStatus("No images loaded");
      return;
    }

    state.frames = collectFramesFromGroups();
    const nextFrameIndex = state.frames.indexOf(currentFrame);
    state.frameIndex = nextFrameIndex === -1
      ? clamp(state.frameIndex, 0, state.frames.length - 1)
      : nextFrameIndex;

    syncPaneDomOrder();
    clearPaneDropMarkers();
    updateEnabledState();
    loadFrame(state.frameIndex, false);
  }

  function releasePaneResources(group) {
    if (group.viewport) {
      resizeObserver.unobserve(group.viewport);
    }
    if (group.card) {
      group.card.remove();
    }

    const sources = Array.from(group.entries.values()).map(function(entry) {
      return entry.src;
    });
    sources.forEach(function(src) {
      if (state.objectUrls.indexOf(src) !== -1) {
        URL.revokeObjectURL(src);
      }
    });
    state.objectUrls = state.objectUrls.filter(function(url) {
      return sources.indexOf(url) === -1;
    });
  }

  function collectFramesFromGroups() {
    const names = new Set();
    state.groups.forEach(function(group) {
      group.entries.forEach(function(_, name) {
        names.add(name);
      });
    });
    return Array.from(names).sort(naturalCompare);
  }

  function bindPaneReorder(group, head, card) {
    head.addEventListener("dragstart", function(event) {
      startPaneReorder(event, group.id);
    });
    head.addEventListener("dragend", finishPaneReorder);
    card.addEventListener("dragover", function(event) {
      handlePaneDragOver(event, group.id);
    });
    card.addEventListener("dragleave", function(event) {
      if (!card.contains(event.relatedTarget)) {
        clearPaneDropMarkers();
      }
    });
    card.addEventListener("drop", function(event) {
      handlePaneDrop(event, group.id);
    });
  }

  function startPaneReorder(event, sourceId) {
    if (state.groups.length < 2) {
      event.preventDefault();
      return;
    }

    state.reorder = {
      sourceId: sourceId,
      targetId: null,
      placement: "before"
    };

    const group = findGroup(sourceId);
    if (group && group.card) {
      group.card.classList.add("is-reordering");
    }

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(reorderType, sourceId);
      event.dataTransfer.setData("text/plain", sourceId);
    }
  }

  function handlePaneDragOver(event, targetId) {
    if (!isPaneReorderDrag(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    const target = findGroup(targetId);
    if (!target || !target.card || targetId === state.reorder.sourceId) {
      clearPaneDropMarkers();
      return;
    }

    const placement = getDropPlacement(event, target.card);
    setPaneDropTarget(targetId, placement);
  }

  function handlePaneDrop(event, targetId) {
    if (!isPaneReorderDrag(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const target = findGroup(targetId);
    const placement = target && target.card
      ? getDropPlacement(event, target.card)
      : state.reorder.placement;

    movePane(state.reorder.sourceId, targetId, placement);
    finishPaneReorder();
  }

  function handleGridDragOver(event) {
    if (!isPaneReorderDrag(event) || event.target.closest(".image-card")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const last = state.groups[state.groups.length - 1];
    if (!last || last.id === state.reorder.sourceId) {
      clearPaneDropMarkers();
      return;
    }

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    setPaneDropTarget(last.id, "after");
  }

  function handleGridDrop(event) {
    if (!isPaneReorderDrag(event) || event.target.closest(".image-card")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const last = state.groups[state.groups.length - 1];
    if (last) {
      movePane(state.reorder.sourceId, last.id, "after");
    }
    finishPaneReorder();
  }

  function isPaneReorderDrag(event) {
    return Boolean(state.reorder);
  }

  function getDropPlacement(event, card) {
    const rect = card.getBoundingClientRect();
    return event.clientY > rect.top + rect.height / 2 ? "after" : "before";
  }

  function setPaneDropTarget(targetId, placement) {
    state.reorder.targetId = targetId;
    state.reorder.placement = placement;

    state.groups.forEach(function(group) {
      if (!group.card) {
        return;
      }
      const isTarget = group.id === targetId;
      group.card.classList.toggle("drop-before", isTarget && placement === "before");
      group.card.classList.toggle("drop-after", isTarget && placement === "after");
    });
  }

  function movePane(sourceId, targetId, placement) {
    if (!sourceId || !targetId || sourceId === targetId) {
      return;
    }

    const sourceIndex = state.groups.findIndex(function(group) {
      return group.id === sourceId;
    });
    if (sourceIndex === -1) {
      return;
    }

    const moved = state.groups.splice(sourceIndex, 1)[0];
    const targetIndex = state.groups.findIndex(function(group) {
      return group.id === targetId;
    });
    if (targetIndex === -1) {
      state.groups.splice(sourceIndex, 0, moved);
      return;
    }

    const insertIndex = placement === "after" ? targetIndex + 1 : targetIndex;
    state.groups.splice(insertIndex, 0, moved);
    syncPaneDomOrder();
    drawAll();
  }

  function syncPaneDomOrder() {
    state.groups.forEach(function(group) {
      if (group.card) {
        els.pane.appendChild(group.card);
      }
    });
  }

  function finishPaneReorder() {
    clearPaneDropMarkers();
    state.reorder = null;
  }

  function clearPaneDropMarkers() {
    state.groups.forEach(function(group) {
      if (group.card) {
        group.card.classList.remove("is-reordering", "drop-before", "drop-after");
      }
    });
  }

  function findGroup(id) {
    return state.groups.find(function(group) {
      return group.id === id;
    });
  }

  function bindCanvas(canvas) {
    canvas.addEventListener("pointerdown", function(event) {
      if (!state.groups.length) {
        return;
      }
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add("is-dragging");
      state.drag = {
        canvas: canvas,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        tx: state.view.tx,
        ty: state.view.ty
      };
    });

    canvas.addEventListener("pointermove", function(event) {
      if (!state.drag || state.drag.pointerId !== event.pointerId) {
        return;
      }
      state.view.tx = state.drag.tx + event.clientX - state.drag.x;
      state.view.ty = state.drag.ty + event.clientY - state.drag.y;
      drawAll();
    });

    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("wheel", function(event) {
      if (!state.groups.length) {
        return;
      }
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const point = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
      const factor = Math.exp(-event.deltaY * 0.001);
      zoomAt(point, factor);
    }, { passive: false });
  }

  function endDrag(event) {
    if (!state.drag || state.drag.pointerId !== event.pointerId) {
      return;
    }
    state.drag.canvas.classList.remove("is-dragging");
    state.drag = null;
  }

  async function setFrame(index) {
    if (!state.frames.length) {
      return;
    }
    const nextIndex = clamp(index, 0, state.frames.length - 1);
    await loadFrame(nextIndex, false);
  }

  async function loadFrame(index, shouldFit) {
    const token = ++state.loadToken;
    state.frameIndex = clamp(index, 0, Math.max(0, state.frames.length - 1));
    const frameName = state.frames[state.frameIndex];
    updateEnabledState();

    const jobs = state.groups.map(function(group) {
      const entry = group.entries.get(frameName);
      group.currentEntry = entry || null;
      if (!entry) {
        group.image = null;
        group.meta.textContent = frameName || "";
        group.size.textContent = "--";
        group.missing.classList.add("is-visible");
        return Promise.resolve();
      }
      return loadImage(entry.src).then(function(image) {
        if (token !== state.loadToken) {
          return;
        }
        group.image = image;
        group.meta.textContent = entry.name || frameName;
        group.size.textContent = image.naturalWidth + " x " + image.naturalHeight;
        group.missing.classList.remove("is-visible");
      }).catch(function() {
        group.image = null;
        group.meta.textContent = entry.name || frameName;
        group.size.textContent = "Error";
        group.missing.textContent = "Could not load image";
        group.missing.classList.add("is-visible");
      });
    });

    await Promise.all(jobs);
    if (token !== state.loadToken) {
      return;
    }
    resizeCanvases();
    if (shouldFit) {
      fitView();
    } else {
      drawAll();
    }
    updateEnabledState();
  }

  function loadImage(src) {
    return new Promise(function(resolve, reject) {
      const image = new Image();
      image.decoding = "async";
      image.onload = function() {
        resolve(image);
      };
      image.onerror = reject;
      image.src = src;
    });
  }

  function resizeCanvases() {
    state.groups.forEach(function(group) {
      if (!group.canvas || !group.viewport) {
        return;
      }
      const rect = group.viewport.getBoundingClientRect();
      const cssWidth = Math.max(1, Math.round(rect.width));
      const cssHeight = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, maxDevicePixelRatio);
      const width = Math.round(cssWidth * dpr);
      const height = Math.round(cssHeight * dpr);
      if (group.canvas.width !== width || group.canvas.height !== height) {
        group.canvas.width = width;
        group.canvas.height = height;
      }
      group.canvas.dataset.cssWidth = String(cssWidth);
      group.canvas.dataset.cssHeight = String(cssHeight);
      group.canvas.dataset.dpr = String(dpr);
    });
  }

  function fitView() {
    const ref = getReferenceSize();
    const viewport = getReferenceViewport();
    if (!ref || !viewport) {
      drawAll();
      return;
    }
    const padding = 22;
    const scaleX = (viewport.width - padding * 2) / ref.width;
    const scaleY = (viewport.height - padding * 2) / ref.height;
    state.view.scale = clamp(Math.min(scaleX, scaleY), minScale, maxScale);
    state.view.tx = (viewport.width - ref.width * state.view.scale) / 2;
    state.view.ty = (viewport.height - ref.height * state.view.scale) / 2;
    drawAll();
  }

  function actualSize() {
    const ref = getReferenceSize();
    const viewport = getReferenceViewport();
    if (!ref || !viewport) {
      return;
    }
    state.view.scale = 1;
    state.view.tx = (viewport.width - ref.width) / 2;
    state.view.ty = (viewport.height - ref.height) / 2;
    drawAll();
  }

  function zoomAt(point, factor) {
    const nextScale = clamp(state.view.scale * factor, minScale, maxScale);
    const worldX = (point.x - state.view.tx) / state.view.scale;
    const worldY = (point.y - state.view.ty) / state.view.scale;
    state.view.scale = nextScale;
    state.view.tx = point.x - worldX * nextScale;
    state.view.ty = point.y - worldY * nextScale;
    drawAll();
  }

  function drawAll() {
    state.groups.forEach(drawGroup);
  }

  function drawGroup(group) {
    const canvas = group.canvas;
    const ctx = group.ctx;
    if (!canvas || !ctx) {
      return;
    }

    const cssWidth = Number(canvas.dataset.cssWidth || canvas.clientWidth || 1);
    const cssHeight = Number(canvas.dataset.cssHeight || canvas.clientHeight || 1);
    const dpr = Number(canvas.dataset.dpr || 1);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = "#15191c";
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    if (!group.image) {
      return;
    }

    const drawSize = getDrawSize(group);
    ctx.imageSmoothingEnabled = state.smoothing;
    ctx.save();
    ctx.translate(state.view.tx, state.view.ty);
    ctx.scale(state.view.scale, state.view.scale);
    ctx.drawImage(group.image, 0, 0, drawSize.width, drawSize.height);
    ctx.restore();
  }

  function getReferenceSize() {
    const group = state.groups.find(function(item) {
      return item.image;
    });
    if (!group) {
      return null;
    }
    return getDrawSize(group);
  }

  function getReferenceViewport() {
    const group = state.groups.find(function(item) {
      return item.canvas;
    });
    if (!group) {
      return null;
    }
    return {
      width: Number(group.canvas.dataset.cssWidth || group.canvas.clientWidth || 1),
      height: Number(group.canvas.dataset.cssHeight || group.canvas.clientHeight || 1)
    };
  }

  function getDrawSize(group) {
    if (!group.image) {
      return { width: 1, height: 1 };
    }
    if (!state.normalize) {
      return {
        width: group.image.naturalWidth,
        height: group.image.naturalHeight
      };
    }
    const first = state.groups.find(function(item) {
      return item.image;
    });
    return {
      width: first ? first.image.naturalWidth : group.image.naturalWidth,
      height: first ? first.image.naturalHeight : group.image.naturalHeight
    };
  }

  function exportCanvases() {
    const frameName = sanitizeFileName(state.frames[state.frameIndex] || "frame");
    state.groups.forEach(function(group) {
      if (!group.image || !group.canvas) {
        return;
      }
      const label = sanitizeFileName(group.label);
      const link = document.createElement("a");
      link.href = group.canvas.toDataURL("image/png", 1.0);
      link.download = "qualcmp_" + frameName + "_" + label + ".png";
      link.click();
      link.remove();
    });
  }

  function updateEnabledState() {
    const hasDataset = state.groups.length > 0;
    const hasFrames = state.frames.length > 0;
    const hasManyFrames = state.frames.length > 1;

    els.empty.classList.toggle("is-hidden", hasDataset);
    els.pane.classList.toggle("is-empty", !hasDataset);
    els.clear.disabled = !hasDataset;
    els.previous.disabled = !hasManyFrames || state.frameIndex <= 0;
    els.next.disabled = !hasManyFrames || state.frameIndex >= state.frames.length - 1;
    els.index.disabled = !hasFrames;
    els.fit.disabled = !hasDataset;
    els.actual.disabled = !hasDataset;
    els.export.disabled = !hasDataset;

    els.index.value = hasFrames ? String(state.frameIndex + 1) : "1";
    els.index.max = String(Math.max(1, state.frames.length));
    els.frameCount.textContent = "of " + state.frames.length;

    if (hasDataset) {
      const frameName = state.frames[state.frameIndex] || "Current";
      setStatus(state.groups.length + " panes, " + state.frames.length + " frames, " + frameName);
    }
  }

  function setStatus(text) {
    els.status.textContent = text;
  }

  function isImage(file, path) {
    return (file.type && file.type.indexOf("image/") === 0) || imagePattern.test(path || file.name || "");
  }

  function normalizePath(path) {
    return String(path || "").replace(/\\/g, "/").replace(/^\/+/, "");
  }

  function basename(path) {
    const clean = normalizePath(path);
    const parts = clean.split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : clean;
  }

  function cleanConfigLabel(label) {
    const clean = normalizePath(label).replace(/\/+$/, "");
    const parts = clean.split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : clean || "Images";
  }

  function stripExtension(name) {
    return String(name || "Image").replace(/\.[^.]+$/, "");
  }

  function uniqueLabel(label, index) {
    return label || "Image " + (index + 1);
  }

  function sanitizeFileName(name) {
    return String(name || "image")
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9_-]+/gi, "_")
      .replace(/^_+|_+$/g, "") || "image";
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function naturalCompare(a, b) {
    return String(a).localeCompare(String(b), undefined, {
      numeric: true,
      sensitivity: "base"
    });
  }
})();
