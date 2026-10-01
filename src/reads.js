// Founder reads: a weekly, curated reading list from Founder Weekly with an
// "AI lens" tying the essays to the briefing's tech trends.
//
//   node src/reads.js fetch [issue-url]  -> data/inbox/reads-<date>-items.json (latest issue by default)
//   node src/reads.js draft [date]       -> data/inbox/reads-<date>-draft.json via the API
//      (or, without an API key, Claude writes that draft in chat: { ai_lens, reads })
//   node src/reads.js finish [date]      -> validates the draft, saves data/reads/<date>.json and publishes it
import fs from "node:fs";
import path from "node:path";
import { fetchIssue, fetchExcerpt, formatOf, latestIssueUrl } from "./founder-weekly.js";
import { structured } from "./claude.js";
import { READS_TASK } from "./prompts.js";
import { READS_SCHEMA } from "./schemas.js";
import { DATA_DIR, loadTrends, recentStories, localDate, saveReads } from "./store.js";

const INBOX = path.join(DATA_DIR, "inbox");
fs.mkdirSync(INBOX, { recursive: true });
const itemsFile = (date) => path.join(INBOX, `reads-${date}-items.json`);
const draftFile = (date) => path.join(INBOX, `reads-${date}-draft.json`);

// Without a date, use the most recently fetched issue.
function latestFetched() {
  const dates = fs.readdirSync(INBOX).map((f) => f.match(/^reads-(\d{4}-\d{2}-\d{2})-items\.json$/)?.[1]).filter(Boolean).sort();
  if (!dates.length) throw new Error("No fetched issue yet - run: node src/reads.js fetch");
  return dates.at(-1);
}

async function fetchCmd(url) {
  const issue = await fetchIssue(url || (await latestIssueUrl()));
  const excerpts = await Promise.all(issue.items.map((it) => fetchExcerpt(it.url)));
  issue.items.forEach((it, i) => (it.excerpt = excerpts[i]));
  // Context for the AI lens: the tech trend dashboard and a week of tech headlines.
  const context = {
    trends: loadTrends().filter((t) => t.domain === "tech").map(({ name, status, direction, summary }) => ({ name, status, direction, summary })),
    recent_tech_headlines: recentStories(localDate(new Date(Date.now() + 864e5))).filter((s) => s.id.startsWith("t")).map((s) => `${s.date}: ${s.headline}`),
  };
  fs.writeFileSync(itemsFile(issue.date), JSON.stringify({ ...issue, context }, null, 1));
  console.log(`Issue ${issue.number} (${issue.date}): ${issue.items.length} reads, ${excerpts.filter(Boolean).length} with article text -> ${itemsFile(issue.date)}`);
}

export function formatIssue({ title, items, context }) {
  return `${title}

READS
${items.map((it) => `${it.id} | ${it.section} | ${formatOf(it.url)} | ${it.title}
   ${it.url}
   Newsletter blurb: ${it.blurb || "(none)"}
   Article opening: ${it.excerpt || "(could not fetch)"}`).join("\n\n")}

TECH TREND DASHBOARD
${context.trends.map((t) => `- ${t.name} (${t.status}, ${t.direction}): ${t.summary}`).join("\n") || "(none yet)"}

RECENT TECH HEADLINES
${context.recent_tech_headlines.join("\n") || "(none yet)"}`;
}

async function draftCmd(date) {
  const issue = JSON.parse(fs.readFileSync(itemsFile(date), "utf8"));
  const draft = await structured({ label: "founder reads", system: READS_TASK, user: formatIssue(issue), schema: READS_SCHEMA, effort: "high" });
  fs.writeFileSync(draftFile(date), JSON.stringify(draft, null, 2));
  console.log(`Draft -> ${draftFile(date)}`);
}

// Joins the curator's picks back onto the parsed links, so titles and URLs are
// always exactly what the newsletter linked.
export function mergeReads(issue, draft) {
  const byId = new Map(issue.items.map((it) => [it.id, it]));
  for (const r of draft.reads) if (!byId.has(r.id)) throw new Error(`Draft cites unknown read ${r.id}`);
  for (const t of draft.ai_lens.themes) for (const id of t.read_ids) if (!byId.has(id)) throw new Error(`Theme "${t.name}" cites unknown read ${id}`);
  const missing = issue.items.filter((it) => !draft.reads.some((r) => r.id === it.id));
  if (missing.length) throw new Error(`Draft is missing ${missing.map((it) => it.id).join(", ")}`);
  const trendNames = new Set(issue.context.trends.map((t) => t.name));
  return {
    date: issue.date,
    source: "Founder Weekly",
    issue: issue.number,
    title: issue.title,
    source_url: issue.url,
    generated_at: new Date().toISOString(),
    ai_lens: {
      ...draft.ai_lens,
      // Only keep trend links that exist, so the UI never links to nothing.
      themes: draft.ai_lens.themes.map((t) => ({ ...t, related_trend: trendNames.has(t.related_trend) ? t.related_trend : "" })),
    },
    reads: draft.reads.map((r) => {
      const it = byId.get(r.id);
      return { ...r, title: it.title, url: it.url, section: it.section, format: formatOf(it.url), site: new URL(it.url).hostname.replace(/^www\./, "") };
    }),
  };
}

function finishCmd(date) {
  const issue = JSON.parse(fs.readFileSync(itemsFile(date), "utf8"));
  const draft = JSON.parse(fs.readFileSync(draftFile(date), "utf8"));
  const reads = mergeReads(issue, draft);
  saveReads(reads);
  const n = (p) => reads.reads.filter((r) => r.pick === p).length;
  console.log(`Saved issue ${reads.issue}: ${n("must")} must, ${n("worth")} worth, ${n("skip")} skip -> data/reads/${date}.json (+ public/reads/)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, arg] = process.argv.slice(2);
  try {
    if (cmd === "fetch") await fetchCmd(arg);
    else if (cmd === "draft") await draftCmd(arg || latestFetched());
    else if (cmd === "finish") finishCmd(arg || latestFetched());
    else console.log("usage: node src/reads.js fetch [issue-url] | draft [date] | finish [date]");
  } catch (err) {
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
