// PawWatch Vercel serverless function handler.
// Entry point for Vercel Build Output API — bundled into a single .mjs file by build-vercel.sh.
// Handles API routes (Hono) at /api/* and serves static files + SPA fallback from dist/.
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import apiApp from "./server/index";
import { waitForDb } from "./server/db";

const DIST_DIR = join(import.meta.dir, "dist");

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
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

function serveStatic(pathname: string): Response | null {
  let filePath = pathname === "/" ? "/index.html" : pathname;
  if (filePath.endsWith("/") && filePath !== "/") {
    filePath = filePath.slice(0, -1);
  }
  const fullPath = join(DIST_DIR, filePath);

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

  // SPA fallback — serve index.html for any non-file route
  const indexPath = join(DIST_DIR, "index.html");
  if (existsSync(indexPath)) {
    return new Response(readFileSync(indexPath), {
      headers: { "Content-Type": "text/html" },
    });
  }

  return null;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // Ensure DB is initialized (lazy Turso connect on cold start)
  await waitForDb();

  const url = new URL(
    req.url || "/",
    `https://${req.headers.host || "localhost"}`,
  );
  const pathname = url.pathname;

  // ── API routes ──
  if (pathname.startsWith("/api")) {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) for (const v of value) headers.append(key, v);
      else if (value != null) headers.set(key, value);
    }

    let body: string | null = null;
    if (req.method !== "GET" && req.method !== "HEAD") {
      body = await new Promise<string>((resolve) => {
        let data = "";
        req.on("data", (chunk: string) => (data += chunk));
        req.on("end", () => resolve(data));
      });
    }

    const webReq = new Request(url.toString(), {
      method: req.method || "GET",
      headers,
      ...(body !== null ? { body } : {}),
    });

    try {
      const webRes = await apiApp.fetch(webReq);
      res.statusCode = webRes.status;
      webRes.headers.forEach((value, key) => res.setHeader(key, value));
      if (webRes.body) {
        const reader = webRes.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      }
      res.end();
    } catch (error) {
      console.error("[pawwatch] API error:", error);
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain");
      res.end("Internal Server Error");
    }
    return;
  }

  // ── Static files + SPA fallback ──
  const staticResponse = serveStatic(pathname);
  if (staticResponse) {
    res.statusCode = staticResponse.status;
    staticResponse.headers.forEach((value, key) => res.setHeader(key, value));
    if (staticResponse.body) {
      const reader = staticResponse.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
    return;
  }

  res.statusCode = 404;
  res.end("Not Found");
}
