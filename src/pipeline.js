import { ingest, urlKey } from "./ingest.js";
import { structured, research } from "./claude.js";
import {
  CHARTER, MARKETS_RULES, TRIAGE_TASK, WORLD_TASK, TECH_TASK, DOMAIN_OUTPUT_RULES, SIGNAL_TASK, DEEPDIVE_TASK,
} from "./prompts.js";
import { buildSchemas } from "./schemas.js";
import {
  localDate, loadConfig, saveBriefing, recentStories, loadTrends, saveTrends, loadBriefing, loadDeepdive, saveDeepdive,
} from "./store.js";

// Stories come back from the agents with source URLs; map them to the ingested
// items to recover an image and a publish time. Articles without a feed image
// fall back to the page's og:image.

async function ogImage(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0" } });
    const html = (await res.text()).slice(0, 200000);
    const m = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i);
    return m && /^https:\/\//.test(m[1]) ? m[1].replace(/&amp;/g, "&") : null;
  } catch {
    return null;
  }
}

export async function enrich(stories, items) {
  const byUrl = new Map(items.map((it) => [urlKey(it.link), it]));
  await Promise.all(
    stories.map(async (s) => {
      const matched = s.sources.map((src) => byUrl.get(urlKey(src.url))).filter(Boolean);
      const dates = matched.map((it) => it.published).filter(Boolean).sort();
      s.published = dates.at(-1) ?? null;
      s.image = matched.sort((a, b) => a.tier - b.tier).find((it) => it.image)?.image ?? null;
      for (const src of s.sources) if (!s.image && /^https:/.test(src.url)) s.image = await ogImage(src.url);
    }),
  );
}

export const sumScores = (s) => s.importance + s.impact + s.novelty + s.credibility + s.long_term;

function formatItems(items) {
  return items
    .map((it) => `${it.id} | ${it.domain}${it.market ? `/${it.market}` : ""} | ${it.source} [T${it.tier}] | ${it.title} | ${it.snippet}`)
    .join("\n");
}

// Pick candidates for a domain agent: strongest clusters by story signal, plus
// narrow-coverage and positive clusters that would otherwise be crowded out -
// those feed "You might have missed" and "Positive developments".
export function pickCandidates(clusters, domain, n, marketIds) {
  const pool = clusters.filter((c) => c.domain === domain).sort((a, b) => sumScores(b.scores) - sumScores(a.scores));
  const chosen = new Set(pool.slice(0, n));
  for (const c of pool.filter((c) => c.coverage === "narrow" && c.scores.importance >= 3).slice(0, 4)) chosen.add(c);
  for (const c of pool.filter((c) => c.positive).slice(0, 4)) chosen.add(c);
  // Tracked-market clusters are judged within their market, so keep the best
  // few of each even if they'd fall below the general cut.
  for (const m of marketIds) for (const c of pool.filter((c) => c.markets.includes(m)).slice(0, 6)) chosen.add(c);
  return [...chosen];
}

function formatCandidates(candidates, itemsById) {
  return candidates
    .map((c, i) => {
      const s = c.scores;
      const sources = c.item_ids
        .map((id) => itemsById.get(id))
        .filter(Boolean)
        .map((it) => `   - ${it.source} [T${it.tier}] ${it.published ?? "undated"}\n     ${it.title}\n     ${it.snippet}\n     ${it.link}`)
        .join("\n");
      return `C${i + 1}. ${c.headline}  (${c.category}; markets=${c.markets.join(",") || "none"}; coverage=${c.coverage}; positive=${c.positive}; imp=${s.importance} impact=${s.impact} nov=${s.novelty} cred=${s.credibility} long=${s.long_term})\n   triage note: ${c.reason}\n${sources}`;
    })
    .join("\n\n");
}

function formatInterests(interests) {
  return Object.entries(interests)
    .map(([area, weights]) => `${area}: ` + Object.entries(weights).map(([k, v]) => `${k} ${v}/10`).join(", "))
    .join("\n");
}

async function domainAgent({ domain, task, candidates, itemsById, config, history, date, schema }) {
  const prefix = domain === "world" ? "w" : "t";
  const user = `Today is ${date}.

READER INTERESTS (weights nudge selection; they never override importance)
${formatInterests(config.interests)}
Mark up to ${Math.ceil(config.surprise_me / 2)} stories as outside_interests.

TRACKED MARKETS: ${Object.entries(config.markets ?? {}).map(([id, name]) => `${id} (${name})`).join(", ")}. Aim for up to ${config.stories_per_market ?? 3} stories per market across the world and tech briefings; include market stories that belong to your domain.

RECENT STORIES FROM PREVIOUS BRIEFINGS
${history.length ? history.map((h) => `${h.date}: ${h.headline} - ${h.now ?? ""}`).join("\n") : "(none yet - this is the first briefing)"}

CANDIDATE CLUSTERS
${formatCandidates(candidates, itemsById)}

Use story ids ${prefix}1, ${prefix}2, ... in order of importance.`;

  const out = await structured({
    label: `${domain} agent`,
    system: `${CHARTER}\n\n${MARKETS_RULES}\n\n${task}\n\n${DOMAIN_OUTPUT_RULES}`,
    user,
    schema,
    effort: "high",
  });
  return out.stories.map((s) => ({ ...s, domain, signal_score: sumScores(s.scores) }));
}

export async function runPipeline({ ingestOnly = false, log = console.log } = {}) {
  const config = loadConfig();
  const date = localDate();
  const marketIds = Object.keys(config.markets ?? {});
  const schemas = buildSchemas(marketIds);

  log("1/4 Ingesting sources...");
  const { items, report } = await ingest({
    lookbackHours: config.lookback_hours,
    maxItemsPerSource: config.max_items_per_source,
  });
  const failed = report.filter((r) => !r.ok);
  log(`    ${items.length} items from ${report.length - failed.length}/${report.length} sources`);
  for (const f of failed) log(`    ! ${f.source}: ${f.error}`);
  if (ingestOnly) return { items, report };
  if (!items.length) throw new Error("No items ingested - check your network connection.");

  log("2/4 Triage: clustering duplicates and scoring...");
  const triage = await structured({
    label: "triage",
    system: `${CHARTER}\n\n${MARKETS_RULES}\n\n${TRIAGE_TASK}`,
    user: `Today is ${date}. ${items.length} feed items:\n\n${formatItems(items)}`,
    schema: schemas.triage,
    effort: "medium",
  });
  const itemsById = new Map(items.map((it) => [it.id, it]));
  const clusters = triage.clusters.filter((c) => c.item_ids.some((id) => itemsById.has(id)));
  log(`    ${clusters.length} story clusters kept`);

  log("3/4 World and Tech agents writing stories...");
  const history = recentStories(date);
  const shared = { itemsById, config, history, date, schema: schemas.domain };
  const candidates = (domain) => pickCandidates(clusters, domain, config.candidates_per_domain, marketIds);
  const [world, tech] = await Promise.all([
    domainAgent({ domain: "world", task: WORLD_TASK, candidates: candidates("world"), ...shared }),
    domainAgent({ domain: "tech", task: TECH_TASK, candidates: candidates("tech"), ...shared }),
  ]);
  const stories = [...world, ...tech];
  await enrich(stories, items);

  log("4/4 Signal detector looking across stories...");
  const signal = await structured({
    label: "signals",
    system: `${CHARTER}\n\n${MARKETS_RULES}\n\n${SIGNAL_TASK}`,
    user: `Today is ${date}.

TODAY'S STORIES
${JSON.stringify(stories.map(({ id, domain, headline, categories, markets, what_happened, why_it_matters, whats_new }) => ({ id, domain, headline, categories, markets, what_happened, why_it_matters, whats_new })), null, 1)}

CURRENT TREND DASHBOARD
${JSON.stringify(loadTrends().map(({ name, domain, markets, status, direction, summary, recent_developments, first_detected }) => ({ name, domain, markets, status, direction, summary, recent_developments, first_detected })), null, 1)}`,
    schema: schemas.signal,
    effort: "high",
  });

  const trends = saveTrends(signal.trends, date);
  const briefing = {
    date,
    generated_at: new Date().toISOString(),
    top_line: signal.top_line,
    stories,
    signals: signal.signals,
    watchlist: signal.watchlist,
    trends,
    stats: { items: items.length, sources_ok: report.length - failed.length, sources_total: report.length, clusters: clusters.length },
  };
  saveBriefing(briefing);
  log(`Done: ${stories.length} stories, ${signal.signals.length} signals, ${trends.length} trends -> data/briefings/${date}.json`);
  return briefing;
}

export async function deepDive(date, storyId) {
  const cached = loadDeepdive(date, storyId);
  if (cached) return cached;
  const story = loadBriefing(date)?.stories.find((s) => s.id === storyId);
  if (!story) throw new Error("Story not found");

  const result = await research({
    label: `deep dive ${storyId}`,
    system: `${CHARTER}\n\n${DEEPDIVE_TASK}`,
    user: `Today is ${date}. Explain this story to me.

Headline: ${story.headline}
What happened: ${story.what_happened}
Why it matters: ${story.why_it_matters}
Known sources:
${story.sources.map((s) => `- ${s.name}: ${s.url}`).join("\n")}`,
  });
  const value = { ...result, story_id: storyId, date, generated_at: new Date().toISOString() };
  saveDeepdive(date, storyId, value);
  return value;
}
