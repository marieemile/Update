import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIssue, parseTitle, formatOf } from "../src/founder-weekly.js";
import { mergeReads } from "../src/reads.js";

const ISSUE = `<html><head><script>var x = "<h6><a href='https://bad.example'>Script copy</a></h6>";</script></head><body>
<h1>Founder Weekly (Issue 750 September 30 2026)</h1>
<h2>The AI Work Handbook</h2><p>Sponsored: sign up now.</p><a href="https://sponsor.example">Claim your playbook</a>
<h2>General</h2>
<h6><a href="https://ex.com/a?utm_source=www.founderweekly.com&amp;utm_medium=referral" target="_blank">First <b>piece</b></a></h6>
<div><p style="x">Blurb one.</p></div><svg><path d="M0"></path></svg>
<h2>Money and Finance</h2>
<h6><a href="https://www.youtube.com/watch?v=1&amp;utm_source=x">A video</a></h6><p>Blurb two.</p>
<p>Our Other Newsletters: Python Weekly...</p>
</body></html>`;

test("parseTitle reads the issue number and date", () => {
  assert.deepEqual(parseTitle("Founder Weekly (Issue 750 September 30 2026)"), { number: 750, date: "2026-09-30" });
  assert.deepEqual(parseTitle("Founder Weekly (Issue 9 March 3, 2027)"), { number: 9, date: "2027-03-03" });
  assert.equal(parseTitle("Something else"), null);
});

test("parseIssue extracts linked pieces with sections, clean URLs and blurbs", () => {
  const issue = parseIssue(ISSUE);
  assert.equal(issue.number, 750);
  assert.deepEqual(issue.items.map((it) => [it.id, it.section, it.title, it.url, it.blurb]), [
    ["r1", "General", "First piece", "https://ex.com/a", "Blurb one."],
    ["r2", "Money and Finance", "A video", "https://www.youtube.com/watch?v=1", "Blurb two."],
  ]);
});

test("parseIssue rejects pages that aren't issues", () => {
  assert.throws(() => parseIssue("<h1>Welcome</h1>"), /Not a Founder Weekly issue/);
});

test("formatOf classifies links", () => {
  assert.equal(formatOf("https://www.youtube.com/watch?v=1"), "video");
  assert.equal(formatOf("https://x.com/a/status/1"), "thread");
  assert.equal(formatOf("https://blog.example/post"), "article");
});

const issue = {
  date: "2026-09-30", number: 750, title: "t", url: "https://fw/p/750",
  items: [{ id: "r1", title: "One", url: "https://www.a.com/1", section: "General" }, { id: "r2", title: "Two", url: "https://b.com/2", section: "Money" }],
  context: { trends: [{ name: "Real trend" }] },
};
const read = (id, pick = "worth") => ({ id, pick, summary: "s", why_read: "w", ai_angle: "", tags: [] });

test("mergeReads takes titles and URLs from the issue and drops unknown trend links", () => {
  const out = mergeReads(issue, {
    ai_lens: { headline: "h", summary: "s", themes: [{ name: "A", what: "w", read_ids: ["r1"], related_trend: "Real trend" }, { name: "B", what: "w", read_ids: ["r2"], related_trend: "Made up" }] },
    reads: [{ ...read("r1", "must"), title: "Model's title" }, read("r2")],
  });
  assert.equal(out.reads[0].title, "One");
  assert.equal(out.reads[0].site, "a.com");
  assert.deepEqual(out.ai_lens.themes.map((t) => t.related_trend), ["Real trend", ""]);
});

test("mergeReads rejects unknown or missing ids", () => {
  const lens = { headline: "h", summary: "s", themes: [] };
  assert.throws(() => mergeReads(issue, { ai_lens: lens, reads: [read("r1"), read("r2"), read("r9")] }), /unknown read r9/);
  assert.throws(() => mergeReads(issue, { ai_lens: lens, reads: [read("r1")] }), /missing r2/);
});
