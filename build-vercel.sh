#!/usr/bin/env bash
# Build PawWatch for Vercel deployment (Build Output API v3).
# Produces .vercel/output with:
#   - Static SPA files from dist/ (built by Vite)
#   - Single serverless function bundling the Hono API + static file server
set -euo pipefail
cd "$(dirname "$0")"
umask 002

echo "[1/3] Installing dependencies"
bun install

echo "[2/3] Building frontend (Vite SPA → dist/)"
bun run build

echo "[3/3] Assembling .vercel/output (Build Output API v3)"
rm -rf .vercel/output
mkdir -p .vercel/output/functions/render.func

# Copy static SPA assets
cp -R dist .vercel/output/static

# Bundle the serverless handler (Hono API + static server) into a single .mjs file.
# --target node: produce ESM for Node.js runtime
# The handler reads env vars (TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, JWT_SECRET) at runtime.
bun build vercel-entry.ts --target node \
  --outfile .vercel/output/functions/render.func/index.mjs

# Vercel function config — Node.js 22 runtime, classic (req, res) launcher
cat > .vercel/output/functions/render.func/.vc-config.json <<'JSON'
{ "runtime": "nodejs22.x", "handler": "index.mjs", "launcherType": "Nodejs", "supportsResponseStreaming": true }
JSON

# Route config: try filesystem (static/) first, then fall through to the render function
cat > .vercel/output/config.json <<'JSON'
{ "version": 3, "routes": [ { "handle": "filesystem" }, { "src": "/(.*)", "dest": "/render" } ] }
JSON

echo "Done → .vercel/output ready for: bunx vercel deploy --prebuilt"
