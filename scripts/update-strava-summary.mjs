import { mkdir, writeFile } from "node:fs/promises";

const {
  STRAVA_CLIENT_ID,
  STRAVA_CLIENT_SECRET,
  STRAVA_REFRESH_TOKEN,
  STRAVA_START_DATE = "2026-05-14",
  STRAVA_TIMEZONE = "Asia/Jakarta",
  STRAVA_TIMEZONE_OFFSET = "+07:00",
} = process.env;

const OUTPUT_FILE = new URL("../public/data/strava-summary.json", import.meta.url);
const RUN_WALK_TYPES = new Set(["Run", "Walk", "Hike", "TrailRun", "VirtualRun"]);

function requireSecret(name, value) {
  if (!value) throw new Error(`Missing ${name}`);
}

function dateInTimezone(date = new Date(), timezone = STRAVA_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function epochAtLocalMidnight(date, offset = STRAVA_TIMEZONE_OFFSET) {
  return Math.floor(Date.parse(`${date}T00:00:00${offset}`) / 1000);
}

async function postForm(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!response.ok) throw new Error(`${url} failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function getJson(url, accessToken) {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`${url} failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function refreshAccessToken() {
  requireSecret("STRAVA_CLIENT_ID", STRAVA_CLIENT_ID);
  requireSecret("STRAVA_CLIENT_SECRET", STRAVA_CLIENT_SECRET);
  requireSecret("STRAVA_REFRESH_TOKEN", STRAVA_REFRESH_TOKEN);

  return postForm("https://www.strava.com/oauth/token", {
    client_id: STRAVA_CLIENT_ID,
    client_secret: STRAVA_CLIENT_SECRET,
    refresh_token: STRAVA_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });
}

async function fetchActivities(accessToken, afterEpoch) {
  const activities = [];
  for (let page = 1; page <= 10; page += 1) {
    const url = new URL("https://www.strava.com/api/v3/athlete/activities");
    url.searchParams.set("after", String(afterEpoch));
    url.searchParams.set("per_page", "200");
    url.searchParams.set("page", String(page));
    const batch = await getJson(url, accessToken);
    activities.push(...batch);
    if (batch.length < 200) break;
  }
  return activities;
}

function isRunWalk(activity) {
  return RUN_WALK_TYPES.has(activity.sport_type) || RUN_WALK_TYPES.has(activity.type);
}

function summarize(activities, today) {
  const runWalk = activities.filter(isRunWalk);
  const todayMeters = runWalk
    .filter((activity) => dateInTimezone(new Date(activity.start_date), STRAVA_TIMEZONE) === today)
    .reduce((sum, activity) => sum + Number(activity.distance || 0), 0);
  const totalMeters = runWalk.reduce((sum, activity) => sum + Number(activity.distance || 0), 0);

  return {
    todayKm: Math.round((todayMeters / 1000) * 100) / 100,
    totalKm: Math.round((totalMeters / 1000) * 100) / 100,
    activities: runWalk.slice(0, 12).map((activity) => ({
      id: activity.id,
      name: activity.name,
      type: activity.sport_type || activity.type,
      date: dateInTimezone(new Date(activity.start_date), STRAVA_TIMEZONE),
      distanceKm: Math.round((Number(activity.distance || 0) / 1000) * 100) / 100,
    })),
  };
}

async function main() {
  const token = await refreshAccessToken();
  const today = dateInTimezone();
  const activities = await fetchActivities(token.access_token, epochAtLocalMidnight(STRAVA_START_DATE));
  const summary = summarize(activities, today);
  const payload = {
    updatedAt: new Date().toISOString(),
    date: today,
    timezone: STRAVA_TIMEZONE,
    startDate: STRAVA_START_DATE,
    source: "strava",
    today: {
      runWalkKm: summary.todayKm,
    },
    total: {
      runWalkKm: summary.totalKm,
    },
    activities: summary.activities,
  };

  await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
  await writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${OUTPUT_FILE.pathname}`);
  console.log(`Today: ${summary.todayKm} km, total: ${summary.totalKm} km`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
