import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.PIF_MODEL || "claude-opus-5-5";

let _client;
export function client() {
  // Resolves ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / an `ant auth login` profile.
  _client ??= new Anthropic();
  return _client;
}

// Server-side refusal fallback: a declined request is re-run on Anthropic's
// recommended fallback model inside the same call.
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };

function logUsage(label, msg, started) {
  const u = msg.usage;
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  console.log(
    `  [${label}] ${secs}s  in=${u.input_tokens} cache_read=${u.cache_read_input_tokens ?? 0} out=${u.output_tokens}  (${msg.model})`,
  );
}

function checkStop(label, msg) {
  if (msg.stop_reason === "refusal") {
    throw new Error(`${label}: model declined (${msg.stop_details?.category ?? "no category"})`);
  }
  if (msg.stop_reason === "max_tokens") {
    throw new Error(`${label}: hit max_tokens, output truncated`);
  }
}

// One structured-output call: returns parsed JSON matching `schema`.
export async function structured({ label, system, user, schema, effort = "high", maxTokens = 64000 }) {
  const started = Date.now();
  const stream = client().beta.messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    ...FALLBACK,
    thinking: { type: "adaptive" },
    output_config: { effort, format: { type: "json_schema", schema } },
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });
  const msg = await stream.finalMessage();
  logUsage(label, msg, started);
  checkStop(label, msg);
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return JSON.parse(text);
}

// Free-form research with web search + fetch. Returns { markdown, citations }.
export async function research({ label, system, user, effort = "high" }) {
  const started = Date.now();
  const messages = [{ role: "user", content: user }];
  let msg;
  for (let turn = 0; turn < 6; turn++) {
    msg = await client()
      .beta.messages.stream({
        model: MODEL,
        max_tokens: 32000,
        ...FALLBACK,
        thinking: { type: "adaptive" },
        output_config: { effort },
        system,
        tools: [
          { type: "web_search_20260209", name: "web_search", max_uses: 8 },
          { type: "web_fetch_20260209", name: "web_fetch", max_uses: 6 },
        ],
        messages,
      })
      .finalMessage();
    // Long server-tool turns pause; append the paused turn and resend to continue.
    if (msg.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: msg.content });
  }
  logUsage(label, msg, started);
  checkStop(label, msg);

  let markdown = "";
  const citations = new Map();
  for (const block of msg.content) {
    if (block.type !== "text") continue;
    markdown += block.text;
    for (const c of block.citations ?? []) {
      if (c.url) citations.set(c.url, c.title || c.url);
    }
  }
  return { markdown: markdown.trim(), citations: [...citations].map(([url, title]) => ({ url, title })) };
}
