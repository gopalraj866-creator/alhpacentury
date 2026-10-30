import {
  THREE, mulberry32, clamp, smooth, lerp, easeInOut, easeOut, easeIn, range, fmt,
  glowSprite, starSprite, labelSprite, makeStarBody, makePlanet, atmoShell, orbitRing, thickLine,
  makeVoyager, setFov, NOISE_GLSL, softTex,
} from './common.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;

function eqToVec(raH, decDeg) {
  const ra = raH * 15 * D2R, de = decDeg * D2R;
  return V3(Math.cos(de) * Math.cos(ra), Math.sin(de), -Math.cos(de) * Math.sin(ra));
}

// =====================================================================  HOOK
export function hook(ctx) {
  const group = new THREE.Group();
  const sky = new THREE.Group();
  group.add(sky);
  const R = 800;
  const ac = eqToVec(14.66, -60.83);
  const targetDir = V3(0.0, Math.sin(30 * D2R), -Math.cos(30 * D2R));
  const q = new THREE.Quaternion().setFromUnitVectors(ac, targetDir);
  const stars = [
    ['ac', 14.66, -60.83, 0xfff2cf, 120, true], ['hadar', 14.06, -60.37, 0xbcd4ff, 70, true],
    ['acrux', 12.44, -63.10, 0xbcd4ff, 62, true], ['mimosa', 12.80, -59.69, 0xbcd4ff, 55, true],
    ['gacrux', 12.52, -57.11, 0xffb98a, 48, true], ['delta', 12.25, -58.75, 0xbcd4ff, 34, true],
  ];
  let acWorld = null;
  const acSprite = [];
  for (const [id, ra, de, col, sc, sp] of stars) {
    const v = eqToVec(ra, de).applyQuaternion(q).multiplyScalar(R);
    const s = starSprite(col, sc, sp);
    s.position.copy(v);
    group.add(s);
    if (id === 'ac') { acWorld = v.clone(); acSprite.push(s); }
  }
  // ground ridge
  const rnd = mulberry32(7);
  const N = 720, pos = [], idx = [];
  const ph = [rnd() * 6, rnd() * 6, rnd() * 6];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const h = 14 + 16 * Math.sin(a * 3 + ph[0]) * Math.sin(a * 5 + ph[1]) + 9 * Math.sin(a * 13 + ph[2]) + 5 * Math.sin(a * 41 + ph[0] * 2) + 3 * Math.sin(a * 97);
    const x = Math.sin(a) * 880, z = -Math.cos(a) * 880;
    pos.push(x, -400, z, x, Math.max(2, h), z);
    if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  gg.setIndex(idx);
  const ground = new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ color: 0x010206, side: THREE.DoubleSide }));
  ground.renderOrder = 5;
  group.add(ground);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(900, 48), new THREE.MeshBasicMaterial({ color: 0x010206, side: THREE.DoubleSide }));
  cap.rotation.x = -Math.PI / 2; cap.position.y = -1; cap.renderOrder = 5; group.add(cap);
  // horizon glow
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(930, 930, 420, 64, 1, true), new THREE.ShaderMaterial({
    vertexShader: `varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying float vY; void main(){ float h = clamp((vY + 40.0) / 380.0, 0.0, 1.0); float a = pow(1.0 - h, 3.2); gl_FragColor = vec4(vec3(0.08, 0.16, 0.30) * a * 1.6, a); }`,
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.position.y = 150; glow.renderOrder = -4;
  group.add(glow);
  // labels + marker
  const lab = labelSprite('ALPHA CENTAURI', { height: 34 });
  lab.position.copy(acWorld).add(V3(0, -78, 0));
  group.add(lab);
  const lab2 = labelSprite('SOUTHERN CROSS', { height: 26, color: '#9fb8d8' });
  group.add(lab2);
  const cruxPos = eqToVec(12.44, -63.10).applyQuaternion(q).multiplyScalar(R);
  lab2.position.copy(cruxPos).add(V3(0, -70, 0));
  // shooting star
  const shoot = glowSprite(0xdfeaff, 1, { opacity: 0 });
  group.add(shoot);

  return {
    group, bg: true,
    update(p, t) {
      const cam = ctx.camera;
      const z = easeInOut(range(p, 0.55, 0.97));
      setFov(cam, lerp(60, 3.2, Math.pow(z, 0.9)), ctx.aspect);
      const lookIn = easeInOut(range(p, 0.0, 0.5));
      const yaw = lerp(-24, 0, lookIn) * D2R + Math.sin(t * 0.25) * 0.004;
      const pitch = lerp(9, 30, lookIn) * D2R + Math.sin(t * 0.31) * 0.003;
      cam.position.set(0, 1.7, 0);
      cam.rotation.set(pitch, yaw, 0, 'YXZ');
      const fadeL = smooth(0.12, 0.3, p) * (1 - smooth(0.66, 0.76, p));
      lab.material.opacity = fadeL; lab2.material.opacity = smooth(0.2, 0.34, p) * (1 - smooth(0.5, 0.6, p));
      lab.visible = fadeL > 0.01; lab2.visible = lab2.material.opacity > 0.01;
      const g = acSprite[0];
      g.userData.setScale(120 * (1 + 0.04 * Math.sin(t * 3.1)) * (1 + 1.4 * easeIn(range(p, 0.8, 1))));
      // shooting star
      const u = range(p, 0.17, 0.215);
      shoot.material.opacity = u > 0 && u < 1 ? Math.sin(u * Math.PI) : 0;
      shoot.position.set(lerp(-200, 120, u) - 320, lerp(520, 380, u), -640);
      shoot.scale.set(110, 2.4, 1); shoot.material.rotation = 0.38;
    },
    flash(p) { return smooth(0.955, 1.0, p); },
    hud() { return null; },
  };
}

// =====================================================================  VOYAGER
export function voyager(ctx) {
  const group = new THREE.Group();
  const planets = [
    ['JUPITER', 5.2, 20, 0xe8c9a0], ['SATURN', 9.58, 100, 0xf0dca8],
    ['URANUS', 19.2, 200, 0x9fe0e8], ['NEPTUNE', 30.07, 300, 0x5f8bff],
  ];
  const sun = starSprite(0xffe6a8, 0.07, true, true);
  group.add(sun);
  const sunLab = labelSprite('SUN', { height: 0.045, screen: true });
  sunLab.center.set(0.5, 1.4); group.add(sunLab);
  const labs = [];
  for (const [name, a, ang, col] of planets) {
    group.add(orbitRing(a, a * 0.007, 0x5b86b8, 0.4, 256));
    const pm = glowSprite(col, 0.022, { screen: true });
    pm.position.set(Math.cos(ang * D2R) * a, 0, Math.sin(ang * D2R) * a);
    group.add(pm);
    const l = labelSprite(name, { height: 0.045, screen: true });
    l.center.set(0.5, -0.5); l.position.copy(pm.position);
    group.add(l); labs.push(l);
  }
  const helio = new THREE.Group();
  const hr1 = orbitRing(121, 0.9, 0x58b4ff, 0.55, 256);
  const hr2 = orbitRing(121, 0.9, 0x58b4ff, 0.4, 256); hr2.rotation.set(0, 0, Math.PI / 2);
  const hr3 = orbitRing(121, 0.9, 0x58b4ff, 0.3, 256); hr3.rotation.set(-Math.PI / 2, 0, 0); hr3.rotation.y = 0; hr3.rotation.x = 0;
  hr3.rotation.set(0, Math.PI / 2, 0);
  helio.add(hr1, hr2, hr3);
  group.add(helio);
  const helioLab = labelSprite('HELIOPAUSE', { height: 0.09, screen: true, color: '#8fd0ff', sub: 'EDGE OF THE SUN\'S BUBBLE · ≈ 120 AU · CROSSED 2012' });
  helioLab.position.set(0, 0, 121 * 0.7).add(V3(Math.cos(-30 * D2R) * 121 * 0.7, 0, Math.sin(-30 * D2R) * 121 * 0.7).multiplyScalar(0));
  group.add(helioLab);
  const vg = makeVoyager(1);
  group.add(vg);
  const vMarker = glowSprite(0xffffff, 0.03, { screen: true, opacity: 0.0 });
  group.add(vMarker);
  const vLab = labelSprite('VOYAGER 1', { height: 0.085, screen: true, sub: 'LAUNCHED 1977 · ≈ 17 KM/S' });
  vLab.center.set(0.5, -0.75); group.add(vLab);
  const u = V3(Math.cos(-35 * D2R), 0, Math.sin(-35 * D2R));
  let lastR = 6;

  return {
    group, bg: true,
    update(p, t) {
      const cam = ctx.camera;
      const s = easeInOut(range(p, 0.02, 0.86));
      const r = 6 * Math.pow(170 / 6, s);
      lastR = r;
      const vpos = u.clone().multiplyScalar(r);
      vg.position.copy(vpos);
      vg.lookAt(vpos.clone().add(u));
      const dist = Math.max(3.2, r * lerp(3.4, 0.65, smooth(0.0, 0.55, p)));
      const ang = (-35 + 180 - 52 + 16 * Math.sin(t * 0.07) + 14 * easeInOut(range(p, 0, 1))) * D2R;
      const off = V3(Math.cos(ang), 0.42, Math.sin(ang)).normalize().multiplyScalar(dist);
      cam.position.copy(vpos).add(off);
      cam.up.set(0, 1, 0);
      cam.lookAt(vpos.clone().add(u.clone().multiplyScalar(dist * 0.25)));
      setFov(cam, 52, ctx.aspect);
      const vs = dist * 0.028;
      vg.scale.setScalar(vs);
      vMarker.position.copy(vpos);
      vMarker.material.opacity = smooth(0.2, 0.7, p) * 0.8;
      vLab.position.copy(vpos); vLab.material.opacity = smooth(0.0, 0.1, p) * (1 - smooth(0.62, 0.7, p));
      vLab.visible = vLab.material.opacity > 0.01;
      const dFar = smooth(8, 90, dist);
      labs.forEach((l) => { l.material.opacity = 1 - 0.5 * dFar; });
      helio.visible = true;
      helioLab.material.opacity = smooth(0.5, 0.62, p) * (1 - smooth(0.9, 0.98, p));
      helioLab.visible = helioLab.material.opacity > 0.01;
      const hp = u.clone().cross(V3(0, 1, 0)).normalize();
      helioLab.position.copy(u.clone().multiplyScalar(121)).add(hp.multiplyScalar(0)).add(V3(0, 18, 0));
      sun.userData.setScale(0.07 + 0.01 * Math.sin(t * 2));
    },
    hud(p) {
      const items = [];
      const r = lastR;
      if (p > 0.04) items.push({ k: 'DISTANCE FROM THE SUN', v: '≈ ' + fmt(Math.min(170, r)) + ' AU' });
      if (p > 0.8) {
        items.push({ k: 'DISTANCE TO ALPHA CENTAURI', v: '≈ 270,000 AU' });
        items.push({ k: 'PROGRESS SO FAR', v: '≈ 0.06 %' });
      }
      if (p > 0.88) {
        const c = easeOut(range(p, 0.88, 0.98));
        items.push({ k: 'TIME TO ARRIVE AT THIS SPEED', v: '≈ ' + fmt(Math.round(75000 * c / 500) * 500) + ' years', accent: true });
      }
      return items;
    },
  };
}

// =====================================================================  DISTANCE
export function distance(ctx) {
  const group = new THREE.Group();
  const sun = starSprite(0xffe9b0, 0.2, true);
  group.add(sun);
  const sunLab = labelSprite('THE SUN', { height: 0.1, sub: 'EARTH IS HERE' }); sunLab.position.set(0, -0.16, 0); group.add(sunLab);
  const A = starSprite(0xfff0c8, 0.5, true); A.position.set(4.37, 0, 0); group.add(A);
  const B = starSprite(0xffb870, 0.28, false); B.position.set(4.37, -0.02, 0.02); group.add(B);
  const Pr = starSprite(0xff6a4a, 0.14, false); Pr.position.set(4.24, 0.14, -0.22); group.add(Pr);
  const acLab = labelSprite('ALPHA CENTAURI', { height: 0.16, sub: '4.37 LIGHT YEARS' }); acLab.position.set(4.37, -0.42, 0); group.add(acLab);
  const prLab = labelSprite('PROXIMA', { height: 0.1 }); prLab.position.set(4.24, 0.4, -0.22); group.add(prLab);
  const mat = new THREE.MeshBasicMaterial({ color: 0x57c7ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const dim = new THREE.MeshBasicMaterial({ color: 0x3a77a8, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let k = 1; k <= 4; k++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.006, 10, 96), mat);
    ring.rotation.y = Math.PI / 2; ring.position.x = k; group.add(ring);
    const l = labelSprite(k + (k === 1 ? ' LIGHT YEAR' : ' LIGHT YEARS'), { height: 0.1, color: '#9fdcff' });
    l.position.set(k, 0.5, 0); group.add(l);
  }
  for (let k = 0; k < 18; k++) {
    const x = 0.25 * (k + 1);
    if (Math.abs(x - Math.round(x)) < 1e-6) continue;
    const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.0025, 6, 64), dim);
    r2.rotation.y = Math.PI / 2; r2.position.x = x; group.add(r2);
  }
  const axis = thickLine([V3(-0.5, 0, 0), V3(4.4, 0, 0)], 0x57c7ff, 0.35);
  group.add(axis);
  let cx = 0;
  return {
    group, bg: true,
    update(p, t) {
      const cam = ctx.camera;
      cam.near = 0.002; cam.far = 400;
      setFov(cam, 60, ctx.aspect);
      const mv = easeInOut(range(p, 0.2, 0.9));
      cx = lerp(0.25, 4.15, mv);
      const turn = easeInOut(range(p, 0.07, 0.24));
      const yaw = lerp(Math.PI, 0, turn);
      cam.position.set(cx - (1 - turn) * 0.0, 0.0 + 0.02 * Math.sin(t * 0.5), 0);
      cam.rotation.set(0, 0, 0);
      const dirx = Math.sin(yaw), dirz = Math.cos(yaw);
      // yaw=0 -> looking +X; yaw=pi -> looking -X
      const ydeg = lerp(Math.PI, 0, turn);
      cam.lookAt(cam.position.x + Math.cos(ydeg), 0.02 * Math.sin(t * 0.4) * 0 + 0.0, Math.sin(ydeg) * 0);
      cam.rotateZ(Math.sin(t * 0.2) * 0.012);
      sun.userData.setScale(0.2 * (1 + 0.04 * Math.sin(t * 2.2)));
      sunLab.material.opacity = 1 - smooth(0.1, 0.24, p);
    },
    hud(p) {
      const items = [];
      const years = cx;
      items.push({ k: 'LIGHT TRAVEL TIME FROM THE SUN', v: fmt(years, 2) + ' years' });
      items.push({ k: 'DISTANCE', v: fmt(years * 9.4607, 1) + ' trillion km' });
      if (p > 0.84) {
        items.push({ k: 'SCALE MODEL', v: 'Sun = 1 mm grain of sand', accent: true });
        items.push({ k: 'ALPHA CENTAURI WOULD BE', v: '≈ 30 km away', accent: true });
      }
      return items;
    },
  };
}

// =====================================================================  SYSTEM
function keplerPos(M, e, a) {
  let E = M;
  for (let i = 0; i < 6; i++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return [a * (Math.cos(E) - e), a * Math.sqrt(1 - e * e) * Math.sin(E)];
}
export function system(ctx) {
  const group = new THREE.Group();
  const tilt = new THREE.Euler(0.5, 0.3, 0);
  const A = starSprite(0xfff1cc, 0.1, true, true); group.add(A);
  const B = starSprite(0xffa860, 0.075, false, true); group.add(B);
  const Pc = V3(11000, 1500, 7000);
  const Pr = starSprite(0xff5a3c, 0.035, false, true); Pr.position.copy(Pc); group.add(Pr);
  const aLab = labelSprite('ALPHA CENTAURI A', { height: 0.045, screen: true, color: '#fff0c8' });
  const bLab = labelSprite('ALPHA CENTAURI B', { height: 0.045, screen: true, color: '#ffc58f' });
  aLab.center.set(0.5, -0.9); bLab.center.set(0.5, -0.9); group.add(aLab, bLab);
  const pLab = labelSprite('PROXIMA CENTAURI', { height: 0.085, screen: true, color: '#ff9a82', sub: 'RED DWARF · 4.24 LIGHT YEARS FROM US' });
  pLab.position.copy(Pc); pLab.center.set(0.5, 1.0); group.add(pLab);
  const abLab = labelSprite('ALPHA CENTAURI A + B', { height: 0.06, screen: true, color: '#fff0c8' }); abLab.center.set(0.5, -0.9); group.add(abLab);
  const nep = orbitRing(30, 0.28, 0x4a90c8, 0.55, 160); group.add(nep);
  const nepLab = labelSprite('NEPTUNE\'S ORBIT', { height: 0.075, screen: true, color: '#7fb4e6', sub: 'SOLAR SYSTEM FOR SCALE' });
  nepLab.position.set(0, 0, 30); nepLab.center.set(0.5, -0.4); group.add(nepLab);
  const link = thickLine([V3(0, 0, 0), Pc], 0x6fc3ff, 0.45); group.add(link);
  const linkLab = labelSprite('≈ 13,000 AU', { height: 0.075, screen: true, color: '#9fdcff', sub: '0.2 LIGHT YEARS' });
  linkLab.position.copy(Pc).multiplyScalar(0.5); linkLab.center.set(0.5, -0.6); group.add(linkLab);

  const NT = 260;
  const mkTrail = (col) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NT * 3), 3));
    const cols = new Float32Array(NT * 3);
    for (let i = 0; i < NT; i++) { const f = Math.pow(1 - i / NT, 1.6); cols[i * 3] = col[0] * f; cols[i * 3 + 1] = col[1] * f; cols[i * 3 + 2] = col[2] * f; }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    l.frustumCulled = false; return l;
  };
  const trA = mkTrail([1, 0.9, 0.6]), trB = mkTrail([1, 0.55, 0.25]);
  group.add(trA, trB);
  const e = 0.519, a = 23.4, mA = 1.08, mB = 0.91;
  const posAt = (M) => {
    const [x, z] = keplerPos(M, e, a);
    const rel = V3(x, 0, z).applyEuler(tilt);
    return [rel.clone().multiplyScalar(-mB / (mA + mB)), rel.clone().multiplyScalar(mA / (mA + mB))];
  };

  return {
    group, bg: true,
    update(p, t) {
      const cam = ctx.camera;
      const M0 = (t / 9.0) * Math.PI * 2 + 1.0;
      const [pa, pb] = posAt(M0);
      A.position.copy(pa); B.position.copy(pb);
      for (const [tr, which] of [[trA, 0], [trB, 1]]) {
        const arr = tr.geometry.attributes.position.array;
        for (let i = 0; i < NT; i++) { const pp = posAt(M0 - i * 0.022)[which]; arr[i * 3] = pp.x; arr[i * 3 + 1] = pp.y; arr[i * 3 + 2] = pp.z; }
        tr.geometry.attributes.position.needsUpdate = true;
      }
      const z = easeInOut(range(p, 0.3, 0.8));
      const dist = 52 * Math.pow(15500 / 52, z);
      const swing = lerp(0.2 + 0.5 * p, -0.567, z);
      const dir = V3(Math.sin(swing), 0.55 - 0.4 * z, Math.cos(swing)).normalize();
      const look = Pc.clone().multiplyScalar(0.5 * smooth(0.0, 1.0, z));
      cam.position.copy(look).add(dir.multiplyScalar(dist));
      cam.up.set(0, 1, 0);
      cam.lookAt(look);
      setFov(cam, 52, ctx.aspect);
      const sz = 1 - 0.35 * z;
      A.userData.setScale(0.1 * sz); B.userData.setScale(0.075 * sz);
      const near = 1 - smooth(0.3, 0.45, p);
      aLab.position.copy(pa); bLab.position.copy(pb);
      aLab.material.opacity = bLab.material.opacity = near * smooth(0.0, 0.08, p);
      aLab.visible = bLab.visible = near > 0.02;
      nep.material.opacity = 0.55 * near; nepLab.material.opacity = near; nepLab.visible = near > 0.02; nep.visible = near > 0.02;
      const far = smooth(0.55, 0.72, p);
      pLab.material.opacity = far; link.material.opacity = 0.5 * far; linkLab.material.opacity = far;
      pLab.visible = linkLab.visible = far > 0.01;
      link.visible = far > 0.01;
      abLab.material.opacity = far; abLab.visible = far > 0.01;
    },
    hud(p) {
      const items = [];
      if (p > 0.08) items.push({ k: 'A + B ORBIT EACH OTHER EVERY', v: '≈ 80 years' });
      if (p > 0.55) items.push({ k: 'PROXIMA IS ABOUT', v: '≈ 13,000 AU from A + B' });
      if (p > 0.78) items.push({ k: 'PROXIMA — DISTANCE FROM EARTH', v: '4.24 light years', accent: true });
      return items;
    },
  };
}

// =====================================================================  PROXIMA b + JWST
export function proxima(ctx) {
  const group = new THREE.Group();
  const shotA = new THREE.Group(), shotB = new THREE.Group();
  group.add(shotA, shotB);
  // ---- planet + star (artistic scale: star pulled in so both fit one frame)
  const SD = 14;
  const S = V3(SD, 0, 0);
  const planet = makePlanet({
    radius: 1, seed: 4.2, colors: [[0.20, 0.09, 0.05], [0.46, 0.24, 0.13], [0.66, 0.40, 0.22], [0.9, 0.75, 0.6]],
    freq: 2.4, sea: 0.46, atmo: [1.0, 0.5, 0.25], atmoPow: 2.6, sun: V3(1, 0, 0), ambient: 0.02, sunColor: [1.25, 0.72, 0.45],
  });
  shotA.add(planet);
  const shell = atmoShell(1.09, [1.0, 0.45, 0.2], 2.2, 0.9); shotA.add(shell);
  const star = makeStarBody({ radius: 2.2, c1: [0.9, 0.17, 0.03], c2: [1.0, 0.55, 0.2], granule: 4.5, seed: 8 });
  star.position.copy(S); shotA.add(star);
  const starGlow = glowSprite(0xff5a20, 15, { opacity: 0.9 }); starGlow.position.copy(S); shotA.add(starGlow);
  const starGlow2 = glowSprite(0xff9a50, 6.5, { opacity: 0.8 }); starGlow2.position.copy(S); shotA.add(starGlow2);
  const flashSp = glowSprite(0xffd2a0, 8, { opacity: 0 }); shotA.add(flashSp);
  // flare plume (arc of particles lifting off the star)
  const NPL = 160; const pl = new Float32Array(NPL * 3); const plr = new Float32Array(NPL * 3);
  { const r = mulberry32(5); for (let i = 0; i < NPL * 3; i++) plr[i] = r(); }
  const plg = new THREE.BufferGeometry(); plg.setAttribute('position', new THREE.BufferAttribute(pl, 3));
  const plMat = new THREE.PointsMaterial({ color: 0xffa860, size: 0.3, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, map: softTex() });
  const plume = new THREE.Points(plg, plMat); plume.frustumCulled = false; shotA.add(plume);
  // particle stream star -> planet
  const NP = 220; const sp = new Float32Array(NP * 3); const rnd = mulberry32(21); const sr = new Float32Array(NP);
  for (let i = 0; i < NP; i++) sr[i] = rnd();
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const streamMat = new THREE.PointsMaterial({ color: 0xffb070, size: 0.2, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, map: softTex() });
  const stream = new THREE.Points(sg, streamMat); stream.frustumCulled = false; shotA.add(stream);
  const labP = labelSprite('PROXIMA b', { height: 0.62, sub: 'ROCKY · HABITABLE ZONE · 11.2-DAY ORBIT' });
  shotA.add(labP);

  // ---- JWST shot
  const AA = starSprite(0xfff4d8, 14, true); shotB.add(AA);
  const halo = glowSprite(0xffe8b0, 26, { opacity: 0.55 }); shotB.add(halo);
  const mask = new THREE.Mesh(new THREE.CircleGeometry(1.25, 64), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  mask.position.z = 0.4; mask.renderOrder = 8; shotB.add(mask);
  const maskRing = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.3, 64), new THREE.MeshBasicMaterial({ color: 0x57c7ff, transparent: true, opacity: 0.8 }));
  maskRing.position.z = 0.41; maskRing.renderOrder = 9; shotB.add(maskRing);
  const maskLab = labelSprite('CORONAGRAPH', { height: 0.62, color: '#9fdcff', sub: 'BLOCKS THE STAR\'S GLARE' });
  maskLab.position.set(0, -2.2, 0.5); shotB.add(maskLab);
  const ellPts = [];
  for (let k = 0; k <= 160; k++) { const a = k / 160 * Math.PI * 2; ellPts.push(V3(1.05 + 2.55 * Math.cos(a), 0.28 + 1.15 * Math.sin(a), 0.3)); }
  const ell = thickLine(ellPts, 0x57c7ff, 0.3); shotB.add(ell);
  const dot = glowSprite(0xaee6ff, 0.55, { opacity: 0 }); dot.position.set(3.15, 1.2, 0.35); shotB.add(dot);
  const dotCore = glowSprite(0xffffff, 0.16, { opacity: 0 }); dotCore.position.copy(dot.position); shotB.add(dotCore);
  const dotLab = labelSprite('PLANET CANDIDATE?', { height: 0.62, color: '#bfeaff', sub: 'SEEN ONCE · AUG 2024 · ≈ 2 AU FROM STAR' });
  dotLab.position.set(3.15, 2.35, 0.5); shotB.add(dotLab);
  const jLab = labelSprite('JAMES WEBB · MID-INFRARED', { height: 0.5, color: '#ffffff' });
  jLab.position.set(0, 3.7, 0.5); shotB.add(jLab);
  let bump = 0;
  const T1 = 0.27, T2 = 0.66;

  return {
    group, bg: true,
    flash(p) {
      const a = Math.max(0, 1 - Math.abs(p - T1) / 0.012), b = Math.max(0, 1 - Math.abs(p - T2) / 0.014);
      return Math.max(a, b) * 0.8;
    },
    update(p, t, d) {
      const cam = ctx.camera;
      const inA = p < T2;
      shotA.visible = inA; shotB.visible = !inA;
      planet.userData.uniforms.uTime.value = t;
      star.userData.uniforms.uTime.value = t;
      if (inA) {
        const shot1 = p < T1;
        const u = range(p, 0.36, 0.62);
        bump = (u > 0 && u < 1) ? Math.pow(Math.sin(Math.PI * u), 2.0) : 0;
        if (shot1) {
          const phi = lerp(0.9, 2.3, p / T1);
          const th = phi + 1.15 + 0.5 * (p / T1);
          const R = lerp(4.6, 3.3, easeInOut(p / T1));
          star.position.set(Math.cos(phi) * SD, 0, Math.sin(phi) * SD);
          cam.position.set(Math.cos(th) * R, 0.8 * Math.cos(p * 6), Math.sin(th) * R);
          cam.up.set(0, 1, 0); cam.lookAt(0, 0, 0);
          setFov(cam, 50, ctx.aspect);
        } else {
          star.position.copy(S);
          const w = range(p, T1, T2);
          cam.position.set(7.2 - 0.6 * w, 1.7 - 0.3 * w, 16.0 - 1.6 * w);
          cam.up.set(0, 1, 0);
          cam.lookAt(7.0 + 0.4 * w, 0.0, 0.0);
          setFov(cam, 44, ctx.aspect);
          if (ctx.aspect < 1) cam.position.set(7.2, 2.0, 21.0 - 2.0 * w);
        }
        const dirS = star.position.clone().normalize();
        planet.userData.uniforms.uSun.value.copy(dirS);
        planet.rotation.y = -Math.atan2(dirS.z, dirS.x);
        planet.userData.uniforms.uTint.value.set(1.0, 0.22, 0.05).multiplyScalar(0.9 * bump);
        shell.material.uniforms.uCol.value.set(1.0, 0.45 + 0.4 * bump, 0.2 + 0.1 * bump);
        shell.material.uniforms.uInt.value = 0.9 + 3.0 * bump;
        star.userData.uniforms.uBoost.value = 1 + 1.4 * bump;
        starGlow.position.copy(star.position); starGlow2.position.copy(star.position);
        starGlow.material.opacity = 0.75 + 0.25 * bump;
        starGlow2.scale.setScalar(6.5 * (1 + 0.5 * bump));
        const toPlanet = star.position.clone().multiplyScalar(-1).normalize();
        const n = toPlanet.clone().multiplyScalar(0.8).add(V3(0, 0.55, 0.35)).normalize();
        const F = star.position.clone().add(n.clone().multiplyScalar(2.15));
        const tang = n.clone().cross(V3(0, 1, 0)).normalize();
        // plume loop
        const pa = plg.attributes.position.array;
        const gH = 0.25 + 2.3 * bump + 0.15 * Math.sin(t * 1.3), gW = 0.5 + 1.2 * bump;
        for (let i = 0; i < NPL; i++) {
          const th = (i / NPL) * Math.PI;
          const jx = (plr[i * 3] - 0.5) * 0.28, jy = (plr[i * 3 + 1] - 0.5) * 0.28, jz = (plr[i * 3 + 2] - 0.5) * 0.28;
          const side = (i % 2 ? 1 : -1);
          const P = F.clone().add(n.clone().multiplyScalar(Math.sin(th) * gH)).add(tang.clone().multiplyScalar(side * (1 - Math.cos(th)) * 0.5 * gW));
          pa[i * 3] = P.x + jx; pa[i * 3 + 1] = P.y + jy; pa[i * 3 + 2] = P.z + jz;
        }
        plg.attributes.position.needsUpdate = true;
        plMat.opacity = 0.25 + 0.75 * bump; plMat.size = 0.28 * (ctx.aspect < 1 ? 1.5 : 1);
        flashSp.position.copy(F);
        flashSp.material.opacity = bump;
        flashSp.scale.setScalar(3 + 14 * bump);
        // stream
        const arr = sg.attributes.position.array;
        const lead = Math.min(1, range(u, 0.04, 0.45));
        for (let i = 0; i < NP; i++) {
          const s = ((sr[i] + u * 2.6 * (1 + sr[i])) % 1) * lead;
          arr[i * 3] = lerp(F.x, 0, s) + (sr[(i * 5) % NP] - 0.5) * 0.9 * (1 - s);
          arr[i * 3 + 1] = lerp(F.y, 0, s) + (sr[(i * 7) % NP] - 0.5) * 1.2 * (1 - s);
          arr[i * 3 + 2] = lerp(F.z, 0, s) + (sr[(i * 13) % NP] - 0.5) * 1.2 * (1 - s);
        }
        sg.attributes.position.needsUpdate = true;
        streamMat.opacity = bump > 0.02 ? Math.min(1, bump * 1.5) : 0;
        streamMat.size = 0.2 * (ctx.aspect < 1 ? 1.5 : 1);
        labP.material.opacity = shot1 ? smooth(0.04, 0.1, p) * (1 - smooth(0.2, T1, p)) : 0;
        labP.visible = labP.material.opacity > 0.01;
        labP.position.set(0, 1.5, 0);
      } else {
        const w = range(p, T2, 1);
        setFov(cam, 50, ctx.aspect);
        const camZ = ctx.aspect < 1 ? 14.5 : 9.5;
        cam.position.set(1.0 + 0.15 * Math.sin(w * 3), 0.3 * Math.cos(w * 2), camZ - 0.8 * w);
        cam.up.set(0, 1, 0); cam.lookAt(1.2, 0.5, 0);
        AA.userData.setScale(14 * (1 + 0.03 * Math.sin(t * 4)));
        const jit = 0.5 + 0.5 * Math.sin(t * 17) * Math.sin(t * 5.3);
        const vis = smooth(0.1, 0.25, w) * (1 - smooth(0.62, 0.78, w));
        dot.material.opacity = vis * (0.55 + 0.4 * jit);
        dotCore.material.opacity = vis;
        dotLab.material.opacity = smooth(0.2, 0.34, w);
        dotLab.visible = dotLab.material.opacity > 0.01;
        ell.material.opacity = 0.3 * (1 - smooth(0.7, 0.9, w));
        maskLab.material.opacity = smooth(0.02, 0.16, w) * (1 - smooth(0.5, 0.6, w));
        maskLab.visible = maskLab.material.opacity > 0.01;
      }
    },
    hud(p) {
      const items = [];
      if (p < T1) {
        items.push({ k: 'PROXIMA b · ORBIT', v: '11.2 days · ≈ 7 million km' });
        items.push({ k: 'MASS (MINIMUM)', v: '≈ 1.07 × Earth' });
      } else if (p < T2) {
        const u = range(p, 0.36, 0.62);
        const mult = 1 + 999 * Math.pow(Math.sin(Math.PI * clamp(u)), 2.0);
        items.push({ k: 'ALMA · 24 MARCH 2017 · FLARE BRIGHTNESS', v: '× ' + fmt(mult), accent: mult > 20 });
        items.push({ gauge: Math.log10(mult) / 3, label: 'LOG SCALE', color: '#ff7a3a' });
      } else {
        const w = range(p, T2, 1);
        items.push({ k: 'TARGET', v: 'ALPHA CENTAURI A' });
        if (w > 0.35) items.push({ k: 'WEBB RE-OBSERVED IN 2025', v: 'NOT SEEN AGAIN' });
        if (w > 0.7) items.push({ k: 'STATUS', v: 'UNCONFIRMED', accent: true });
      }
      return items;
    },
  };
}

// =====================================================================  SPEED
export function speed(ctx) {
  const group = new THREE.Group();
  const lanes = [
    { y: 2.3, c: 0xffffff, name: 'VOYAGER 1', sub: '17 km/s', v: 17 / 299792.458 },
    { y: 0.0, c: 0x6dff9a, name: '10 % LIGHT SPEED', sub: '30,000 km/s', v: 0.1 },
    { y: -2.3, c: 0x4fd8ff, name: '20 % LIGHT SPEED', sub: '60,000 km/s', v: 0.2 },
  ];
  const X0 = -8, X1 = 8;
  group.position.y = 1.15;
  const orbs = [], trails = [], arrived = [], labs = [];
  const left = starSprite(0xffe9b0, 2.4, false); left.position.set(X0 - 0.9, 0, 0); group.add(left);
  const leftLab = labelSprite('SUN', { height: 0.8 }); leftLab.position.set(X0 - 0.9, 1.5, 0); group.add(leftLab);
  const right = starSprite(0xfff0c8, 2.4, false); right.position.set(X1 + 0.9, 0, 0); group.add(right);
  const rightLab = labelSprite('ALPHA CENTAURI', { height: 0.8 }); rightLab.position.set(X1 + 0.4, 1.5, 0); group.add(rightLab);
  for (const L of lanes) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, 0.04), new THREE.MeshBasicMaterial({ color: L.c, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    line.position.set(0, L.y, 0); group.add(line);
    const orb = glowSprite(L.c, 1.1); orb.position.set(X0, L.y, 0.1); group.add(orb); orbs.push(orb);
    const core = glowSprite(0xffffff, 0.35); orb.add(core); core.position.set(0, 0, 0);
    const tr = glowSprite(L.c, 1, { opacity: 0.5 }); group.add(tr); trails.push(tr);
    const lab = labelSprite(L.name, { height: 1.0, color: '#' + L.c.toString(16).padStart(6, '0'), sub: L.sub });
    lab.position.set(0, L.y + 0.62, 0); group.add(lab); labs.push(lab);
    const arr = glowSprite(L.c, 1, { opacity: 0 }); arr.position.set(X1, L.y, 0.2); group.add(arr); arrived.push(arr);
  }
  let yr = 0;
  return {
    group, bg: true,
    update(p, t) {
      const cam = ctx.camera;
      setFov(cam, 50, ctx.aspect);
      const halfW = 10.6;
      const dist = halfW / (Math.tan(cam.fov * D2R / 2) * ctx.aspect);
      cam.position.set(Math.sin(t * 0.15) * 0.4, 0.15 * Math.sin(t * 0.2), dist - 1.0 * p);
      cam.up.set(0, 1, 0); cam.lookAt(0, 1.0, 0);
      yr = 44 * easeInOut(range(p, 0.1, 0.96)) ;
      lanes.forEach((L, i) => {
        const frac = Math.min(1, (yr * L.v) / 4.37);
        const x = lerp(X0, X1, frac);
        orbs[i].position.x = x;
        const len = 0.4 + Math.min(5, frac * 20) * (L.v > 0.01 ? 1 : 0);
        trails[i].position.set(x - len * 0.5, L.y, 0.05);
        trails[i].scale.set(len, 0.38, 1);
        trails[i].material.opacity = L.v > 0.01 ? (frac >= 1 ? 0.0 : 0.6) : 0;
        orbs[i].scale.setScalar(frac >= 1 ? 1.1 : 1.1 + 0.15 * Math.sin(t * 6 + i));
        const a = frac >= 1 ? 1 : 0;
        arrived[i].material.opacity = a * (0.4 + 0.2 * Math.sin(t * 5));
        arrived[i].scale.setScalar(a ? 3.5 : 1);
      });
      left.userData.setScale(2.4 + 0.1 * Math.sin(t * 2));
    },
    hud(p) {
      const items = [];
      items.push({ k: 'ELAPSED TIME', v: 'YEAR ' + fmt(yr, 1), big: true });
      const dist = yr * 0.2;
      if (yr * 0.2 >= 4.37) items.push({ k: '20 % LIGHT SPEED', v: 'ARRIVED AFTER ≈ 22 YEARS', accent: true });
      if (yr * 0.1 >= 4.37) items.push({ k: '10 % LIGHT SPEED', v: 'ARRIVED AFTER ≈ 44 YEARS', accent: true });
      if (p > 0.5) items.push({ k: 'VOYAGER 1 AFTER 44 YEARS', v: '≈ 0.06 % OF THE WAY' });
      return items;
    },
  };
}
