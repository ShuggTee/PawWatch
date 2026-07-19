// PawWatch unified server: Hono API + static frontend on port 3000
import { Hono } from "hono";
import apiApp from "./server/index";
import { waitForDb } from "./server/db";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const PORT = 3000;
const HOST = "0.0.0.0";
const DIST_DIR = join(import.meta.dir, "dist");

// Ensure database is initialized before handling requests
await waitForDb();

const app = new Hono();

// Mount the API app at /api
app.route("/api", apiApp);

// MIME types for static files
const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

// Catch-all: serve static files, SPA fallback to index.html
app.get("*", (c) => {
  const url = new URL(c.req.url);
  let filePath = url.pathname === "/" ? "/index.html" : url.pathname;

  // Remove trailing slash
  if (filePath.endsWith("/") && filePath !== "/") {
    filePath = filePath.slice(0, -1);
  }

  const fullPath = join(DIST_DIR, filePath);

  // Try to serve exact file
  if (existsSync(fullPath)) {
    const ext = extname(fullPath);
    const mimeType = MIME[ext] || "application/octet-stream";
    try {
      const content = readFileSync(fullPath);
      return new Response(content, {
        headers: { "Content-Type": mimeType },
      });
    } catch {
      // fall through to SPA fallback
    }
  }

  // SPA fallback
  const indexPath = join(DIST_DIR, "index.html");
  if (existsSync(indexPath)) {
    const content = readFileSync(indexPath);
    return new Response(content, {
      headers: { "Content-Type": "text/html" },
    });
  }

  return new Response("Not Found", { status: 404 });
});

const freePort =
  `for _ in $(seq 1 25); do ` +
  `pids=$(lsof -t -iTCP:${String(PORT)} -sTCP:LISTEN 2>/dev/null || true); ` +
  `if [ -z "$pids" ]; then exit 0; fi; ` +
  `kill $pids 2>/dev/null || true; sleep 0.2; ` +
  `done`;

for (let attempt = 1; ; attempt++) {
  await Bun.$`sudo sh -c ${freePort}`.quiet().nothrow();
  try {
    Bun.serve({
      port: PORT,
      hostname: HOST,
      fetch: app.fetch,
    });
    break;
  } catch (err) {
    if (attempt >= 10) throw err;
    await Bun.sleep(200);
  }
}

console.log(`🐾 PawWatch serving on http://${HOST}:${String(PORT)}`);
