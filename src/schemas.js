// JSON schemas for structured outputs. Every object needs additionalProperties:false
// and a full required list; numeric/length constraints aren't supported, so ranges
// are stated in the prompts instead.

const obj = (properties) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const str = { type: "string" };
const int = { type: "integer" };
const bool = { type: "boolean" };
const arr = (items) => ({ type: "array", items });
const oneOf = (...values) => ({ type: "string", enum: values });

// Tracked markets (config.json "markets"). A story can belong to zero or more.
const markets = arr(oneOf("ip", "real_estate"));

const scores = obj({ importance: int, impact: int, novelty: int, credibility: int, long_term: int });

export const TRIAGE_SCHEMA = obj({
  clusters: arr(
    obj({
      headline: str,
      domain: oneOf("world", "tech"),
      category: str,
      item_ids: arr(str),
      scores,
      markets,
      coverage: oneOf("wide", "narrow"),
      positive: bool,
      reason: str,
    }),
  ),
});

export const DOMAIN_SCHEMA = obj({
  stories: arr(
    obj({
      id: str,
      headline: str,
      level: oneOf("essential", "context"),
      categories: arr(str),
      markets,
      what_happened: str,
      why_it_matters: str,
      whats_new: obj({ before: str, now: str }),
      watch: arr(str),
      confidence: oneOf("high", "medium", "low"),
      confidence_note: str,
      claim_status: oneOf("confirmed", "official_statement", "reported", "allegation", "analysis", "mixed"),
      scores,
      positive: bool,
      under_the_radar: bool,
      outside_interests: bool,
      timeline: arr(obj({ date: str, event: str })),
      sources: arr(obj({ name: str, url: str, tier: int, adds: str })),
    }),
  ),
});

export const SIGNAL_SCHEMA = obj({
  top_line: str,
  signals: arr(
    obj({
      title: str,
      domain: oneOf("world", "tech", "cross"),
      what: str,
      evidence_story_ids: arr(str),
      why_it_matters: str,
      would_confirm: str,
      would_invalidate: str,
    }),
  ),
  trends: arr(
    obj({
      name: str,
      domain: oneOf("world", "tech"),
      markets,
      status: oneOf("emerging", "developing", "accelerating", "established", "cooling", "unclear"),
      direction: oneOf("up", "steady", "down"),
      summary: str,
      recent_developments: arr(str),
      evidence_story_ids: arr(str),
      what_to_watch: str,
    }),
  ),
  watchlist: arr(obj({ item: str, why: str })),
});
