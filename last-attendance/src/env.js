'use strict';
// ============================================================
//  자연환경: 하늘, 해·달·별, 시간대, 날씨(맑음/흐림/비/폭풍/안개), 바람, 그림자, 그래픽 품질
// ============================================================
const ENV = {
  hour: 16.2, rate: 1 / 150, weather: 'clear', wx: 0, t: 0, wind: { a: 0.6, s: 0.4 }, lightning: 0, nextBolt: 8, ug: false,
  U: { uTime: { value: 0 }, uWind: { value: 0.4 }, uWindDir: { value: new THREE.Vector2(1, 0.3) } },
  sunDir: new THREE.Vector3(), facades: [], glows: [], gfx: 'high',
};
const WEATHER = {
  clear:  { name: '맑음', light: 1.0, grey: 0.0, rain: 0, wind: 0.35, fogFar: 230, fogNear: 70, cloud: 0.25, petals: 1 },
  cloudy: { name: '흐림', light: 0.6, grey: 0.55, rain: 0, wind: 0.6, fogFar: 170, fogNear: 50, cloud: 0.8, petals: 0.6 },
  rain:   { name: '비', light: 0.42, grey: 0.75, rain: 1, wind: 0.75, fogFar: 120, fogNear: 25, cloud: 1, petals: 0 },
  storm:  { name: '폭풍우', light: 0.3, grey: 0.85, rain: 1.6, wind: 1.3, fogFar: 85, fogNear: 15, cloud: 1, petals: 0 },
  fog:    { name: '안개', light: 0.55, grey: 0.6, rain: 0, wind: 0.12, fogFar: 55, fogNear: 4, cloud: 0.6, petals: 0.2 },
};
const CH_ENV = { prologue: [16.2, 'clear'], ch1: [16.5, 'cloudy'], ch2: [17.0, 'rain'], ch3: [18.7, 'storm'], ch4: [5.3, 'fog'], ch5: [6.2, 'clear'], ch6: [7.2, 'clear'] };

// ---------- 캔버스 텍스처 ----------
function canvasTex(w, h, draw, rx, ry) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1);
  if (renderer) t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); t.encoding = THREE.sRGBEncoding; return t;
}
const noise = (g, w, h, n, cols, sz) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[(Math.random() * cols.length) | 0]; const s = sz * (0.5 + Math.random()); g.fillRect(Math.random() * w, Math.random() * h, s, s * (0.6 + Math.random())); } };
const TEX = {};
// 값 노이즈 (텍스처용)
function vnoise(w, h, cell, seed) { const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2, G2 = []; let sd = seed || 7;
  const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647; for (let i = 0; i < gw * gh; i++) G2.push(R());
  return (x, y) => { const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const g = (a, b) => G2[((b % gh) + gh) % gh * gw + ((a % gw) + gw) % gw]; return (g(ix, iy) * (1 - sx) + g(ix + 1, iy) * sx) * (1 - sy) + (g(ix, iy + 1) * (1 - sx) + g(ix + 1, iy + 1) * sx) * sy; }; }
function pixTex(w, h, fn, rx, ry, linear) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), im = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = fn(x, y), i = (y * w + x) * 4; im.data[i] = v[0]; im.data[i + 1] = v[1]; im.data[i + 2] = v[2]; im.data[i + 3] = v[3] === undefined ? 255 : v[3]; }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); if (!linear) t.encoding = THREE.sRGBEncoding;
  if (renderer) t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t; }
function leafTex(cols, kind) {
  return canvasTex(256, 256, (g, w, h) => { g.clearRect(0, 0, w, h);
    for (let i = 0; i < (kind === 'pine' ? 260 : 150); i++) { const x = 20 + Math.random() * 216, y = 20 + Math.random() * 216, d = Math.hypot(x - 128, y - 128); if (d > 118) continue;
      g.save(); g.translate(x, y); g.rotate(Math.random() * 6.28); g.fillStyle = cols[(Math.random() * cols.length) | 0];
      if (kind === 'pine') { g.fillRect(-1, -9, 2, 18); } else { g.beginPath(); g.ellipse(0, 0, kind === 'cherry' ? 6 : 9, kind === 'cherry' ? 5 : 4.5, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(-8, -0.5, 16, 1); }
      g.restore(); } });
}
function makeTextures() {
  const n1 = vnoise(512, 512, 64, 3), n2 = vnoise(512, 512, 16, 5), n3 = vnoise(512, 512, 4, 9);
  TEX.grass = pixTex(512, 512, (x, y) => { const v = n1(x, y) * 0.5 + n2(x, y) * 0.3 + n3(x, y) * 0.2, r = Math.random() * 0.12;
    return [62 + v * 40 + r * 40, 96 + v * 52 + r * 50, 40 + v * 26 + r * 20]; }, 46, 40);
  const a1 = vnoise(256, 256, 32, 11), a2 = vnoise(256, 256, 6, 12);
  TEX.asphalt = pixTex(256, 256, (x, y) => { const v = 70 + a1(x, y) * 14 + a2(x, y) * 10 + (Math.random() < 0.08 ? (Math.random() * 40 - 15) : Math.random() * 8); return [v, v + 1, v + 3]; });
  const w1 = vnoise(256, 256, 40, 21);
  TEX.walk = pixTex(256, 256, (x, y) => { const tx = Math.floor((x + (Math.floor(y / 32) % 2) * 16) / 32), ty = Math.floor(y / 32), m = (x + (Math.floor(y / 32) % 2) * 16) % 32 < 2 || y % 32 < 2;
    if (m) return [120, 112, 102]; const tv = ((tx * 37 + ty * 91) % 13) / 13 * 18, v = 178 + tv + w1(x, y) * 20 + Math.random() * 10; return [v + 6, v, v - 10]; });
  TEX.bark = pixTex(64, 128, (x, y) => { const v = 70 + Math.sin(x * 0.9 + Math.sin(y * 0.15) * 2) * 12 + Math.random() * 18; return [v, v * 0.78, v * 0.6]; });
  const wn = vnoise(256, 256, 24, 31), wn2 = vnoise(256, 256, 8, 32), ht = (x, y) => wn(x, y) * 0.7 + wn2(x, y) * 0.3;
  TEX.waterN = pixTex(256, 256, (x, y) => { const dx = ht(x + 1, y) - ht(x - 1, y), dy = ht(x, y + 1) - ht(x, y - 1); return [128 + dx * 500, 128 + dy * 500, 255]; }, 10, 10, true);
  TEX.water = TEX.waterN;
  TEX.track = pixTex(128, 128, (x, y) => { const v = Math.random() * 18; return [160 + v, 78 + v * 0.6, 58 + v * 0.4]; }, 20, 12);
  TEX.cloud = canvasTex(256, 128, (g, w, h) => { for (let i = 0; i < 40; i++) { const x = 30 + Math.random() * 196, y = 40 + Math.random() * 50, r = 14 + Math.random() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); } });
  TEX.glow = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.25, 'rgba(255,220,150,.6)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  TEX.petal = canvasTex(16, 16, (g) => { g.fillStyle = '#ffd1df'; g.beginPath(); g.ellipse(8, 8, 6, 3.5, 0.6, 0, 7); g.fill(); });
  TEX.leaf = { round: leafTex(['#3f7a2c', '#4b8a33', '#5a9a3c', '#356b26', '#6aa846']), cherry: leafTex(['#eaa3bb', '#f2b8ca', '#de8fab', '#f6cad8', '#6f9448'], 'cherry'),
    autumn: leafTex(['#d98a2b', '#c96f24', '#e8a83f', '#b8562a', '#9a7a2a']), pine: leafTex(['#2b5a24', '#356a2c', '#244d1f', '#3f7232'], 'pine'), bush: leafTex(['#3a6e2a', '#457d31', '#2f5f24', '#55903a']) };
}
// 바람에 흔들리는 재질
function addSway(m, amp) {
  amp = amp || 0.045;
  m.customProgramCacheKey = () => 'sway' + amp + (m.isMeshDepthMaterial ? 'd' : '');
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, ENV.U);
    sh.vertexShader = 'uniform float uTime; uniform float uWind; uniform vec2 uWindDir;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 ip = vec3(0.0);
      #endif
      float ph = uTime * (1.3 + uWind) + ip.x * 0.31 + ip.z * 0.23 + position.x * 0.8;
      float k = max(position.y - 1.2, 0.0) * ${amp.toFixed(3)} * uWind;
      transformed.x += (sin(ph) * 0.6 + uWind * 0.8) * k * uWindDir.x + sin(ph * 3.1 + position.z) * 0.02 * uWind;
      transformed.z += (sin(ph * 1.13) * 0.6 + uWind * 0.8) * k * uWindDir.y + cos(ph * 2.7 + position.x) * 0.02 * uWind;`);
  };
  return m;
}
function swayMaterial(color) { return addSway(stdMat({ color, roughness: 0.8 })); }
function leafMaterial(tex) {
  const m = addSway(stdMat({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75 }), 0.05);
  const d = addSway(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.45 }), 0.05);
  return [m, d];
}

// ---------- 하늘 / 날씨 오브젝트 ----------
function initEnv() {
  // 그림자
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = sc.bottom = -60; sc.right = sc.top = 60; sc.near = 1; sc.far = 320;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; scene.add(sun.target);
  moonLight = new THREE.DirectionalLight('#9fb6ff', 0); scene.add(moonLight); scene.add(moonLight.target);
  camera.far = 1600; camera.updateProjectionMatrix();
  // 대기 산란 하늘 + 흐림/밤 덮개
  const mkSky = () => { const k = new THREE.Sky(); k.scale.setScalar(1400); k.frustumCulled = false; const m = k.material; m.fog = false;
    m.uniforms.skyGain = { value: 1 }; m.uniforms.overCol = { value: new THREE.Color() }; m.uniforms.overA = { value: 0 }; m.fragmentShader = 'uniform float skyGain; uniform vec3 overCol; uniform float overA;\n' + m.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( mix( pow( max(retColor, 0.0), vec3(2.2) ) * skyGain, overCol, overA ), 1.0 );')
      .replace('#include <tonemapping_fragment>', ''); return k; };
  ENV.sky = mkSky(); scene.add(ENV.sky);
  ENV.envScene = new THREE.Scene(); ENV.sky2 = mkSky(); ENV.envScene.add(ENV.sky2);
  ENV.pmrem = new THREE.PMREMGenerator(renderer); ENV.envT = 99; ENV.wetMats = ENV.wetMats || [];
  // 별
  const sg = new THREE.BufferGeometry(), sp = [];
  for (let i = 0; i < 1800; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.283, r = 640, s = Math.sqrt(1 - u * u); if (u < 0.05) continue; sp.push(Math.cos(a) * s * r, u * r, Math.sin(a) * s * r); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  ENV.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false })); ENV.stars.frustumCulled = false; scene.add(ENV.stars);
  // 달
  ENV.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: '#e8eeff', transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); ENV.moon.scale.set(40, 40, 1); scene.add(ENV.moon);
  // 구름
  ENV.clouds = new THREE.Group(); scene.add(ENV.clouds);
  for (let i = 0; i < 34; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.cloud, color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false, fog: false }));
    s.position.set(rand(-560, 560), rand(150, 230), rand(-560, 560)); const k = rand(90, 170); s.scale.set(k * 2.2, k, 1); ENV.clouds.add(s); }
  // 비
  const RN = 3000, rg = new THREE.BufferGeometry(), rp = new Float32Array(RN * 6);
  ENV.drops = []; for (let i = 0; i < RN; i++) ENV.drops.push({ x: rand(-35, 35), y: rand(0, 30), z: rand(-35, 35), v: rand(22, 30) });
  rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  ENV.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#b9c8da', transparent: true, opacity: 0.55, depthWrite: false })); ENV.rain.frustumCulled = false; scene.add(ENV.rain);
  // 벚꽃잎
  const PN = 260, pg = new THREE.BufferGeometry(), pp = new Float32Array(PN * 3); ENV.pet = [];
  for (let i = 0; i < PN; i++) ENV.pet.push({ x: rand(-30, 30), y: rand(0, 12), z: rand(-30, 30), s: rand(0.4, 1.2), p: rand(0, 6) });
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  ENV.petals = new THREE.Points(pg, new THREE.PointsMaterial({ map: TEX.petal, size: 0.35, transparent: true, depthWrite: false, alphaTest: 0.3 })); ENV.petals.frustumCulled = false; scene.add(ENV.petals);
  initGrass();
  try { ENV.gfx = localStorage.getItem('la_gfx') || (('ontouchstart' in window) ? 'mid' : 'high'); } catch (e) {}
  applyGfx();
}
let moonLight;
// ---------- 풀잎 들판 (플레이어 주변 64m 를 따라다니는 인스턴스 풀) ----------
const GRASS = { N: 45000, T: 64 };
function initGrass() {
  // 풀이 자랄 수 있는 곳 마스크 (1px = 1m)
  const W = MAP.x1 - MAP.x0, D = MAP.z1 - MAP.z0, c = document.createElement('canvas'); c.width = W; c.height = D; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, D); g.fillStyle = '#000'; g.strokeStyle = '#000'; g.lineCap = 'round';
  const X = x => x - MAP.x0, Z = z => z - MAP.z0;
  WORLD.roads.forEach(([x1, z1, x2, z2, w]) => { g.lineWidth = w + 7; g.beginPath(); g.moveTo(X(x1), Z(z1)); g.lineTo(X(x2), Z(z2)); g.stroke(); });
  WORLD.buildings.forEach(b => g.fillRect(X(b.x0) - 1.5, Z(b.z0) - 1.5, b.x1 - b.x0 + 3, b.z1 - b.z0 + 3));
  WORLD.walls.forEach(w => { if ((w.f0 || 0) <= 0 && w.w * w.d > 1.5) g.fillRect(X(w.x) - 0.5, Z(w.z) - 0.5, w.w + 1, w.d + 1); });
  const F = WORLD.field; if (F) { g.fillRect(X(F.x - F.w / 2 - 10), Z(F.z - F.d / 2 - 10), F.w + 20, F.d + 20); }
  g.beginPath(); g.arc(X(24), Z(-30), 16, 0, 7); g.fill(); g.fillRect(X(-122 - 49), Z(92 - 53), 98, 106); g.fillRect(X(-66 - 14), Z(118 - 25), 28, 50);
  const mt = new THREE.CanvasTexture(c); mt.flipY = false; mt.minFilter = THREE.LinearFilter; mt.generateMipmaps = false;
  // 풀잎 하나: 4단 테이퍼 띠
  const base = new THREE.BufferGeometry(), P = [], U = [];
  for (let i = 0; i <= 4; i++) { const t = i / 4, wd = 0.032 * (1 - t * 0.85); P.push(-wd, t, 0, wd, t, 0); U.push(0, t, 1, t); }
  const I = []; for (let i = 0; i < 4; i++) { const a = i * 2; I.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  const geo = new THREE.InstancedBufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); geo.setIndex(I);
  const off = new Float32Array(GRASS.N * 4); for (let i = 0; i < GRASS.N; i++) { off[i * 4] = Math.random() * GRASS.T; off[i * 4 + 1] = Math.random() * GRASS.T; off[i * 4 + 2] = Math.random(); off[i * 4 + 3] = Math.random(); }
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4)); geo.instanceCount = GRASS.N;
  GRASS.U = { uCenter: { value: new THREE.Vector2() }, uMask: { value: mt }, uMap: { value: new THREE.Vector4(MAP.x0, MAP.z0, W, D) }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() },
    uAmb: { value: new THREE.Color() }, uFogCol: { value: new THREE.Color() }, uFog: { value: new THREE.Vector2(60, 160) }, uWet: { value: 0 } };
  const m = new THREE.ShaderMaterial({ uniforms: Object.assign(GRASS.U, ENV.U), side: THREE.DoubleSide,
    vertexShader: `uniform vec2 uCenter; uniform sampler2D uMask; uniform vec4 uMap; uniform float uTime; uniform float uWind; uniform vec2 uWindDir; attribute vec4 aOff;
      varying float vH; varying float vR; varying vec3 vN; varying float vD; varying float vM;
      void main(){ vec2 p = uCenter + mod(aOff.xy - uCenter + ${(GRASS.T / 2).toFixed(1)}, ${GRASS.T.toFixed(1)}) - ${(GRASS.T / 2).toFixed(1)};
        float d = length(p - uCenter); float m = texture2D(uMask, (p - uMap.xy) / uMap.zw).r; float fade = 1.0 - smoothstep(${(GRASS.T / 2 - 8).toFixed(1)}, ${(GRASS.T / 2).toFixed(1)}, d);
        float h = (0.14 + aOff.z * 0.24) * smoothstep(0.35, 0.8, m) * fade; float a = aOff.w * 6.283; vec2 dir = vec2(cos(a), sin(a));
        vec3 pos = position; float t = uv.y; vH = t; vR = aOff.z; vM = m;
        float ph = uTime * (1.6 + uWind * 1.5) + p.x * 0.35 + p.y * 0.27; float bend = (0.15 + aOff.z * 0.2 + uWind * (0.35 + 0.25 * sin(ph))) * t * t;
        vec3 wp = vec3(p.x + pos.x * dir.y, pos.y * h, p.y - pos.x * dir.x);
        vec2 lean = normalize(uWindDir + dir * 0.6) * bend * h * 2.2; wp.xz += lean; wp.y -= length(lean) * 0.35 * t;
        vN = normalize(vec3(dir.x * 0.4 + lean.x, 1.0, dir.y * 0.4 + lean.y));
        vec4 mv = modelViewMatrix * vec4(wp, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uAmb; uniform vec3 uFogCol; uniform vec2 uFog; uniform float uWet; varying float vH; varying float vR; varying vec3 vN; varying float vD; varying float vM;
      void main(){ vec3 root = vec3(0.035, 0.07, 0.02), tip = mix(vec3(0.12, 0.26, 0.05), vec3(0.22, 0.32, 0.08), vR * vR);
        vec3 c = mix(root, tip, vH) * (1.0 - uWet * 0.25); float ndl = max(dot(normalize(vN), uSunDir), 0.0) * 0.8 + 0.2;
        float sss = pow(max(dot(vec3(0.0,1.0,0.0), uSunDir), 0.0), 2.0) * vH * 0.25;
        vec3 col = c * (uAmb * (0.5 + 0.5 * vH) + uSunCol * (ndl + sss));
        float f = smoothstep(uFog.x, uFog.y, vD); gl_FragColor = vec4(mix(col, uFogCol, f), 1.0); }` });
  GRASS.mesh = new THREE.Mesh(geo, m); GRASS.mesh.frustumCulled = false; GRASS.mesh.userData.noShadow = true; scene.add(GRASS.mesh);
}
function updateGrass(ug, sunI, hemiC, hemiI) {
  if (!GRASS.mesh) return;
  const n = ENV.gfx === 'high' ? GRASS.N : ENV.gfx === 'mid' ? 18000 : 0, me = G.me, inside = me && (inBuilding(me.x, me.z) && (me.fl || 0) > 0);
  GRASS.mesh.visible = n > 0 && !ug && !inside; if (!GRASS.mesh.visible) return; GRASS.mesh.geometry.instanceCount = n;
  const U = GRASS.U; U.uCenter.value.set(camera.position.x, camera.position.z);
  if (me && G.view !== 'top') U.uCenter.value.set((camera.position.x + me.x) / 2, (camera.position.z + me.z) / 2);
  U.uSunDir.value.copy(ENV.sunDir); U.uSunCol.value.copy(sun.color).multiplyScalar(sunI); U.uAmb.value.copy(hemiC).multiplyScalar(hemiI * 1.6 + (scene.environment ? 0.35 * (1 - G.night) : 0));
  U.uFogCol.value.copy(scene.fog.color); U.uFog.value.set(scene.fog.near, scene.fog.far); U.uWet.value = ENV.wet || 0;
}
function applyGfx() {
  const q = ENV.gfx;
  renderer.setPixelRatio(q === 'high' ? Math.min(window.devicePixelRatio || 1, 2) : q === 'mid' ? Math.min(window.devicePixelRatio || 1, 1.25) : 0.85);
  renderer.shadowMap.enabled = q !== 'low'; sun.castShadow = q !== 'low';
  const ms = q === 'high' ? 2048 : 1024; if (sun.shadow.mapSize.x !== ms) { sun.shadow.mapSize.set(ms, ms); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  ENV.rainN = q === 'high' ? 3000 : q === 'mid' ? 1600 : 600; ENV.rain.geometry.setDrawRange(0, ENV.rainN * 2);
  ENV.clouds.children.forEach((c, i) => c.visible = q !== 'low' || i % 3 === 0);
  scene.traverse(o => { if (o.material) { const ms2 = Array.isArray(o.material) ? o.material : [o.material]; ms2.forEach(m => m.needsUpdate = true); } });
  ENV.envKey = null; if (typeof onResize === 'function') onResize();
}
function cycleGfx() { ENV.gfx = { high: 'mid', mid: 'low', low: 'high' }[ENV.gfx]; try { localStorage.setItem('la_gfx', ENV.gfx); } catch (e) {} applyGfx(); UI.banner(`그래픽: ${{ high: '높음', mid: '보통', low: '낮음' }[ENV.gfx]}`, '#fff', 1.6); }
// 모든 메시에 그림자 적용 (월드 구성 후 / 캐릭터 생성 시)
function shadowAll(root, cast, recv) { root.traverse(o => { if ((o.isMesh || o.isInstancedMesh) && !o.userData.noShadow) { if (cast && !o.userData.noCast) o.castShadow = true; if (recv) o.receiveShadow = true; } }); }

// ---------- 시간 / 날씨 ----------
function setChapterEnv(id) { const e = CH_ENV[id] || [12, 'clear']; ENV.hour = e[0]; setWeather(e[1], true); }
function setHour(h) { ENV.hour = h; }
function setWeather(w, instant) { ENV.weather = w; if (instant) ENV.wx = 1; ENV.prevW = ENV.curW || w; ENV.curW = w; ENV.blend = instant ? 1 : 0; }
function sunElev(h) { h = ((h % 24) + 24) % 24; if (h >= 5.4 && h <= 19.6) return Math.sin((h - 5.4) / 14.2 * Math.PI); const k = h > 19.6 ? h - 19.6 : h + 4.4; return -Math.sin(k / 9.8 * Math.PI) * 0.6; }
function nightOf(h) { return clamp(0.35 - sunElev(h) * 2.6, 0, 1); }
// 예전 코드 호환: 밤 정도로 시간 맞추기
function setNight(n) { if (G.me && G.chapterIdx >= 4 && G.chapterIdx <= 4) ENV.hour = 5.3 + (1 - n) * 1.2; else ENV.hour = n < 0.05 ? 15 : 18.7 + n * 3.3; }
const C3 = (a) => new THREE.Color(a);
const SKY = { dayT: C3('#3f86d8'), dayB: C3('#cfe6f7'), setT: C3('#36457e'), setB: C3('#f3a35e'), nightT: C3('#02040c'), nightB: C3('#0e1428'), greyT: C3('#6f7882'), greyB: C3('#a9b1b8') };
const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();
function lerpW(key) { const A = WEATHER[ENV.prevW || ENV.weather][key], B = WEATHER[ENV.curW || ENV.weather][key]; return A + (B - A) * (ENV.blend === undefined ? 1 : ENV.blend); }

function updateEnv(dt) {
  ENV.t += dt; ENV.U.uTime.value = ENV.t;
  const me = G.me, ug = me && underground(me.x);
  if (G.running && !G.paused && !ug) ENV.hour += dt * ENV.rate;
  if (ENV.blend < 1) ENV.blend = Math.min(1, ENV.blend + dt / 6);
  const el = sunElev(ENV.hour), night = nightOf(ENV.hour); G.night = ug ? 1 : night;
  const W = { light: lerpW('light'), grey: lerpW('grey'), rain: lerpW('rain'), wind: lerpW('wind'), fogFar: lerpW('fogFar'), fogNear: lerpW('fogNear'), cloud: lerpW('cloud'), petals: lerpW('petals') };
  // 바람
  ENV.wind.a += dt * 0.02 * Math.sin(ENV.t * 0.05); const gust = Math.max(0, Math.sin(ENV.t * 0.37) * Math.sin(ENV.t * 0.11)) * 0.6;
  ENV.wind.s = W.wind * (0.75 + 0.25 * Math.sin(ENV.t * 0.23)) + gust * W.wind;
  ENV.U.uWind.value = ENV.wind.s; ENV.U.uWindDir.value.set(Math.cos(ENV.wind.a), Math.sin(ENV.wind.a));
  // 해 방향
  const h = ((ENV.hour % 24) + 24) % 24, az = (h - 6) / 12 * Math.PI;
  ENV.sunDir.set(-Math.cos(az) * 0.9, Math.max(el, -0.3), -0.45).normalize();
  // 하늘: 대기 산란 + 흐림/밤 덮개
  const sunset = clamp(1 - Math.abs(el - 0.05) / 0.22, 0, 1) * (el > -0.15 ? 1 : 0);
  const top = tmpC.copy(SKY.dayT).lerp(SKY.setT, sunset * 0.8).lerp(SKY.nightT, night), bot = tmpC2.copy(SKY.dayB).lerp(SKY.setB, sunset).lerp(SKY.nightB, night);
  top.lerp(SKY.greyT.clone().multiplyScalar(1 - night * 0.85), W.grey * 0.85); bot.lerp(SKY.greyB.clone().multiplyScalar(1 - night * 0.85), W.grey * 0.85);
  const flash = ENV.lightning > 0 ? ENV.lightning : 0;
  if (ug) { const lab = me.z > 70; top.set(lab ? '#1a2230' : '#07080c'); bot.copy(top); }
  const sd = ENV.sunDir;
  for (const k of [ENV.sky, ENV.sky2]) {
    const u = k.material.uniforms; u.sunPosition.value.set(sd.x, Math.max(sd.y, -0.12), sd.z).multiplyScalar(400);
    u.turbidity.value = 2.2 + W.grey * 8 + sunset * 2; u.rayleigh.value = 1.2 + sunset * 1.6 - W.grey * 0.6; u.mieCoefficient.value = 0.004 + sunset * 0.004; u.mieDirectionalG.value = 0.82;
    u.skyGain.value = (1 + flash * 3) * (1 - night * 0.92) * (k === ENV.sky2 ? 0.5 : 0.85);
    u.overCol.value.copy(bot).lerp(C3('#070b16'), night).convertSRGBToLinear().multiplyScalar(1 + flash * 4);
    u.overA.value = ug ? 1 : clamp(Math.max(W.grey * 0.82, night * 0.75), 0, 1);
    if (ug) u.overCol.value.copy(top).convertSRGBToLinear();
  }
  ENV.sky.position.copy(camera.position);
  scene.background = bot; scene.fog.color.copy(bot).convertSRGBToLinear().multiplyScalar(0.72 + 0.28 * W.grey);
  scene.fog.near = ug ? 14 : W.fogNear * 1.3 * (1 - night * 0.3); scene.fog.far = ug ? (me.z > 70 ? 70 : 48) : W.fogFar * (1.2 + 0.5 * (1 - W.grey)) * (1 - night * 0.35);
  // 환경광(반사·간접광) 맵: 시간·날씨가 바뀌면 다시 굽기
  const ek = Math.round(ENV.hour * 6) + '|' + Math.round(W.grey * 10) + '|' + (ug ? 1 : 0);
  if (ENV.envKey !== ek && ENV.gfx !== 'low' && (ENV.envT += dt) > 0.5) { ENV.envKey = ek; ENV.envT = 0;
    if (ug) { scene.environment = null; } else { const rt = ENV.pmrem.fromScene(ENV.envScene, 0, 1, 2000); if (ENV.envRT) ENV.envRT.dispose(); ENV.envRT = rt; scene.environment = rt.texture; } }
  if (ENV.gfx === 'low' && scene.environment) scene.environment = null;
  // 조명
  const day = clamp(el * 3 + 0.25, 0, 1), envOn = !!scene.environment;
  sun.color.set(sunset > 0.4 ? '#ffb27a' : '#fff1dc').convertSRGBToLinear(); sun.intensity = ug ? 0 : day * 2.3 * W.light * (1 - W.grey * 0.45);
  hemi.color.copy(bot).lerp(C3('#ffffff'), 0.3).convertSRGBToLinear(); hemi.groundColor.set(night > 0.5 ? '#141820' : '#5a5a40').convertSRGBToLinear();
  hemi.intensity = ug ? (me.z > 70 ? 0.9 : 0.55) : ((envOn ? 0.18 : 0.45) + (envOn ? 0.2 : 0.5) * day) * (0.65 + 0.35 * W.light) + 0.12 * night + flash * 2.2;
  moonLight.intensity = ug ? 0 : night * 0.45; moonLight.position.set((me ? me.x : 0) - ENV.sunDir.x * 120, 120, (me ? me.z : 0) - ENV.sunDir.z * 120);
  if (me) { sun.position.set(me.x + ENV.sunDir.x * 150, Math.max(20, ENV.sunDir.y * 150), me.z + ENV.sunDir.z * 150); sun.target.position.set(me.x, 0, me.z); moonLight.target.position.set(me.x, 0, me.z); }
  else { sun.position.set(ENV.sunDir.x * 150, 150, ENV.sunDir.z * 150); }
  ENV.exposure = ug ? 1.2 : 0.64 + night * 0.45 + W.grey * 0.12; ENV.sat = 1.06 - W.grey * 0.1 - night * 0.08;
  // 젖은 노면: 비가 오면 어둡고 반짝이게
  ENV.wet = clamp((ENV.wet || 0) + (W.rain > 0.1 && !ug ? dt / 20 : -dt / 60), 0, 1);
  if (Math.abs((ENV.wetA || 0) - ENV.wet) > 0.02) { ENV.wetA = ENV.wet; ENV.wetMats.forEach(w => { w.m.roughness = w.r * (1 - 0.6 * ENV.wet); w.m.color.copy(w.c).multiplyScalar(1 - 0.35 * ENV.wet); }); }
  updateGrass(ug, sun.intensity, hemi.color, hemi.intensity);
  ENV.stars.material.opacity = ug ? 0 : night * (1 - W.grey); ENV.stars.position.copy(camera.position);
  ENV.moon.position.set(camera.position.x - ENV.sunDir.x * 380, camera.position.y + Math.max(60, -ENV.sunDir.y * 380 + 80), camera.position.z - ENV.sunDir.z * 380); ENV.moon.material.opacity = ug ? 0 : night * (1 - W.grey * 0.8);
  // 구름
  const cw = ENV.wind.s * 3;
  ENV.clouds.children.forEach(c => { c.position.x += Math.cos(ENV.wind.a) * cw * dt; c.position.z += Math.sin(ENV.wind.a) * cw * dt;
    if (c.position.x > 560) c.position.x -= 1120; if (c.position.x < -560) c.position.x += 1120; if (c.position.z > 560) c.position.z -= 1120; if (c.position.z < -560) c.position.z += 1120;
    c.material.opacity = ug ? 0 : (0.2 + W.cloud * 0.55) * (1 - night * 0.6); c.material.color.copy(bot).lerp(C3(sunset > 0.4 ? '#ffd2b0' : '#ffffff'), 0.6 * (1 - night)).multiplyScalar(1 - W.grey * 0.3); });
  // 건물 창문 불빛 / 가로등
  const wl = ug ? 0 : clamp(night * 1.3 - 0.15, 0, 1);
  ENV.facades.forEach(m => m.emissiveIntensity = wl * 1.4);
  ENV.glows.forEach(s => { s.visible = wl > 0.05; s.material.opacity = wl * (s.userData.pool ? 0.08 : 0.45); });
  if (WORLD.lakeTex) { WORLD.lakeTex.offset.x += Math.cos(ENV.wind.a) * ENV.wind.s * dt * 0.02; WORLD.lakeTex.offset.y += Math.sin(ENV.wind.a) * ENV.wind.s * dt * 0.02; }
  // 비
  const inside = me && inBuilding(me.x, me.z), rainAmt = ug ? 0 : W.rain;
  ENV.rain.visible = rainAmt > 0.02 && !(inside && (me.fl || 0) >= 0 && G.view === 'top' && false);
  if (ENV.rain.visible) {
    const pos = ENV.rain.geometry.attributes.position.array, cx = camera.position.x, cy = camera.position.y, cz = camera.position.z, wx = Math.cos(ENV.wind.a) * ENV.wind.s * 6, wz = Math.sin(ENV.wind.a) * ENV.wind.s * 6;
    const n = Math.min(ENV.rainN, Math.floor(ENV.rainN * Math.min(1, rainAmt)));
    for (let i = 0; i < n; i++) { const d = ENV.drops[i]; d.y -= d.v * dt * (0.8 + rainAmt * 0.2); d.x += wx * dt; d.z += wz * dt;
      if (d.y < -cy + (G.me ? FY(G.me) : 0) - 2) { d.y += 32; d.x = rand(-35, 35); d.z = rand(-35, 35); }
      const X = cx + d.x, Y = cy + d.y, Z = cz + d.z, L = 0.55 + rainAmt * 0.35;
      pos[i * 6] = X; pos[i * 6 + 1] = Y; pos[i * 6 + 2] = Z; pos[i * 6 + 3] = X - wx * 0.03; pos[i * 6 + 4] = Y - L; pos[i * 6 + 5] = Z - wz * 0.03; }
    ENV.rain.geometry.setDrawRange(0, n * 2); ENV.rain.geometry.attributes.position.needsUpdate = true;
    ENV.rain.material.opacity = 0.35 + 0.25 * Math.min(1, rainAmt) - night * 0.1;
  }
  // 번개 (폭풍)
  if (ENV.lightning > 0) ENV.lightning = Math.max(0, ENV.lightning - dt * 4);
  if (!ug && (ENV.curW === 'storm') && G.running) { ENV.nextBolt -= dt; if (ENV.nextBolt <= 0) { ENV.nextBolt = rand(6, 15); ENV.lightning = 1; setTimeout(() => { ENV.lightning = 0.7; }, 120); setTimeout(() => thunder(), rand(400, 1600)); } }
  // 벚꽃잎
  const pa = ug ? 0 : W.petals * (1 - night * 0.5);
  ENV.petals.visible = pa > 0.05 && !inside;
  if (ENV.petals.visible) { const pp = ENV.petals.geometry.attributes.position.array, wx = Math.cos(ENV.wind.a) * (0.6 + ENV.wind.s * 3), wz = Math.sin(ENV.wind.a) * (0.6 + ENV.wind.s * 3);
    const cx = me ? me.x : camera.position.x, cz = me ? me.z : camera.position.z;
    ENV.pet.forEach((p, i) => { p.x += (wx + Math.sin(ENV.t * 2 + p.p) * 0.6) * dt * p.s; p.z += (wz + Math.cos(ENV.t * 1.7 + p.p) * 0.6) * dt * p.s; p.y -= dt * 0.6 * p.s;
      if (p.y < 0 || Math.abs(p.x) > 30 || Math.abs(p.z) > 30) { p.y = rand(6, 12); p.x = rand(-30, 30); p.z = rand(-30, 30); }
      pp[i * 3] = cx + p.x; pp[i * 3 + 1] = p.y; pp[i * 3 + 2] = cz + p.z; });
    ENV.petals.geometry.attributes.position.needsUpdate = true; ENV.petals.material.opacity = pa; }
  rainSound(rainAmt * (inside ? 0.45 : 1));
}
// ---------- 빗소리 / 천둥 ----------
let rainNode = null;
function rainSound(v) {
  if (!AC || muted) { if (rainNode) rainNode.g.gain.value = 0; return; }
  if (!rainNode) { const len = AC.sampleRate * 2, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = AC.createBufferSource(); src.buffer = buf; src.loop = true; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; const g = AC.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(AC.destination); src.start(); rainNode = { g }; }
  rainNode.g.gain.value += (Math.min(1.5, v) * 0.05 - rainNode.g.gain.value) * 0.05;
}
function thunder() {
  if (!AC || muted) return; try { const len = AC.sampleRate * 2.5, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const s = AC.createBufferSource(); s.buffer = buf; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; const g = AC.createGain(); g.gain.value = 0.35; s.connect(f); f.connect(g); g.connect(AC.destination); s.start(); } catch (e) {}
}
