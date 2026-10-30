#!/usr/bin/env node
// Deterministic frame renderer: headless Chromium (WebGL via SwiftShader) -> JPEG frames -> ffmpeg (H.264).
//
//   node tools/render.mjs --format 1080p --chunk 0 --chunks 24 --out parts/1080p_000.mp4
//   node tools/render.mjs --format shorts --stills 3,40,200 --still-dir stills      (visual QA)
//
// formats: 1080p (1920x1080), 4k (3840x2160), shorts (1080x1920, own timeline/audio)
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const arg = (name, def = null) => {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const FORMATS = {
  '1080p': { w: 1920, h: 1080, mode: 'main' },
  '4k': { w: 3840, h: 2160, mode: 'main' },
  shorts: { w: 1080, h: 1920, mode: 'shorts' },
};
const fmtName = arg('format', '1080p');
const F = FORMATS[fmtName];
if (!F) { console.error('unknown format', fmtName); process.exit(2); }
const fps = +arg('fps', 30);
const chunk = +arg('chunk', 0), chunks = +arg('chunks', 1);
const crf = arg('crf', fmtName === '4k' ? '18' : '17');
const preset = arg('preset', 'medium');
const captions = arg('captions', fmtName === 'shorts' ? '1' : '0') === '1' || arg('captions') === true;
const gs = +arg('gs', 1);
const aa = arg('aa', '1');
const out = arg('out', `build/parts/${fmtName}_${String(chunk).padStart(3, '0')}.mp4`);
const stills = arg('stills', null);
const stillDir = arg('still-dir', 'build/stills');
const buildDir = path.resolve(ROOT, arg('build', `build/${F.mode}`));
const startSec = arg('start', null), endSec = arg('end', null);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.css': 'text/css' };
function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file;
    if (url === '/timeline.json') file = path.join(buildDir, 'timeline.json');
    else if (url.startsWith('/three/')) file = path.join(ROOT, 'node_modules/three', url.slice(7));
    else if (url.startsWith('/fonts/')) file = path.join(ROOT, 'node_modules/@fontsource/inter/files', url.slice(7));
    else file = path.join(ROOT, 'web', url === '/' ? 'index.html' : url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; res.end('nf'); return; }
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

const server = await serve();
const port = server.address().port;
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl',
    '--disable-dev-shm-usage', '--no-sandbox', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning' || t.startsWith('INIT')) console.log('[page]', t.slice(0, 400)); });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 600)));
const qs = `w=${F.w}&h=${F.h}&mode=${F.mode}&gs=${gs}&aa=${aa}&captions=${captions ? 1 : 0}`;
await page.goto(`http://127.0.0.1:${port}/index.html?${qs}`);
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 180000 });
const err = await page.evaluate(() => window.__error);
if (err) { console.error('page init error:', err); process.exit(3); }
const info = await page.evaluate(() => window.__info);
const total = info.total;
const frameAt = (t) => page.evaluate((tt) => window.renderFrame(tt), t);

if (stills) {
  fs.mkdirSync(stillDir, { recursive: true });
  for (const s of String(stills).split(',')) {
    const t = parseFloat(s); const t0 = Date.now();
    const b64 = await frameAt(t);
    const f = path.join(stillDir, `${fmtName}_${String(t.toFixed(1)).padStart(6, '0')}.jpg`);
    fs.writeFileSync(f, Buffer.from(b64, 'base64'));
    console.log('still', f, ((Date.now() - t0) / 1000).toFixed(2) + 's');
  }
  await browser.close(); server.close(); process.exit(0);
}

const nFrames = Math.round(total * fps);
let f0 = Math.floor((chunk * nFrames) / chunks), f1 = Math.floor(((chunk + 1) * nFrames) / chunks);
if (startSec !== null) f0 = Math.round(+startSec * fps);
if (endSec !== null) f1 = Math.min(nFrames, Math.round(+endSec * fps));
fs.mkdirSync(path.dirname(path.resolve(ROOT, out)), { recursive: true });
console.log(`format=${fmtName} ${F.w}x${F.h} fps=${fps} total=${total.toFixed(1)}s frames ${f0}..${f1 - 1} (${f1 - f0}) crf=${crf}`);

const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
  '-vf', 'scale=in_color_matrix=bt601:in_range=full:out_color_matrix=bt709:out_range=tv,format=yuv420p',
  '-c:v', 'libx264', '-preset', String(preset), '-crf', String(crf), '-profile:v', 'high',
  '-g', String(fps * 2), '-bf', '2', '-r', String(fps),
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  path.resolve(ROOT, out)], { stdio: ['pipe', 'inherit', 'inherit'] });
const ffDone = new Promise((res, rej) => { ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))); });
ff.stdin.on('error', () => {});

const T0 = Date.now();
for (let f = f0; f < f1; f++) {
  const b64 = await frameAt(f / fps);
  const buf = Buffer.from(b64, 'base64');
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  const done = f - f0 + 1;
  if (done % 30 === 0 || f === f1 - 1) {
    const el = (Date.now() - T0) / 1000;
    console.log(`  frame ${done}/${f1 - f0}  ${(done / el).toFixed(2)} fps  eta ${(((f1 - f0) - done) / (done / el) / 60).toFixed(1)} min`);
  }
}
ff.stdin.end();
await ffDone;
await browser.close();
server.close();
console.log('done', out, ((Date.now() - T0) / 1000).toFixed(0) + 's');
