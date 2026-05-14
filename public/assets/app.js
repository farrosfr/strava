const STORAGE_KEY = "daily-watermark-state-v1";

const els = {
  startDate: document.querySelector("#startDate"),
  postDate: document.querySelector("#postDate"),
  dayNumber: document.querySelector("#dayNumber"),
  headlineText: document.querySelector("#headlineText"),
  stravaStatus: document.querySelector("#stravaStatus"),
  runToday: document.querySelector("#runToday"),
  pushToday: document.querySelector("#pushToday"),
  otherSport: document.querySelector("#otherSport"),
  otherActivity: document.querySelector("#otherActivity"),
  quoteStyle: document.querySelector("#quoteStyle"),
  customQuote: document.querySelector("#customQuote"),
  runTotal: document.querySelector("#runTotal"),
  pushTotal: document.querySelector("#pushTotal"),
  creditText: document.querySelector("#creditText"),
  ratioSelect: document.querySelector("#ratioSelect"),
  imageInput: document.querySelector("#imageInput"),
  stravaCsv: document.querySelector("#stravaCsv"),
  previewCanvas: document.querySelector("#previewCanvas"),
  captionPreview: document.querySelector("#captionPreview"),
  saveEntryButton: document.querySelector("#saveEntryButton"),
  copyCaptionButton: document.querySelector("#copyCaptionButton"),
  downloadButton: document.querySelector("#downloadButton"),
  threadsButton: document.querySelector("#threadsButton"),
  shareImageButton: document.querySelector("#shareImageButton"),
  saveTemplateButton: document.querySelector("#saveTemplateButton"),
  resetButton: document.querySelector("#resetButton"),
};

const state = {
  startDate: todayIso(),
  postDate: todayIso(),
  credit: "@farrosfr | farrosfr.com",
  ratio: "4:5",
  quoteStyle: "you-vs-you",
  customQuote: "",
  entries: {},
  importedRunByDate: {},
  stravaSummary: null,
  image: null,
};

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    Object.assign(state, parsed, { image: null });
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveState() {
  const { image, ...serializable } = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
}

function parseNumber(value) {
  const normalized = String(value || "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatKm(value) {
  return parseNumber(value).toLocaleString("id-ID", {
    minimumFractionDigits: value % 1 ? 1 : 0,
    maximumFractionDigits: 2,
  });
}

function formatInt(value) {
  return Math.round(parseNumber(value)).toLocaleString("id-ID");
}

function dateDiffDays(fromIso, toIso) {
  const from = new Date(`${fromIso}T00:00:00`);
  const to = new Date(`${toIso}T00:00:00`);
  return Math.max(1, Math.floor((to - from) / 86400000) + 1);
}

function getEntry(date = state.postDate) {
  return state.entries[date] || {
    runToday: state.importedRunByDate[date] || 0,
    pushToday: 0,
    otherSport: "",
    otherActivity: "",
  };
}

function getSortedEntriesThrough(date) {
  return Object.entries(state.entries)
    .filter(([entryDate]) => entryDate <= date && entryDate >= state.startDate)
    .sort(([a], [b]) => a.localeCompare(b));
}

function calculateTotals(date = state.postDate) {
  const manualEntries = getSortedEntriesThrough(date);
  const manualRun = manualEntries.reduce((sum, [, entry]) => sum + parseNumber(entry.runToday), 0);
  const manualPush = manualEntries.reduce((sum, [, entry]) => sum + parseNumber(entry.pushToday), 0);
  const importedRun = Object.entries(state.importedRunByDate)
    .filter(([entryDate]) => entryDate <= date && entryDate >= state.startDate && !state.entries[entryDate])
    .reduce((sum, [, km]) => sum + parseNumber(km), 0);
  return {
    runTotal: manualRun + importedRun,
    pushTotal: manualPush,
  };
}

function syncInputsFromState() {
  els.startDate.value = state.startDate;
  els.postDate.value = state.postDate;
  els.creditText.value = state.credit;
  els.ratioSelect.value = state.ratio;
  els.quoteStyle.value = state.quoteStyle;
  els.customQuote.value = state.customQuote;

  const entry = getEntry();
  els.runToday.value = entry.runToday || "";
  els.pushToday.value = entry.pushToday || "";
  els.otherSport.value = entry.otherSport || "";
  els.otherActivity.value = entry.otherActivity || "";

  const totals = calculateTotals();
  els.runTotal.value = totals.runTotal ? roundForInput(totals.runTotal) : "";
  els.pushTotal.value = totals.pushTotal ? Math.round(totals.pushTotal) : "";
  updatePreview();
}

function roundForInput(value) {
  return Math.round(parseNumber(value) * 100) / 100;
}

function readEntryFromInputs() {
  return {
    runToday: parseNumber(els.runToday.value),
    pushToday: parseNumber(els.pushToday.value),
    otherSport: els.otherSport.value.trim(),
    otherActivity: els.otherActivity.value.trim(),
  };
}

function saveCurrentEntry() {
  state.startDate = els.startDate.value || todayIso();
  state.postDate = els.postDate.value || todayIso();
  state.credit = els.creditText.value.trim() || "@farrosfr | farrosfr.com";
  state.ratio = els.ratioSelect.value;
  state.quoteStyle = els.quoteStyle.value;
  state.customQuote = els.customQuote.value.trim();
  state.entries[state.postDate] = readEntryFromInputs();
  saveState();
  syncInputsFromState();
}

function updatePreview() {
  const entry = readEntryFromInputs();
  const explicitTotals = {
    runTotal: parseNumber(els.runTotal.value),
    pushTotal: parseNumber(els.pushTotal.value),
  };
  const calculated = calculateTotals();
  const totals = {
    runTotal: explicitTotals.runTotal || calculated.runTotal,
    pushTotal: explicitTotals.pushTotal || calculated.pushTotal,
  };
  const day = dateDiffDays(els.startDate.value || state.startDate, els.postDate.value || state.postDate);
  const caption = buildCaption(day, entry, totals);

  els.dayNumber.textContent = `Day ${day}`;
  els.headlineText.textContent = entry.otherActivity || entry.otherSport || "Keep the streak moving.";
  els.captionPreview.textContent = caption;
  drawCanvas(day, entry, totals);
}

async function loadStravaSummary() {
  try {
    const response = await fetch(`./data/strava-summary.json?ts=${Date.now()}`);
    if (!response.ok) return;
    const summary = await response.json();
    if (!summary || summary.source === "placeholder") return;

    state.stravaSummary = summary;
    applyStravaSummary(summary);
  } catch {
    if (els.stravaStatus) els.stravaStatus.textContent = "";
  }
}

function applyStravaSummary(summary) {
  const runToday = parseNumber(summary.today?.runWalkKm);
  const runTotal = parseNumber(summary.total?.runWalkKm);
  const summaryDate = summary.date || todayIso();
  state.importedRunByDate[summaryDate] = runToday;

  if ((els.postDate.value || state.postDate) === summaryDate && !parseNumber(els.runToday.value)) {
    els.runToday.value = runToday ? roundForInput(runToday) : "";
  }
  if (!parseNumber(els.runTotal.value)) {
    els.runTotal.value = runTotal ? roundForInput(runTotal) : "";
  }
  if (els.stravaStatus && summary.updatedAt) {
    els.stravaStatus.textContent = `Strava synced ${formatSyncTime(summary.updatedAt)}`;
  }
  updatePreview();
}

function formatSyncTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildCaption(day, entry, totals) {
  const lines = [
    `Day ${day}:`,
    `run/walk today: ${formatKm(entry.runToday)} km`,
    `run/walk total: ${formatKm(totals.runTotal)} km`,
    `push ups today: ${formatInt(entry.pushToday)}`,
    `push ups total: ${formatInt(totals.pushTotal)}`,
  ];

  if (entry.otherSport) lines.push(`other sport: ${entry.otherSport}`);
  if (entry.otherActivity) lines.push(`other activity: ${entry.otherActivity}`);
  lines.push("", getQuoteLine());
  return lines.join("\n");
}

function getQuoteLine() {
  const custom = els.customQuote.value.trim();
  const quotes = {
    "you-vs-you": "You vs you. Every day.",
    "one-percent": "1% chance is still a chance. Fight.",
    "show-up": "No perfect day. Still show up.",
    proof: "Proof over promises.",
    discipline: "Discipline first. Mood later.",
    custom: custom || "Keep promises to yourself.",
  };
  return quotes[els.quoteStyle.value] || quotes["you-vs-you"];
}

function ratioToSize(ratio) {
  const sizes = {
    "1:1": [1080, 1080],
    "4:5": [1080, 1350],
    "16:9": [1600, 900],
    "9:16": [1080, 1920],
  };
  return sizes[ratio] || sizes["4:5"];
}

function drawCanvas(day, entry, totals) {
  const canvas = els.previewCanvas;
  const ctx = canvas.getContext("2d");
  const [width, height] = ratioToSize(els.ratioSelect.value);
  canvas.width = width;
  canvas.height = height;

  if (state.image) {
    drawCoverImage(ctx, state.image, width, height);
  } else {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#263238");
    gradient.addColorStop(1, "#5b6f73");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `${Math.round(width * 0.045)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Preview", width / 2, height / 2);
  }

  drawWatermark(ctx, width, height, day, entry, totals);
}

function drawCoverImage(ctx, image, width, height) {
  const canvasRatio = width / height;
  const imageRatio = image.naturalWidth / image.naturalHeight;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  let sourceX = 0;
  let sourceY = 0;

  if (imageRatio > canvasRatio) {
    sourceWidth = image.naturalHeight * canvasRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / canvasRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }

  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
}

function drawWatermark(ctx, width, height, day, entry, totals) {
  const margin = Math.round(width * 0.04);
  const panelWidth = Math.min(width - margin * 2, Math.round(width * 0.78));
  const panelPad = Math.round(width * 0.026);
  const eyebrowSize = Math.max(16, Math.round(width * 0.014));
  const daySize = Math.max(38, Math.round(width * 0.044));
  const labelSize = Math.max(14, Math.round(width * 0.013));
  const valueSize = Math.max(22, Math.round(width * 0.024));
  const quoteSize = Math.max(18, Math.round(width * 0.017));
  const creditSize = Math.max(16, Math.round(width * 0.014));
  const panelHeight = Math.round(panelPad * 2 + daySize * 1.25 + valueSize * 2.75 + quoteSize * 1.6);
  const x = margin;
  const y = height - margin - panelHeight;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.32)";
  ctx.shadowBlur = Math.round(width * 0.024);
  ctx.fillStyle = "rgba(8, 10, 12, 0.52)";
  roundRect(ctx, x, y, panelWidth, panelHeight, 10);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = Math.max(1, Math.round(width * 0.0015));
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.66)";
  ctx.font = `800 ${eyebrowSize}px system-ui, sans-serif`;
  ctx.fillText("DAILY LOG", x + panelPad, y + panelPad);

  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${daySize}px system-ui, sans-serif`;
  ctx.fillText(`DAY ${day}`, x + panelPad, y + panelPad + eyebrowSize * 1.18);

  const statsY = y + panelPad + eyebrowSize * 1.2 + daySize * 1.18;
  const colGap = Math.round(width * 0.038);
  const colWidth = (panelWidth - panelPad * 2 - colGap) / 2;
  drawMetric(ctx, x + panelPad, statsY, colWidth, "RUN/WALK", `${formatKm(entry.runToday)} km`, `${formatKm(totals.runTotal)} km total`, labelSize, valueSize);
  drawMetric(ctx, x + panelPad + colWidth + colGap, statsY, colWidth, "PUSH UPS", formatInt(entry.pushToday), `${formatInt(totals.pushTotal)} total`, labelSize, valueSize);

  const activity = compactText(entry.otherActivity || entry.otherSport, 44);
  if (activity) {
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = `700 ${labelSize}px system-ui, sans-serif`;
    ctx.fillText(activity.toUpperCase(), x + panelPad, statsY + valueSize * 2.25);
  }

  const footerY = y + panelHeight - panelPad - quoteSize * 1.05;
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${quoteSize}px system-ui, sans-serif`;
  ctx.fillText(compactText(getQuoteLine(), 38), x + panelPad, footerY);

  const credit = splitCredit(els.creditText.value.trim() || state.credit);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.font = `800 ${creditSize}px system-ui, sans-serif`;
  ctx.fillText(credit.handle, x + panelWidth - panelPad, y + panelPad);
  ctx.fillStyle = "rgba(255,255,255,0.56)";
  ctx.font = `700 ${labelSize}px system-ui, sans-serif`;
  ctx.fillText(credit.site, x + panelWidth - panelPad, y + panelPad + creditSize * 1.25);
  ctx.restore();
}

function drawMetric(ctx, x, y, width, label, value, total, labelSize, valueSize) {
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = `800 ${labelSize}px system-ui, sans-serif`;
  ctx.fillText(label, x, y);

  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${valueSize}px system-ui, sans-serif`;
  ctx.fillText(compactText(value, 15), x, y + labelSize * 1.25);

  ctx.fillStyle = "rgba(255,255,255,0.68)";
  ctx.font = `700 ${labelSize}px system-ui, sans-serif`;
  ctx.fillText(compactText(total, 20), x, y + labelSize * 1.35 + valueSize * 1.08, width);
}

function compactText(text, limit) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, Math.max(0, limit - 1)).trim()}...`;
}

function splitCredit(value) {
  const [handle, site] = value.split("|").map((item) => item.trim());
  return {
    handle: handle || "@farrosfr",
    site: site || "farrosfr.com",
  };
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function readImage(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      state.image = image;
      updatePreview();
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function downloadImage() {
  updatePreview();
  const link = document.createElement("a");
  link.download = `threads-day-${els.dayNumber.textContent.replace(/\D/g, "") || "1"}.png`;
  link.href = els.previewCanvas.toDataURL("image/png");
  link.click();
}

function openThreadsDraft() {
  updatePreview();
  const text = encodeURIComponent(els.captionPreview.textContent);
  window.open(`https://www.threads.net/intent/post?text=${text}`, "_blank", "noopener,noreferrer");
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

async function shareImageDraft() {
  updatePreview();
  const blob = await canvasToBlob(els.previewCanvas);
  if (!blob) return;

  const file = new File([blob], `threads-${els.dayNumber.textContent.toLowerCase().replace(/\s+/g, "-")}.png`, {
    type: "image/png",
  });
  const shareData = {
    title: els.dayNumber.textContent,
    text: els.captionPreview.textContent,
    files: [file],
  };

  if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
    await navigator.share(shareData);
    return;
  }

  downloadImage();
  openThreadsDraft();
}

async function copyCaption() {
  updatePreview();
  const caption = els.captionPreview.textContent;
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(caption);
  } else {
    const textarea = document.createElement("textarea");
    textarea.value = caption;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  els.copyCaptionButton.textContent = "Copied";
  setTimeout(() => {
    els.copyCaptionButton.textContent = "Copy caption";
  }, 1200);
}

function parseCsv(text) {
  const rows = [];
  let cell = "";
  let row = [];
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (cell || row.length) rows.push([...row, cell]);
      cell = "";
      row = [];
      if (char === "\r" && next === "\n") i += 1;
    } else {
      cell += char;
    }
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
}

function importStravaCsv(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCsv(String(reader.result || ""));
    const headers = rows.shift()?.map((header) => header.trim().toLowerCase()) || [];
    const typeIndex = findHeader(headers, ["activity type", "type", "sport type"]);
    const dateIndex = findHeader(headers, ["activity date", "date", "start date"]);
    const distanceIndex = findHeader(headers, ["distance", "distance km", "distance (km)"]);
    if (dateIndex < 0 || distanceIndex < 0) return;

    rows.forEach((row) => {
      const type = String(row[typeIndex] || "").toLowerCase();
      if (typeIndex >= 0 && !/(run|walk|hike)/.test(type)) return;
      const isoDate = normalizeCsvDate(row[dateIndex]);
      const km = normalizeDistance(row[distanceIndex]);
      if (!isoDate || !km) return;
      state.importedRunByDate[isoDate] = roundForInput((state.importedRunByDate[isoDate] || 0) + km);
    });
    saveState();
    syncInputsFromState();
  };
  reader.readAsText(file);
}

function findHeader(headers, names) {
  return headers.findIndex((header) => names.includes(header));
}

function normalizeCsvDate(value) {
  const raw = String(value || "").trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDistance(value) {
  const raw = parseNumber(value);
  if (!raw) return 0;
  return raw > 100 ? raw / 1000 : raw;
}

function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  state.startDate = todayIso();
  state.postDate = todayIso();
  state.credit = "@farrosfr | farrosfr.com";
  state.ratio = "4:5";
  state.quoteStyle = "you-vs-you";
  state.customQuote = "";
  state.entries = {};
  state.importedRunByDate = {};
  state.image = null;
  syncInputsFromState();
}

[
  els.startDate,
  els.postDate,
  els.runToday,
  els.pushToday,
  els.otherSport,
  els.otherActivity,
  els.quoteStyle,
  els.customQuote,
  els.runTotal,
  els.pushTotal,
  els.creditText,
  els.ratioSelect,
].forEach((input) => input.addEventListener("input", updatePreview));

els.postDate.addEventListener("change", () => {
  state.postDate = els.postDate.value || todayIso();
  syncInputsFromState();
});
els.startDate.addEventListener("change", () => {
  state.startDate = els.startDate.value || todayIso();
  saveState();
  syncInputsFromState();
});
els.saveEntryButton.addEventListener("click", saveCurrentEntry);
els.saveTemplateButton.addEventListener("click", () => {
  state.credit = els.creditText.value.trim() || state.credit;
  state.ratio = els.ratioSelect.value;
  state.quoteStyle = els.quoteStyle.value;
  state.customQuote = els.customQuote.value.trim();
  saveState();
});
els.copyCaptionButton.addEventListener("click", copyCaption);
els.downloadButton.addEventListener("click", downloadImage);
els.threadsButton.addEventListener("click", openThreadsDraft);
els.shareImageButton.addEventListener("click", shareImageDraft);
els.resetButton.addEventListener("click", resetAll);
els.imageInput.addEventListener("change", (event) => readImage(event.target.files[0]));
els.stravaCsv.addEventListener("change", (event) => importStravaCsv(event.target.files[0]));

loadState();
syncInputsFromState();
loadStravaSummary();
