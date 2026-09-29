// Pure helpers shared by app.js; no DOM access, so they can be tested in Node.
export const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "#");

// First sentence of a paragraph: a sentence end followed by a capital, a quote,
// a bracket or the end of the text. Abbreviations like "U.S. officials" survive.
export const firstSentence = (t) => (t.match(/^.*?[.!?](?=\s+[A-Z(“"']|$)/)?.[0] ?? t).trim();

export function ago(iso, now = Date.now()) {
  if (!iso) return "";
  const mins = Math.max(1, Math.round((now - new Date(iso)) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

// Minimal Markdown for deep-research output: headings, lists, paragraphs, links, bold, italics.
export function markdown(md) {
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
