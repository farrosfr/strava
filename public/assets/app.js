const STORAGE_KEY = "daily-watermark-state-v1";
const THREADS_TOPIC_NAME = "Running";
const STRAVA_PROFILE_URL = "https://www.strava.com/athletes/farrosfr";

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
  manualLog: null,
  image: null,
};

function todayIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    Object.assign(state, parsed, { image: null });
    state.postDate = todayIso();
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

function normalizeDate(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : raw;
}

function getEntry(date = state.postDate) {
  const localEntry = state.entries[date] || {};
  const manualEntry = getManualEntry(date) || {};
  return {
    runToday: state.importedRunByDate[date] || localEntry.runToday || 0,
    pushToday: manualEntry.pushToday ?? localEntry.pushToday ?? 0,
    otherSport: manualEntry.otherSport ?? localEntry.otherSport ?? "",
    otherActivity: manualEntry.otherActivity ?? localEntry.otherActivity ?? "",
  };
}

function getEntryForTotals(date) {
  const localEntry = state.entries[date] || {};
  const manualEntry = getManualEntry(date) || {};
  return {
    runToday: state.importedRunByDate[date] || localEntry.runToday || 0,
    pushToday: manualEntry.pushToday ?? localEntry.pushToday ?? 0,
  };
}

function getKnownDatesThrough(date) {
  return Array.from(
    new Set([
      date,
      ...Object.keys(state.importedRunByDate),
      ...Object.keys(state.entries),
      ...Object.keys(getManualEntriesFromFile()),
    ]),
  )
    .filter((entryDate) => entryDate <= date && entryDate >= state.startDate)
    .sort((a, b) => a.localeCompare(b));
}

function getSortedEntriesThrough(date) {
  return getKnownDatesThrough(date).map((entryDate) => [entryDate, getEntryForTotals(entryDate)]);
}

function calculateTotals(date = state.postDate) {
  const manualEntries = getSortedEntriesThrough(date);
  const manualPush = manualEntries.reduce((sum, [, entry]) => sum + parseNumber(entry.pushToday), 0);
  const importedRun = Object.entries(state.importedRunByDate)
    .filter(([entryDate]) => entryDate <= date && entryDate >= state.startDate)
    .reduce((sum, [, km]) => sum + parseNumber(km), 0);
  return {
    runTotal: importedRun,
    pushTotal: manualPush,
  };
}

function calculatePreviewTotals(date, currentEntry) {
  const totals = calculateTotals(date);
  const savedCurrent = getEntryForTotals(date);
  const currentRunFromStrava = parseNumber(state.importedRunByDate[date]);
  return {
    runTotal: totals.runTotal - parseNumber(savedCurrent.runToday) + (currentRunFromStrava || parseNumber(currentEntry.runToday)),
    pushTotal: totals.pushTotal - parseNumber(savedCurrent.pushToday) + parseNumber(currentEntry.pushToday),
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
  const postDate = els.postDate.value || state.postDate;
  const totals = calculatePreviewTotals(postDate, entry);
  els.runTotal.value = totals.runTotal ? roundForInput(totals.runTotal) : "";
  els.pushTotal.value = totals.pushTotal ? Math.round(totals.pushTotal) : "";
  const day = dateDiffDays(els.startDate.value || state.startDate, postDate);
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

async function loadManualLog() {
  try {
    const response = await fetch(`./data/manual-log.json?ts=${Date.now()}`);
    if (!response.ok) return;
    state.manualLog = await response.json();
    syncInputsFromState();
  } catch {
    state.manualLog = null;
  }
}

function getManualEntriesFromFile() {
  const entries = {};
  (state.manualLog?.entries || []).forEach((entry) => {
    const date = normalizeDate(entry.date);
    if (!date) return;
    entries[date] = {
      pushToday: parseNumber(entry.pushUps),
      otherSport: entry.otherSport || "",
      otherActivity: entry.otherActivity || "",
    };
  });
  return entries;
}

function getAllManualEntries() {
  return {
    ...state.entries,
    ...getManualEntriesFromFile(),
  };
}

function getManualEntry(date) {
  return getAllManualEntries()[date] || null;
}

function applyStravaSummary(summary) {
  const runToday = parseNumber(summary.today?.runWalkKm);
  const runTotal = parseNumber(summary.total?.runWalkKm);
  const summaryDate = summary.date || todayIso();
  if (summary.startDate) {
    state.startDate = summary.startDate;
    els.startDate.value = summary.startDate;
  }
  state.importedRunByDate[summaryDate] = runToday;
  getStravaDaily(summary).forEach((item) => {
    state.importedRunByDate[item.date] = item.runWalkKm;
  });

  if ((els.postDate.value || state.postDate) === summaryDate && !parseNumber(els.runToday.value)) {
    els.runToday.value = runToday ? roundForInput(runToday) : "";
  }
  if (!parseNumber(els.runTotal.value)) {
    els.runTotal.value = runTotal ? roundForInput(runTotal) : "";
  }
  if (els.stravaStatus && summary.updatedAt) {
    els.stravaStatus.textContent = `Strava synced ${formatSyncTimeWib(summary.updatedAt)}`;
  }
  updatePreview();
}

function getStravaDaily(summary = state.stravaSummary) {
  if (Array.isArray(summary?.daily)) {
    return summary.daily.map((item) => ({
      date: item.date,
      runWalkKm: parseNumber(item.runWalkKm),
    }));
  }

  const daily = new Map();
  (summary?.activities || []).forEach((activity) => {
    daily.set(activity.date, (daily.get(activity.date) || 0) + parseNumber(activity.distanceKm));
  });
  return Array.from(daily.entries()).map(([date, runWalkKm]) => ({
    date,
    runWalkKm: roundForInput(runWalkKm),
  }));
}

function formatSyncTimeWib(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const formatted = date.toLocaleString("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatted} WIB`;
}

function buildCaption(day, entry, totals) {
  const lines = [
    `Day ${day}: Hybrid Training`,
    "",
    `Run/walk: ${formatKm(entry.runToday)} km today | ${formatKm(totals.runTotal)} km total`,
    `Push-ups: ${formatInt(entry.pushToday)} today | ${formatInt(totals.pushTotal)} total`,
  ];

  if (entry.otherSport) lines.push(`Other sport: ${entry.otherSport}`);
  if (entry.otherActivity) lines.push(`Other activity: ${entry.otherActivity}`);
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
    "hard-things": "Do the hard things.",
    "embrace-difficult": "Embrace difficult. Build different.",
    "earn-it": "Earn it in private.",
    "comfort-zone": "Growth lives outside comfort.",
    "quiet-work": "Quiet work. Loud results.",
    standard: "Raise the standard. Repeat.",
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
    const footerHeight = getWatermarkFooterHeight(width);
    drawCoverImage(ctx, state.image, width, height - footerHeight);
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
  const footerHeight = getWatermarkFooterHeight(width);
  const y = height - footerHeight;
  const padX = Math.round(width * 0.048);
  const titleSize = Math.max(28, Math.round(width * 0.032));
  const statSize = Math.max(19, Math.round(width * 0.02));
  const handleSize = Math.max(20, Math.round(width * 0.0205));
  const title = `Day ${day}: Hybrid Training`;
  const handle = splitCredit(els.creditText.value.trim() || state.credit).handle;
  const titleY = y + Math.round(footerHeight * 0.3);
  const runY = y + Math.round(footerHeight * 0.55);
  const pushY = y + Math.round(footerHeight * 0.745);
  const handleY = y + Math.round(footerHeight * 0.33);

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, y, width, footerHeight);

  ctx.fillStyle = "#f1f2f4";
  ctx.beginPath();
  ctx.moveTo(width * 0.56, height);
  ctx.bezierCurveTo(width * 0.64, y + footerHeight * 0.78, width * 0.66, y + footerHeight * 0.32, width * 0.74, y);
  ctx.lineTo(width, y);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(0, y, width, Math.max(2, Math.round(width * 0.002)));

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = "#111315";
  drawFittedText(ctx, title, padX, titleY, width * 0.62, titleSize, 20, 900, "left");

  ctx.fillStyle = "#34383d";
  drawTrainingStatSeparator(ctx, padX, runY, pushY, width, statSize);
  drawTrainingStatRow(
    ctx,
    padX,
    runY,
    width,
    statSize,
    "Run/walk",
    `${formatKm(entry.runToday)} km`,
    `${formatKm(totals.runTotal)} km`,
  );
  drawTrainingStatRow(
    ctx,
    padX,
    pushY,
    width,
    statSize,
    "Push-ups",
    formatInt(entry.pushToday),
    formatInt(totals.pushTotal),
  );

  ctx.textAlign = "right";
  ctx.fillStyle = "#111315";
  drawFittedText(ctx, handle, width - padX, handleY, width * 0.25, handleSize, 15, 800, "right");
  ctx.restore();
}

function getWatermarkFooterHeight(width) {
  return Math.round(width * 0.145);
}

function drawTrainingStatRow(ctx, x, y, width, size, label, today, total) {
  const labelX = x;
  const todayX = x + Math.round(width * 0.103);
  const totalLabelX = x + Math.round(width * 0.215);
  const totalX = x + Math.round(width * 0.275);

  ctx.textAlign = "left";
  ctx.font = `750 ${size}px system-ui, sans-serif`;
  ctx.fillText(`${label}:`, labelX, y);
  ctx.fillText(today, todayX, y);
  ctx.fillText("Total:", totalLabelX, y);
  ctx.fillText(total, totalX, y);
}

function drawTrainingStatSeparator(ctx, x, runY, pushY, width, size) {
  const separatorX = x + Math.round(width * 0.202);
  const top = runY - size * 0.65;
  const height = pushY - runY + size * 1.3;

  ctx.fillStyle = "#b9bec5";
  ctx.fillRect(separatorX, top, Math.max(2, Math.round(width * 0.0015)), height);
  ctx.fillStyle = "#34383d";
}

function compactText(text, limit) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, Math.max(0, limit - 1)).trim()}...`;
}

function drawFittedText(ctx, text, x, y, maxWidth, preferredSize, minSize, weight, align = "left") {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  let size = preferredSize;
  ctx.textAlign = align;
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;

  while (size > minSize && ctx.measureText(clean).width > maxWidth) {
    size -= 1;
    ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  }

  ctx.fillText(clean, x, y);
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

async function openThreadsDraft() {
  updatePreview();
  await copyTextToClipboard(buildStravaReplyText());
  const text = encodeURIComponent(buildThreadsShareText());
  window.open(`https://www.threads.com/intent/post?text=${text}`, "_blank", "noopener,noreferrer");
}

function buildThreadsShareText() {
  return `${els.captionPreview.textContent}\n\n#${THREADS_TOPIC_NAME}`;
}

function buildStravaReplyText() {
  return `Connect on Strava:\n${STRAVA_PROFILE_URL}`;
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

async function shareImageDraft() {
  updatePreview();
  await copyTextToClipboard(buildStravaReplyText());
  const blob = await canvasToBlob(els.previewCanvas);
  if (!blob) return;

  const file = new File([blob], `threads-${els.dayNumber.textContent.toLowerCase().replace(/\s+/g, "-")}.png`, {
    type: "image/png",
  });
  const shareData = {
    title: els.dayNumber.textContent,
    text: buildThreadsShareText(),
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
  await copyTextToClipboard(caption);
  els.copyCaptionButton.textContent = "Copied";
  setTimeout(() => {
    els.copyCaptionButton.textContent = "Copy caption";
  }, 1200);
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
  } else {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
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
loadManualLog();
loadStravaSummary();
