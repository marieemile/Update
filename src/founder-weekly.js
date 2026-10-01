// Founder Weekly (founderweekly.com, on beehiiv) has no RSS feed, but each issue
// page is server-rendered: section headings, then one <h6><a> per article
// followed by the newsletter's blurb. Sponsored blocks don't use <h6> links.
import { normalizeUrl } from "./ingest.js";

export const HOME = "https://www.founderweekly.com";
const UA = { "User-Agent": "Mozilla/5.0 (PersonalIntelligenceFeed/0.1)" };
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

const text = (html = "") =>
  html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/g, " ").replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#39;|&rsquo;|&#x27;/g, "’").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ").trim();

// "Founder Weekly (Issue 750 September 30 2026)" -> { number: 750, date: "2026-09-30" }
export function parseTitle(title) {
  const m = title.match(/Issue\s+(\d+)\s+([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
  if (!month) return null;
  return { number: Number(m[1]), date: `${m[4]}-${String(month).padStart(2, "0")}-${m[3].padStart(2, "0")}` };
}

export function parseIssue(html) {
  // Only the rendered body; the same content is repeated as JSON in scripts.
  const body = html.replace(/<script[\s\S]*?<\/script>/g, "");
  const title = text(body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]);
  const meta = parseTitle(title);
  if (!meta) throw new Error(`Not a Founder Weekly issue page (title: "${title.slice(0, 80)}")`);

  const marks = [
    ...[...body.matchAll(/<h[2-5][^>]*>([\s\S]*?)<\/h[2-5]>/g)].map((m) => ({ at: m.index, end: m.index + m[0].length, section: text(m[1]) })),
    ...[...body.matchAll(/<h6[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h6>/g)].map((m) => ({ at: m.index, end: m.index + m[0].length, url: m[1], title: text(m[2]) })),
  ].sort((a, b) => a.at - b.at);

  const items = [];
  let section = "";
  marks.forEach((m, i) => {
    if (m.section !== undefined) return void (section = m.section);
    const next = marks[i + 1]?.at ?? body.length;
    items.push({
      id: `r${items.length + 1}`,
      title: m.title,
      url: normalizeUrl(m.url.replace(/&amp;/g, "&")),
      section,
      // The blurb is the first paragraph after the link (not the page footer).
      blurb: text(body.slice(m.end, next).match(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/)?.[1]).slice(0, 700),
    });
  });
  return { ...meta, title, items };
}

export const formatOf = (url) =>
  /youtube\.com|youtu\.be|vimeo\.com/.test(url) ? "video"
    : /(^|\/\/)(www\.)?(x|twitter)\.com\//.test(url) ? "thread"
      : /podcast|spotify\.com|podcasts\.apple/.test(url) ? "podcast"
        : "article";

export async function latestIssueUrl() {
  const res = await fetch(HOME, { headers: UA, signal: AbortSignal.timeout(15000) });
  const path = (await res.text()).match(/href="(\/p\/founder-weekly-issue-[^"]+)"/)?.[1];
  if (!path) throw new Error("Could not find the latest issue on founderweekly.com");
  return HOME + path;
}

export async function fetchIssue(url) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Issue page: HTTP ${res.status}`);
  return { url, ...parseIssue(await res.text()) };
}

// Opening text of each linked piece, so the curator judges the article itself
// and not just the newsletter's one-line pitch. Failures (X, paywalls) are fine.
export async function fetchExcerpt(url, chars = 1500) {
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return "";
    const html = (await res.text()).slice(0, 400000);
    const desc = html.match(/<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? "";
    // `<p(\s|>)` so <path>, <picture> etc. aren't taken for paragraphs.
    const paras = [...html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/g, "").matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/g)].map((m) => text(m[1])).filter((p) => p.length > 80);
    return text(`${desc} ${paras.join(" ")}`).slice(0, chars);
  } catch {
    return "";
  }
}
