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
  if (renderer) t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t;
}
const noise = (g, w, h, n, cols, sz) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[(Math.random() * cols.length) | 0]; const s = sz * (0.5 + Math.random()); g.fillRect(Math.random() * w, Math.random() * h, s, s * (0.6 + Math.random())); } };
const TEX = {};
function makeTextures() {
  TEX.grass = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#5a8a42'; g.fillRect(0, 0, w, h); noise(g, w, h, 2600, ['#4f7d39', '#67994b', '#5f9145', '#4a7434', '#74a356', '#83ad5e'], 3); noise(g, w, h, 60, ['#9fbf6a', '#c9d07a', '#e8e3a0'], 2); }, 70, 60);
  TEX.asphalt = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#56585a'; g.fillRect(0, 0, w, h); noise(g, w, h, 2200, ['#4a4c4e', '#62645f', '#5c5e60', '#6c6e6a', '#434547'], 1.6); });
  TEX.walk = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#c9c2b4'; g.fillRect(0, 0, w, h); noise(g, w, h, 500, ['#bdb6a7', '#d3ccbf', '#c2bbad'], 2);
    g.strokeStyle = 'rgba(80,70,60,.35)'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke(); } for (let r = 0; r < 4; r++) for (let i = 0; i <= 4; i++) { const x = i * 32 + (r % 2) * 16; g.beginPath(); g.moveTo(x, r * 32); g.lineTo(x, r * 32 + 32); g.stroke(); } });
  TEX.water = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#3a78ad'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(200,230,255,.35)'; g.lineWidth = 2;
    for (let i = 0; i < 26; i++) { const y = Math.random() * h, x = Math.random() * w; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y - 3, x + 16, y); g.stroke(); } }, 12, 12);
  TEX.track = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#a8553f'; g.fillRect(0, 0, w, h); noise(g, w, h, 500, ['#9a4c38', '#b4614a', '#a35a42'], 1.5); }, 20, 12);
  TEX.cloud = canvasTex(128, 64, (g, w, h) => { for (let i = 0; i < 14; i++) { const x = 20 + Math.random() * 88, y = 22 + Math.random() * 20, r = 12 + Math.random() * 16;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); } });
  TEX.glow = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.25, 'rgba(255,220,150,.6)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  TEX.petal = canvasTex(16, 16, (g) => { g.fillStyle = '#ffd1df'; g.beginPath(); g.ellipse(8, 8, 6, 3.5, 0.6, 0, 7); g.fill(); });
}
// 바람에 흔들리는 나뭇잎 재질
function swayMaterial(color) {
  const m = new THREE.MeshLambertMaterial({ color });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, ENV.U);
    sh.vertexShader = 'uniform float uTime; uniform float uWind; uniform vec2 uWindDir;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 ip = vec3(0.0);
      #endif
      float ph = uTime * (1.3 + uWind) + ip.x * 0.31 + ip.z * 0.23;
      float k = (position.y + 2.5) * 0.045 * uWind;
      transformed.x += (sin(ph) * 0.6 + uWind * 0.8) * k * uWindDir.x;
      transformed.z += (sin(ph * 1.13) * 0.6 + uWind * 0.8) * k * uWindDir.y;`);
  };
  return m;
}

// ---------- 하늘 / 날씨 오브젝트 ----------
function initEnv() {
  // 그림자
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = sc.bottom = -60; sc.right = sc.top = 60; sc.near = 1; sc.far = 320;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; scene.add(sun.target);
  moonLight = new THREE.DirectionalLight('#9fb6ff', 0); scene.add(moonLight); scene.add(moonLight.target);
  // 하늘 돔
  ENV.sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#4a90d9') }, bot: { value: new THREE.Color('#cfe6f5') }, sunD: { value: new THREE.Vector3(0, 1, 0) }, sunC: { value: new THREE.Color('#fff2d0') }, glow: { value: 1 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 bot; uniform vec3 sunD; uniform vec3 sunC; uniform float glow; varying vec3 vP;
      void main(){ float h = clamp(vP.y * 1.6 + 0.12, 0.0, 1.0); vec3 c = mix(bot, top, pow(h, 0.8));
        float s = max(dot(vP, normalize(sunD)), 0.0); c += sunC * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.35) * glow;
        if (vP.y < 0.0) c = mix(c, bot * 0.9, clamp(-vP.y * 4.0, 0.0, 1.0)); gl_FragColor = vec4(c, 1.0); }` }));
  ENV.sky.renderOrder = -10; ENV.sky.frustumCulled = false; scene.add(ENV.sky);
  // 별
  const sg = new THREE.BufferGeometry(), sp = [];
  for (let i = 0; i < 1600; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.283, r = 430, s = Math.sqrt(1 - u * u); if (u < 0.05) continue; sp.push(Math.cos(a) * s * r, u * r, Math.sin(a) * s * r); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  ENV.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false })); ENV.stars.frustumCulled = false; scene.add(ENV.stars);
  // 달
  ENV.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: '#e8eeff', transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); ENV.moon.scale.set(40, 40, 1); scene.add(ENV.moon);
  // 구름
  ENV.clouds = new THREE.Group(); scene.add(ENV.clouds);
  for (let i = 0; i < 34; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.cloud, color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false, fog: false }));
    s.position.set(rand(-420, 420), rand(95, 140), rand(-420, 420)); const k = rand(60, 120); s.scale.set(k * 2, k, 1); ENV.clouds.add(s); }
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
  try { ENV.gfx = localStorage.getItem('la_gfx') || (('ontouchstart' in window) ? 'mid' : 'high'); } catch (e) {}
  applyGfx();
}
let moonLight;
function applyGfx() {
  const q = ENV.gfx;
  renderer.setPixelRatio(q === 'high' ? Math.min(window.devicePixelRatio || 1, 2) : q === 'mid' ? Math.min(window.devicePixelRatio || 1, 1.25) : 0.85);
  renderer.shadowMap.enabled = q !== 'low'; sun.castShadow = q !== 'low';
  const ms = q === 'high' ? 2048 : 1024; if (sun.shadow.mapSize.x !== ms) { sun.shadow.mapSize.set(ms, ms); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  ENV.rainN = q === 'high' ? 3000 : q === 'mid' ? 1600 : 600; ENV.rain.geometry.setDrawRange(0, ENV.rainN * 2);
  ENV.clouds.children.forEach((c, i) => c.visible = q !== 'low' || i % 3 === 0);
  scene.traverse(o => { if (o.material) { const ms2 = Array.isArray(o.material) ? o.material : [o.material]; ms2.forEach(m => m.needsUpdate = true); } });
  if (typeof onResize === 'function') onResize();
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
  // 하늘색: 낮 → 노을 → 밤, 흐림이면 회색
  const sunset = clamp(1 - Math.abs(el - 0.05) / 0.22, 0, 1) * (el > -0.15 ? 1 : 0);
  const top = tmpC.copy(SKY.dayT).lerp(SKY.setT, sunset * 0.8).lerp(SKY.nightT, night), bot = tmpC2.copy(SKY.dayB).lerp(SKY.setB, sunset).lerp(SKY.nightB, night);
  top.lerp(SKY.greyT.clone().multiplyScalar(1 - night * 0.85), W.grey * 0.85); bot.lerp(SKY.greyB.clone().multiplyScalar(1 - night * 0.85), W.grey * 0.85);
  const flash = ENV.lightning > 0 ? ENV.lightning : 0;
  if (ug) { const lab = me.z > 70; top.set(lab ? '#1a2230' : '#07080c'); bot.copy(top); }
  ENV.sky.material.uniforms.top.value.copy(top).addScalar(flash * 0.6); ENV.sky.material.uniforms.bot.value.copy(bot).addScalar(flash * 0.7);
  ENV.sky.material.uniforms.sunD.value.copy(ENV.sunDir); ENV.sky.material.uniforms.glow.value = (1 - W.grey) * clamp(el * 4 + 0.6, 0, 1);
  ENV.sky.material.uniforms.sunC.value.set(sunset > 0.3 ? '#ffb070' : '#fff1d0');
  scene.background = bot; scene.fog.color.copy(bot);
  scene.fog.near = ug ? 14 : W.fogNear * (1 - night * 0.3); scene.fog.far = ug ? (me.z > 70 ? 70 : 48) : W.fogFar * (1 - night * 0.35);
  // 조명
  const day = clamp(el * 3 + 0.25, 0, 1);
  sun.color.set(sunset > 0.4 ? '#ffb27a' : '#fff4e2'); sun.intensity = ug ? 0 : day * 0.95 * W.light;
  hemi.color.copy(bot).lerp(C3('#ffffff'), 0.4); hemi.groundColor.set(night > 0.5 ? '#141820' : '#4a5a3a');
  hemi.intensity = ug ? (me.z > 70 ? 0.75 : 0.42) : (0.32 + 0.5 * day) * (0.65 + 0.35 * W.light) + flash * 2.2;
  moonLight.intensity = ug ? 0 : night * 0.32; moonLight.position.set((me ? me.x : 0) - ENV.sunDir.x * 120, 120, (me ? me.z : 0) - ENV.sunDir.z * 120);
  if (me) { sun.position.set(me.x + ENV.sunDir.x * 150, Math.max(20, ENV.sunDir.y * 150), me.z + ENV.sunDir.z * 150); sun.target.position.set(me.x, 0, me.z); moonLight.target.position.set(me.x, 0, me.z); }
  else { sun.position.set(ENV.sunDir.x * 150, 150, ENV.sunDir.z * 150); }
  ENV.stars.material.opacity = ug ? 0 : night * (1 - W.grey); ENV.stars.position.copy(camera.position);
  ENV.moon.position.set(camera.position.x - ENV.sunDir.x * 380, camera.position.y + Math.max(60, -ENV.sunDir.y * 380 + 80), camera.position.z - ENV.sunDir.z * 380); ENV.moon.material.opacity = ug ? 0 : night * (1 - W.grey * 0.8);
  ENV.sky.position.copy(camera.position);
  // 구름
  const cw = ENV.wind.s * 3;
  ENV.clouds.children.forEach(c => { c.position.x += Math.cos(ENV.wind.a) * cw * dt; c.position.z += Math.sin(ENV.wind.a) * cw * dt;
    if (c.position.x > 450) c.position.x -= 900; if (c.position.x < -450) c.position.x += 900; if (c.position.z > 450) c.position.z -= 900; if (c.position.z < -450) c.position.z += 900;
    c.material.opacity = ug ? 0 : (0.25 + W.cloud * 0.6) * (1 - night * 0.6); c.material.color.copy(bot).lerp(C3('#ffffff'), 0.5 * (1 - night)).multiplyScalar(1 - W.grey * 0.25); });
  // 건물 창문 불빛 / 가로등
  const wl = ug ? 0 : clamp(night * 1.3 - 0.15, 0, 1);
  ENV.facades.forEach(m => m.emissiveIntensity = wl * 0.55);
  ENV.glows.forEach(s => { s.visible = wl > 0.05; s.material.opacity = wl * (s.userData.pool ? 0.13 : 0.9); });
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
