// Pulse - personal intelligence feed. Hash routes:
//   #/briefing  #/radar  #/analysis  #/signal  #/story/<id>  #/signal-detail/<n>
const state = { briefing: null, dates: [], config: null, mode: "five", filter: "top", radarFilter: "all", query: "", deepdive: {} };
const view = document.getElementById("view");
const $ = (s) => document.querySelector(s);

const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
};
state.mode = store.get("pulse-mode", "five");
let saved = new Set(store.get("pulse-saved", []));

// ---------- utils ----------
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "#");
const ms = (name, cls = "") => `<span class="ms ${cls}" aria-hidden="true">${name}</span>`;

async function api(url, opts) {
  const res = await fetch(url, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || res.statusText), { status: res.status });
  return body;
}

function ago(iso) {
  if (!iso) return "";
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso)) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}
const fmtDate = (d, opts = { weekday: "long", month: "long", day: "numeric" }) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, opts);

const AVATAR_COLORS = ["#0050cb", "#565e74", "#007aa5", "#0d9488", "#6366f1", "#ba1a1a", "#ea580c", "#0b1c30"];
function avatar(name, cls = "") {
  const initials = name.replace(/^The /, "").split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `<span class="avatar ${cls}" style="background:${AVATAR_COLORS[h % AVATAR_COLORS.length]}">${esc(initials)}</span>`;
}
const TIER_LABEL = { 1: "Primary source", 2: "Established journalism", 3: "Specialist publication", 4: "Discovery source" };
const verified = (tier) => (tier <= 2 ? ms("verified", "verified") : "");
const lead = (s) => [...s.sources].sort((a, b) => a.tier - b.tier)[0] ?? { name: "Unknown", tier: 4 };
const topCategory = (s) => (s.categories[0] || (s.domain === "world" ? "World" : "Tech")).split("/")[0].trim();

function media(s) {
  const fallback = `<div class="placeholder ${s.domain}">${ms(s.domain === "world" ? "public" : "memory")}</div>`;
  if (!s.image) return fallback;
  // On load failure swap in the placeholder rather than showing a broken image.
  return `<img src="${esc(s.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML=this.nextElementSibling.innerHTML"><template>${fallback}</template>`;
}

function badge(s) {
  if (s.positive) return `<span class="chip good">${ms("trending_up")}Progress</span>`;
  if (s.under_the_radar) return `<span class="chip warn">${ms("visibility")}Under the radar</span>`;
  if (s.outside_interests) return `<span class="chip muted">${ms("explore")}Outside usual</span>`;
  if (s.scores.impact >= 4) return `<span class="chip muted">${ms("offline_bolt")}High impact</span>`;
  return `<span class="chip soft">${ms("insights")}${s.signal_score}/25</span>`;
}

const stories = (f = () => true) => (state.briefing?.stories ?? []).filter(f);
const byId = (id) => state.briefing?.stories.find((s) => s.id === id);
const inMode = (s) => state.mode === "fifteen" || s.level === "essential";

// ---------- components ----------
function heroCard(s) {
  const src = lead(s);
  return `
  <a class="hero" href="#/story/${s.id}">
    <div class="media">${media(s)}</div>
    <div class="hero-body">
      <div class="hero-tags"><span class="chip ${s.domain}">${esc(topCategory(s).toUpperCase())}</span>
        ${s.positive ? `<span class="chip glass">${ms("trending_up")}Progress</span>` : s.under_the_radar ? `<span class="chip glass">${ms("visibility")}Under the radar</span>` : `<span class="chip glass">${ms("bolt")}Essential</span>`}</div>
      <h3>${esc(s.headline)}</h3>
      <div class="hero-foot">
        <span class="src"><span>${esc(src.name)}</span>${verified(src.tier)}<span class="time">${s.published ? "· " + ago(s.published) : ""}</span></span>
        <button class="glass-btn" data-save="${s.id}" aria-label="${saved.has(s.id) ? "Remove from saved" : "Save story"}">${ms("bookmark", saved.has(s.id) ? "fill" : "")}</button>
      </div>
    </div>
  </a>`;
}

function tile(s, { timeRight = false } = {}) {
  const src = lead(s);
  return `
  <a class="card tile" href="#/story/${s.id}">
    <div class="thumb">${media(s)}<span class="tag">${s.domain}</span></div>
    <div class="tile-body">
      <div class="tile-top"><span class="cat ${s.domain}">${esc(s.categories.join(" · "))}</span>${timeRight ? "" : badge(s)}</div>
      <h3>${esc(s.headline)}</h3>
      <div class="src-row">${avatar(src.name)}<b>${esc(src.name)}</b>${verified(src.tier)}
        ${s.sources.length > 1 ? `<span>+${s.sources.length - 1}</span>` : ""}<span class="time">${esc(ago(s.published))}</span></div>
    </div>
  </a>`;
}
const tileList = (list, opts) => (list.length ? `<div class="tiles">${list.map((s) => tile(s, opts)).join("")}</div>` : `<div class="card empty-note">Nothing here today.</div>`);

function sectionHead(title, { icon, live, sub, action } = {}) {
  return `<div class="section-head"><div><h2>${live ? `<span class="live-dot"></span>` : ""}${icon ? ms(icon) : ""}${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ""}</div>${action ?? ""}</div>`;
}

function watchlist() {
  const w = state.briefing.watchlist;
  if (!w.length) return "";
  return `<section class="section">${sectionHead("Watchlist", { icon: "visibility", sub: "Worth monitoring over the coming days" })}
    <div class="watch-list">${w.map((x) => `<div class="card watch-item">${ms("radar")}<div><b>${esc(x.item)}</b><span>${esc(x.why)}</span></div></div>`).join("")}</div></section>`;
}

function progressCard() {
  if (!refresh.active) return "";
  const pct = Math.min(95, 8 + refresh.log.length * 13);
  return `<div class="card progress ${refresh.error ? "failed" : ""}">
    <div class="progress-top">${ms(refresh.error ? "error" : "progress_activity")}${refresh.error ? "Briefing failed" : "Building today's briefing…"}</div>
    ${refresh.error ? "" : `<div class="progress-bar"><i style="width:${pct}%"></i></div>`}
    <pre>${esc(refresh.log.join("\n"))}${refresh.error ? `\n\n<span class="error-text">${esc(refresh.error)}</span>` : ""}</pre></div>`;
}

// ---------- views ----------
function emptyView() {
  return `<div class="wrap">${progressCard()}<div class="empty">
    <img src="/logo.svg" alt="" width="64" height="64" />
    <h1>No briefing yet</h1>
    <p>Pulse reads about 35 sources, groups duplicate coverage into single stories, scores them for importance rather than popularity, and writes up what's worth knowing. It takes a few minutes.</p>
    <button class="btn-primary" style="max-width:320px" data-action="refresh" ${refresh.active && !refresh.error ? "disabled" : ""}>${ms("bolt")}Generate today's briefing</button>
  </div></div>`;
}

const VIEWS = {
  briefing() {
    const b = state.briefing;
    const visible = stories(inMode);
    const featured = stories((s) => s.level === "essential").sort((a, b) => b.signal_score - a.signal_score).slice(0, 3);
    const featuredIds = new Set(featured.map((s) => s.id));
    const filters = [
      ["top", "Top signal", (s) => !featuredIds.has(s.id)],
      ["world", "World", (s) => s.domain === "world"],
      ["tech", "Tech", (s) => s.domain === "tech"],
      ["positive", "Progress", (s) => s.positive],
      ["missed", "Missed", (s) => s.under_the_radar || s.outside_interests],
    ];
    const [, , active] = filters.find(([k]) => k === state.filter) ?? filters[0];
    const list = visible.filter(active).sort((a, b) => b.signal_score - a.signal_score);
    const sourceNames = [...new Set(b.stories.flatMap((s) => s.sources.map((x) => x.name)))];
    const minutes = state.mode === "five" ? 5 : 15;
    const sig = b.signals[0];

    return `<div class="wrap">
      ${progressCard()}
      <section class="pad"><div class="card capsule">
        <div class="capsule-top">
          <div><span class="chip status-chip"><i></i>${esc(fmtDate(b.date, { weekday: "long" }))} briefing</span>
            <span class="meta">${ms("schedule")}${minutes} min read</span></div>
          <div class="seg" role="group" aria-label="Briefing length">
            <button data-mode="five" class="${state.mode === "five" ? "on" : ""}">5 min</button>
            <button data-mode="fifteen" class="${state.mode === "fifteen" ? "on" : ""}">15 min</button></div>
        </div>
        <div><h1>If you only read one thing</h1><p class="topline">${esc(b.top_line)}</p></div>
        <div class="capsule-foot">
          <span><span class="avatars">${sourceNames.slice(0, 3).map((n) => avatar(n)).join("")}</span>Synthesized from ${b.stats.items} items across ${b.stats.sources_ok} sources</span>
          <span>${visible.length} stories · ${b.stats.clusters} clusters reviewed</span>
        </div>
      </div></section>

      <section class="section">
        ${sectionHead("Essential intelligence", { live: true, action: `<a class="link" href="#/radar">View all</a>` })}
        <div class="carousel" id="carousel">${featured.map(heroCard).join("")}</div>
        ${featured.length > 1 ? `<div class="dots" id="dots">${featured.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>` : ""}
      </section>

      <section class="section">
        <div class="pills" role="tablist">${filters.map(([k, label, f]) => `<button class="pill ${k === state.filter ? "on" : ""}" data-filter="${k}">${label} (${visible.filter(f).length})</button>`).join("")}</div>
        <div style="height:16px"></div>
        ${sectionHead(state.filter === "missed" ? "You might have missed" : "Worth knowing", { sub: state.filter === "missed" ? "Under-covered, or outside your usual interests" : "Ranked by importance, not popularity" })}
        ${list.length || state.filter !== "top" ? tileList(list) : `<div class="card empty-note">That's everything essential today.
          <div style="margin-top:12px"><button class="btn-secondary" data-mode="fifteen">${ms("add")}Show the 15-minute briefing</button></div></div>`}
      </section>

      ${sig ? `<section class="section pad"><a class="banner" href="#/signal-detail/0">
        <div><small>Signal detected · ${sig.evidence_story_ids.length} stories</small><b>${esc(sig.title)}</b><span>Something bigger may be happening. See the evidence.</span></div>
        <span class="round">${ms("arrow_forward")}</span></a></section>` : ""}

      ${watchlist()}
    </div>`;
  },

  radar() {
    const b = state.briefing;
    const q = state.query.trim().toLowerCase();
    const cats = [...new Set(b.stories.map(topCategory))].slice(0, 8);
    const filterFn = (s) =>
      (state.radarFilter === "all" || s.domain === state.radarFilter || topCategory(s) === state.radarFilter) &&
      (!q || `${s.headline} ${s.categories.join(" ")} ${s.what_happened} ${s.sources.map((x) => x.name).join(" ")}`.toLowerCase().includes(q));
    const list = stories(filterFn).sort((a, b) => (b.published ?? "").localeCompare(a.published ?? ""));
    return `<div class="wrap">
      <label class="search">${ms("search")}<span class="sr">Search stories</span>
        <input id="search" type="search" placeholder="Search stories, sources, topics" value="${esc(state.query)}" autocomplete="off" /></label>
      <div style="height:14px"></div>
      <div class="pills">${[["all", "All signals"], ["world", "World"], ["tech", "Tech"], ...cats.map((c) => [c, c])]
        .map(([k, l]) => `<button class="pill ${state.radarFilter === k ? "on" : ""}" data-radar="${esc(k)}">${esc(l)}</button>`).join("")}</div>

      <section class="section">
        ${sectionHead("Emerging signals", { icon: "radar", sub: "Patterns across several stories", action: `<a class="link" href="#/analysis">Trends</a>` })}
        ${b.signals.length ? `<div class="signal-row">${b.signals.map((sig, i) => `
          <a class="card signal-card" href="#/signal-detail/${i}">
            <div class="row"><span class="chip ${sig.domain === "cross" ? "solid" : sig.domain}">${sig.domain === "cross" ? "Cross-domain" : sig.domain === "world" ? "World" : "Tech"}</span>
              <span class="count">${ms("trending_up")}${sig.evidence_story_ids.length} stories</span></div>
            <h3>${esc(sig.title)}</h3><p>${esc(sig.what)}</p>
            <div class="foot">${ms("fact_check")}<span>What would confirm it</span><span>${ms("chevron_right")}</span></div>
          </a>`).join("")}</div>` : `<div class="card empty-note">No cross-story patterns stood out today. That's allowed.</div>`}
      </section>

      <section class="section">
        ${sectionHead("Live wire", { live: true, action: `<span class="meta">${list.length} stories</span>` })}
        ${tileList(list, { timeRight: true })}
      </section>
    </div>`;
  },

  analysis() {
    const t = state.briefing.trends;
    const card = (x) => `
      <div class="card trend">
        <div class="trend-top"><span class="chip ${x.status === "accelerating" ? "solid" : x.status === "cooling" ? "muted" : "soft"}">${esc(x.status)}</span>
          <span class="dir ${x.direction}" aria-label="${x.direction}">${ms({ up: "north_east", steady: "east", down: "south_east" }[x.direction])}</span></div>
        <h3>${esc(x.name)}</h3><p>${esc(x.summary)}</p>
        ${x.recent_developments.length ? `<ul>${x.recent_developments.slice(0, 3).map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}
        <p><b>Watch:</b> ${esc(x.what_to_watch)}</p>
        <div class="since"><span>Tracked since ${esc(fmtDate(x.first_detected, { month: "short", day: "numeric" }))}</span><span>${x.evidence_story_ids.length} stories today</span></div>
      </div>`;
    const group = (d) => t.filter((x) => x.domain === d);
    return `<div class="wrap">
      ${sectionHead("What's changing", { icon: "monitoring", sub: "Descriptive trend states built from the stories. Not predictions." })}
      ${sectionHead("World", {})}<div class="trend-grid">${group("world").map(card).join("") || `<div class="card empty-note">No world trends yet.</div>`}</div>
      <div class="section">${sectionHead("Technology", {})}<div class="trend-grid">${group("tech").map(card).join("") || `<div class="card empty-note">No tech trends yet.</div>`}</div></div>
      ${watchlist()}
    </div>`;
  },

  signal() {
    const c = state.config;
    const b = state.briefing;
    const savedStories = [...saved].map(byId).filter(Boolean);
    const ICONS = { AI: "neurology", Product: "deployed_code", Startups: "rocket_launch", Robotics: "precision_manufacturing", Space: "satellite_alt", Chips: "memory", Quantum: "blur_on",
      Geopolitics: "public", Economy: "monitoring", Climate: "eco", Science: "science", Society: "groups" };
    const slider = (area, topic, w) => `
      <div class="card stream"><span class="stream-icon">${ms(ICONS[topic] ?? "tune")}</span>
        <div class="stream-body"><b>${esc(topic)} <output>${w}/10</output></b>
          <input type="range" min="0" max="10" step="1" value="${w}" style="--pct:${w * 10}%" data-area="${area}" data-topic="${esc(topic)}" aria-label="${esc(topic)} interest weight" /></div></div>`;
    return `<div class="wrap">
      <section class="pad"><div class="card engine">
        <img src="/logo.svg" alt="" width="60" height="60" />
        <div><b>Your feed engine</b>
          <small>${b ? `Last briefing ${esc(fmtDate(b.date, { weekday: "short", month: "short", day: "numeric" }))} · ${new Date(b.generated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "No briefing yet"}</small>
          ${b ? `<span class="live">${ms("bolt")}${b.stats.sources_ok}/${b.stats.sources_total} sources · ${b.stats.items} items · ${b.stats.clusters} clusters</span>` : ""}</div>
      </div></section>

      <section class="section">
        ${sectionHead("Interest weights", { icon: "tune", sub: "Nudges selection between stories of similar importance. Never overrides importance." })}
        ${Object.entries(c.interests).map(([area, topics]) => `
          <div class="group-label">${esc(area)}</div>
          <div class="stack">${Object.entries(topics).map(([t, w]) => slider(area, t, w)).join("")}</div>`).join("")}
        <div class="group-label">Discovery</div>
        <div class="stack"><div class="card stream"><span class="stream-icon">${ms("shuffle")}</span>
          <div class="stream-body"><b>Surprise me</b><small>Important stories deliberately outside your interests</small></div>
          <div class="stepper"><button data-step="-1" aria-label="Fewer">${ms("remove")}</button><output id="surprise">${c.surprise_me}</output><button data-step="1" aria-label="More">${ms("add")}</button></div></div></div>
      </section>

      <section class="section">
        ${sectionHead("Saved stories", { icon: "bookmark", action: `<span class="meta">${savedStories.length} saved</span>` })}
        ${savedStories.length ? tileList(savedStories) : `<div class="card empty-note">Tap the bookmark on any story to keep it here.</div>`}
      </section>

      ${state.dates.length > 1 ? `<section class="section">${sectionHead("Past briefings", { icon: "history" })}
        <div class="date-list">${state.dates.map((d) => `<button class="pill ${d === b?.date ? "on" : ""}" data-date="${d}">${esc(fmtDate(d, { weekday: "short", month: "short", day: "numeric" }))}</button>`).join("")}</div></section>` : ""}

      <section class="section pad"><button class="btn-primary" id="save-interests" disabled>${ms("tune")}Save interests</button>
        <p class="meta" style="justify-content:center;margin-top:10px;display:flex">Applies from the next briefing.</p></section>
    </div>`;
  },

  story(id) {
    const s = byId(id);
    if (!s) return `<div class="wrap"><div class="card empty-note">Story not found.</div></div>`;
    const src = lead(s);
    const tiers = s.sources.reduce((acc, x) => ((acc[x.tier] = (acc[x.tier] || 0) + 1), acc), {});
    const tierText = Object.entries(tiers).map(([t, n]) => `${n} ${["", "primary", "journalism", "specialist", "discovery"][t]}`).join(" · ");
    const claim = { confirmed: "Confirmed", official_statement: "Official statement", reported: "Reported", allegation: "Allegation", analysis: "Analysis", mixed: "Mixed" }[s.claim_status];
    const sc = s.scores;
    const dd = state.deepdive[s.id];
    const bars = [["Importance", sc.importance], ["Impact", sc.impact], ["Novelty", sc.novelty], ["Credibility", sc.credibility], ["Long-term", sc.long_term]];
    return `<div class="article-wrap">
      <div class="article-hero"><div class="media">${media(s)}</div>
        <div class="article-hero-body">
          <div class="tags"><span class="chip ${s.domain}">${esc(s.categories[0] ?? s.domain)}</span>${s.categories.slice(1).map((c) => `<span class="chip glass">${esc(c)}</span>`).join("")}</div>
          <h1>${esc(s.headline)}</h1>
          <div class="sub"><span><b>Signal ${s.signal_score}/25</b></span>${s.published ? `<span>${ago(s.published)}</span>` : ""}<span>${ms("newsmode")} ${s.sources.length} source${s.sources.length > 1 ? "s" : ""}</span></div>
        </div></div>
      <div class="sheet">
        <div class="card source-card">${avatar(src.name, "lg")}
          <div class="who"><b><span>${esc(src.name)}</span>${verified(src.tier)}</b><small>${TIER_LABEL[src.tier]}${s.sources.length > 1 ? ` · +${s.sources.length - 1} more` : ""}</small></div>
          <a class="follow" href="${esc(safeUrl(src.url))}" target="_blank" rel="noopener">Read ${ms("open_in_new")}</a></div>

        <div class="takeaways">
          <div class="takeaways-head"><span>${ms("auto_awesome")}Key takeaways</span><span class="chip soft">AI synthesis</span></div>
          <ul>
            <li>${ms("check_circle")}<span><b>What happened:</b> ${esc(s.what_happened)}</span></li>
            <li>${ms("check_circle")}<span><b>What's new:</b> ${esc(s.whats_new.now)}</span></li>
            ${s.watch[0] ? `<li>${ms("check_circle")}<span><b>Watch:</b> ${esc(s.watch[0])}</span></li>` : ""}
          </ul></div>

        <div class="kicker">Confidence & verification</div>
        <div class="duo">
          <div class="card"><small>Confidence</small><b><i class="conf-dot ${s.confidence}"></i>${s.confidence[0].toUpperCase() + s.confidence.slice(1)}</b>${s.confidence_note ? `<p>${esc(s.confidence_note)}</p>` : ""}</div>
          <div class="card"><small>Source integrity</small><b>${ms("verified_user")}${esc(claim)}</b><p>${esc(tierText)}</p></div>
        </div>

        <div class="card scores"><div class="scores-head"><span>Story signal</span><b>${s.signal_score} / 25</b></div>
          ${bars.map(([l, v]) => `<div class="bar-row"><span>${l}</span><div class="bar"><i style="width:${v * 20}%"></i></div><b>${v}</b></div>`).join("")}</div>

        <div class="kicker">Why it matters</div>
        <div class="quote">${ms("lightbulb")}<p>${esc(s.why_it_matters)}</p><small>Pulse analysis</small></div>

        <div class="kicker">What changed</div>
        <div class="changed"><div class="card"><small>Before</small>${esc(s.whats_new.before)}</div><div class="card now"><small>Now</small>${esc(s.whats_new.now)}</div></div>

        ${s.timeline.length ? `<div class="kicker">Timeline</div><ol class="timeline">${s.timeline.map((t) => `<li><time>${esc(t.date)}</time>${esc(t.event)}</li>`).join("")}</ol>` : ""}

        ${s.watch.length ? `<div class="kicker">What to watch</div><ul class="watch-bullets">${s.watch.map((w) => `<li>${ms("arrow_right_alt")}${esc(w)}</li>`).join("")}</ul>` : ""}

        <div class="kicker">Sources</div>
        <div class="sources">${s.sources.map((x) => `
          <a class="card source" href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener">${avatar(x.name, "lg")}
            <div class="who"><b>${esc(x.name)}${verified(x.tier)}</b><small>${esc(x.adds)} · ${TIER_LABEL[x.tier]}</small></div>${ms("open_in_new")}</a>`).join("")}</div>

        <div class="kicker">Related intelligence clusters</div>
        <div class="tags-row">${s.categories.map((c) => `<button class="hashtag" data-topic-search="${esc(c.split("/").pop().trim())}">#${esc(c.replace(/\s*\/\s*/g, " "))}</button>`).join("")}</div>

        <div id="research">${dd ? researchBlock(dd) : ""}</div>
        <div style="height:90px"></div>
      </div>
      ${dd?.markdown ? "" : `<button class="float-pill ${dd?.loading ? "busy" : ""}" data-explain="${s.id}">
        <span class="ms eq" aria-hidden="true">graphic_eq</span>
        <div><b>${dd?.loading ? "Researching across sources…" : "Explain this to me"}</b><small>${dd?.loading ? "Usually one to three minutes" : "Deep research with web search"}</small></div>
        <span class="round">${ms(dd?.loading ? "progress_activity" : "arrow_forward")}</span></button>`}
    </div>`;
  },

  signalDetail(i) {
    const sig = state.briefing.signals[Number(i)];
    if (!sig) return `<div class="wrap"><div class="card empty-note">Signal not found.</div></div>`;
    return `<div class="wrap">
      <section class="pad"><div class="card capsule">
        <div class="capsule-top"><span class="chip ${sig.domain === "cross" ? "solid" : sig.domain}">${sig.domain === "cross" ? "Cross-domain signal" : sig.domain === "world" ? "World signal" : "Tech signal"}</span>
          <span class="meta">${ms("trending_up")}${sig.evidence_story_ids.length} stories</span></div>
        <div><h1 style="font-size:22px;line-height:28px;font-weight:700">${esc(sig.title)}</h1><p class="topline">${esc(sig.what)}</p></div>
      </div></section>
      <div class="kicker">Why it may matter</div>
      <div class="quote">${ms("lightbulb")}<p>${esc(sig.why_it_matters)}</p><small>Signal detector · not a prediction</small></div>
      <div class="duo">
        <div class="card"><small>Would confirm</small><p style="font-size:14px;line-height:20px;color:var(--ink)">${esc(sig.would_confirm)}</p></div>
        <div class="card"><small>Would invalidate</small><p style="font-size:14px;line-height:20px;color:var(--ink)">${esc(sig.would_invalidate)}</p></div>
      </div>
      <section class="section">${sectionHead("Evidence", { icon: "fact_check" })}${tileList(sig.evidence_story_ids.map(byId).filter(Boolean))}</section>
    </div>`;
  },
};

function researchBlock(dd) {
  if (dd.error) return `<div class="card research"><p class="error-text">Deep research failed: ${esc(dd.error)}</p></div>`;
  if (!dd.markdown) return "";
  return `<div class="kicker">Deep research</div><div class="card research">${markdown(dd.markdown)}
    ${dd.citations?.length ? `<h2>Cited while researching</h2><ul>${dd.citations.map((c) => `<li><a href="${esc(safeUrl(c.url))}" target="_blank" rel="noopener">${esc(c.title)}</a></li>`).join("")}</ul>` : ""}</div>`;
}

function markdown(md) {
  const inline = (t) => esc(t)
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<i>$2</i>");
  let html = "", list = null;
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const line of md.split("\n")) {
    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)/))) { close(); const l = m[1].length <= 2 ? 2 : 3; html += `<h${l}>${inline(m[2])}</h${l}>`; }
    else if ((m = line.match(/^\s*[-*]\s+(.*)/))) { if (list !== "ul") { close(); html += "<ul>"; list = "ul"; } html += `<li>${inline(m[1])}</li>`; }
    else if ((m = line.match(/^\s*\d+\.\s+(.*)/))) { if (list !== "ol") { close(); html += "<ol>"; list = "ol"; } html += `<li>${inline(m[1])}</li>`; }
    else if (line.trim()) { close(); html += `<p>${inline(line)}</p>`; }
    else close();
  }
  close();
  return html;
}

// ---------- routing & chrome ----------
const NAV = [["briefing", "home", "Briefing"], ["radar", "explore", "Radar"], ["analysis", "newspaper", "Analysis"], ["signal", "tune", "My Signal"]];
const SECTION = { briefing: "Briefing", radar: "Radar", analysis: "Analysis", signal: "My Signal" };

function route() {
  const [, name = "briefing", arg] = location.hash.match(/^#\/([\w-]+)(?:\/(.+))?/) ?? [];
  return { name: VIEWS[name] || name === "signal-detail" ? name : "briefing", arg };
}

function render({ keepScroll = false } = {}) {
  const { name, arg } = route();
  const detail = name === "story" || name === "signal-detail";
  const navKey = detail ? (name === "story" ? "briefing" : "radar") : name;
  document.querySelectorAll("[data-nav]").forEach((nav) => {
    nav.innerHTML = NAV.map(([k, icon, label]) => `<a href="#/${k}" class="${k === navKey ? "on" : ""}" ${k === navKey ? 'aria-current="page"' : ""}>${ms(icon, k === navKey ? "fill" : "")}<span>${label}</span></a>`).join("");
  });
  $("#section-label").textContent = SECTION[name] ?? "Briefing";
  $("#back").hidden = !detail;
  $("#brand").hidden = detail;
  $("#topbar-title").hidden = !detail;
  $("#topbar-title").textContent = name === "story" ? "Story deep dive" : "Signal";
  $("#search-btn").hidden = detail;
  const story = name === "story" ? byId(arg) : null;
  $("#share-btn").hidden = !story;
  $("#refresh-btn").hidden = detail;
  $("#refresh-btn").classList.toggle("spinning", refresh.active && !refresh.error);

  const y = window.scrollY;
  if (!state.briefing && name !== "signal") view.innerHTML = emptyView();
  else if (name === "signal-detail") view.innerHTML = VIEWS.signalDetail(arg);
  else view.innerHTML = VIEWS[name](arg);
  if (keepScroll) window.scrollTo(0, y);
  wireCarousel();
}

function wireCarousel() {
  const c = $("#carousel"), dots = $("#dots");
  if (!c || !dots) return;
  c.addEventListener("scroll", () => {
    const cards = [...c.children];
    const i = cards.reduce((best, el, idx) => (Math.abs(el.offsetLeft - c.scrollLeft - c.offsetLeft) < Math.abs(cards[best].offsetLeft - c.scrollLeft - c.offsetLeft) ? idx : best), 0);
    [...dots.children].forEach((d, idx) => d.classList.toggle("on", idx === i));
  }, { passive: true });
}

function toast(text) {
  const el = Object.assign(document.createElement("div"), { className: "toast", textContent: text });
  document.body.append(el);
  setTimeout(() => el.remove(), 1800);
}

// ---------- data loading ----------
async function load(date) {
  const [dates, config] = await Promise.all([api("/api/dates"), api("/api/config")]);
  state.dates = dates;
  state.config = config;
  state.briefing = dates.length ? await api(`/api/briefing?date=${date || dates[0]}`) : null;
  render();
}

const refresh = { active: false, log: [], error: null };
async function startRefresh() {
  try {
    await api("/api/refresh", { method: "POST" });
  } catch (err) {
    if (err.status !== 409) return toast(err.message);
  }
  Object.assign(refresh, { active: true, log: [], error: null });
  if (route().name !== "briefing") location.hash = "#/briefing";
  render();
  const poll = async () => {
    const st = await api("/api/status");
    refresh.log = st.log;
    if (st.running) { render({ keepScroll: true }); return setTimeout(poll, 1500); }
    if (st.error) { refresh.error = st.error; render({ keepScroll: true }); return; }
    Object.assign(refresh, { active: false });
    await load();
    toast("Briefing updated");
  };
  poll();
}

async function explain(id) {
  state.deepdive[id] = { loading: true };
  render({ keepScroll: true });
  try {
    state.deepdive[id] = await api("/api/deepdive", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: state.briefing.date, id }),
    });
  } catch (err) {
    state.deepdive[id] = { error: err.message };
  }
  if (route().arg === id) {
    render({ keepScroll: true });
    document.getElementById("research")?.scrollIntoView({ behavior: "smooth" });
  }
}

// ---------- events ----------
const pendingInterests = { interests: {}, surprise_me: null };

document.addEventListener("click", (e) => {
  const t = e.target.closest("button, a");
  if (!t) return;
  const d = t.dataset;
  if (d.save) {
    e.preventDefault();
    saved.has(d.save) ? saved.delete(d.save) : saved.add(d.save);
    store.set("pulse-saved", [...saved]);
    toast(saved.has(d.save) ? "Saved" : "Removed from saved");
    render({ keepScroll: true });
  } else if (d.mode) { state.mode = d.mode; store.set("pulse-mode", d.mode); render({ keepScroll: true }); }
  else if (d.filter) { state.filter = d.filter; render({ keepScroll: true }); }
  else if (d.radar) { state.radarFilter = d.radar; render({ keepScroll: true }); }
  else if (d.topicSearch) { state.query = d.topicSearch; state.radarFilter = "all"; location.hash = "#/radar"; }
  else if (d.explain) explain(d.explain);
  else if (d.action === "refresh" || t.id === "refresh-btn") startRefresh();
  else if (d.date) load(d.date).then(() => (location.hash = "#/briefing"));
  else if (d.step) {
    const out = $("#surprise");
    const v = Math.max(0, Math.min(4, Number(out.value || out.textContent) + Number(d.step)));
    out.textContent = v;
    pendingInterests.surprise_me = v;
    $("#save-interests").disabled = false;
  } else if (t.id === "save-interests") {
    t.disabled = true;
    api("/api/interests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pendingInterests) })
      .then((config) => { state.config = config; pendingInterests.interests = {}; pendingInterests.surprise_me = null; toast("Interests saved"); })
      .catch((err) => { t.disabled = false; toast(err.message); });
  } else if (t.id === "search-btn") {
    location.hash = "#/radar";
    setTimeout(() => $("#search")?.focus(), 50);
  } else if (t.id === "back") {
    history.length > 1 ? history.back() : (location.hash = "#/briefing");
  } else if (t.id === "share-btn") {
    const s = byId(route().arg);
    if (s) window.open(safeUrl(lead(s).url), "_blank", "noopener");
  }
});

document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.id === "search") {
    state.query = el.value;
    const pos = el.selectionStart;
    render({ keepScroll: true });
    const again = $("#search");
    again.focus();
    again.setSelectionRange(pos, pos);
  } else if (el.type === "range") {
    el.style.setProperty("--pct", `${el.value * 10}%`);
    el.closest(".stream-body").querySelector("output").textContent = `${el.value}/10`;
    (pendingInterests.interests[el.dataset.area] ??= {})[el.dataset.topic] = Number(el.value);
    $("#save-interests").disabled = false;
  }
});

window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });

load().catch((err) => (view.innerHTML = `<div class="card empty-note error-text">Could not load: ${esc(err.message)}</div>`));
api("/api/status").then((st) => { if (st.running) { refresh.active = true; startRefresh(); } }).catch(() => {});
