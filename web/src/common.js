// Shared helpers for all scenes. Everything is a pure function of time so the
// renderer can jump to any frame (needed for chunked parallel rendering).
import * as THREE from 'three';
export { THREE };

THREE.ColorManagement.enabled = false;

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t) => clamp(t) * clamp(t) * clamp(t);
export const range = (p, a, b) => clamp((p - a) / (b - a));
export const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

// ------------------------------------------------------------------ textures
let _glow, _spike, _soft;
export function glowTex() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.10, 'rgba(255,255,255,0.65)');
  gr.addColorStop(0.28, 'rgba(255,255,255,0.20)');
  gr.addColorStop(0.55, 'rgba(255,255,255,0.05)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}
export function softTex() { // plain soft disc
  if (_soft) return _soft;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.6)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  _soft = new THREE.CanvasTexture(c);
  return _soft;
}
export function spikeTex() { // 4-point diffraction spikes
  if (_spike) return _spike;
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.translate(256, 256);
  for (let k = 0; k < 2; k++) {
    g.save(); g.rotate(k * Math.PI / 2);
    const gr = g.createLinearGradient(-256, 0, 256, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(-256, -1.6, 512, 3.2);
    g.restore();
  }
  const rg = g.createRadialGradient(0, 0, 0, 0, 0, 40);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(-40, -40, 80, 80);
  _spike = new THREE.CanvasTexture(c);
  return _spike;
}

export function glowSprite(color = 0xffffff, scale = 1, { opacity = 1, screen = false, tex = null } = {}) {
  const m = new THREE.SpriteMaterial({
    map: tex || glowTex(), color, transparent: true, opacity, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: !screen,
  });
  const s = new THREE.Sprite(m);
  s.scale.set(scale, scale, 1);
  return s;
}
export function starSprite(color, scale, spikes = true, screen = false) {
  const g = new THREE.Group();
  const glow = glowSprite(color, scale, { screen });
  g.add(glow);
  if (spikes) {
    const sp = glowSprite(color, scale * 2.2, { screen, tex: spikeTex(), opacity: 0.55 });
    g.add(sp);
    g.userData.spike = sp;
  }
  g.userData.glow = glow;
  g.userData.setScale = (s) => {
    glow.scale.set(s, s, 1);
    if (g.userData.spike) g.userData.spike.scale.set(s * 2.2, s * 2.2, 1);
  };
  return g;
}

const _labelCache = new Map();
export function labelSprite(text, { height = 1, color = '#d8ecff', screen = false, sub = null } = {}) {
  const key = text + '|' + color + '|' + sub;
  let rec = _labelCache.get(key);
  if (!rec) {
    const CW = 1600, CH = sub ? 250 : 150;
    const c = document.createElement('canvas'); c.width = CW; c.height = CH;
    const g = c.getContext('2d');
    g.textBaseline = 'middle'; g.textAlign = 'center';
    g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 12;
    const fit = (txt, px, w, ls) => {
      let f = px;
      for (let i = 0; i < 12; i++) {
        g.font = `600 ${f}px Inter, "DejaVu Sans", sans-serif`; g.letterSpacing = `${ls}px`;
        if (g.measureText(txt).width <= w) break;
        f *= 0.92;
      }
      return f;
    };
    fit(text, 88, CW - 60, 5);
    g.fillStyle = color;
    g.fillText(text, CW / 2, sub ? 78 : CH / 2);
    if (sub) {
      fit(sub, 50, CW - 60, 2);
      g.fillStyle = 'rgba(200,220,242,0.92)';
      g.fillText(sub, CW / 2, 182);
    }
    const tex = new THREE.CanvasTexture(c);
    rec = { tex, aspect: CW / CH };
    _labelCache.set(key, rec);
  }
  // each label gets its own material so its opacity can be animated independently
  const m = new THREE.SpriteMaterial({ map: rec.tex, transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: !screen });
  const s = new THREE.Sprite(m);
  s.scale.set(height * rec.aspect, height, 1);
  s.renderOrder = 50;
  return s;
}

// --------------------------------------------------------------- milky way
let _mw;
export function milkyWayTexture() {
  if (_mw) return _mw;
  const W = 1024, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const rnd = mulberry32(99);
  const P = new Float32Array(512 * 512);
  for (let i = 0; i < P.length; i++) P[i] = rnd();
  const vn = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const s = (a, b) => P[((a & 511) + ((b & 511) << 9))];
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return (s(xi, yi) * (1 - u) + s(xi + 1, yi) * u) * (1 - v) + (s(xi, yi + 1) * (1 - u) + s(xi + 1, yi + 1) * u) * v;
  };
  const fbm = (x, y) => { let a = 0.5, s = 0; for (let o = 0; o < 5; o++) { s += a * vn(x, y); x *= 2.02; y *= 2.02; a *= 0.5; } return s; };
  for (let y = 0; y < H; y++) {
    const lat = (y / H - 0.5) * Math.PI; // -pi/2..pi/2
    for (let x = 0; x < W; x++) {
      const lon = (x / W) * Math.PI * 2;
      const bulge = Math.exp(-Math.pow((lon - Math.PI) / 1.1, 2));
      const width = 0.16 + 0.14 * bulge;
      const band = Math.exp(-Math.pow(lat / width, 2));
      const n = fbm(x * 0.03, y * 0.05);
      const dust = fbm(x * 0.05 + 40, y * 0.09 + 17);
      let v = band * (0.35 + 1.1 * n) * (0.35 + 0.9 * bulge + 0.35);
      v *= 1 - 0.85 * Math.max(0, dust - 0.48) * 2.2 * band;
      v = Math.max(0, v);
      const i = (y * W + x) * 4;
      img.data[i] = Math.min(255, v * 105 + 2);
      img.data[i + 1] = Math.min(255, v * 100 + 3);
      img.data[i + 2] = Math.min(255, v * 112 + 6);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  _mw = new THREE.CanvasTexture(c);
  _mw.wrapS = THREE.RepeatWrapping;
  return _mw;
}

export function makeMilkyWay(radius = 950, intensity = 0.8) {
  const mat = new THREE.MeshBasicMaterial({
    map: milkyWayTexture(), side: THREE.BackSide, depthWrite: false, transparent: true,
    blending: THREE.AdditiveBlending, opacity: intensity,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), mat);
  m.rotation.set(0.5, 0.4, 0.3);
  m.renderOrder = -10;
  return m;
}

// --------------------------------------------------------------- starfield
const STAR_COLS = [[0.62, 0.75, 1.0], [0.8, 0.88, 1.0], [1, 1, 1], [1, 0.95, 0.82], [1, 0.82, 0.58], [1, 0.62, 0.42]];
export function makeStarfield({ count = 14000, seed = 5, radius = 1000, relativistic = false, size = 1.0, extra = [] } = {}) {
  const rnd = mulberry32(seed);
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
  const sz = new Float32Array(count), ph = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    pos[i * 3] = r * Math.cos(a); pos[i * 3 + 1] = u; pos[i * 3 + 2] = r * Math.sin(a);
    const cc = STAR_COLS[Math.min(5, Math.floor(Math.pow(rnd(), 1.4) * 6))];
    const br = 0.35 + 0.65 * Math.pow(rnd(), 2.2);
    col[i * 3] = cc[0] * br; col[i * 3 + 1] = cc[1] * br; col[i * 3 + 2] = cc[2] * br;
    sz[i] = (1.0 + Math.pow(rnd(), 14) * 6.5) * size;
    ph[i] = rnd();
  }
  extra.forEach((e, k) => {
    const i = count - 1 - k; const d = e.dir.clone().normalize();
    pos[i * 3] = d.x; pos[i * 3 + 1] = d.y; pos[i * 3 + 2] = d.z;
    col[i * 3] = e.color[0]; col[i * 3 + 1] = e.color[1]; col[i * 3 + 2] = e.color[2]; sz[i] = e.size;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uScale: { value: 1 }, uTime: { value: 0 }, uBeta: { value: 0 },
      uRel: { value: relativistic ? 1 : 0 }, uVdir: { value: new THREE.Vector3(1, 0, 0) }, uRadius: { value: radius },
    },
    vertexShader: `
      attribute float aSize; attribute vec3 aColor; attribute float aPhase;
      uniform float uScale, uTime, uBeta, uRel, uRadius; uniform vec3 uVdir;
      varying vec3 vColor; varying float vAlpha;
      void main(){
        vec3 d = normalize(position);
        float dop = 1.0;
        if(uRel > 0.5){
          float c = dot(d, uVdir);
          float c2 = (c + uBeta) / (1.0 + uBeta * c);
          vec3 perp = d - c * uVdir; float pl = length(perp);
          vec3 pdir = pl > 1e-5 ? perp / pl : vec3(0.0);
          float s2 = sqrt(max(0.0, 1.0 - c2 * c2));
          float gamma = 1.0 / sqrt(max(1e-4, 1.0 - uBeta * uBeta));
          dop = gamma * (1.0 + uBeta * c);
          d = uVdir * c2 + pdir * s2;
        }
        vec4 mv = modelViewMatrix * vec4(d * uRadius, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.88 + 0.12 * sin(uTime * (1.5 + aPhase * 2.0) + aPhase * 40.0);
        float boost = 1.0;
        vec3 col = aColor;
        float al = 1.0;
        if(uRel > 0.5){
          boost = clamp(pow(dop, 0.55), 0.7, 3.2);
          float b = clamp(log2(dop) * 0.55, -1.0, 1.0);
          col = mix(col, vec3(0.5, 0.75, 1.7), clamp(b, 0.0, 1.0));
          col = mix(col, vec3(1.4, 0.22, 0.04), clamp(-b, 0.0, 1.0));
          al = clamp(pow(dop, 0.9), 0.16, 2.6);
        }
        gl_PointSize = aSize * uScale * tw * boost;
        vColor = col; vAlpha = al;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vAlpha;
      void main(){
        vec2 p = gl_PointCoord - 0.5; float r = length(p) * 2.0;
        float a = smoothstep(1.0, 0.0, r); a = a * a * (1.0 + 2.0 * smoothstep(0.35, 0.0, r));
        gl_FragColor = vec4(vColor * a * vAlpha, a * vAlpha);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = -5;
  return pts;
}

// ------------------------------------------------------------ noise GLSL
export const NOISE_GLSL = `
float hash31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x), mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x), mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){ float a = 0.5, s = 0.0; for(int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
`;

// ------------------------------------------------------------ planet
export function makePlanet({
  radius = 1, seed = 1, colors = [[0.05, 0.12, 0.35], [0.1, 0.3, 0.5], [0.2, 0.4, 0.2], [0.9, 0.9, 0.95]],
  freq = 2.6, bands = 0, sea = 0.48, atmo = [0.3, 0.55, 1.0], atmoPow = 3.0, sun = new THREE.Vector3(1, 0.3, 0.5),
  ambient = 0.025, sunColor = [1, 0.97, 0.9], clouds = 0.0, nightLights = 0.0,
} = {}) {
  const uniforms = {
    uSun: { value: sun.clone().normalize() }, uSeed: { value: seed },
    uC1: { value: new THREE.Vector3(...colors[0]) }, uC2: { value: new THREE.Vector3(...colors[1]) },
    uC3: { value: new THREE.Vector3(...colors[2]) }, uC4: { value: new THREE.Vector3(...colors[3]) },
    uFreq: { value: freq }, uBands: { value: bands }, uSea: { value: sea }, uAtmo: { value: new THREE.Vector3(...atmo) },
    uAtmoPow: { value: atmoPow }, uAmb: { value: ambient }, uSunCol: { value: new THREE.Vector3(...sunColor) },
    uClouds: { value: clouds }, uNight: { value: nightLights }, uTime: { value: 0 }, uTint: { value: new THREE.Vector3(0, 0, 0) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 vN; varying vec3 vP; varying vec3 vW;
      void main(){
        vP = normalize(position); vN = normalize(mat3(modelMatrix) * normal);
        vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform vec3 uSun, uC1, uC2, uC3, uC4, uAtmo, uSunCol, uTint; uniform float uSeed, uFreq, uBands, uSea, uAtmoPow, uAmb, uClouds, uNight, uTime;
      varying vec3 vN; varying vec3 vP; varying vec3 vW;
      ${NOISE_GLSL}
      void main(){
        vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
        vec3 q = vP * uFreq + uSeed * 13.1;
        float h = fbm(q);
        if(uBands > 0.0){ h = 0.5 + 0.5 * sin(vP.y * uBands + (fbm(q * 1.6) - 0.5) * 4.0) * 0.8 + (h - 0.5) * 0.35; }
        vec3 col;
        if(h < uSea) col = mix(uC1, uC2, smoothstep(uSea - 0.2, uSea, h));
        else { col = mix(uC2 * 0.8 + uC3 * 0.2, uC3, smoothstep(uSea, uSea + 0.12, h)); col = mix(col, uC4, smoothstep(uSea + 0.16, uSea + 0.32, h)); }
        if(uBands > 0.0){ col = mix(uC1, mix(uC2, mix(uC3, uC4, smoothstep(0.62, 0.9, h)), smoothstep(0.38, 0.62, h)), smoothstep(0.1, 0.4, h)); }
        float cl = 0.0;
        if(uClouds > 0.0){ cl = smoothstep(0.52, 0.75, fbm(vP * 3.2 + vec3(uTime * 0.01, 0.0, uSeed))) * uClouds; col = mix(col, vec3(1.0), cl); }
        float ndl = dot(N, uSun);
        float lit = smoothstep(-0.08, 0.32, ndl);
        float diff = max(ndl, 0.0);
        vec3 c = col * (uAmb + diff * 1.15) * uSunCol;
        if(uNight > 0.0){
          float city = step(0.7, fbm(vP * 18.0 + 3.0)) * step(uSea + 0.03, h) * (1.0 - lit) * (1.0 - cl);
          c += vec3(1.0, 0.75, 0.4) * city * uNight;
        }
        float fr = pow(1.0 - max(dot(N, V), 0.0), uAtmoPow);
        c += uAtmo * fr * (0.15 + 1.2 * lit);
        c += uTint * fr;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), mat);
  mesh.userData.uniforms = uniforms;
  return mesh;
}

export function atmoShell(radius, color = [0.3, 0.55, 1.0], power = 3.0, intensity = 1.0) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Vector3(...color) }, uPow: { value: power }, uInt: { value: intensity } },
    vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uCol; uniform float uPow, uInt; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 V = normalize(cameraPosition - vW); float f = pow(max(0.0, 0.62 - dot(normalize(vN), V)), uPow) * uInt; gl_FragColor = vec4(uCol * f, f); }`,
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 48), mat);
}

// glowing star body
export function makeStarBody({ radius = 1, c1 = [1, 0.55, 0.1], c2 = [1, 0.95, 0.6], granule = 5.0, seed = 3 } = {}) {
  const uniforms = { uTime: { value: 0 }, uC1: { value: new THREE.Vector3(...c1) }, uC2: { value: new THREE.Vector3(...c2) }, uG: { value: granule }, uSeed: { value: seed }, uBoost: { value: 1.0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vW; void main(){ vP = normalize(position); vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float uTime, uG, uSeed, uBoost; uniform vec3 uC1, uC2; varying vec3 vP; varying vec3 vN; varying vec3 vW;
      ${NOISE_GLSL}
      void main(){
        vec3 V = normalize(cameraPosition - vW); float mu = max(dot(normalize(vN), V), 0.0);
        float g = fbm(vP * uG + vec3(uSeed, uTime * 0.06, 0.0));
        float g2 = fbm(vP * uG * 2.5 - vec3(uTime * 0.09, uSeed, 2.0));
        float t = clamp(g * 1.2 + g2 * 0.35, 0.0, 1.0);
        float spots = smoothstep(0.34, 0.2, fbm(vP * 2.2 + uSeed * 3.0 + uTime * 0.01));
        vec3 col = mix(uC1, uC2, t) * (1.0 - spots * 0.55);
        col *= 0.30 + 0.70 * pow(mu, 0.45);
        gl_FragColor = vec4(col * 1.35 * uBoost, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 48), mat);
  m.userData.uniforms = uniforms;
  return m;
}

// ------------------------------------------------------------ rings / lines
export function orbitRing(radius, width, color = 0x4a7aa8, opacity = 0.45, seg = 192) {
  const m = new THREE.Mesh(new THREE.RingGeometry(radius - width / 2, radius + width / 2, seg),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.rotation.x = -Math.PI / 2;
  return m;
}
export function thickLine(points, color = 0xffffff, opacity = 1) {
  const g = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
}

// ------------------------------------------------------------ warp dust
// Streaks that fly past the camera. Add the returned object as a child of camera.
export function makeWarpDust({ count = 1600, length = 60, radius = 14, color = [0.7, 0.85, 1.0], minR = 0.6, seed = 11 } = {}) {
  const rnd = mulberry32(seed);
  const pos = new Float32Array(count * 2 * 3), end = new Float32Array(count * 2), amp = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2, r = minR + Math.sqrt(rnd()) * radius, z = -rnd() * length;
    const x = Math.cos(a) * r, y = Math.sin(a) * r, b = 0.35 + 0.65 * rnd();
    for (let k = 0; k < 2; k++) {
      pos.set([x, y, z], (i * 2 + k) * 3); end[i * 2 + k] = k; amp[i * 2 + k] = b;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  geo.setAttribute('aAmp', new THREE.BufferAttribute(amp, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uOff: { value: 0 }, uStretch: { value: 1 }, uLen: { value: length }, uCol: { value: new THREE.Vector3(...color) }, uAlpha: { value: 1 } },
    vertexShader: `
      attribute float aEnd; attribute float aAmp; uniform float uOff, uStretch, uLen; varying float vA; varying float vE;
      void main(){
        vec3 p = position; p.z = mod(p.z + uOff, uLen) - uLen;
        p.z -= aEnd * uStretch;
        float dist = -p.z;
        vA = aAmp * smoothstep(uLen, uLen * 0.6, dist) * smoothstep(0.5, 3.0, dist);
        vE = 1.0 - aEnd * 0.9;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform vec3 uCol; uniform float uAlpha; varying float vA; varying float vE; void main(){ gl_FragColor = vec4(uCol * vA * vE * uAlpha, vA * vE * uAlpha); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const l = new THREE.LineSegments(geo, mat);
  l.frustumCulled = false;
  return l;
}

// ------------------------------------------------------------ sail
export function makeSail(size = 1) {
  const g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uGlow: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vW; varying vec2 vUv; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float uTime, uGlow; varying vec3 vN; varying vec3 vW; varying vec2 vUv;
      void main(){
        vec3 V = normalize(cameraPosition - vW); float f = abs(dot(normalize(vN), V));
        float th = f * 6.0 + vUv.x * 1.3 + vUv.y * 0.9;
        vec3 irid = 0.5 + 0.5 * cos(6.2831 * (th + vec3(0.0, 0.33, 0.67)));
        vec3 c = mix(vec3(0.62, 0.7, 0.82), irid, 0.2) * (0.3 + 0.55 * (1.0 - f * 0.5));
        vec2 e = abs(vUv - 0.5) * 2.0; float edge = smoothstep(0.93, 1.0, max(e.x, e.y));
        c += vec3(0.6, 0.8, 1.0) * edge * 0.5 + vec3(1.0, 0.5, 0.3) * uGlow * 0.35;
        gl_FragColor = vec4(c, 0.92);
      }`,
    side: THREE.DoubleSide, transparent: true,
  });
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  g.add(sail);
  const chip = new THREE.Mesh(new THREE.BoxGeometry(size * 0.03, size * 0.03, size * 0.01), new THREE.MeshBasicMaterial({ color: 0x9fb4c8 }));
  chip.position.z = -size * 0.15;
  g.add(chip);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const ln = thickLine([new THREE.Vector3(sx * size * 0.5, sy * size * 0.5, 0), new THREE.Vector3(0, 0, -size * 0.15)], 0x8aa0b8, 0.35);
    g.add(ln);
  }
  g.userData.mat = mat;
  return g;
}

// ------------------------------------------------------------ voyager model (simple)
export function makeVoyager(scale = 1) {
  const g = new THREE.Group();
  const metal = new THREE.MeshBasicMaterial({ color: 0xc8ced6 });
  const gold = new THREE.MeshBasicMaterial({ color: 0xd8b25a });
  const dark = new THREE.MeshBasicMaterial({ color: 0x59606b });
  const dish = new THREE.Mesh(new THREE.SphereGeometry(1.8, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2.6), new THREE.MeshBasicMaterial({ color: 0xe8ecf0, side: THREE.DoubleSide }));
  dish.rotation.x = Math.PI / 2; dish.position.z = 0.8;
  g.add(dish);
  const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.6, 10), dark);
  bus.rotation.x = Math.PI / 2; bus.position.z = -0.2; g.add(bus);
  const rtg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.8, 8), metal);
  rtg.rotation.z = Math.PI / 2; rtg.position.set(1.7, 0, -0.6); g.add(rtg);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.6, 6), metal);
  boom.rotation.z = Math.PI / 2; boom.position.set(-1.8, 0, -0.5); g.add(boom);
  const sci = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), gold); sci.position.set(-3.5, 0, -0.5); g.add(sci);
  const mag = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 6, 6), metal);
  mag.rotation.x = Math.PI / 2; mag.position.set(0, 1.0, -3); g.add(mag);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.03, 20), gold);
  disc.rotation.x = Math.PI / 2; disc.position.set(0.5, -0.9, -0.1); g.add(disc);
  g.scale.setScalar(scale);
  return g;
}

// helper: set camera vertical FOV from a "landscape" design value, aspect aware
export function setFov(cam, vfovLandscape, aspect) {
  if (aspect >= 1) cam.fov = vfovLandscape;
  else cam.fov = Math.min(100, 2 * Math.atan(Math.tan(vfovLandscape * Math.PI / 360) * 1.9) * 180 / Math.PI);
  cam.updateProjectionMatrix();
}
