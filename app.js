const MAX_FILES = 10;
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const dropzone = document.getElementById("dropzone");
const pickFilesBtn = document.getElementById("pickFilesBtn");
const fileInput = document.getElementById("fileInput");
const outputFormat = document.getElementById("outputFormat");
const qualitySlider = document.getElementById("qualitySlider");
const qualityValue = document.getElementById("qualityValue");
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

qualitySlider.addEventListener("input", () => {
  qualityValue.textContent = qualitySlider.value;
});
outputFormat.addEventListener("change", updateOutputControls);

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
  if (worker) worker.terminate();
});

initConverterEngine();
updateOutputControls();

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

  const quality = Number(qualitySlider.value) / 100;
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

function updateOutputControls() {
  const target = OUTPUT_FORMATS[outputFormat.value] || OUTPUT_FORMATS["image/webp"];
  const qualityEnabled = outputFormat.value !== "image/png";
  qualitySlider.disabled = !qualityEnabled;
  qualitySlider.classList.toggle("opacity-50", !qualityEnabled);
  qualityHint.classList.toggle("hidden", qualityEnabled);
  convertBtn.textContent = `Converti in ${target.label}`;
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
