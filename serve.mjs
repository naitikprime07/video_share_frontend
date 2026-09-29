// Tiny static server for local frontend development: npm run dev → http://localhost:5173
// No dependencies: the frontend is plain HTML/CSS/JS, so it only has to read files and set
// Content-Type. Any real host (Netlify, Cloudflare Pages, nginx) does the same thing in production.
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || 5173);

// Load .env (simple KEY=VALUE lines, # comments ignored) so the backend URL lives
// outside the code. A real environment variable always wins over the file value.
try {
  const text = await readFile(path.join(ROOT, '.env'), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    process.env[m[1]] ??= m[2].replace(/^((['"])(.*)\2)$/, '$3');
  }
} catch { /* no .env file: fall back to config.js defaults */ }

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let filePath = path.join(ROOT, decodeURIComponent(url.pathname));

  let info = await stat(filePath).catch(() => null);
  if (info?.isDirectory()) {
    filePath = path.join(filePath, 'index.html');
    info = await stat(filePath).catch(() => null);
  }
  if (!info?.isFile()) {
    // No local file: proxy backend-rendered pages (e.g. /privacy) through this origin,
    // so the browser stays on localhost:5173/privacy instead of redirecting to the
    // API domain. Uses the same API base as .env / config.js.
    const api = String(process.env.API_BASE_URL || '').replace(/\/$/, '');
    if (api && (req.method === 'GET' || req.method === 'HEAD')) {
      try {
        const upstream = await fetch(`${api}${url.pathname}${url.search}`);
        const buf = Buffer.from(await upstream.arrayBuffer());
        res.writeHead(upstream.status, {
          'Content-Type': upstream.headers.get('content-type') || 'text/html; charset=utf-8',
          'Content-Length': String(buf.length),
          'Cache-Control': 'no-store',
        });
        res.end(buf);
        return;
      } catch { /* backend unreachable: fall through to 404 */ }
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  // .env / env override: API_BASE_URL, PLAY_STORE_URL and API_KEY (from the .env file or the
  // real environment) replace the matching values inside /config.js without editing it.
  // Without them, config.js is served as-is.
  const envOverrides = { API: process.env.API_BASE_URL, PLAY_STORE: process.env.PLAY_STORE_URL, API_KEY: process.env.API_KEY };
  if (/^[\\/]?config\.js$/.test(url.pathname) && Object.values(envOverrides).some(Boolean)) {
    let out = await readFile(filePath, 'utf8');
    for (const [key, val] of Object.entries(envOverrides)) {
      if (!val) continue;
      out = out.replace(new RegExp(`${key}:\\s*['"][^'"]*['"]`), `${key}: ${JSON.stringify(val)}`);
    }
    res.writeHead(200, {
      'Content-Type': TYPES['.js'],
      'Content-Length': String(Buffer.byteLength(out)),
      'Cache-Control': 'no-store',
    });
    res.end(out);
    return;
  }

  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Content-Length': String(info.size),
    // Never cache during development: a reload must always show the new file.
    'Cache-Control': 'no-store',
  });
  createReadStream(filePath).pipe(res);
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend on http://localhost:${PORT}`);
  console.log(`  dashboard: http://localhost:${PORT}/dashboard/`);
});
