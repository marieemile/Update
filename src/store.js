import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DATA_DIR = path.join(root, "data");
const BRIEFINGS = path.join(DATA_DIR, "briefings");
const DEEPDIVES = path.join(DATA_DIR, "deepdives");
const READS = path.join(DATA_DIR, "reads");
const TRENDS = path.join(DATA_DIR, "trends.json");

for (const dir of [DATA_DIR, BRIEFINGS, DEEPDIVES, READS]) fs.mkdirSync(dir, { recursive: true });

// Briefings are dated in the machine's local time zone, not UTC, so an early
// morning run isn't filed under yesterday.
export function localDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

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
  const max = config.surprise_max ?? 4;
  if (surprise_me != null) config.surprise_me = Math.max(0, Math.min(max, Math.round(Number(surprise_me) || 0)));
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

const listDates = (dir) =>
  fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.slice(0, 10))
    .sort()
    .reverse();
export const listBriefingDates = () => listDates(BRIEFINGS);

export function loadBriefing(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return readJson(path.join(BRIEFINGS, `${date}.json`), null);
}

export function saveBriefing(briefing) {
  writeJson(path.join(BRIEFINGS, `${briefing.date}.json`), briefing);
  publishStatic();
}

// Founder reads: one curated newsletter issue per file, keyed by issue date.
export const listReadsDates = () => listDates(READS);
export function loadReads(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return readJson(path.join(READS, `${date}.json`), null);
}
export function saveReads(reads) {
  writeJson(path.join(READS, `${reads.date}.json`), reads);
  publishStatic();
}

// Static copies under public/briefings/ and public/reads/ let the web app run on a static host
// (Vercel) with no server: the UI falls back to these when /api/* is absent.
const STATIC_DIR = path.join(root, "public", "briefings");
const STATIC_READS = path.join(root, "public", "reads");
export function publishStatic() {
  for (const [from, to, dates] of [[BRIEFINGS, STATIC_DIR, listBriefingDates()], [READS, STATIC_READS, listReadsDates()]]) {
    fs.mkdirSync(to, { recursive: true });
    for (const d of dates) fs.copyFileSync(path.join(from, `${d}.json`), path.join(to, `${d}.json`));
    writeJson(path.join(to, "index.json"), dates);
  }
  const { interests, surprise_me, surprise_max, markets } = loadConfig();
  writeJson(path.join(STATIC_DIR, "config.json"), { interests, surprise_me, surprise_max, markets });
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
export function mergeTrends(previous, updated, date) {
  const byName = new Map(previous.map((t) => [t.name.toLowerCase(), t]));
  return updated.map((t) => ({
    ...t,
    first_detected: byName.get(t.name.toLowerCase())?.first_detected ?? date,
    last_updated: date,
  }));
}

export function saveTrends(updated, date) {
  const merged = mergeTrends(loadTrends(), updated, date);
  writeJson(TRENDS, merged);
  return merged;
}

const deepdivePath = (date, id) => path.join(DEEPDIVES, `${date}-${id.replace(/[^a-z0-9-]/gi, "")}.json`);
export const loadDeepdive = (date, id) => readJson(deepdivePath(date, id), null);
export const saveDeepdive = (date, id, value) => writeJson(deepdivePath(date, id), value);
