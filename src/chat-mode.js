// "Chat mode": run the pipeline without an API key, with Claude (in a Claude
// Code / desktop chat) acting as the triage, world, tech and signal agents.
//
//   node src/chat-mode.js fetch    -> data/inbox/<date>-items.json (raw feed items)
//   (Claude writes data/inbox/<date>-draft.json: { top_line, stories, signals, trends, watchlist, stats })
//   node src/chat-mode.js finish   -> attaches images/times, merges trends, saves the briefing
import fs from "node:fs";
import path from "node:path";
import { ingest } from "./ingest.js";
import { enrich } from "./pipeline.js";
import { DATA_DIR, loadConfig, saveBriefing, saveTrends } from "./store.js";

const INBOX = path.join(DATA_DIR, "inbox");
fs.mkdirSync(INBOX, { recursive: true });
const date = process.argv[3] || new Date().toISOString().slice(0, 10);
const itemsFile = path.join(INBOX, `${date}-items.json`);
const draftFile = path.join(INBOX, `${date}-draft.json`);
const sum = (s) => s.importance + s.impact + s.novelty + s.credibility + s.long_term;

async function fetchItems() {
  const config = loadConfig();
  const { items, report } = await ingest({ lookbackHours: config.lookback_hours, maxItemsPerSource: config.max_items_per_source });
  fs.writeFileSync(itemsFile, JSON.stringify({ date, report, items }, null, 1));
  console.log(`${items.length} items from ${report.filter((r) => r.ok).length}/${report.length} sources -> ${itemsFile}`);
}

async function finish() {
  const { items, report } = JSON.parse(fs.readFileSync(itemsFile, "utf8"));
  const draft = JSON.parse(fs.readFileSync(draftFile, "utf8"));
  // Drafts may cite sources by ingested item id; resolve them to exact names/URLs.
  const byId = new Map(items.map((it) => [it.id, it]));
  const stories = draft.stories.map((s) => ({
    ...s,
    sources: s.sources.map((src) => {
      const it = src.id && byId.get(src.id);
      if (src.id && !it) throw new Error(`${s.id}: unknown item ${src.id}`);
      return it ? { name: it.source, url: it.link, tier: it.tier, adds: src.adds } : src;
    }),
    markets: s.markets ?? [],
    signal_score: sum(s.scores),
  }));
  await enrich(stories, items);
  const briefing = {
    date,
    generated_at: new Date().toISOString(),
    top_line: draft.top_line,
    stories,
    signals: draft.signals,
    watchlist: draft.watchlist,
    trends: saveTrends(draft.trends.map((t) => ({ ...t, markets: t.markets ?? [] })), date),
    stats: {
      items: items.length,
      sources_ok: report.filter((r) => r.ok).length,
      sources_total: report.length,
      clusters: draft.stats?.clusters ?? stories.length,
    },
    generated_by: "chat",
  };
  saveBriefing(briefing);
  console.log(`Saved ${stories.length} stories (${stories.filter((s) => s.image).length} with images) -> data/briefings/${date}.json`);
}

const cmd = process.argv[2];
if (cmd === "fetch") await fetchItems();
else if (cmd === "finish") await finish();
else console.log("usage: node src/chat-mode.js fetch|finish [date]");
