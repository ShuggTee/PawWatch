// Production static file server for PawWatch SPA.
// Serves built files from dist/ and falls back to index.html for client-side routing.
const PORT = 3000;
const HOST = "0.0.0.0";
const DIST_DIR = `${import.meta.dir}/dist`;

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
      async fetch(req) {
        const { pathname } = new URL(req.url);
        // Try to serve a static file
        let filePath = pathname === "/" ? "/index.html" : pathname;
        const file = Bun.file(DIST_DIR + filePath);
        if (await file.exists()) {
          return new Response(file);
        }
        // SPA fallback: serve index.html for any unmatched route
        const indexFile = Bun.file(DIST_DIR + "/index.html");
        if (await indexFile.exists()) {
          return new Response(indexFile);
        }
        return new Response("Not Found", { status: 404 });
      },
    });
    break;
  } catch (err) {
    if (attempt >= 10) throw err;
    await Bun.sleep(200);
  }
}

console.log(`PawWatch serving on http://${HOST}:${String(PORT)}`);
