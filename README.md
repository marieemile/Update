# Daily Bite: Personal Intelligence Feed

A personal news intelligence system. It doesn't try to tell you everything. It tells you what changed in the world and in technology, why it matters, and what to watch.

## How it works

```
~65 RSS sources (tiered: primary → journalism → specialist → discovery)
        │
   1. Ingest        fetch in parallel, exact dedupe            src/ingest.js
        │
   2. Triage        cluster same-event articles, drop trivia,  (Claude, medium effort)
        │           score importance/impact/novelty/credibility/long-term
        │
   3. World agent ─┬─ Tech agent   write story cards in parallel   (Claude, high effort)
        │
   4. Signal detector  cross-story patterns, trend dashboard,       (Claude, high effort)
        │              watchlist, "if you only read one thing"
        │
   data/briefings/YYYY-MM-DD.json  →  web app (localhost:4747)
```

Each story card has: what happened, why it matters, what changed (before/now), what to watch, confidence, a timeline for continuing stories, and deduplicated sources that note what each one adds.

**Explain this to me** on any story runs a deep-research agent with web search and fetch, then caches the result.

The editorial rules (importance over popularity, balanced good and bad news, facts kept separate from claims, political neutrality, no sensationalism) are in [`src/prompts.js`](src/prompts.js).

## Design

The UI follows the **Cobalt Pulse** design system from the Stitch project (Inter, electric cobalt, white cards on a slate canvas). It is mobile first: a floating bottom dock on phones, and a left sidebar with multi-column grids from 768px up. It has four sections:

- **Briefing**: the "if you only read one thing" capsule, the essential-stories carousel, filtered story tiles, the top signal and the watchlist
- **Radar**: search, emerging signals, and a live wire of every story by time
- **Analysis**: the "What's changing" trend dashboard
- **Reads**: the weekly founder reading list with its AI lens (see Founder reads below)
- **My Signal**: interest weights (saved to `config.json`), the surprise-me count, saved stories and past briefings

Tapping a story opens the deep-dive page, with takeaways, confidence, the score breakdown, what changed, a timeline, sources and on-demand deep research.

## Setup

Requires Node 20+ and an Anthropic API key.

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npm start            # http://localhost:4747, then press "Generate today's briefing"
```

Or from the terminal:

```bash
npm run brief        # full pipeline, writes data/briefings/<today>.json
npm run ingest       # fetch sources only (no API calls), useful for testing feeds
```

### Without an API key ("chat mode")

Claude can act as the agents from inside a Claude Code or Claude desktop chat:

```bash
npm run chat:fetch    # fetch sources -> data/inbox/<date>-items.json
# ask Claude: "write today's briefing draft" -> data/inbox/<date>-draft.json
npm run chat:finish   # attach images/times, merge trends, save the briefing
```

## Tracked markets

`config.json` → `markets` lists markets followed closely in every briefing: **Intellectual Property** (`ip`) and **Real Estate** (`real_estate`, Europe with a Portugal focus: law and tax changes, proptech tools, market data). They have dedicated feeds in `src/sources.js` (`market: ...`), but stories from any source can be tagged. The agents follow `MARKETS_RULES` in `src/prompts.js`, add up to `stories_per_market` stories for each market, and tag stories and trends with a `markets` array. In the app, the Briefing tab has a large card for each market that opens a market page (`#/market/<id>`) with its stories, related signals and trends. Market filters also appear on the Briefing and Radar pills.

## 5- and 15-minute modes

- **5 min:** a text-first, numbered list of the essential stories (headline plus a one-sentence summary), the market cards, the top signal, the top three watchlist items, and a button to open the full edition. No image carousel.
- **15 min:** the full edition: the image carousel, filter pills, every story with the full write-up (what happened, why it matters, what changed), all signals and the full watchlist.

The 5/15 control is a sliding switch. Sliding it to 15 min expands the top card in place with a "Today in brief" summary: the essential world and tech stories, the lead story for each tracked market, and the main signal, each with why it matters. The rest of the page then changes to the full edition. The read-time label is calculated from the words each mode actually shows.

## Founder reads

A weekly reading list from [Founder Weekly](https://www.founderweekly.com), on the **Reads** tab with a teaser card on the Briefing. Founder Weekly has no RSS feed, so `src/founder-weekly.js` parses the issue page itself: each linked piece, its section and the newsletter's blurb, with sponsored blocks left out. It also fetches the opening text of each piece, so the curator judges the article and not just the pitch.

A curator then marks every piece **must** (at most three), **worth** or **skip**, says why, and notes its AI angle. It also writes an **AI lens**: what this week's essays say about how AI is changing how companies are built, sold, staffed and funded, set against the tech trends and headlines from your briefings. Themes link to the matching trend on the Analysis tab.

```bash
npm run reads:fetch    # latest issue -> data/inbox/reads-<date>-items.json (or pass an issue URL)
npm run reads:draft    # curate with the API -> data/inbox/reads-<date>-draft.json
# or, without an API key, ask Claude in chat: "draft this week's founder reads"
npm run reads:finish   # validate, save data/reads/<date>.json and publish public/reads/
```

`finish` takes titles and URLs from the parsed issue rather than the draft, rejects drafts that cite unknown or skip existing pieces, and drops trend links that don't exist.

## Publishing (Vercel)

The live site is a static deployment of `public/` (see `vercel.json`); `src/server.js` doesn't run there. Every saved briefing is also copied to `public/briefings/` (`<date>.json`, `index.json`, `config.json`). When `/api/*` isn't available, the app reads those files and runs read-only: no Refresh, deep research or interest editing. Committing and pushing `public/briefings/` to `main` publishes a new briefing; the morning scheduled task does this automatically.

## Configuration

- **`config.json`**: interest weights (these nudge selection but never override importance), the number of "surprise me" stories outside your interests (`surprise_me`, capped at `surprise_max`), the tracked `markets`, the lookback window and the port. Market ids here drive the agents' output schemas; give a new market an icon in `MARKET_STYLE` (`public/app.js`), colours in `styles.css` and a description in `MARKETS_RULES` (`src/prompts.js`).
- **`src/sources.js`**: add or remove feeds and set their tier. Reuters, AP, Bloomberg and WSJ don't offer open RSS; add a feed there if you have one. FT, NYT and Law360 are paywalled, but their feeds still carry headlines and summaries.
- **`PIF_MODEL`** env var: overrides the model (default `claude-opus-5-5`).

## Cost

A briefing makes four model calls with roughly 60–100K input tokens in total, which works out to around $0.50–$1.50 per day on Claude Opus 5.5. A deep dive costs extra for each story you open.

## Layout

```
src/sources.js    feed registry with tiers
src/ingest.js     fetch + exact dedupe, URL normalising
src/prompts.js    editorial charter and per-agent instructions
src/schemas.js    structured-output schemas (built from config.json markets)
src/claude.js     API wrapper (structured output, research loop, refusal fallback)
src/pipeline.js   triage → world/tech agents → signal detector; deep dive
src/store.js      briefings, trend history, deep-dive cache (data/), static publish
src/server.js     local HTTP server + API
src/run.js        CLI entry for `npm run brief` / `npm run ingest`
src/chat-mode.js  API-key-free pipeline driven from a Claude chat
src/founder-weekly.js  Founder Weekly issue parser and article fetcher
src/reads.js      founder reads CLI (fetch → draft → finish)
public/           web app (index.html, styles.css, app.js, lib.js, logo.svg)
public/briefings/ static copies of briefings for the Vercel site
public/reads/     static copies of founder reads issues
test/             `npm test` (node:test, no extra dependencies)
```
