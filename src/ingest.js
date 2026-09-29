import Parser from "rss-parser";
import { SOURCES } from "./sources.js";

const parser = new Parser({
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
      ["content:encoded", "contentEncoded"],
    ],
  },
});
const FETCH_TIMEOUT_MS = 15000;

function clean(text = "") {
  return text.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeUrl(url = "") {
  try {
    const u = new URL(url);
    for (const key of [...u.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "ref" || key === "CMP") u.searchParams.delete(key);
    }
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

// Feeds carry images in several places; take the first usable one.
function pickImage(item) {
  const enc = item.enclosure;
  let url =
    (enc && (enc.type?.startsWith("image") || /\.(jpe?g|png|webp)/i.test(enc.url || "")) && enc.url) ||
    item.mediaContent?.find((m) => m.$?.url && (!m.$.medium || m.$.medium === "image"))?.$.url ||
    item.mediaThumbnail?.[0]?.$?.url ||
    (item.contentEncoded || item.content || "").match(/<img[^>]+src="([^"]+)"/)?.[1];
  if (!url || !/^https:\/\//.test(url)) return null;
  // BBC serves 240px thumbnails by default; ask for a larger rendition.
  return url.replace(/\/ace\/standard\/\d+\//, "/ace/standard/976/");
}

function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

async function fetchSource(source, cutoff, maxItems) {
  // fetch + AbortSignal gives a hard deadline; rss-parser's own timeout doesn't
  // cover servers that stall mid-body.
  const res = await fetch(source.url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "Mozilla/5.0 (PersonalIntelligenceFeed/0.1)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // Some feeds contain bare "&" characters, which strict XML parsing rejects.
  const xml = (await res.text()).replace(/&(?!#?\w+;)/g, "&amp;");
  const feed = await parser.parseString(xml);
  return feed.items
    .map((item) => {
      const published = new Date(item.isoDate || item.pubDate || 0);
      return {
        title: clean(item.title),
        link: normalizeUrl(item.link),
        source: source.name,
        tier: source.tier,
        domain: source.domain,
        published: isNaN(published) ? null : published.toISOString(),
        image: pickImage(item),
        snippet: clean(item.contentSnippet || item.summary || item.content || "").slice(0, 320),
      };
    })
    // Undated items are kept: some primary sources omit dates.
    .filter((it) => it.title && it.link && (!it.published || new Date(it.published) >= cutoff))
    .slice(0, maxItems);
}

// Pulls every source in parallel and does cheap exact deduplication (same URL or
// same normalized title). Semantic clustering of "same event, different outlet"
// happens later in the triage step.
export async function ingest({ lookbackHours = 30, maxItemsPerSource = 25 } = {}) {
  const cutoff = new Date(Date.now() - lookbackHours * 3600 * 1000);
  const results = await Promise.allSettled(
    SOURCES.map((s) => fetchSource(s, cutoff, maxItemsPerSource)),
  );

  const report = [];
  const seenUrls = new Set();
  const seenTitles = new Set();
  const items = [];

  results.forEach((r, i) => {
    const source = SOURCES[i];
    if (r.status === "rejected") {
      report.push({ source: source.name, ok: false, error: String(r.reason?.message || r.reason).slice(0, 120) });
      return;
    }
    let kept = 0;
    for (const it of r.value) {
      const t = normalizeTitle(it.title);
      if (seenUrls.has(it.link) || seenTitles.has(t)) continue;
      seenUrls.add(it.link);
      seenTitles.add(t);
      items.push(it);
      kept++;
    }
    report.push({ source: source.name, ok: true, items: kept });
  });

  items.forEach((it, i) => (it.id = `i${i + 1}`));
  return { items, report };
}
