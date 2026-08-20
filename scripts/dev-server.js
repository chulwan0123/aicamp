/**
 * 의존성 없는 로컬 개발 서버.
 * 정적 파일을 서빙하고 /api/* 를 Vercel 서버리스 함수 시그니처로 연결한다.
 *   node scripts/dev-server.js  (기본 포트 3000)
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3000;

/* .env 간이 로더 — dotenv 를 설치하지 않는다. */
for (const name of ['.env.local', '.env']) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.]+)\s*=\s*(.*)?\s*$/);
    if (!match || line.trim().startsWith('#')) continue;
    const value = (match[2] || '').trim().replace(/^["']|["']$/g, '');
    if (!(match[1] in process.env)) process.env[match[1]] = value;
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error', reject);
});

/** Vercel 함수가 기대하는 res 인터페이스로 감싼다. */
function wrapResponse(res) {
  return {
    _status: 200,
    status(code) { this._status = code; return this; },
    setHeader(name, value) { res.setHeader(name, value); return this; },
    json(data) {
      res.writeHead(this._status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
    },
    send(data) {
      res.writeHead(this._status);
      res.end(data);
    },
  };
}

async function handleApi(req, res, route) {
  const file = path.join(ROOT, 'api', `${route}.js`);
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `/api/${route} 없음` }));
    return;
  }

  const raw = await readBody(req);
  let body = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { body = raw; }

  // 매 요청마다 새로 import 해 코드 수정이 즉시 반영되게 한다.
  const module = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
  const fakeReq = { method: req.method, body, query: Object.fromEntries(new URL(req.url, 'http://x').searchParams), headers: req.headers };
  await module.default(fakeReq, wrapResponse(res));
}

function serveStatic(req, res, urlPath) {
  const relative = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath);
  const target = path.join(ROOT, relative);
  if (!target.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(target)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(target).pipe(res);
}

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname.slice('/api/'.length));
      return;
    }
    serveStatic(req, res, pathname);
  } catch (error) {
    console.error('[dev-server]', error);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: String(error.message || error) }));
  }
}).listen(PORT, () => {
  console.log(`플러스홈 dev 서버 → http://localhost:${PORT}`);
  console.log(`USE_MOCK=${process.env.USE_MOCK ?? '(미설정)'}  OPENAI_API_KEY=${process.env.OPENAI_API_KEY ? '설정됨' : '없음'}`);
});
