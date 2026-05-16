const PAGE_SIZE = 10;
const START_DATE = "2026-05-14";

const els = {
  historyBody: document.querySelector("#historyBody"),
  historySummary: document.querySelector("#historySummary"),
  prevPage: document.querySelector("#prevPage"),
  nextPage: document.querySelector("#nextPage"),
  pageStatus: document.querySelector("#pageStatus"),
};

const state = {
  rows: [],
  page: 1,
};

function parseNumber(value) {
  const parsed = Number.parseFloat(String(value || "").replace(",", "."));
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

async function loadJson(path, fallback) {
  try {
    const response = await fetch(`${path}?ts=${Date.now()}`);
    if (!response.ok) return fallback;
    return response.json();
  } catch {
    return fallback;
  }
}

function getStravaDaily(summary) {
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
    runWalkKm,
  }));
}

function buildRows(stravaSummary, manualLog) {
  const stravaByDate = new Map(getStravaDaily(stravaSummary).map((item) => [item.date, item.runWalkKm]));
  const manualByDate = new Map(
    (manualLog.entries || []).map((entry) => [
      normalizeDate(entry.date),
      {
        pushToday: parseNumber(entry.pushUps),
        activity: entry.otherActivity || entry.otherSport || "",
      },
    ]),
  );

  const dates = new Set([...stravaByDate.keys(), ...manualByDate.keys()]);
  return Array.from(dates)
    .filter((date) => date >= START_DATE)
    .sort((a, b) => b.localeCompare(a))
    .map((date) => {
      const manual = manualByDate.get(date) || {};
      return {
        day: `Day ${dateDiffDays(START_DATE, date)}`,
        date,
        runWalkKm: stravaByDate.get(date) || 0,
        pushToday: manual.pushToday || 0,
        activity: manual.activity || "",
      };
    });
}

function render() {
  const pageCount = Math.max(1, Math.ceil(state.rows.length / PAGE_SIZE));
  state.page = Math.min(Math.max(1, state.page), pageCount);
  const start = (state.page - 1) * PAGE_SIZE;
  const rows = state.rows.slice(start, start + PAGE_SIZE);

  els.historyBody.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    [row.day, row.date, `${formatKm(row.runWalkKm)} km`, formatInt(row.pushToday), row.activity || "-"].forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });
    els.historyBody.appendChild(tr);
  });

  const runTotal = state.rows.reduce((sum, row) => sum + parseNumber(row.runWalkKm), 0);
  const pushTotal = state.rows.reduce((sum, row) => sum + parseNumber(row.pushToday), 0);
  els.historySummary.textContent = `${formatKm(runTotal)} km run/walk | ${formatInt(pushTotal)} push-ups`;
  els.pageStatus.textContent = `Page ${state.page} of ${pageCount}`;
  els.prevPage.disabled = state.page <= 1;
  els.nextPage.disabled = state.page >= pageCount;
}

async function init() {
  const [stravaSummary, manualLog] = await Promise.all([
    loadJson("../data/strava-summary.json", {}),
    loadJson("../data/manual-log.json", { entries: [] }),
  ]);
  state.rows = buildRows(stravaSummary, manualLog);
  render();
}

els.prevPage.addEventListener("click", () => {
  state.page -= 1;
  render();
});

els.nextPage.addEventListener("click", () => {
  state.page += 1;
  render();
});

init();
