import { THREE, makeStarfield, makeMilkyWay, clamp, smooth, lerp, easeOut, range, fmt } from './common.js';
import * as A from './scenesA.js';
import * as B from './scenesB.js';

const FACTORY = { ...A, ...B };
const qs = new URLSearchParams(location.search);
const W = +qs.get('w') || 1920, H = +qs.get('h') || 1080;
const GS = +qs.get('gs') || 1;
const MODE = qs.get('mode') || 'main';
const CAPTIONS = qs.get('captions') === '1';
const AA = qs.get('aa') !== '0';
const ASPECT = W / H;
const PORTRAIT = ASPECT < 1;
const U = PORTRAIT ? W / 1080 : W / 1920;           // design unit
const FONT = 'Inter, "DejaVu Sans", Arial, sans-serif';

async function loadFonts() {
  const defs = [['400', 'inter-latin-400-normal.woff2'], ['600', 'inter-latin-600-normal.woff2'], ['700', 'inter-latin-700-normal.woff2']];
  for (const [w, f] of defs) {
    try {
      const ff = new FontFace('Inter', `url(/fonts/${f})`, { weight: w });
      await ff.load(); document.fonts.add(ff);
    } catch (e) { console.warn('font fail', f, e.message); }
  }
}

let renderer, camera, bgGroup, stars, mw, tl, out, outCtx, glCanvas, scene3;
const instances = {};
let lastSceneId = null;

function getScene(id) {
  if (!instances[id]) {
    const f = FACTORY[id];
    if (!f) throw new Error('no scene ' + id);
    const ctx = { camera, aspect: ASPECT, renderer, portrait: PORTRAIT, scale: U };
    const inst = f(ctx);
    inst.group.visible = false;
    scene3.add(inst.group);
    instances[id] = inst;
  }
  return instances[id];
}

async function init() {
  await loadFonts();
  tl = await (await fetch('/timeline.json')).json();
  glCanvas = document.createElement('canvas');
  const gw = Math.round(W * GS), gh = Math.round(H * GS);
  glCanvas.width = gw; glCanvas.height = gh;
  document.body.appendChild(glCanvas);
  renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: AA, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(gw, gh, false);
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  scene3 = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(55, ASPECT, 0.05, 1e5);
  bgGroup = new THREE.Group();
  stars = makeStarfield({ count: 16000, seed: 5, radius: 1000 });
  stars.material.uniforms.uScale.value = Math.max(1, (PORTRAIT ? gw / 1080 : gw / 1920) * 1.25);
  mw = makeMilkyWay(950, 0.55);
  bgGroup.add(mw, stars);
  scene3.add(bgGroup);
  out = document.createElement('canvas'); out.width = W; out.height = H;
  outCtx = out.getContext('2d');
  window.__info = { W, H, total: tl.total, mode: MODE };
  window.__ready = true;
}

// ---------------------------------------------------------------- overlay
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function setFont(g, weight, px, ls = 0) { g.font = `${weight} ${Math.round(px)}px ${FONT}`; g.letterSpacing = `${ls}px`; }

function wrap(g, text, maxW) {
  const words = text.split(' '); const lines = []; let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (g.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawTitle(g, sc, si, lt) {
  g.save();
  if (si === 0 && MODE === 'main') {
    const a = easeOut(range(lt, 0.9, 2.0)) * (1 - smooth(6.0, 7.2, lt));
    if (a > 0.01) {
      g.globalAlpha = a; g.textAlign = 'center'; g.textBaseline = 'middle';
      setFont(g, 600, (PORTRAIT ? 30 : 26) * U, 9 * U); g.fillStyle = '#6fd3ff';
      const tagY = H * 0.5;
      setFont(g, 700, (PORTRAIT ? 92 : 112) * U, 3 * U);
      const lines = wrap(g, tl.title.toUpperCase(), W * (PORTRAIT ? 0.88 : 0.8));
      const lh = (PORTRAIT ? 104 : 126) * U;
      setFont(g, 600, (PORTRAIT ? 30 : 26) * U, 9 * U);
      g.fillText('TECHNICAL TALK INDIA PRESENTS', W / 2, tagY - (lines.length / 2) * lh - 34 * U);
      setFont(g, 700, (PORTRAIT ? 92 : 112) * U, 3 * U); g.fillStyle = '#ffffff';
      g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = 30 * U;
      lines.forEach((ln, i) => g.fillText(ln, W / 2, H * 0.5 + (i - (lines.length - 1) / 2) * lh));
      g.shadowBlur = 0;
      setFont(g, 400, (PORTRAIT ? 28 : 28) * U, 5 * U); g.fillStyle = 'rgba(200,225,255,0.85)';
      g.fillText('A REAL-PHYSICS 3D SIMULATION', W / 2, H * 0.5 + (lines.length / 2) * lh + 50 * U);
    }
    g.restore();
    return;
  }
  const parts = sc.title.split(' · ');
  const tag = (parts.length > 1 ? parts[0] : sc.title).toUpperCase();
  const name = parts.length > 1 ? parts[1] : '';
  const a = easeOut(range(lt, 0.35, 1.2)) * (1 - smooth(4.4, 5.2, lt));
  if (a < 0.01) { g.restore(); return; }
  g.globalAlpha = a;
  g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 18 * U;
  if (PORTRAIT) {
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const y = H * 0.085;
    setFont(g, 700, 66 * U, 4 * U); g.fillStyle = '#ffffff';
    const lines = wrap(g, tag, W * 0.9);
    lines.forEach((ln, i) => g.fillText(ln, W / 2, y + i * 74 * U));
  } else {
    const x = 96 * U, y = H - 150 * U;
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    setFont(g, 600, 22 * U, 8 * U); g.fillStyle = '#6fd3ff';
    g.fillText(tag, x, y);
    if (name) { setFont(g, 700, 66 * U, 1 * U); g.fillStyle = '#ffffff'; g.fillText(name, x, y + 72 * U); }
    g.shadowBlur = 0;
    const lw = easeOut(range(lt, 0.5, 1.5)) * 220 * U;
    g.fillStyle = '#6fd3ff'; g.fillRect(x, y - 52 * U, lw, 3 * U);
  }
  g.restore();
}

function drawCards(g, t) {
  for (const c of tl.cards) {
    if (t < c.start - 0.05 || t > c.end + 0.1) continue;
    const a = easeOut(range(t, c.start, c.start + 0.5)) * (1 - smooth(c.end - 0.45, c.end, t));
    if (a < 0.01) continue;
    const lf = PORTRAIT ? 26 : 19, vf = PORTRAIT ? 54 : 40;
    const pad = (PORTRAIT ? 30 : 24) * U, h = (PORTRAIT ? 138 : 104) * U, gap = (PORTRAIT ? 20 : 14) * U;
    g.save();
    setFont(g, 600, lf * U, 3.5 * U); const w1 = g.measureText(c.label).width;
    setFont(g, 700, vf * U, 0); const w2 = g.measureText(c.value).width;
    let w = Math.max(w1, w2) + pad * 2 + 10 * U;
    const maxW = W * (PORTRAIT ? 0.9 : 0.6);
    let scale = 1;
    if (w > maxW) scale = maxW / w;
    const x0 = (PORTRAIT ? (W - w * scale) / 2 : 72 * U);
    const y0 = (PORTRAIT ? 215 * U : 72 * U) + c.slot * (h + gap);
    const slide = (1 - easeOut(range(t, c.start, c.start + 0.5))) * -60 * U;
    g.translate(x0 + slide, y0); g.scale(scale, scale);
    g.globalAlpha = a;
    rr(g, 0, 0, w, h, 14 * U); g.fillStyle = 'rgba(6,12,28,0.66)'; g.fill();
    g.lineWidth = 1.5 * U; g.strokeStyle = 'rgba(111,211,255,0.38)'; g.stroke();
    g.fillStyle = '#6fd3ff'; g.fillRect(0, 14 * U, 5 * U, h - 28 * U);
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    setFont(g, 600, lf * U, 3.5 * U); g.fillStyle = '#7fd6ff'; g.fillText(c.label, pad + 4 * U, h * 0.38);
    setFont(g, 700, vf * U, 0); g.fillStyle = '#ffffff'; g.fillText(c.value, pad + 4 * U, h * 0.8);
    g.restore();
  }
}

function drawHud(g, items, bottomY) {
  if (!items || !items.length) return;
  g.save();
  const pad = 22 * U;
  const rows = [];
  let wMax = 0, hTot = pad * 2 - 6 * U;
  const kf = (PORTRAIT ? 20 : 17) * U, vf = (PORTRAIT ? 36 : 30) * U, bigf = (PORTRAIT ? 66 : 58) * U;
  for (const it of items) {
    if (it.gauge !== undefined) { rows.push({ it, h: 40 * U, w: 330 * U }); }
    else {
      setFont(g, 600, kf, 2.5 * U); const w1 = g.measureText(it.k).width;
      setFont(g, 700, it.big ? bigf : vf, 0); const w2 = g.measureText(it.v).width;
      rows.push({ it, h: (it.big ? bigf + kf + 20 * U : vf + kf + 22 * U), w: Math.max(w1, w2) });
    }
  }
  rows.forEach((r) => { wMax = Math.max(wMax, r.w); hTot += r.h; });
  const wBox = wMax + pad * 2;
  const x1 = PORTRAIT ? (W + wBox) / 2 : W - 72 * U;
  const x0 = x1 - wBox;
  const y1 = bottomY, y0 = y1 - hTot;
  rr(g, x0, y0, wBox, hTot, 14 * U); g.fillStyle = 'rgba(6,12,28,0.62)'; g.fill();
  g.lineWidth = 1.5 * U; g.strokeStyle = 'rgba(111,211,255,0.34)'; g.stroke();
  let y = y0 + pad - 4 * U;
  g.textAlign = 'right'; g.textBaseline = 'alphabetic';
  for (const r of rows) {
    const it = r.it;
    if (it.gauge !== undefined) {
      const bx = x0 + pad, bw = wBox - pad * 2, by = y + 8 * U;
      rr(g, bx, by, bw, 14 * U, 7 * U); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fill();
      rr(g, bx, by, Math.max(10 * U, bw * clamp(it.gauge)), 14 * U, 7 * U); g.fillStyle = it.color || '#6fd3ff'; g.fill();
      setFont(g, 600, 14 * U, 2 * U); g.fillStyle = 'rgba(190,215,240,0.8)'; g.textAlign = 'left';
      g.fillText(it.label || '', bx, by + 34 * U); g.textAlign = 'right';
    } else {
      setFont(g, 600, kf, 2.5 * U); g.fillStyle = 'rgba(160,200,235,0.9)';
      g.fillText(it.k, x1 - pad, y + kf + 4 * U);
      setFont(g, 700, it.big ? bigf : vf, 0); g.fillStyle = it.accent ? '#ffd27a' : '#ffffff';
      g.fillText(it.v, x1 - pad, y + kf + 4 * U + (it.big ? bigf : vf) + 6 * U);
    }
    y += r.h;
  }
  g.restore();
}

function drawCaption(g, t) {
  const c = tl.captions.find((k) => t >= k.start && t <= k.end + 0.05);
  if (!c) return;
  g.save();
  const fs = (PORTRAIT ? 54 : 38) * U;
  setFont(g, 600, fs, 0);
  const lines = wrap(g, c.text.replace(/\n/g, ' '), W * (PORTRAIT ? 0.84 : 0.72));
  const lh = fs * 1.28;
  const hBox = lines.length * lh + 24 * U;
  const yc = PORTRAIT ? H * 0.60 : H - 52 * U - hBox;
  let wMax = 0; lines.forEach((l) => { wMax = Math.max(wMax, g.measureText(l).width); });
  const bx = (W - wMax) / 2 - 26 * U, by = PORTRAIT ? yc - hBox / 2 : yc;
  rr(g, bx, by, wMax + 52 * U, hBox, 14 * U); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
  lines.forEach((l, i) => g.fillText(l, W / 2, by + 12 * U + lh * (i + 0.5)));
  g.restore();
}

function drawBrand(g, t) {
  g.save();
  g.globalAlpha = 0.62; g.textBaseline = 'alphabetic';
  setFont(g, 700, (PORTRAIT ? 24 : 20) * U, 5 * U);
  g.fillStyle = '#ffffff'; g.textAlign = 'right';
  g.fillText('TECHNICAL TALK INDIA', W - 54 * U, 64 * U);
  g.restore();
}

function drawEnd(g, t) {
  const start = tl.total - (MODE === 'shorts' ? 4.2 : 9.5);
  const a = easeOut(range(t, start, start + 1.2)) * (1 - smooth(tl.total - 1.6, tl.total - 0.5, t));
  if (a < 0.01) return;
  g.save(); g.globalAlpha = a; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 24 * U;
  const cy = PORTRAIT ? H * 0.73 : H * 0.34;
  setFont(g, 700, (PORTRAIT ? 66 : 74) * U, 3 * U); g.fillStyle = '#ffffff';
  g.fillText(MODE === 'shorts' ? 'WOULD YOU GO?' : 'WOULD YOU BOARD THAT SHIP?', W / 2, cy);
  const bw = (PORTRAIT ? 560 : 520) * U, bh = 96 * U, by = cy + 110 * U;
  g.shadowBlur = 0;
  rr(g, W / 2 - bw / 2, by - bh / 2, bw, bh, bh / 2); g.fillStyle = '#e5322d'; g.fill();
  setFont(g, 700, 40 * U, 6 * U); g.fillStyle = '#fff';
  g.fillText(MODE === 'shorts' ? 'FOLLOW' : 'SUBSCRIBE', W / 2, by + 2 * U);
  setFont(g, 600, 28 * U, 6 * U); g.fillStyle = '#9fdcff';
  g.fillText('TECHNICAL TALK INDIA', W / 2, by + 100 * U);
  if (MODE !== 'shorts') { setFont(g, 400, 26 * U, 2 * U); g.fillStyle = 'rgba(220,235,255,0.9)'; g.fillText('Tell us your answer in the comments', W / 2, by + 150 * U); }
  g.restore();
}

// ---------------------------------------------------------------- frame
window.renderFrame = (t) => {
  t = clamp(t, 0, tl.total - 1e-3);
  let si = tl.scenes.findIndex((s) => t >= s.start && t < s.end);
  if (si < 0) si = tl.scenes.length - 1;
  const sc = tl.scenes[si];
  const inst = getScene(sc.id);
  for (const k in instances) instances[k].group.visible = instances[k] === inst;
  const d = sc.end - sc.start, lt = t - sc.start, p = clamp(lt / d);
  camera.near = 0.05; camera.far = 1e5; camera.up.set(0, 1, 0);
  camera.rotation.set(0, 0, 0);
  bgGroup.visible = inst.bg !== false;
  inst.update(p, lt, d);
  camera.updateMatrixWorld(true);
  bgGroup.position.copy(camera.position);
  stars.material.uniforms.uTime.value = t;
  renderer.render(scene3, camera);

  const g = outCtx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.drawImage(glCanvas, 0, 0, W, H);
  const fl = inst.flash ? inst.flash(p) : 0;
  if (fl > 0.003) { g.fillStyle = `rgba(255,255,255,${clamp(fl)})`; g.fillRect(0, 0, W, H); }

  // overlay
  drawBrand(g, t);
  if (!(MODE === 'shorts' && si === tl.scenes.length - 1)) drawTitle(g, sc, si, lt);
  drawCards(g, t);
  let hudBottom = PORTRAIT ? H * 0.80 : H - 72 * U;
  if (CAPTIONS && !PORTRAIT) hudBottom = H - 200 * U;
  const hud = inst.hud ? inst.hud(p, lt, d) : null;
  drawHud(g, hud, hudBottom);
  if (CAPTIONS) drawCaption(g, t);
  if (si === tl.scenes.length - 1) drawEnd(g, t);
  if (MODE === 'main') { g.fillStyle = 'rgba(111,211,255,0.75)'; g.fillRect(0, H - 4 * U, W * t / tl.total, 4 * U); }

  // fades
  let fade = 0;
  fade = Math.max(fade, si === 0 ? 1 - smooth(0, 1.0, lt) : 1 - smooth(0, 0.5, lt));
  fade = Math.max(fade, si === tl.scenes.length - 1 ? smooth(tl.total - 2.0, tl.total, t) : 1 - smooth(0, 0.5, sc.end - t));
  if (fade > 0.002) { g.fillStyle = `rgba(0,0,0,${clamp(fade)})`; g.fillRect(0, 0, W, H); }

  return out.toDataURL('image/jpeg', 0.93).slice(23);
};

init().catch((e) => { console.error('INIT FAIL', e.stack || e); window.__error = String(e.stack || e); });
