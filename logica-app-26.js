const MAX_FILES = 10;
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const QUALITY_INPUT_MIN = 1;
const QUALITY_SLIDER_MIN = 50;
const QUALITY_MAX = 100;
const QUALITY_DEFAULT = 80;
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const dropzone = document.getElementById("dropzone");
const pickFilesBtn = document.getElementById("pickFilesBtn");
const fileInput = document.getElementById("fileInput");
const outputFormat = document.getElementById("outputFormat");
const qualitySlider = document.getElementById("qualitySlider");
const qualityValue = document.getElementById("qualityValue");
const qualityInput = document.getElementById("qualityInput");
const presetButtons = Array.from(document.querySelectorAll("[data-quality-preset]"));
const qualityHint = document.getElementById("qualityHint");
const convertBtn = document.getElementById("convertBtn");
const downloadAllBtn = document.getElementById("downloadAllBtn");
const inputList = document.getElementById("inputList");
const outputList = document.getElementById("outputList");
const emptyInput = document.getElementById("emptyInput");
const emptyOutput = document.getElementById("emptyOutput");
const errorBox = document.getElementById("errorBox");
const statusPanel = document.getElementById("statusPanel");
const batchCounter = document.getElementById("batchCounter");
const elapsedTime = document.getElementById("elapsedTime");
const appCommitDate = document.getElementById("appCommitDate");

// Elementi Tab
const tabBtnOptimizer = document.getElementById("tabBtnOptimizer");
const tabBtnComparator = document.getElementById("tabBtnComparator");
const sectionOptimizer = document.getElementById("sectionOptimizer");
const sectionComparator = document.getElementById("sectionComparator");

// Elementi Comparatore
const compDropzone = document.getElementById("compDropzone");
const compPickBtn = document.getElementById("compPickBtn");
const compFileInput = document.getElementById("compFileInput");
const compFormat = document.getElementById("compFormat");
const compProgress = document.getElementById("compProgress");
const compProgressBar = document.getElementById("compProgressBar");
const comparisonResults = document.getElementById("comparisonResults");
const comparisonGrid = document.getElementById("comparisonGrid");
const compEmpty = document.getElementById("compEmpty");
const sourceInfo = document.getElementById("sourceInfo");

// Elementi Modal
const imageModal = document.getElementById("imageModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalImage = document.getElementById("modalImage");
const modalImageContainer = document.getElementById("modalImageContainer");

const OUTPUT_FORMATS = {
  "image/webp": { ext: "webp", label: "WebP" },
  "image/jpeg": { ext: "jpg", label: "JPEG" },
  "image/png": { ext: "png", label: "PNG" },
};

let worker = null;
let workerEnabled = false;

let selectedFiles = [];
let converted = [];
let startedAt = 0;
let elapsedTimer = null;
let completedCount = 0;
let currentQuality = QUALITY_DEFAULT;
let comparisonVariants = []; // Per il comparatore

const FALLBACK_BUILD_META = {
  version: "v0.1.0",
  commitDate: "2026-02-07",
};

qualitySlider.addEventListener("input", () => setQualityFromSlider(qualitySlider.value));
qualityInput.addEventListener("input", () => setQualityFromInput(qualityInput.value));
qualityInput.addEventListener("blur", () => setQualityFromInput(qualityInput.value));
outputFormat.addEventListener("change", updateOutputControls);
presetButtons.forEach((button) => {
  button.addEventListener("click", () => setQualityFromPreset(button.dataset.qualityPreset));
});

// Eventi Tab
tabBtnOptimizer.addEventListener("click", () => switchTab("optimizer"));
tabBtnComparator.addEventListener("click", () => switchTab("comparator"));

// Eventi Comparatore
compPickBtn.addEventListener("click", () => compFileInput.click());
compFileInput.addEventListener("change", (event) => handleComparisonFile(event.target.files[0]));
compFormat.addEventListener("change", () => {
  if (comparisonVariants.length > 0) {
    const firstVariant = comparisonVariants[0];
    if (firstVariant && firstVariant.sourceFile) {
      handleComparisonFile(firstVariant.sourceFile);
    }
  }
});

compDropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  compDropzone.classList.add("border-brand-primary", "bg-blue-50");
});
compDropzone.addEventListener("dragleave", () => {
  compDropzone.classList.remove("border-brand-primary", "bg-blue-50");
});
compDropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  compDropzone.classList.remove("border-brand-primary", "bg-blue-50");
  if (e.dataTransfer.files.length > 0) {
    handleComparisonFile(e.dataTransfer.files[0]);
  }
});

// Eventi Modal
closeModalBtn.addEventListener("click", closeModal);
imageModal.addEventListener("click", (e) => {
  if (e.target === imageModal) closeModal();
});
modalImage.addEventListener("click", toggleZoom);

pickFilesBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (event) => handleFiles(event.target.files));

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("border-brand-primary", "bg-blue-50");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("border-brand-primary", "bg-blue-50");
});

dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropzone.classList.remove("border-brand-primary", "bg-blue-50");
  handleFiles(event.dataTransfer.files);
});

convertBtn.addEventListener("click", convertAll);
downloadAllBtn.addEventListener("click", downloadAllAsZip);
window.addEventListener("beforeunload", () => {
  cleanupSelectedPreviews();
  cleanupConvertedPreviews();
  cleanupComparisonPreviews();
  if (worker) worker.terminate();
});

initConverterEngine();
updateOutputControls();
setQualityFromPreset(qualitySlider.value);
loadBuildMeta();

function handleFiles(fileList) {
  clearError();
  const incoming = Array.from(fileList ?? []);
  if (incoming.length === 0) return;

  if (incoming.length > MAX_FILES) {
    showError(`Hai selezionato ${incoming.length} file. Il massimo consentito e ${MAX_FILES}.`);
    return;
  }

  const validFiles = [];
  for (const file of incoming) {
    if (!SUPPORTED_TYPES.has(file.type)) {
      showError(`Formato non supportato: ${file.name}. Usa JPG/JPEG, PNG o WebP.`);
      continue;
    }
    if (file.size > MAX_FILE_SIZE) {
      showError(`File troppo grande: ${file.name}. Limite: 15 MB.`);
      continue;
    }
    validFiles.push({
      file,
      previewUrl: URL.createObjectURL(file),
    });
  }

  if (validFiles.length === 0) return;

  cleanupSelectedPreviews();
  selectedFiles = validFiles.slice(0, MAX_FILES);
  cleanupConvertedPreviews();
  converted = [];
  completedCount = 0;
  renderInputList();
  renderOutputList();
  convertBtn.disabled = false;
  downloadAllBtn.disabled = true;
}

function renderInputList() {
  inputList.innerHTML = "";
  emptyInput.classList.toggle("hidden", selectedFiles.length > 0);

  for (const item of selectedFiles) {
    const li = document.createElement("li");
    li.className = "rounded-xl border border-slate-200 p-3";
    li.innerHTML = `
      <img src="${item.previewUrl}" alt="${item.file.name}" class="h-28 w-full rounded-lg object-cover" />
      <p class="mt-2 truncate text-sm font-medium">${item.file.name}</p>
      <p class="text-xs text-slate-500">${humanBytes(item.file.size)}</p>
    `;
    inputList.appendChild(li);
  }
}

function renderOutputList() {
  outputList.innerHTML = "";
  emptyOutput.classList.toggle("hidden", converted.length > 0);
  downloadAllBtn.disabled = converted.length === 0;

  for (const item of converted) {
    if (!item.previewUrl) {
      item.previewUrl = URL.createObjectURL(item.blob);
    }
    const li = document.createElement("li");
    li.className = "rounded-xl border border-slate-200 p-3";
    li.innerHTML = `
      <img src="${item.previewUrl}" alt="${item.name}" class="h-28 w-full rounded-lg object-cover" />
      <p class="mt-2 truncate text-sm font-medium">${item.name}</p>
      <p class="text-xs text-slate-500">${item.width}x${item.height} - ${humanBytes(item.blob.size)}</p>
      <button class="mt-2 w-full rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
        Download
      </button>
    `;
    li.querySelector("button").addEventListener("click", () => downloadBlob(item.blob, item.name));
    outputList.appendChild(li);
  }
}

async function convertAll() {
  if (selectedFiles.length === 0) return;

  clearError();
  cleanupConvertedPreviews();
  converted = [];
  completedCount = 0;
  renderOutputList();
  beginBatchStatus();
  updateBatchCounter();
  convertBtn.disabled = true;
  downloadAllBtn.disabled = true;

  const qualityPercent = currentQuality;
  const quality = qualityPercent / 100;
  const targetType = outputFormat.value;
  const target = OUTPUT_FORMATS[targetType] || OUTPUT_FORMATS["image/webp"];

  for (let i = 0; i < selectedFiles.length; i += 1) {
    const arrayBuffer = await selectedFiles[i].file.arrayBuffer();
    const result = await convertOne({
      id: i,
      quality,
      type: selectedFiles[i].file.type,
      outputType: targetType,
      buffer: arrayBuffer,
    });

    if (result.ok) {
      const blob = new Blob([result.blobBuffer], { type: targetType });
      converted.push({
        name: toOutputName(selectedFiles[i].file.name, target.ext),
        blob,
        mimeType: targetType,
        width: result.width,
        height: result.height,
        sourceName: selectedFiles[i].file.name,
      });
    } else {
      showError(`Conversione fallita per "${selectedFiles[i].file.name}": ${result.error}`);
    }

    completedCount += 1;
    updateBatchCounter();
    renderOutputList();
  }

  endBatchStatus();
  convertBtn.disabled = false;
}

async function downloadAllAsZip() {
  if (converted.length === 0) return;
  if (!window.JSZip) {
    showError("JSZip non disponibile. Riprova dopo il refresh della pagina.");
    return;
  }

  const zip = new window.JSZip();
  for (const item of converted) {
    zip.file(item.name, item.blob);
  }

  try {
    const blob = await zip.generateAsync({ type: "blob" });
    const target = OUTPUT_FORMATS[outputFormat.value] || OUTPUT_FORMATS["image/webp"];
    downloadBlob(blob, `${target.ext}-converted-${Date.now()}.zip`);
  } catch (error) {
    showError(`Errore nella creazione ZIP: ${error.message}`);
  }
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function beginBatchStatus() {
  statusPanel.classList.remove("hidden");
  startedAt = Date.now();
  elapsedTime.textContent = "00:00";
  if (elapsedTimer) clearInterval(elapsedTimer);
  elapsedTimer = setInterval(() => {
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
    const ss = String(seconds % 60).padStart(2, "0");
    elapsedTime.textContent = `${mm}:${ss}`;
  }, 1000);
}

function endBatchStatus() {
  if (elapsedTimer) {
    clearInterval(elapsedTimer);
    elapsedTimer = null;
  }
}

function updateBatchCounter() {
  batchCounter.textContent = `${completedCount}/${selectedFiles.length}`;
}

function convertInWorker(message) {
  return new Promise((resolve) => {
    const onMessage = (event) => {
      if (event.data?.id !== message.id) return;
      worker.removeEventListener("message", onMessage);
      resolve(event.data);
    };

    worker.addEventListener("message", onMessage);
    worker.postMessage(message, [message.buffer]);
  });
}

async function convertInMainThread(message) {
  try {
    const inputBlob = new Blob([message.buffer], { type: message.type });
    const bitmap = await createImageBitmap(inputBlob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Impossibile inizializzare il canvas 2D.");
    }
    context.drawImage(bitmap, 0, 0);
    bitmap.close();

    const outputBlob = await new Promise((resolve, reject) => {
      const qualityArg = message.outputType === "image/png" ? undefined : message.quality;
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Impossibile creare il file convertito."));
            return;
          }
          resolve(blob);
        },
        message.outputType,
        qualityArg
      );
    });
    const blobBuffer = await outputBlob.arrayBuffer();
    return {
      id: message.id,
      ok: true,
      blobBuffer,
      width: canvas.width,
      height: canvas.height,
    };
  } catch (error) {
    return {
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : "Errore sconosciuto",
    };
  }
}

function convertOne(message) {
  if (workerEnabled && worker) {
    return convertInWorker(message);
  }
  return convertInMainThread(message);
}

function initConverterEngine() {
  if (window.location.protocol === "file:") {
    workerEnabled = false;
    showError("Modalita file:// rilevata: conversione attiva senza worker (potrebbe essere piu lenta).");
    return;
  }

  try {
    worker = new Worker("./converter-worker.js");
    workerEnabled = true;
  } catch (_error) {
    worker = null;
    workerEnabled = false;
    showError("Worker non disponibile: conversione attiva senza worker.");
  }
}

async function loadBuildMeta() {
  try {
    const response = await fetch("./version.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const meta = await response.json();
    appVersion.textContent = meta.version || FALLBACK_BUILD_META.version;
    appCommitDate.textContent = meta.commitDate || FALLBACK_BUILD_META.commitDate;
  } catch (_error) {
    appVersion.textContent = FALLBACK_BUILD_META.version;
    appCommitDate.textContent = FALLBACK_BUILD_META.commitDate;
  }
}

function updateOutputControls() {
  const target = OUTPUT_FORMATS[outputFormat.value] || OUTPUT_FORMATS["image/webp"];
  const qualityEnabled = outputFormat.value !== "image/png";
  qualitySlider.disabled = !qualityEnabled;
  qualityInput.disabled = !qualityEnabled;
  qualitySlider.classList.toggle("opacity-50", !qualityEnabled);
  qualityInput.classList.toggle("opacity-50", !qualityEnabled);
  presetButtons.forEach((button) => {
    button.disabled = !qualityEnabled;
    button.classList.toggle("opacity-50", !qualityEnabled);
    button.classList.toggle("cursor-not-allowed", !qualityEnabled);
  });
  qualityHint.classList.toggle("hidden", qualityEnabled);
  convertBtn.textContent = `Ottimizza come ${target.label}`;
}

function switchTab(tab) {
  const isOptimizer = tab === "optimizer";

  // Update Buttons
  tabBtnOptimizer.classList.toggle("bg-white", isOptimizer);
  tabBtnOptimizer.classList.toggle("text-brand-primary", isOptimizer);
  tabBtnOptimizer.classList.toggle("shadow-sm", isOptimizer);
  tabBtnOptimizer.classList.toggle("text-slate-600", !isOptimizer);

  tabBtnComparator.classList.toggle("bg-white", !isOptimizer);
  tabBtnComparator.classList.toggle("text-brand-primary", !isOptimizer);
  tabBtnComparator.classList.toggle("shadow-sm", !isOptimizer);
  tabBtnComparator.classList.toggle("text-slate-600", isOptimizer);

  // Update Sections
  sectionOptimizer.classList.toggle("hidden", !isOptimizer);
  sectionComparator.classList.toggle("hidden", isOptimizer);
}

async function handleComparisonFile(file) {
  if (!file) return;
  if (!SUPPORTED_TYPES.has(file.type)) {
    alert("Formato non supportato.");
    return;
  }
  cleanupComparisonPreviews();
  comparisonVariants = [];
  compEmpty.classList.add("hidden");
  comparisonResults.classList.remove("hidden");
  compProgress.classList.remove("hidden");
  comparisonGrid.innerHTML = "";

  sourceInfo.textContent = `Originale: ${file.name} (${humanBytes(file.size)})`;

  const targetType = compFormat.value;
  const target = OUTPUT_FORMATS[targetType];
  const arrayBuffer = await file.arrayBuffer();

  const qualityLevels = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];
  let processed = 0;

  for (const q of qualityLevels) {
    const result = await convertOne({
      id: `comp-${q}`,
      quality: q / 100,
      type: file.type,
      outputType: targetType,
      buffer: arrayBuffer.slice(0), // Clone for worker safety
    });

    if (result.ok) {
      const blob = new Blob([result.blobBuffer], { type: targetType });
      const variant = {
        quality: q,
        blob,
        name: toOutputName(file.name, target.ext),
        width: result.width,
        height: result.height,
        previewUrl: URL.createObjectURL(blob),
        sourceFile: file // Keep reference to allow format switching
      };
      comparisonVariants.push(variant);
      renderComparisonCard(variant);
    }

    processed++;
    compProgressBar.style.width = `${(processed / qualityLevels.length) * 100}%`;
  }

  compProgress.classList.add("hidden");
  compProgressBar.style.width = "0%";
}

function renderComparisonCard(variant) {
  const card = document.createElement("div");
  card.className = "group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md";

  card.innerHTML = `
    <div class="relative mb-4 aspect-video overflow-hidden rounded-xl bg-slate-100">
      <img src="${variant.previewUrl}" class="h-full w-full object-contain transition group-hover:scale-105" />
      <div class="absolute right-2 top-2 rounded-lg bg-black/60 px-2 py-1 text-xs font-bold text-white backdrop-blur-md">
        Q: ${variant.quality}%
      </div>
    </div>
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-bold text-slate-900">${humanBytes(variant.blob.size)}</p>
        <p class="text-[10px] uppercase tracking-wider text-slate-500">${variant.width}x${variant.height}</p>
      </div>
      <div class="flex gap-2">
        <button class="expand-btn rounded-lg bg-slate-100 p-2 text-brand-primary transition hover:bg-brand-primary hover:text-white" title="Espandi">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        </button>
        <button class="download-btn rounded-lg bg-slate-100 p-2 text-brand-primary transition hover:bg-brand-primary hover:text-white" title="Scarica">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  `;

  card.querySelector(".download-btn").addEventListener("click", () => downloadBlob(variant.blob, variant.name));
  card.querySelector(".expand-btn").addEventListener("click", () => openModal(variant.previewUrl));
  comparisonGrid.appendChild(card);
}

function openModal(url) {
  modalImage.src = url;
  modalImage.classList.remove("max-w-none", "max-h-none");
  modalImage.classList.add("max-h-[90vh]", "max-w-[90vw]");
  modalImage.dataset.zoomed = "false";
  imageModal.classList.remove("hidden");
  document.body.style.overflow = "hidden"; // Blocca scroll
}

function closeModal() {
  imageModal.classList.add("hidden");
  document.body.style.overflow = "";
  modalImage.src = "";
}

function toggleZoom() {
  const isZoomed = modalImage.dataset.zoomed === "true";
  if (isZoomed) {
    // Torna a Fit
    modalImage.classList.remove("max-w-none", "max-h-none");
    modalImage.classList.add("max-h-[90vh]", "max-w-[90vw]");
    modalImage.dataset.zoomed = "false";
  } else {
    // Vai a 100%
    modalImage.classList.remove("max-h-[90vh]", "max-w-[90vw]");
    modalImage.classList.add("max-w-none", "max-h-none");
    modalImage.dataset.zoomed = "true";
  }
}

function setQualityFromSlider(rawValue) {
  const normalized = normalizeQualityValue(rawValue, QUALITY_SLIDER_MIN);
  applyQuality(normalized);
}

function setQualityFromPreset(rawValue) {
  const normalized = normalizeQualityValue(rawValue, QUALITY_SLIDER_MIN);
  applyQuality(normalized);
}

function setQualityFromInput(rawValue) {
  const normalized = normalizeQualityValue(rawValue, QUALITY_INPUT_MIN);
  applyQuality(normalized);
}

function applyQuality(value) {
  currentQuality = value;
  qualityInput.value = String(value);
  qualityValue.textContent = String(value);
  qualitySlider.value = String(Math.max(QUALITY_SLIDER_MIN, value));
  updateQualityPresetState(value);
}

function normalizeQualityValue(rawValue, minValue) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return QUALITY_DEFAULT;
  return Math.min(QUALITY_MAX, Math.max(minValue, Math.round(parsed)));
}

function updateQualityPresetState(value) {
  presetButtons.forEach((button) => {
    const buttonValue = Number(button.dataset.qualityPreset);
    const isActive = buttonValue === value;
    button.classList.toggle("bg-brand-primary", isActive);
    button.classList.toggle("text-white", isActive);
    button.classList.toggle("border-brand-primary", isActive);
  });
}

function cleanupSelectedPreviews() {
  for (const item of selectedFiles) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

function cleanupConvertedPreviews() {
  for (const item of converted) {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
  }
}

function toOutputName(name, extension) {
  const extIndex = name.lastIndexOf(".");
  const base = extIndex >= 0 ? name.slice(0, extIndex) : name;
  return `${base}.${extension}`;
}

function humanBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function showError(message) {
  errorBox.classList.remove("hidden");
  errorBox.textContent = message;
}

function clearError() {
  errorBox.classList.add("hidden");
  errorBox.textContent = "";
}

function cleanupComparisonPreviews() {
  for (const item of comparisonVariants) {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
  }
}
