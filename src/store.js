import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DATA_DIR = path.join(root, "data");
const BRIEFINGS = path.join(DATA_DIR, "briefings");
const DEEPDIVES = path.join(DATA_DIR, "deepdives");
const TRENDS = path.join(DATA_DIR, "trends.json");

for (const dir of [DATA_DIR, BRIEFINGS, DEEPDIVES]) fs.mkdirSync(dir, { recursive: true });

export function loadConfig() {
  return JSON.parse(fs.readFileSync(path.join(root, "config.json"), "utf8"));
}

// Only interest weights and the surprise count are editable from the app.
export function saveInterests({ interests, surprise_me }) {
  const config = loadConfig();
  const clamp = (n) => Math.max(0, Math.min(10, Math.round(Number(n) || 0)));
  for (const [area, weights] of Object.entries(interests ?? {})) {
    if (!config.interests[area]) continue;
    for (const [topic, w] of Object.entries(weights)) {
      if (topic in config.interests[area]) config.interests[area][topic] = clamp(w);
    }
  }
  if (surprise_me != null) config.surprise_me = Math.max(0, Math.min(4, Math.round(Number(surprise_me) || 0)));
  fs.writeFileSync(path.join(root, "config.json"), JSON.stringify(config, null, 2) + "\n");
  return config;
}

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
};
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2));

export function listBriefingDates() {
  return fs
    .readdirSync(BRIEFINGS)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.slice(0, 10))
    .sort()
    .reverse();
}

export function loadBriefing(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return readJson(path.join(BRIEFINGS, `${date}.json`), null);
}

export function saveBriefing(briefing) {
  writeJson(path.join(BRIEFINGS, `${briefing.date}.json`), briefing);
  publishStatic();
}

// Static copies under public/briefings/ let the web app run on a static host
// (Vercel) with no server: the UI falls back to these when /api/* is absent.
const STATIC_DIR = path.join(root, "public", "briefings");
export function publishStatic() {
  fs.mkdirSync(STATIC_DIR, { recursive: true });
  const dates = listBriefingDates();
  for (const d of dates) fs.copyFileSync(path.join(BRIEFINGS, `${d}.json`), path.join(STATIC_DIR, `${d}.json`));
  writeJson(path.join(STATIC_DIR, "index.json"), dates);
  const { interests, surprise_me } = loadConfig();
  writeJson(path.join(STATIC_DIR, "config.json"), { interests, surprise_me });
}

// Headlines from the last few briefings, so agents can spot continuing stories
// and build timelines.
export function recentStories(beforeDate, days = 7) {
  return listBriefingDates()
    .filter((d) => d < beforeDate)
    .slice(0, days)
    .flatMap((d) =>
      (loadBriefing(d)?.stories ?? []).map((s) => ({ date: d, id: s.id, headline: s.headline, now: s.whats_new?.now })),
    );
}

export function loadTrends() {
  return readJson(TRENDS, []);
}

// The signal agent returns the whole updated dashboard; we only preserve
// first_detected so a trend's age survives renames of its summary.
export function saveTrends(updated, date) {
  const previous = new Map(loadTrends().map((t) => [t.name.toLowerCase(), t]));
  const merged = updated.map((t) => ({
    ...t,
    first_detected: previous.get(t.name.toLowerCase())?.first_detected ?? date,
    last_updated: date,
  }));
  writeJson(TRENDS, merged);
  return merged;
}

const deepdivePath = (date, id) => path.join(DEEPDIVES, `${date}-${id.replace(/[^a-z0-9-]/gi, "")}.json`);
export const loadDeepdive = (date, id) => readJson(deepdivePath(date, id), null);
export const saveDeepdive = (date, id, value) => writeJson(deepdivePath(date, id), value);
