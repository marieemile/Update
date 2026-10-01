import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPipeline, deepDive } from "./pipeline.js";
import { listBriefingDates, listReadsDates, loadBriefing, loadConfig, loadReads, saveInterests } from "./store.js";

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".ico": "image/png", ".webmanifest": "application/manifest+json" };

// One refresh at a time; the UI polls /api/status for progress.
const refresh = { running: false, log: [], error: null, finished_at: null };
const deepdivesInFlight = new Map();

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

async function api(req, res, url) {
  const route = `${req.method} ${url.pathname}`;
  switch (route) {
    case "GET /api/dates":
      return send(res, 200, listBriefingDates());
    case "GET /api/briefing": {
      const date = url.searchParams.get("date") || listBriefingDates()[0];
      const briefing = date && loadBriefing(date);
      return briefing ? send(res, 200, briefing) : send(res, 404, { error: "No briefing yet" });
    }
    case "GET /api/reads/dates":
      return send(res, 200, listReadsDates());
    case "GET /api/reads": {
      const date = url.searchParams.get("date") || listReadsDates()[0];
      const reads = date && loadReads(date);
      return reads ? send(res, 200, reads) : send(res, 404, { error: "No founder reads yet" });
    }
    case "GET /api/config":
      return send(res, 200, loadConfig());
    case "POST /api/interests":
      return send(res, 200, saveInterests(await readBody(req)));
    case "GET /api/status":
      return send(res, 200, refresh);
    case "POST /api/refresh": {
      if (refresh.running) return send(res, 409, { error: "Already running" });
      Object.assign(refresh, { running: true, log: [], error: null });
      const log = (line) => (refresh.log.push(line), console.log(line));
      runPipeline({ log })
        .catch((err) => ((refresh.error = err.message), console.error(err)))
        .finally(() => Object.assign(refresh, { running: false, finished_at: new Date().toISOString() }));
      return send(res, 202, { started: true });
    }
    case "POST /api/deepdive": {
      const { date, id } = await readBody(req);
      if (typeof date !== "string" || typeof id !== "string") return send(res, 400, { error: "date and id are required" });
      const key = `${date}/${id}`;
      if (!deepdivesInFlight.has(key)) {
        deepdivesInFlight.set(key, deepDive(date, id).finally(() => deepdivesInFlight.delete(key)));
      }
      try {
        return send(res, 200, await deepdivesInFlight.get(key));
      } catch (err) {
        return send(res, 500, { error: err.message });
      }
    }
    default:
      return send(res, 404, { error: "Not found" });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    const file = path.join(PUBLIC, url.pathname === "/" ? "index.html" : path.normalize(url.pathname));
    // Directories exist too, but streaming one fails with EISDIR.
    if (!file.startsWith(PUBLIC + path.sep) || !fs.statSync(file, { throwIfNoEntry: false })?.isFile()) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-cache" });
    fs.createReadStream(file)
      .on("error", (err) => (console.error(err), res.destroy()))
      .pipe(res);
  } catch (err) {
    console.error(err);
    send(res, 500, { error: err.message });
  }
});

const port = Number(process.env.PORT) || loadConfig().port || 4747;
server.listen(port, "127.0.0.1", () => console.log(`Personal Intelligence Feed on http://localhost:${port}`));
