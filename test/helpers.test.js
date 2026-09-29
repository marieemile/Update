import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeUrl, urlKey } from "../src/ingest.js";
import { sumScores, pickCandidates } from "../src/pipeline.js";
import { buildSchemas } from "../src/schemas.js";
import { localDate, mergeTrends } from "../src/store.js";
import { firstSentence, markdown, ago, safeUrl } from "../public/lib.js";

test("normalizeUrl drops tracking params, fragment and trailing slash", () => {
  assert.equal(normalizeUrl("https://ex.com/a/?utm_source=x&id=3&ref=hn#top"), "https://ex.com/a/?id=3");
  assert.equal(normalizeUrl("https://ex.com/a/"), "https://ex.com/a");
  assert.equal(normalizeUrl("not a url"), "not a url");
});

test("urlKey matches the same article across scheme, www and query", () => {
  assert.equal(urlKey("http://www.ex.com/a/?x=1"), urlKey("https://ex.com/a"));
});

test("sumScores adds the five dimensions", () => {
  assert.equal(sumScores({ importance: 1, impact: 2, novelty: 3, credibility: 4, long_term: 5 }), 15);
});

test("pickCandidates keeps top market clusters for every configured market", () => {
  const scores = (n) => ({ importance: n, impact: n, novelty: n, credibility: n, long_term: n });
  const clusters = [
    ...Array.from({ length: 5 }, (_, i) => ({ domain: "world", scores: scores(5), markets: [], coverage: "wide", positive: false, id: `big${i}` })),
    { domain: "world", scores: scores(1), markets: ["shipping"], coverage: "wide", positive: false, id: "ship" },
  ];
  const ids = pickCandidates(clusters, "world", 2, ["shipping"]).map((c) => c.id);
  assert.ok(ids.includes("ship"));
  assert.equal(ids.length, 3);
});

test("buildSchemas uses the configured market ids", () => {
  const { domain } = buildSchemas(["ip", "shipping"]);
  assert.deepEqual(domain.properties.stories.items.properties.markets.items.enum, ["ip", "shipping"]);
});

test("localDate uses local time, not UTC", () => {
  assert.equal(localDate(new Date(2026, 0, 2, 0, 30)), "2026-01-02");
});

test("mergeTrends keeps first_detected across updates (case-insensitive)", () => {
  const merged = mergeTrends([{ name: "Chip Controls", first_detected: "2026-09-01" }], [{ name: "chip controls" }, { name: "New" }], "2026-09-29");
  assert.equal(merged[0].first_detected, "2026-09-01");
  assert.equal(merged[1].first_detected, "2026-09-29");
  assert.ok(merged.every((t) => t.last_updated === "2026-09-29"));
});

test("firstSentence keeps abbreviations together", () => {
  assert.equal(firstSentence("U.S. officials met. Then left."), "U.S. officials met.");
  assert.equal(firstSentence("No full stop"), "No full stop");
});

test("markdown escapes HTML and renders lists, headings and safe links", () => {
  const html = markdown("## Hi\n- <b>x</b>\n- [a](https://e.com)\n[bad](javascript:alert(1))");
  assert.match(html, /<h2>Hi<\/h2><ul><li>&lt;b&gt;x&lt;\/b&gt;<\/li><li><a href="https:\/\/e.com"/);
  assert.doesNotMatch(html, /href="javascript/);
});

test("ago and safeUrl", () => {
  const now = Date.parse("2026-09-29T12:00:00Z");
  assert.equal(ago("2026-09-29T11:30:00Z", now), "30m ago");
  assert.equal(ago("2026-09-27T12:00:00Z", now), "2d ago");
  assert.equal(safeUrl("javascript:x"), "#");
});
