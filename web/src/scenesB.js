import {
  THREE, mulberry32, clamp, smooth, lerp, easeInOut, easeOut, easeIn, range, fmt,
  glowSprite, starSprite, labelSprite, makeStarBody, makePlanet, atmoShell, orbitRing, thickLine,
  makeSail, makeWarpDust, makeStarfield, setFov, softTex,
} from './common.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;
const follow = (obj, cam) => { obj.position.copy(cam.position); obj.quaternion.copy(cam.quaternion); };

// =====================================================================  STARSHOT
export function starshot(ctx) {
  const group = new THREE.Group();
  const gA = new THREE.Group(), gB = new THREE.Group();
  group.add(gA, gB);
  const rnd = mulberry32(31);

  // ---------- shot A: the laser array on the ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshBasicMaterial({ color: 0x07090e }));
  ground.rotation.x = -Math.PI / 2; ground.renderOrder = 2; gA.add(ground);
  const NX = 26, SP = 5;
  const pts = new Float32Array(NX * NX * 3);
  const boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.7, 1.4), new THREE.MeshBasicMaterial({ color: 0x1b2a3a }), NX * NX);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < NX; i++) for (let j = 0; j < NX; j++) {
    const x = (i - (NX - 1) / 2) * SP, z = (j - (NX - 1) / 2) * SP;
    m4.makeTranslation(x, 0.35, z); boxes.setMatrixAt(i * NX + j, m4);
    pts.set([x, 0.9, z], (i * NX + j) * 3);
  }
  gA.add(boxes);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  const tops = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x7fe0ff, size: 6, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: softTex() }));
  gA.add(tops);
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uA: { value: 0 } },
    vertexShader: 'varying vec3 vP; varying vec3 vN; varying vec3 vW; void main(){ vP = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform float uT, uA; varying vec3 vP; varying vec3 vN; varying vec3 vW; void main(){ vec3 V = normalize(cameraPosition - vW); float f = pow(abs(dot(normalize(vN), V)), 1.4); float h = smoothstep(900.0, 0.0, vP.y + 450.0); float pulse = 0.75 + 0.25 * sin(vP.y * 0.05 - uT * 6.0); gl_FragColor = vec4(vec3(0.45, 0.85, 1.0) * f * pulse * uA, f * uA * (0.4 + 0.6 * h)); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(20, 22, 1500, 40, 1, true), beamMat);
  beam.position.y = 750; gA.add(beam);
  const beamCore = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 1500, 24, 1, true), beamMat);
  beamCore.position.y = 750; gA.add(beamCore);
  const glowA = glowSprite(0x7fe0ff, 120, { opacity: 0.6 }); glowA.position.set(0, 6, 0); gA.add(glowA);
  const labA = labelSprite('100 GW LASER ARRAY', { height: 15, sub: 'THE MOST POWERFUL LASER EVER BUILT' });
  labA.position.set(-62, 30, 0); gA.add(labA);

  // ---------- shot B/C: space, Earth, sails
  const earth = makePlanet({ radius: 20, seed: 2.1, colors: [[0.02, 0.07, 0.25], [0.05, 0.22, 0.45], [0.12, 0.35, 0.14], [0.92, 0.94, 0.98]], freq: 2.2, sea: 0.5, atmo: [0.35, 0.6, 1.0], atmoPow: 2.8, sun: V3(0.5, 0.35, 0.8), ambient: 0.03, clouds: 0.8, nightLights: 1.0 });
  gB.add(earth);
  const eShell = atmoShell(21.6, [0.3, 0.55, 1.0], 3.0, 1.1); gB.add(eShell);
  const NS = 28; const sails = [], off = [];
  for (let i = 0; i < NS; i++) {
    const s = makeSail(0.8); s.rotation.y = Math.PI / 2; gB.add(s); sails.push(s);
    off.push([i === 0 ? 0 : 1.6 + i * (1.2 + rnd() * 1.1), (rnd() - 0.5) * 3.6, (rnd() - 0.5) * 3.6]);
  }
  const bMat = new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const bCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1, 12, 1, true), bMat);
  bCyl.rotation.z = Math.PI / 2; gB.add(bCyl);
  const bGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x4ab8ff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false }));
  bGlow.rotation.z = Math.PI / 2; gB.add(bGlow);
  const leadGlow = glowSprite(0xaee6ff, 3.0, { opacity: 0.9 }); gB.add(leadGlow);
  const earthDot = glowSprite(0x6aa8ff, 14, { opacity: 0 }); gB.add(earthDot);
  const dust = makeWarpDust({ count: 1800, length: 70, radius: 16, color: [0.6, 0.8, 1.0], minR: 0.8, seed: 77 });
  gB.add(dust);
  const labB = labelSprite('LIGHT SAILS', { height: 1.1, sub: 'THOUSANDS OF GRAM-SCALE PROBES' });
  gB.add(labB);
  const T1 = 0.26;
  let speedPct = 0;

  return {
    group, bg: true,
    flash(p) { return Math.max(0, 1 - Math.abs(p - T1) / 0.012) * 0.7; },
    update(p, t) {
      const cam = ctx.camera;
      const A = p < T1;
      gA.visible = A; gB.visible = !A;
      if (A) {
        const u = p / T1;
        beamMat.uniforms.uT.value = t; beamMat.uniforms.uA.value = 0.25 + 1.1 * smooth(0.15, 0.7, u);
        cam.position.set(lerp(-80, -34, u), lerp(16, 34, u), lerp(135, 92, u));
        cam.up.set(0, 1, 0); cam.lookAt(0, lerp(18, 70, u), 0);
        setFov(cam, 55, ctx.aspect);
        tops.material.size = 6 + Math.sin(t * 5) * 0.4;
        glowA.material.opacity = 0.35 + 0.35 * smooth(0.2, 0.8, u);
        labA.material.opacity = smooth(0.08, 0.22, u) * (1 - smooth(0.45, 0.62, u));
        labA.visible = labA.material.opacity > 0.01;
        return;
      }
      const q = range(p, T1, 0.92);
      const xLead = 26 * Math.pow(150, easeIn(q) * 0.9 + q * 0.1);   // 26 -> ~3900
      speedPct = 20 * easeOut(range(p, T1 + 0.02, 0.62));
      earth.userData.uniforms.uTime.value = t;
      const fleetStretch = 1 + 3 * q;
      sails.forEach((s, i) => {
        const o = off[i];
        s.position.set(xLead - o[0] * fleetStretch, o[1] * (1 + q), o[2] * (1 + q));
        s.userData.mat.uniforms.uGlow.value = 0.6;
        s.rotation.z = Math.sin(t * 0.9 + i) * 0.03;
        s.scale.setScalar(1 + (xLead / 600) * 0.0);
      });
      // beam from Earth surface to lead sail
      const bx0 = 20, len = Math.max(1, xLead - bx0);
      bCyl.scale.set(1, len, 1); bCyl.position.set(bx0 + len / 2, 0, 0);
      bGlow.scale.set(1 + q * 3, len, 1); bGlow.position.copy(bCyl.position);
      bMat.opacity = 0.5 * (1 - smooth(0.72, 0.95, q)) + 0.14;
      leadGlow.position.set(xLead, 0, 0); leadGlow.scale.setScalar(3 + q * 12);
      earthDot.position.set(0, 0, 0);
      earthDot.material.opacity = smooth(0.35, 0.9, q) * 0.9; earthDot.scale.setScalar(14 + 40 * q);
      earth.visible = true;
      // camera: wide establishing view of Earth + launch, then follows the lead sail
      const dist = lerp(13, 5.5, easeOut(range(q, 0, 0.25)));
      const swing = lerp(0.15, 0.6, q) + Math.sin(t * 0.2) * 0.04;
      const fol = V3(xLead - dist * 0.55 - 1.2, 1.2 + 0.6 * Math.sin(t * 0.3), dist * Math.cos(swing) + 0.2);
      const folLook = V3(xLead + 3 + 6 * q, 0, 0);
      const wide = V3(ctx.aspect < 1 ? 62 : 46, 12, ctx.aspect < 1 ? 92 : 64), wideLook = V3(ctx.aspect < 1 ? 14 : 22, -2, 0);
      const kk = easeInOut(range(q, 0.03, 0.2));
      cam.position.copy(wide).lerp(fol, kk); cam.up.set(0, 1, 0);
      cam.lookAt(wideLook.clone().lerp(folLook, kk));
      setFov(cam, 52, ctx.aspect);
      // dust streaks only once fast
      follow(dust, cam);
      const sp = easeIn(range(q, 0.05, 0.9));
      dust.material.uniforms.uOff.value = 40 + 900 * Math.pow(q, 1.6);
      dust.material.uniforms.uStretch.value = 0.4 + 26 * sp;
      dust.material.uniforms.uAlpha.value = 0.1 + 0.9 * sp;
      dust.visible = q > 0.04;
      labB.position.set(xLead + 1.0, 3.2 + 4 * (1 - smooth(0, 0.2, q)), 0); labB.scale.set(1.1 * 5.33 * (1 + 6 * (1 - smooth(0, 0.2, q))), 1.1 * 1.0 * (1 + 6 * (1 - smooth(0, 0.2, q))) , 1);
      labB.material.opacity = smooth(0.0, 0.12, q) * (1 - smooth(0.25, 0.4, q));
      labB.visible = labB.material.opacity > 0.01;
    },
    hud(p) {
      if (p < T1) return [{ k: 'LASER POWER', v: '≈ 100 gigawatts' }, { k: 'EACH PROBE', v: '≈ 1 gram chip + sail' }];
      const items = [];
      items.push({ k: 'PROBE SPEED', v: fmt(speedPct, 1) + ' % of light', big: true });
      items.push({ k: 'SPEED', v: fmt(speedPct / 100 * 1079.25, 0) + ' million km/h' });
      if (p > 0.72) items.push({ k: 'ACCELERATION TIME', v: 'only minutes', accent: true });
      return items;
    },
  };
}

// =====================================================================  DUST
export function dust(ctx) {
  const group = new THREE.Group();
  const gA = new THREE.Group(), gB = new THREE.Group();
  group.add(gA, gB);
  const rnd = mulberry32(55);
  // ---- A: flying through dust, sail in front of the camera
  const sail = makeSail(3.4); sail.position.set(0, -0.35, -6.2); sail.rotation.set(-0.35, 0.28, 0.0); gA.add(sail);
  const streaks = makeWarpDust({ count: 2600, length: 90, radius: 18, color: [0.95, 0.78, 0.6], minR: 0.4, seed: 13 });
  gA.add(streaks);
  const NF = 46; const flashes = [];
  for (let i = 0; i < NF; i++) {
    const f = glowSprite(0xffc890, 1, { opacity: 0 });
    gA.add(f);
    flashes.push({ s: f, t0: (i / NF) * 0.5 + rnd() * 0.01, u: (rnd() - 0.5) * 3.2, v: (rnd() - 0.5) * 3.2 });
  }
  const labA = labelSprite('INTERSTELLAR DUST', { height: 0.5, sub: 'EVERY GRAIN BECOMES A BULLET' });
  labA.position.set(0, 2.55, -6.2); gA.add(labA);

  // ---- B: one grain hits the hull in slow motion
  const plateTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
    g.fillStyle = '#2a323d'; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(160,185,210,0.35)'; g.lineWidth = 2;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(512, i * 64); g.stroke(); }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * 512, Math.random() * 512, 3, 3); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t;
  })();
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: plateTex }));
  plate.rotation.x = -Math.PI / 2; gB.add(plate);
  const grain = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), new THREE.MeshBasicMaterial({ color: 0xb89c80 }));
  { const pa = grain.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const k = 0.8 + rnd() * 0.4; pa.setXYZ(i, pa.getX(i) * k, pa.getY(i) * k, pa.getZ(i) * k); } }
  gB.add(grain);
  const grainGlow = glowSprite(0xffd0a0, 0.9, { opacity: 0.7 }); gB.add(grainGlow);
  const flashB = glowSprite(0xffe2b8, 1, { opacity: 0 }); flashB.position.set(0, 0.1, 0); gB.add(flashB);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.0, 64), new THREE.MeshBasicMaterial({ color: 0xffa860, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.004; gB.add(ring);
  const holeGlow = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: 0xff6a20, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  holeGlow.rotation.x = -Math.PI / 2; holeGlow.position.y = 0.006; gB.add(holeGlow);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: 0x020203 }));
  hole.rotation.x = -Math.PI / 2; hole.position.y = 0.008; gB.add(hole);
  const ND = 320; const dv = []; const dp = new Float32Array(ND * 3); const dc = new Float32Array(ND * 3);
  for (let i = 0; i < ND; i++) {
    const a = rnd() * Math.PI * 2, e = Math.pow(rnd(), 0.6) * 1.35, sp = 0.8 + rnd() * 3.6;
    dv.push([Math.cos(a) * Math.cos(e) * sp * 0.9, Math.sin(e) * sp * 1.15, Math.sin(a) * Math.cos(e) * sp * 0.9]);
  }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dg.setAttribute('color', new THREE.BufferAttribute(dc, 3));
  const debris = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.07, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: softTex() }));
  debris.frustumCulled = false; gB.add(debris);
  const labB = labelSprite('ONE GRAIN · 1 mm', { height: 0.34, sub: 'HITTING AT 20 % OF LIGHT SPEED' });
  gB.add(labB);
  const PB = 0.52, TI = 0.6;   // switch to slow-motion shot; impact moment (within shot)
  let count = 0, ub = 0;

  return {
    group, bg: true,
    flash(p) { return Math.max(0, 1 - Math.abs(p - PB) / 0.012) * 0.8; },
    update(p, t) {
      const cam = ctx.camera;
      const A = p < PB;
      gA.visible = A; gB.visible = !A;
      if (A) {
        cam.position.set(0, 0, 0); cam.up.set(0, 1, 0);
        cam.lookAt(Math.sin(t * 0.3) * 0.15, Math.cos(t * 0.23) * 0.1, -1);
        setFov(cam, 60, ctx.aspect);
        follow(streaks, cam);
        const q = p / PB;
        streaks.material.uniforms.uOff.value = t * 85;
        streaks.material.uniforms.uStretch.value = 5 + 10 * q;
        sail.position.y = -0.35 + Math.sin(t * 0.7) * 0.05;
        sail.userData.mat.uniforms.uGlow.value = 0.2 + 0.6 * q;
        flashes.forEach((f) => {
          const k = (q - f.t0 * 2) / 0.05;
          if (k < 0 || k > 1) { f.s.material.opacity = 0; return; }
          const lp = new THREE.Vector3(f.u * 0.85, f.v * 0.85, 0).applyEuler(sail.rotation).add(sail.position);
          f.s.position.copy(lp);
          f.s.material.opacity = (1 - k);
          f.s.scale.setScalar(0.25 + 0.9 * (1 - k));
        });
        const e = range(p, 0.02, PB);
        count = Math.pow(10, 9 * e);
        labA.material.opacity = smooth(0.0, 0.1, p) * (1 - smooth(0.3, 0.42, p));
        labA.visible = labA.material.opacity > 0.01;
        return;
      }
      ub = range(p, PB, 1);
      const impact = TI - 0.45 * 0 ;
      const tIm = 0.34;                       // impact at 34 % of the slow-mo shot
      const pre = clamp(ub / tIm);
      const post = Math.max(0, ub - tIm) / (1 - tIm);
      const start = V3(-3.6, 2.6, 0.2);
      const gp = start.clone().multiplyScalar(1 - pre);
      gp.y = Math.max(0.1, gp.y) ;
      grain.position.copy(gp); grain.rotation.set(ub * 3, ub * 5, 0);
      grain.visible = pre < 1; grainGlow.visible = pre < 1; grainGlow.position.copy(gp);
      grainGlow.scale.setScalar(0.6 + 0.5 * pre);
      // impact effects
      const k = post;
      flashB.material.opacity = k > 0 ? Math.max(0, 1 - k * 7) : 0; flashB.scale.setScalar(0.5 + 6 * Math.min(1, k * 6));
      ring.material.opacity = k > 0 ? Math.max(0, 0.9 - k * 1.6) : 0; ring.scale.setScalar(0.2 + k * 6.5);
      hole.scale.setScalar(k > 0 ? 0.12 + 0.34 * easeOut(k * 3) : 0.0001);
      holeGlow.scale.setScalar(hole.scale.x * 1.45); holeGlow.material.opacity = k > 0 ? Math.max(0, 0.9 - k * 1.1) : 0;
      const dpa = dg.attributes.position.array, dca = dg.attributes.color.array;
      const tau = k * 2.4;
      for (let i = 0; i < ND; i++) {
        const v = dv[i];
        dpa[i * 3] = v[0] * tau; dpa[i * 3 + 1] = 0.05 + v[1] * tau - 0.55 * tau * tau; dpa[i * 3 + 2] = v[2] * tau;
        const f = k > 0 ? Math.max(0, 1 - k * 1.2) : 0;
        dca[i * 3] = 1.0 * f; dca[i * 3 + 1] = (0.55 + 0.3 * (i % 3) / 3) * f; dca[i * 3 + 2] = 0.2 * f;
      }
      dg.attributes.position.needsUpdate = true; dg.attributes.color.needsUpdate = true;
      // camera: low side shot, slow pull back, shake on impact
      const shake = k > 0 ? Math.exp(-k * 12) * 0.05 : 0;
      const pull = easeInOut(range(ub, 0.0, 1.0));
      cam.position.set(1.2 + pull * 0.8 + shake * Math.sin(t * 90), 0.75 + pull * 0.6 + shake * Math.cos(t * 77), 3.4 + pull * 1.4);
      cam.up.set(0, 1, 0); cam.lookAt(-0.3, 0.2, 0);
      setFov(cam, 50, ctx.aspect);
      labB.position.set(-1.1, 2.2, 0);
      labB.material.opacity = smooth(0.0, 0.12, ub) * (1 - smooth(0.3, 0.4, ub));
      labB.visible = labB.material.opacity > 0.01;
    },
    hud(p) {
      if (p < PB) return [{ k: 'DUST IMPACTS SO FAR', v: '≈ ' + fmt(Math.round(count)), accent: count > 1e8 }, { k: 'EXPECTED OVER THE TRIP', v: '≈ 1,000,000,000' }];
      const items = [{ k: 'GRAIN SIZE', v: '≈ 1 mm' }, { k: 'IMPACT SPEED', v: '20 % of light' }];
      if (ub > 0.34) items.push({ k: 'IMPACT ENERGY', v: '≈ 3 × 10⁸ joules', accent: true }, { k: 'EQUIVALENT', v: 'dozens of kg of TNT', accent: true });
      return items;
    },
  };
}

// =====================================================================  RADIATION
export function radiation(ctx) {
  const group = new THREE.Group();
  const ship = new THREE.Group(); group.add(ship);
  const hullM = new THREE.MeshPhongMaterial({ color: 0xaab4c2, shininess: 60, specular: 0x6a7686 });
  const darkM = new THREE.MeshPhongMaterial({ color: 0x3f4a58, shininess: 30 });
  const sun1 = new THREE.DirectionalLight(0xfff0dd, 2.6); sun1.position.set(-3, 5, 4); group.add(sun1);
  group.add(new THREE.AmbientLight(0x6a7da0, 1.1));
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 4.4, 24), hullM); body.rotation.z = Math.PI / 2; body.position.x = -0.6; ship.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 24), darkM); nose.rotation.z = -Math.PI / 2; nose.position.x = 2.05; ship.add(nose);
  for (let i = 0; i < 5; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.04, 8, 32), darkM); r.rotation.y = Math.PI / 2; r.position.x = -2.2 + i * 0.95; ship.add(r); }
  const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 0.7, 20), darkM); eng.rotation.z = Math.PI / 2; eng.position.x = -3.1; ship.add(eng);
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.02), new THREE.MeshBasicMaterial({ color: 0xffd48a }));
  for (let i = 0; i < 4; i++) { const w = win.clone(); w.position.set(-1.7 + i * 0.9, 0.2, 0.5); ship.add(w); }
  const exhaust = glowSprite(0x7ab8ff, 2.2, { opacity: 0.7 }); exhaust.position.x = -3.7; ship.add(exhaust);
  // shield (grows later)
  const shieldMat = new THREE.MeshBasicMaterial({ color: 0x4af0d0, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false });
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1, 40), shieldMat); shield.rotation.z = Math.PI / 2; group.add(shield);
  const shieldEdge = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.03, 8, 64), new THREE.MeshBasicMaterial({ color: 0x9ffff0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  shieldEdge.rotation.y = Math.PI / 2; group.add(shieldEdge);
  // incoming cosmic rays
  const NR = 360; const rnd = mulberry32(88);
  const ry = new Float32Array(NR), rz = new Float32Array(NR), rv = new Float32Array(NR), ro = new Float32Array(NR), rh = new Uint8Array(NR);
  for (let i = 0; i < NR; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 3.3;
    ry[i] = Math.cos(a) * r; rz[i] = Math.sin(a) * r; rv[i] = 14 + rnd() * 10; ro[i] = rnd() * 20; rh[i] = Math.hypot(ry[i], rz[i]) < 0.9 ? 1 : 0;
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NR * 6), 3));
  lg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NR * 6), 3));
  const rays = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  rays.frustumCulled = false; group.add(rays);
  // showers
  const NSH = 14, PER = 18; const sh = [];
  for (let i = 0; i < NR && sh.length < NSH; i++) if (rh[i]) sh.push(i);
  const NB = NSH * PER; const bv = [];
  for (let i = 0; i < NB; i++) { const a = rnd() * Math.PI * 2, e = (rnd() - 0.5) * 2; bv.push([-(0.3 + rnd() * 1.4), Math.cos(a) * 0.5 * (1 - Math.abs(e) * 0.4), Math.sin(a) * 0.5 * (1 - Math.abs(e) * 0.4)]); }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NB * 3), 3)); bg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NB * 3), 3));
  const burst = new THREE.Points(bg, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: softTex() }));
  burst.frustumCulled = false; group.add(burst);
  const labA = labelSprite('COSMIC RAYS', { height: 0.62, color: '#ff9a8a', sub: 'FAST PARTICLES FROM ALL DIRECTIONS' }); labA.position.set(0.5, 2.4, 0); group.add(labA);
  const labS = labelSprite('RADIATION SHIELD', { height: 0.62, color: '#9ffff0', sub: 'SEVERAL METRES THICK' }); group.add(labS);
  const BOW = 2.5;
  let dose = 0.3, shieldFrac = 0;

  return {
    group, bg: true,
    update(p, t) {
      const cam = ctx.camera;
      shieldFrac = smooth(0.56, 0.78, p);
      const th = shieldFrac * 1.0;     // visual thickness 0..1
      const sx = BOW + 0.1 + th * 0.5;
      shield.scale.set(1, Math.max(0.001, th * 1.0), 1); // cylinder axis after rotation z: Y -> X
      shield.position.set(BOW + 0.55 + th * 0.0, 0, 0);
      shield.scale.y = Math.max(0.001, th * 1.1);
      shield.position.x = BOW + 0.2 + th * 0.55;
      shieldMat.opacity = 0.2 * shieldFrac + 0.08 * shieldFrac * Math.sin(t * 5);
      shieldEdge.position.x = shield.position.x + th * 0.55;
      shieldEdge.material.opacity = shieldFrac * 0.9;
      const frontX = shield.position.x + shield.scale.y / 2;
      const stop = shieldFrac > 0.5 ? frontX : BOW + 0.05;
      const pos = lg.attributes.position.array, col = lg.attributes.color.array;
      const L = 7;
      for (let i = 0; i < NR; i++) {
        const cyc = 20 / rv[i] * 1.0;
        const ph = ((t + ro[i]) % (cyc + 0.0001)) / cyc;      // 0..1
        const head = 14 - ph * 30;                             // x travels from +14 to -16
        const inside = Math.hypot(ry[i], rz[i]) < (shieldFrac > 0.5 ? 1.5 : 0.9);
        const hx = inside ? Math.max(head, stop) : head;
        const tx = hx + (inside && head < stop ? 0 : L * 0.5 + rv[i] * 0.12);
        const tail = inside && head < stop ? Math.min(stop + 1.4, stop + (stop - head) * 0.0 + 1.4) : tx;
        pos[i * 6] = hx; pos[i * 6 + 1] = ry[i]; pos[i * 6 + 2] = rz[i];
        const tt = inside && head < stop ? stop + 1.6 : hx + L * 0.5 + rv[i] * 0.12;
        pos[i * 6 + 3] = tt; pos[i * 6 + 4] = ry[i]; pos[i * 6 + 5] = rz[i];
        const vis = (head > -3 && !(inside && head < stop - 0.4 * 0)) ? 1 : 0;
        const fade = (inside && head < stop) ? Math.max(0, 1 - (stop - head) * 1.6) : 1;
        col[i * 6] = 1.0 * vis * fade; col[i * 6 + 1] = 0.55 * vis * fade; col[i * 6 + 2] = 0.35 * vis * fade;
        col[i * 6 + 3] = 0; col[i * 6 + 4] = 0; col[i * 6 + 5] = 0;
      }
      lg.attributes.position.needsUpdate = true; lg.attributes.color.needsUpdate = true;
      // showers inside the hull (only without a thick shield) or sparks on the shield
      const bp = bg.attributes.position.array, bc = bg.attributes.color.array;
      for (let s = 0; s < NSH; s++) {
        const i = sh[s]; const cyc = 20 / rv[i];
        const ph = ((t + ro[i]) % cyc) / cyc; const head = 14 - ph * 30;
        const k = clamp((stop - head) / 2.6, 0, 1) * (head < stop ? 1 : 0);
        const protectedHull = shieldFrac > 0.5;
        for (let j = 0; j < PER; j++) {
          const b = s * PER + j; const v = bv[b];
          const sc = protectedHull ? 0.12 : 1.0;
          bp[b * 3] = stop + v[0] * k * 1.9 * sc * (protectedHull ? -0.2 : 1) - 0.0;
          bp[b * 3 + 1] = ry[i] + v[1] * k * 1.6 * sc;
          bp[b * 3 + 2] = rz[i] + v[2] * k * 1.6 * sc;
          const f = k > 0 ? Math.max(0, 1 - k) * (protectedHull ? 0.35 : 1.0) : 0;
          bc[b * 3] = 1.0 * f; bc[b * 3 + 1] = 0.35 * f + 0.25 * f * (j % 2); bc[b * 3 + 2] = 0.12 * f;
        }
      }
      bg.attributes.position.needsUpdate = true; bg.attributes.color.needsUpdate = true;
      // camera orbit
      const ang = lerp(2.5, 3.9, p) + Math.sin(t * 0.17) * 0.06;
      const R = lerp(13.5, 11.0, p);
      cam.position.set(1.0 + Math.cos(ang) * R * 0.55, 2.2 + Math.sin(t * 0.2) * 0.3, Math.sin(ang) * R);
      cam.up.set(0, 1, 0); cam.lookAt(0.0, 0, 0);
      setFov(cam, 50, ctx.aspect);
      exhaust.scale.setScalar(2.1 + 0.15 * Math.sin(t * 12));
      dose = lerp(0.18 + 0.7 * smooth(0.0, 0.5, p), 0.12, shieldFrac);
      labA.material.opacity = smooth(0.05, 0.15, p) * (1 - smooth(0.4, 0.52, p)); labA.visible = labA.material.opacity > 0.01;
      labS.position.set(shield.position.x, 2.1, 0); labS.material.opacity = smooth(0.66, 0.8, p); labS.visible = labS.material.opacity > 0.01;
    },
    hud(p) {
      const items = [];
      const colr = dose > 0.6 ? '#ff5a4a' : dose > 0.35 ? '#ffb84a' : '#4af0a0';
      items.push({ gauge: dose, label: 'CREW RADIATION EXPOSURE', color: colr });
      if (p > 0.62) items.push({ k: 'SHIELD AT HIGH SPEED', v: 'SEVERAL METRES', accent: true });
      return items;
    },
  };
}

// =====================================================================  RELATIVITY
export function relativity(ctx) {
  const group = new THREE.Group();
  const stars = makeStarfield({
    count: 40000, seed: 12, radius: 1000, relativistic: true, size: 1.0,
    extra: [
      { dir: V3(1, 0, 0), color: [1.2, 1.1, 0.85], size: 22 },
      { dir: V3(1, 0.002, 0.001), color: [1.0, 0.7, 0.4], size: 11 },
      { dir: V3(-1, 0, 0), color: [1.2, 1.1, 0.8], size: 18 },
    ],
  });
  group.add(stars);
  // cockpit window frame (screen-fixed)
  const shape = new THREE.Shape();
  shape.moveTo(-1, -1); shape.lineTo(1, -1); shape.lineTo(1, 1); shape.lineTo(-1, 1); shape.lineTo(-1, -1);
  const hole = new THREE.Path(); const hw = 0.86, hh = 0.84, rr = 0.12;
  hole.moveTo(-hw + rr, -hh); hole.lineTo(hw - rr, -hh); hole.quadraticCurveTo(hw, -hh, hw, -hh + rr); hole.lineTo(hw, hh - rr);
  hole.quadraticCurveTo(hw, hh, hw - rr, hh); hole.lineTo(-hw + rr, hh); hole.quadraticCurveTo(-hw, hh, -hw, hh - rr); hole.lineTo(-hw, -hh + rr); hole.quadraticCurveTo(-hw, -hh, -hw + rr, -hh);
  shape.holes.push(hole);
  const frame = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: 0x06080c, depthTest: false, depthWrite: false }));
  frame.renderOrder = 100; group.add(frame);
  const rim = new THREE.Line(new THREE.BufferGeometry().setFromPoints(hole.getPoints(12).map((q) => V3(q.x, q.y, 0.001))), new THREE.LineBasicMaterial({ color: 0x6fd3ff, transparent: true, opacity: 0.5, depthTest: false }));
  rim.renderOrder = 101; group.add(rim);
  const T = 3.65, a = 1.032;   // ship years, 1 g in light-years / year^2
  let beta = 0, tauS = 0, tE = 0, phase = 'ACCELERATING';
  const flipA = 0.5, flipB = 0.62;

  return {
    group, bg: false,
    update(p, t) {
      const cam = ctx.camera;
      // ship time: accelerate until the midpoint of the *physics* timeline, brake afterwards
      tauS = T * p;
      const th = tauS < T / 2 ? tauS : T - tauS;
      beta = Math.tanh(a * th);
      const half = Math.sinh(a * T / 2) / a;
      tE = tauS < T / 2 ? Math.sinh(a * tauS) / a : 2 * half - Math.sinh(a * (T - tauS)) / a;
      phase = p < flipA ? 'ACCELERATING · 1 g' : p < flipB ? 'FLIP · TURNING TO BRAKE' : 'BRAKING · 1 g';
      
      stars.material.uniforms.uBeta.value = Math.min(0.9985, beta);
      stars.material.uniforms.uTime.value = t;
      stars.material.uniforms.uVdir.value.set(1, 0, 0);
      cam.position.set(0, 0, 0);
      cam.up.set(0, 1, 0);
      cam.lookAt(1, 0.0, 0);
      cam.rotateZ(Math.sin(t * 0.4) * 0.01 + Math.PI * 2 * easeInOut(range(p, flipA, flipB)));
      stars.material.uniforms.uScale.value = Math.max(1.2, ctx.scale * 1.7);
      setFov(cam, 62, ctx.aspect);
      follow(stars, cam); stars.position.copy(cam.position); stars.quaternion.identity();
      // frame sized to the view, 0.6 in front of the camera
      const d = 0.6; const hh2 = Math.tan(cam.fov * D2R / 2) * d, hw2 = hh2 * ctx.aspect;
      frame.position.set(0, 0, -d).applyQuaternion(cam.quaternion).add(cam.position);
      frame.quaternion.copy(cam.quaternion); frame.scale.set(hw2 * 1.01, hh2 * 1.01, 1);
      rim.position.copy(frame.position); rim.quaternion.copy(frame.quaternion); rim.scale.copy(frame.scale);
      rim.translateZ(0.002);
    },
    hud() {
      return [
        { k: 'SPEED', v: fmt(beta * 100, 1) + ' % of light', big: true },
        { k: 'SHIP CLOCK', v: 'year ' + fmt(tauS, 2) },
        { k: 'EARTH CLOCK', v: 'year ' + fmt(tE, 2), accent: true },
        { k: 'STATUS', v: phase },
      ];
    },
    flash() { return 0; },
  };
}

// =====================================================================  ARRIVAL
export function arrival(ctx) {
  const group = new THREE.Group();
  const SP = V3(-45, 6, -40), PP = V3(8, 0, -60);
  const star = makeStarBody({ radius: 7, c1: [0.9, 0.17, 0.03], c2: [1.0, 0.55, 0.2], granule: 4.0, seed: 3 });
  star.position.copy(SP); group.add(star);
  const g1 = glowSprite(0xff5a20, 60, { opacity: 0.85 }); g1.position.copy(SP); group.add(g1);
  const g2 = glowSprite(0xff9a50, 22, { opacity: 0.8 }); g2.position.copy(SP); group.add(g2);
  const planet = makePlanet({ radius: 2.6, seed: 4.2, colors: [[0.20, 0.09, 0.05], [0.46, 0.24, 0.13], [0.66, 0.40, 0.22], [0.9, 0.75, 0.6]], freq: 2.4, sea: 0.46, atmo: [1.0, 0.5, 0.25], atmoPow: 2.6, sun: SP.clone().sub(PP), ambient: 0.02, sunColor: [1.25, 0.72, 0.45] });
  planet.position.copy(PP); group.add(planet);
  const shell = atmoShell(2.6 * 1.09, [1.0, 0.45, 0.2], 2.2, 0.9); shell.position.copy(PP); group.add(shell);
  const probe = new THREE.Group(); group.add(probe);
  const sail = makeSail(0.5); probe.add(sail);
  const pGlow = glowSprite(0xdff3ff, 2.6, { opacity: 0.9 }); probe.add(pGlow);
  const trail = glowSprite(0x9fd8ff, 1, { opacity: 0.6 }); trail.material.rotation = 0; group.add(trail);
  const beamPts = new Float32Array(60 * 3);
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(beamPts, 3));
  const beam = new THREE.Points(bg, new THREE.PointsMaterial({ color: 0x7fe0ff, size: 9, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, map: softTex() }));
  beam.frustumCulled = false; group.add(beam);
  const beamLine = thickLine([V3(0, 0, 0), V3(0, 0, 1)], 0x7fe0ff, 0.0); group.add(beamLine);
  const labP = labelSprite('PROXIMA b', { height: 2.4, sub: 'FIRST CLOSE-UP IMAGES EVER' }); labP.position.set(PP.x, PP.y + 6.2, PP.z); group.add(labP);
  const labS = labelSprite('SIGNAL TO EARTH', { height: 2.2, color: '#9fdcff', sub: '1 WATT LASER · 4.24 YEARS TO ARRIVE' }); group.add(labS);
  const frames = [];
  for (let i = 0; i < 4; i++) { const f = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([V3(-1, -0.6, 0), V3(1, -0.6, 0), V3(1, 0.6, 0), V3(-1, 0.6, 0)]), new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0, depthTest: false })); f.renderOrder = 60; group.add(f); frames.push(f); }
  const probeZ = (p) => { const u = p - 0.45; const f = u * (0.25 + 0.75 * smooth(0, 0.2, Math.abs(u))); return -60 - 640 * f; };
  const pz = { z: 0 };

  return {
    group, bg: true,
    flash(p) { return Math.max(0, 1 - Math.abs(p - 0.455) / 0.012) * 0.55; },
    update(p, t) {
      const cam = ctx.camera;
      star.userData.uniforms.uTime.value = t; planet.userData.uniforms.uTime.value = t;
      const z = probeZ(p); pz.z = z;
      const pr = V3(0.0, 0.0, z);
      probe.position.copy(pr); probe.rotation.set(0, 0, 0);
      const vz = Math.abs(probeZ(p + 0.002) - probeZ(p - 0.002)) / 0.004;
      trail.position.set(0, 0, z + vz * 0.012); trail.scale.set(1.2, 1.2, 1); trail.material.opacity = 0.0;
      const sHot = 1.0;
      if (p < 0.32) {
        cam.position.set(1.2, 0.9, z + 6.5); cam.up.set(0, 1, 0);
        cam.lookAt(0.0 + (PP.x * 0.5) * smooth(0.0, 0.32, p), 0, z - 40);
        setFov(cam, 58, ctx.aspect);
      } else if (p < 0.62) {
        const w = range(p, 0.32, 0.62);
        cam.position.set(15.5, 2.4, -48 + 6 * w); cam.up.set(0, 1, 0);
        const look = pr.clone().lerp(PP, 0.45);
        cam.lookAt(look);
        setFov(cam, 52, ctx.aspect);
      } else if (p < 0.84) {
        const w = range(p, 0.62, 0.84);
        cam.position.set(6.5, 1.2, -66 + 0 * w); cam.up.set(0, 1, 0);
        cam.lookAt(pr.clone().lerp(V3(0, 0, -120), 0.2));
        setFov(cam, 50, ctx.aspect);
      } else {
        cam.position.set(2.5, 1.4, -170); cam.up.set(0, 1, 0);
        cam.lookAt(pr);
        setFov(cam, 42, ctx.aspect);
      }
      const dd = cam.position.distanceTo(pr);
      pGlow.scale.setScalar(Math.max(1.2, dd * 0.035));
      sail.scale.setScalar(Math.max(1, dd * 0.05));
      pGlow.material.opacity = 0.75 * (1 - smooth(0.93, 1.0, p));
      const dl = planet.position.clone().negate().add(SP).normalize();
      planet.userData.uniforms.uSun.value.copy(dl);
      planet.rotation.y = t * 0.02;
      // data beam
      const bShow = smooth(0.58, 0.68, p) * (1 - smooth(0.9, 0.98, p));
      const ba = bg.attributes.position.array;
      for (let i = 0; i < 60; i++) { const s = ((i / 60) + t * 0.18) % 1; ba[i * 3] = pr.x; ba[i * 3 + 1] = pr.y; ba[i * 3 + 2] = pr.z + s * 260; }
      bg.attributes.position.needsUpdate = true; beam.material.opacity = bShow; beam.material.size = 9 * ctx.scale;
      beamLine.material.opacity = bShow * 0.35; beamLine.geometry.setFromPoints([pr, V3(pr.x, pr.y, pr.z + 330)]);
      labS.position.set(pr.x + 3, pr.y + Math.max(5, dd * 0.07), pr.z + 18 + dd * 0.15);
      labS.scale.set(Math.max(1, dd * 0.045) * 5.33 * 1.0, Math.max(1, dd * 0.045) * 1.0, 1); labS.material.opacity = bShow;
      labS.visible = bShow > 0.01;
      labP.material.opacity = smooth(0.12, 0.26, p) * (1 - smooth(0.4, 0.5, p)); labP.visible = labP.material.opacity > 0.01;
      // viewfinder
      const vf = (p > 0.4 && p < 0.52) ? 1 : 0;
      frames.forEach((f, i) => {
        const fp = pr.clone().lerp(PP, 0.5);
        f.position.copy(fp); f.quaternion.copy(cam.quaternion);
        const k = 1 - i * 0.18; f.scale.setScalar(8 * k + 4);
        f.material.opacity = vf * (0.8 - i * 0.18) * (0.55 + 0.45 * Math.sin(t * 14 + i));
      });
    },
    hud(p) {
      const items = [];
      if (p < 0.62) items.push({ k: 'FLYBY SPEED', v: '≈ 35 AU per day' });
      if (p > 0.38 && p < 0.58) items.push({ k: 'CAMERA', v: 'CAPTURING IMAGES', accent: true });
      if (p > 0.6 && p < 0.92) items.push({ k: 'DATA LINK', v: '1 watt laser · 4+ years home', accent: true });
      if (p > 0.9) items.push({ k: 'MISSION STATUS', v: 'PROBE LOST TO THE DARK' });
      return items;
    },
  };
}

// =====================================================================  FINALE
export function finale(ctx) {
  const group = new THREE.Group();
  const E = V3(-14, -13, -30);
  const earth = makePlanet({ radius: 14, seed: 2.1, colors: [[0.02, 0.07, 0.25], [0.05, 0.22, 0.45], [0.12, 0.35, 0.14], [0.92, 0.94, 0.98]], freq: 2.2, sea: 0.5, atmo: [0.35, 0.6, 1.0], atmoPow: 2.8, sun: V3(0.7, 0.45, 0.55), ambient: 0.03, clouds: 0.8, nightLights: 1.0 });
  earth.position.copy(E); group.add(earth);
  const eShell = atmoShell(15.1, [0.3, 0.55, 1.0], 3.0, 1.1); eShell.position.copy(E); group.add(eShell);
  const AC = V3(22, 10, -160);
  const ac = starSprite(0xfff2d0, 34, true); ac.position.copy(AC); group.add(ac);
  const acB = glowSprite(0xffb070, 10, { opacity: 0.9 }); acB.position.copy(AC).add(V3(0.8, -0.4, 0)); group.add(acB);
  const pr = starSprite(0xff6a4a, 5, false); pr.position.copy(AC).add(V3(-5.5, 2.2, 6)); group.add(pr);
  const lab = labelSprite('ALPHA CENTAURI', { height: 6, sub: '4.37 LIGHT YEARS · THE NEAREST SHORE' }); lab.position.copy(AC).add(V3(0, -16, 0)); group.add(lab);
  // fleet path from Earth towards the star
  const start = E.clone().add(V3(10, 11, -4));
  const NPT = 90; const pa = new Float32Array(NPT * 3), pc = new Float32Array(NPT * 3);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pa, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  const path = new THREE.Points(pg, new THREE.PointsMaterial({ size: 1.6, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: softTex(), sizeAttenuation: true }));
  path.frustumCulled = false; group.add(path);
  const line = thickLine([start, AC.clone().add(V3(0, -4, 0))], 0x6fd3ff, 0.25); group.add(line);

  return {
    group, bg: true,
    update(p, t) {
      const cam = ctx.camera;
      earth.userData.uniforms.uTime.value = t;
      const push = easeInOut(p);
      cam.position.set(0, 0, -push * 14); cam.up.set(0, 1, 0);
      cam.lookAt(lerp(4, 8, p), lerp(1, 4, p), -140);
      setFov(cam, lerp(58, 44, push), ctx.aspect);
      earth.rotation.y = t * 0.012;
      ac.userData.setScale(34 * (1 + 0.03 * Math.sin(t * 2.5)));
      const a = pg.attributes.position.array, c = pg.attributes.color.array;
      const target = AC.clone().add(V3(0, -4, 0));
      for (let i = 0; i < NPT; i++) {
        const s = ((i / NPT) + t * 0.035) % 1;
        const pt = start.clone().lerp(target, s);
        a[i * 3] = pt.x; a[i * 3 + 1] = pt.y; a[i * 3 + 2] = pt.z;
        const f = Math.sin(Math.PI * s) * (0.35 + 0.65 * ((i * 7) % 5) / 5);
        c[i * 3] = 0.45 * f; c[i * 3 + 1] = 0.85 * f; c[i * 3 + 2] = 1.0 * f;
      }
      pg.attributes.position.needsUpdate = true; pg.attributes.color.needsUpdate = true;
      path.material.size = 1.7 + (ctx.aspect < 1 ? 1.0 : 0);
      line.material.opacity = 0.25 * smooth(0.15, 0.4, p);
      lab.material.opacity = smooth(0.35, 0.55, p) * (1 - smooth(0.74, 0.8, p)); lab.visible = lab.material.opacity > 0.01;
    },
    hud() { return null; },
  };
}
