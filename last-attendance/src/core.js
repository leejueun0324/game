'use strict';
// ============================================================
//  코어: 렌더러, 입력, 카메라, 유닛, 좀비, 전투, 스킬, AI
// ============================================================
let renderer, scene, camera, hemi, sun, flash, hud, hctx;
const G = { mode: 'solo', units: [], zombies: [], pickups: [], fx: [], proj: [], inv: {}, t: 0, paused: true, night: 0, nextId: 1,
  zoom: 26, view: 'chase', yaw: Math.PI, pitch: 0.34, camDist: 6.5, run: false, ctxFl: 0, floorSeen: {}, me: null, chapterIdx: 0, questIdx: 0, qprog: 0, running: false, lure: null, buffs: { haste: 0, guard: 0 }, missionsDone: {}, kills: 0 };
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const D2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const FY = e => ((e && e.fl) || 0) * FH;
const sameFl = (a, b) => (a.fl || 0) === (b.fl || 0);
const angTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);   // y축 회전 기준 (z 앞)
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }

function initRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('gl') });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  scene = new THREE.Scene(); scene.background = new THREE.Color('#9cc7e6'); scene.fog = new THREE.Fog('#9cc7e6', 60, 160);
  camera = new THREE.PerspectiveCamera(50, 1, 0.3, 1600);
  hemi = new THREE.HemisphereLight('#ffffff', '#4a5a3a', 0.85); scene.add(hemi);
  sun = new THREE.DirectionalLight('#fff3dc', 0.7); sun.position.set(40, 80, 30); scene.add(sun);
  flash = new THREE.PointLight('#fff2c8', 0, 22, 1.6); scene.add(flash);
  hud = document.getElementById('hud'); hctx = hud.getContext('2d');
  makeTextures();
  buildWorld(scene);
  shadowAll(scene, true, true);
  initEnv();
  initPost();
  addEventListener('resize', onResize); onResize();
}
function onResize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  const dpr = Math.min(window.devicePixelRatio || 1, 2); hud.width = w * dpr; hud.height = h * dpr; hud.style.width = w + 'px'; hud.style.height = h + 'px';
  hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  document.body.classList.toggle('portrait', h > w);
  if (typeof resizePost === 'function') resizePost();
}
// ---------------- 입력 ----------------
const keys = {}, mouse = { x: 0, y: 0, down: false, world: { x: 0, z: 0 }, rdrag: null };
let pressSkill = false, pressInteract = false, isTouch = false, pad = null;
const joy = { active: false, x: 0, y: 0 }, look = { id: null, x: 0, y: 0 }, pinch = { d: 0 };
function initInput() {
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') { if (e.code === 'Escape') e.target.blur(); return; }
    keys[e.code] = true;
    if (!G.running) return;
    if (e.code === 'Space') { if (UI.dialog) UI.advanceDialog(); else pressSkill = true; e.preventDefault(); }
    if (e.code === 'KeyF') pressSkill = true;
    if (e.code === 'KeyE') pressInteract = true;
    if (e.code === 'Enter' && UI.dialog) UI.advanceDialog();
    if (e.code === 'Tab') { UI.togglePhone(); e.preventDefault(); }
    if (e.code === 'KeyC') UI.openCards(); if (e.code === 'KeyR') UI.openRelations();
    if (e.code === 'KeyV') toggleView();
    if (e.code === 'Escape') UI.togglePause();
    if (e.code === 'Equal' || e.code === 'NumpadAdd') zoomBy(-3); if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoomBy(3);
  });
  addEventListener('keyup', e => keys[e.code] = false);
  const gl = document.getElementById('gl');
  // 마우스: 캐릭터 시점에서는 포인터 잠금(마우스로 시점 회전), 잠금이 안 되면 우클릭 드래그로 회전
  addEventListener('mousemove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (G.view !== 'chase' || !G.running) return;
    if (document.pointerLockElement === gl) rotateCam(e.movementX, e.movementY);
    else if (mouse.rdrag) { const dx = e.clientX - mouse.rdrag.x, dy = e.clientY - mouse.rdrag.y; if (Math.abs(dx) + Math.abs(dy) > 4) mouse.rdrag.moved = true; rotateCam(dx * 1.4, dy * 1.4); mouse.rdrag.x = e.clientX; mouse.rdrag.y = e.clientY; }
  });
  gl.addEventListener('mousedown', e => {
    if (UI.dialog) { UI.advanceDialog(); return; }
    if (G.view === 'chase' && G.running && !isTouch && document.pointerLockElement !== gl && e.button === 0 && gl.requestPointerLock) { try { gl.requestPointerLock(); } catch (er) {} }
    if (e.button === 0) mouse.down = true; if (e.button === 2) mouse.rdrag = { x: e.clientX, y: e.clientY, moved: false };
  });
  addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; if (e.button === 2 && mouse.rdrag) { if (!mouse.rdrag.moved) pressSkill = true; mouse.rdrag = null; } });
  gl.addEventListener('contextmenu', e => e.preventDefault());
  gl.addEventListener('wheel', e => { zoomBy(e.deltaY > 0 ? 2.5 : -2.5); e.preventDefault(); }, { passive: false });
  // 터치: 화면 드래그 = 시점 회전, 두 손가락 = 확대/축소
  gl.addEventListener('touchstart', e => {
    isTouch = true; document.body.classList.add('touch');
    if (UI.dialog) { UI.advanceDialog(); e.preventDefault(); return; }
    if (e.touches.length === 2) { look.id = null; pinch.d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }
    for (const t of e.changedTouches) if (look.id === null && e.touches.length === 1) { look.id = t.identifier; look.x = t.clientX; look.y = t.clientY; }
    e.preventDefault();
  }, { passive: false });
  gl.addEventListener('touchmove', e => {
    if (e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (pinch.d) zoomBy((pinch.d - d) * 0.05); pinch.d = d; }
    for (const t of e.changedTouches) if (t.identifier === look.id) { rotateCam((t.clientX - look.x) * 1.6, (t.clientY - look.y) * 1.6); look.x = t.clientX; look.y = t.clientY; }
    e.preventDefault();
  }, { passive: false });
  const end = e => { for (const t of e.changedTouches) if (t.identifier === look.id) look.id = null; if (e.touches.length < 2) pinch.d = 0; };
  gl.addEventListener('touchend', end); gl.addEventListener('touchcancel', end);
  // 화면 컨트롤러 (조이스틱)
  const stick = document.getElementById('stick'), knob = document.getElementById('knob');
  let sid = null;
  const stickMove = (cx, cy) => { const r = stick.getBoundingClientRect(), R = r.width / 2, dx = cx - (r.left + R), dy = cy - (r.top + R), l = Math.hypot(dx, dy), k = l > R ? R / l : 1;
    joy.x = dx * k / R; joy.y = dy * k / R; joy.active = true; knob.style.transform = `translate(${dx * k}px,${dy * k}px)`; };
  stick.addEventListener('pointerdown', e => { sid = e.pointerId; stick.setPointerCapture(e.pointerId); stickMove(e.clientX, e.clientY); e.preventDefault(); e.stopPropagation(); });
  stick.addEventListener('pointermove', e => { if (e.pointerId === sid) stickMove(e.clientX, e.clientY); });
  const stickEnd = e => { if (e.pointerId !== sid) return; sid = null; joy.active = false; joy.x = joy.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', stickEnd); stick.addEventListener('pointercancel', stickEnd);
  const hold = (id, on, off) => { const el = document.getElementById(id); if (!el) return;
    el.addEventListener('pointerdown', e => { on(); e.preventDefault(); e.stopPropagation(); });
    el.addEventListener('pointerup', e => { off && off(); e.preventDefault(); }); el.addEventListener('pointerleave', () => off && off()); };
  hold('bAtk', () => mouse.down = true, () => mouse.down = false);
  hold('bSkill', () => pressSkill = true); hold('bUse', () => pressInteract = true);
  hold('bRun', () => { G.run = !G.run; document.getElementById('bRun').classList.toggle('on', G.run); });
  hold('bZin', () => zoomBy(-4)); hold('bZout', () => zoomBy(4));
  addEventListener('gamepadconnected', e => { pad = e.gamepad.index; UI.banner('🎮 게임패드 연결됨 — 왼스틱 이동, 오른스틱 시점, A 공격, B 스킬, X 사용, LB 달리기', '#7dff7d', 5); });
}
function rotateCam(dx, dy) { G.yaw -= dx * 0.0032; G.pitch = clamp(G.pitch + dy * 0.0026, 0.05, 1.25); }
function toggleView() { G.view = G.view === 'chase' ? 'top' : 'chase'; if (G.view === 'top' && document.exitPointerLock) document.exitPointerLock(); UI.banner(G.view === 'chase' ? '캐릭터 시점' : '위에서 보기', '#fff', 1.5); }
function zoomBy(d) { if (G.view === 'chase') G.camDist = clamp(G.camDist + d * 0.35, 2.2, 16); else G.zoom = clamp(G.zoom + d, 9, 70); }
const padState = { prev: [] };
function pollPad(dt) {
  const gp = navigator.getGamepads ? navigator.getGamepads() : []; let P = null;
  for (const g of gp) if (g && g.connected) { P = g; break; }
  if (!P) return null;
  const dz = v => Math.abs(v) < 0.18 ? 0 : v, B = i => P.buttons[i] && P.buttons[i].pressed, was = i => padState.prev[i];
  const out = { mx: dz(P.axes[0] || 0), mz: dz(P.axes[1] || 0), run: B(4) || B(10) };
  rotateCam(dz(P.axes[2] || 0) * 900 * dt, dz(P.axes[3] || 0) * 700 * dt);
  out.atk = B(0) || B(7) || B(5);
  if (B(1) && !was(1)) pressSkill = true; if (B(2) && !was(2)) pressInteract = true;
  if (B(3) && !was(3)) UI.togglePhone(); if (B(9) && !was(9)) UI.togglePause(); if (B(8) && !was(8)) toggleView();
  if (UI.dialog && B(0) && !was(0)) UI.advanceDialog();
  padState.prev = P.buttons.map(b => b.pressed);
  return out;
}
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), tmpV = new THREE.Vector3();
function updateMouseWorld() {
  const chase = G.view === 'chase';
  ray.setFromCamera(chase ? { x: 0, y: 0.08 } : { x: mouse.x / innerWidth * 2 - 1, y: -(mouse.y / innerHeight) * 2 + 1 }, camera);
  plane.constant = -FY(G.me);
  if (ray.ray.intersectPlane(plane, tmpV)) { mouse.world.x = tmpV.x; mouse.world.z = tmpV.z; }
  if (chase && G.me) { const d = Math.hypot(mouse.world.x - G.me.x, mouse.world.z - G.me.z); if (!(d > 1.5 && d < 16)) { mouse.world.x = G.me.x + Math.sin(G.yaw) * 9; mouse.world.z = G.me.z + Math.cos(G.yaw) * 9; } }
}

// ---------------- 유닛 ----------------
function statHP(ch) { return 40 + ch.hp * 12; }
function makeUnit(ch, x, z) {
  const model = makeHuman(ch); scene.add(model);
  const u = { id: G.nextId++, kind: 'unit', ch, x, z, r: 0.45, hp: statHP(ch), maxHp: statHP(ch), face: 0, model, atkT: 0, atkAnim: 0, skillCd: 2,
    state: 'active', downT: 0, reviveT: 0, ctrl: 'ai', weapon: null, speed: 0, inv: 0, block: 0, hidden: 0, say: null, hurt: 0, slot: G.units.length, fl: 0, stamina: 100 };
  model.position.set(x, 0, z); shadowAll(model, true, false); G.units.push(u); return u;
}
function setWeapon(u, w) { u.weapon = w; setWeaponModel(u.model, w); }
function activeUnits() { return G.units.filter(u => u.state === 'active'); }
function unitById(id) { return G.units.find(u => u.id === id); }
function unitByCh(cid) { return G.units.find(u => u.ch.id === cid); }

// ---------------- 좀비 / 적 ----------------
const ZDEF = {
  walker: { hp: 34, spd: 2.6, dmg: 7, r: 0.45 }, runner: { hp: 22, spd: 5.4, dmg: 6, r: 0.42 }, brute: { hp: 150, spd: 2.0, dmg: 16, r: 0.7 },
  agent: { hp: 90, spd: 3.6, dmg: 11, r: 0.5 }, mimic: { hp: 520, spd: 6.8, dmg: 18, r: 0.8 }, n1: { hp: 1500, spd: 4.2, dmg: 22, r: 0.6 },
};
function spawnZombie(kind, x, z, fl) {
  const d = ZDEF[kind];
  const model = kind === 'agent' ? makeAgent() : kind === 'mimic' ? makeMimic() : kind === 'n1' ? makeNumberOne() : makeZombie(kind);
  scene.add(model); model.position.set(x, 0, z); shadowAll(model, true, false);
  const zb = { id: G.nextId++, kind, x, z, r: d.r, hp: d.hp, maxHp: d.hp, spd: d.spd * rand(0.9, 1.1), dmg: d.dmg, model, target: null, retarget: 0,
    atkCd: 0, atkAnim: 0, stun: 0, root: 0, confused: 0, mark: 0, dead: false, face: 0, stuck: 0, detour: 0, dside: 1, wander: rand(0, 6), shotT: rand(1, 2), hitFlash: 0, fl: fl || 0 };
  G.zombies.push(zb); return zb;
}
function removeZombie(z) { scene.remove(z.model); }
function clearZombies() { G.zombies.forEach(removeZombie); G.zombies = []; }
function spawnAround(kind, cx, cz, minD, maxD, fl) {
  fl = fl || 0;
  for (let k = 0; k < 25; k++) { const a = rand(0, 6.283), d = rand(minD, maxD), x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d;
    if (freeSpot(x, z, 1, fl) && (fl > 0 ? inBuilding(x, z) === inBuilding(cx, cz) : !inBuilding(x, z) === !inBuilding(cx, cz)) && (underground(x) === underground(cx))) return spawnZombie(kind, x, z, fl); }
  return null;
}

// ---------------- 효과(FX) ----------------
function fx(type, o) { const f = Object.assign({ type, t: 0, life: 0.6, y: (G.ctxFl || 0) * FH }, o); G.fx.push(f); if (G.mode === 'host') NET.event({ e: 'fx', f: Object.assign({}, f, { mesh: undefined }) }); return f; }
function floatText(x, z, text, color, size) { fx('text', { x, z, text, color: color || '#fff', size: size || 16, life: 0.9 }); }
function say(u, text, t) { u.say = { text, t: t || 2.5 }; if (G.mode === 'host') NET.event({ e: 'say', id: u.id, text, tt: t || 2.5 }); }
const FXMESH = { ring: new THREE.RingGeometry(0.85, 1, 40), disc: new THREE.CircleGeometry(1, 32) };
function fxMesh(f) {
  if (f.mesh || f.type === 'text') return;
  let m;
  if (f.type === 'ring') { m = new THREE.Mesh(FXMESH.ring, new THREE.MeshBasicMaterial({ color: f.color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; }
  else if (f.type === 'fire' || f.type === 'smoke' || f.type === 'trap' || f.type === 'zone') {
    const c = f.type === 'fire' ? '#ff6a1a' : f.type === 'smoke' ? '#f4f4f4' : f.type === 'trap' ? '#ffd36b' : f.color;
    m = new THREE.Mesh(FXMESH.disc, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: f.type === 'smoke' ? 0.55 : 0.4, depthWrite: false })); m.rotation.x = -Math.PI / 2; }
  else if (f.type === 'cone') { m = new THREE.Mesh(new THREE.CircleGeometry(1, 24, -0.9, 1.8), new THREE.MeshBasicMaterial({ color: f.color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; }
  if (m) { m.position.set(f.x, (f.y || 0) + 0.08 + (f.type === 'smoke' ? 0.6 : 0), f.z); scene.add(m); f.mesh = m; }
}
function updateFx(dt) {
  for (const f of G.fx) {
    f.t += dt; fxMesh(f);
    const k = f.t / f.life;
    if (f.mesh) {
      if (f.type === 'ring') { const r = f.r0 !== undefined ? f.r0 + (f.r - f.r0) * Math.min(1, k * 1.5) : f.r * Math.min(1, k * 1.6); f.mesh.scale.set(r, r, r); f.mesh.material.opacity = 0.8 * (1 - k); }
      else if (f.type === 'cone') { f.mesh.scale.set(f.r, f.r, f.r); f.mesh.rotation.z = -f.a + Math.PI / 2 - Math.PI / 2; f.mesh.rotation.z = f.a - Math.PI / 2; f.mesh.material.opacity = 0.4 * (1 - k); }
      else { const s = f.r * (f.type === 'smoke' ? 0.7 + 0.3 * Math.min(1, k * 4) : 1); f.mesh.scale.set(s, s, s); f.mesh.material.opacity = (f.type === 'smoke' ? 0.6 : 0.45) * Math.min(1, (1 - k) * 4) * (f.type === 'fire' ? 0.7 + 0.3 * Math.sin(G.t * 20) : 1); }
    }
    if (f.t >= f.life) { f.done = true; if (f.mesh) { scene.remove(f.mesh); f.mesh.material.dispose(); } }
  }
  G.fx = G.fx.filter(f => !f.done);
}

// 투사체 (야구공, 화염병, 총알, 1번의 파동)
const PROJG = { ball: new THREE.SphereGeometry(0.16, 10, 8), bottle: new THREE.CylinderGeometry(0.08, 0.1, 0.4, 8), bullet: new THREE.SphereGeometry(0.1, 6, 5) };
function projectile(o) {
  const geo = PROJG[o.kind] || PROJG.ball, col = o.kind === 'bottle' ? '#7fbf7f' : o.kind === 'bullet' ? '#ffdf6b' : '#ffffff';
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col })); const pfl = o.fl !== undefined ? o.fl : (o.owner ? o.owner.fl || 0 : G.ctxFl || 0); m.position.set(o.x, pfl * FH + 1.2, o.z); scene.add(m);
  const p = Object.assign({ life: 1.2, mesh: m, hit: new Set(), fl: pfl }, o); p.fl = pfl; G.proj.push(p);
  if (G.mode === 'host') NET.event({ e: 'proj', p: { fl: p.fl, kind: p.kind, x: p.x, z: p.z, vx: p.vx, vz: p.vz, life: p.life, arc: p.arc, tx: p.tx, tz: p.tz } });
  return p;
}
function visualProjectile(o) { const m = new THREE.Mesh(PROJG[o.kind] || PROJG.ball, new THREE.MeshBasicMaterial({ color: o.kind === 'bullet' ? '#ffdf6b' : '#fff' })); m.position.set(o.x, (o.fl || 0) * FH + 1.2, o.z); scene.add(m); G.proj.push(Object.assign({}, o, { mesh: m, visual: true, hit: new Set() })); }

// ---------------- 데미지 ----------------
function teamDmgMul(z) { return z.mark > 0 && G.buffs.ambush > 0 ? 2 : 1; }
function hurtZombie(z, dmg, kx, kz, src) {
  if (z.dead) return; G.ctxFl = z.fl || 0;
  dmg *= teamDmgMul(z);
  if (z.kind === 'n1' && G.n1shield) dmg *= 0.35;
  z.hp -= dmg; z.hitFlash = 0.12;
  const kb = z.kind === 'brute' ? 0.4 : (z.kind === 'n1' || z.kind === 'mimic') ? 0.1 : 1;
  z.x += (kx || 0) * kb; z.z += (kz || 0) * kb; pushOut(z);
  floatText(z.x, z.z, Math.round(dmg), dmg >= 40 ? '#ffd23a' : '#fff', dmg >= 40 ? 20 : 14);
  if (z.hp <= 0) killZombie(z, src);
}
function killZombie(z, src) {
  if (z.kind === 'mimic') { z.hp = z.maxHp * 0.5; z.stun = 6; floatText(z.x, z.z, '괴물이 물러났다', '#ff9a9a', 18); return; }
  z.dead = true; G.kills++; STORY.onKill(z);
  if (Math.random() < (z.kind === 'brute' ? 0.6 : z.kind === 'agent' ? 0.7 : 0.07) && !underground(z.x) || z.kind === 'agent')
    dropPickup(Math.random() < 0.5 ? 'food' : 'med', z.x, z.z, { fl: z.fl || 0 });
}
function hurtUnit(u, dmg, src) {
  if (u.state !== 'active' || u.inv > 0) return; G.ctxFl = u.fl || 0;
  if (u.block > 0 && src) { const a = angTo(u, src); if (Math.abs(angDiff(a, u.face)) < 1.6) {
      if (src.kind !== undefined && src.hp !== undefined && G.zombies.includes(src)) { const d = D2(u, src) || 1; hurtZombie(src, 30 + u.ch.atk * 3, (src.x - u.x) / d * 3, (src.z - u.z) / d * 3, u); src.stun = Math.max(src.stun, src.kind === 'n1' ? 0.4 : 1.3); }
      floatText(u.x, u.z, '블락!', '#b9a3ff', 18); return; } }
  if (G.buffs.guard > 0) dmg *= 0.5;
  u.hp -= dmg; u.hurt = 0.25; u.lastHit = G.t;
  if (u === G.me) { G.shake = Math.min(0.6, (G.shake || 0) + dmg * 0.03); sfx('hurt'); }
  if (u.hp <= 0) downUnit(u);
}
function downUnit(u) {
  u.hp = 0; u.state = 'down'; u.downT = u.ctrl === 'ai' ? 35 : 45; u.reviveT = 0;
  say(u, '도와줘……', 3); UI.banner(`${u.ch.name} 쓰러짐! 옆에 서 있으면 일으켜 세울 수 있어요`, '#ff8080');
}
function reviveUnit(u, frac) { u.state = 'active'; u.hp = u.maxHp * (frac || 0.5); u.inv = 1; say(u, '고마워!', 2); floatText(u.x, u.z, '부활', '#7dff7d', 18); }

// 아이템
const PICKNAME = { food: '음식', med: '구급상자', bat: '야구배트', extinguisher: '소화기', molotov: '소주병·휴지', supply: '물자', fuse: '퓨즈', storage: '창고 장비',
  battery: '보조배터리', flashlight: '손전등', ration: '비상식량', pipe: '쇠파이프', radio: '무전기', umbrella: '우산' };
const PICKCOL = { food: '#f2f2e6', med: '#ffffff', bat: '#c49a5a', extinguisher: '#d22', molotov: '#7fbf7f', supply: '#5fa8ff', fuse: '#ffd36b', storage: '#c49a5a',
  battery: '#4ad', flashlight: '#ffe066', ration: '#d9a35a', pipe: '#9aa0a8', radio: '#3a3', umbrella: '#3a4a8a' };
function dropPickup(type, x, z, extra) {
  const g = new THREE.Group(); g.position.set(x, ((extra && extra.fl) || 0) * FH, z);
  const b = new THREE.Mesh(BOXG, mat(PICKCOL[type] || '#fff')); b.scale.set(0.45, 0.45, 0.45); b.position.y = 0.5; g.add(b);
  if (type === 'med') { const c = new THREE.Mesh(BOXG, mat('#d22')); c.scale.set(0.12, 0.47, 0.3); c.position.y = 0.5; g.add(c); }
  const glow = new THREE.Mesh(FXMESH.disc, new THREE.MeshBasicMaterial({ color: PICKCOL[type] || '#fff', transparent: true, opacity: 0.35, depthWrite: false })); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.05; glow.scale.set(0.6, 0.6, 0.6); g.add(glow);
  scene.add(g);
  const p = Object.assign({ id: G.nextId++, type, x, z, mesh: g }, extra || {}); G.pickups.push(p); return p;
}
function clearPickups(keepMission) { G.pickups = G.pickups.filter(p => { if (keepMission && p.mission) return true; scene.remove(p.mesh); return false; }); }
function collectPickup(p, u) {
  p.got = true; scene.remove(p.mesh); sfx('pick'); G.ctxFl = u.fl || 0;
  const I = G.inv, t = p.type;
  if (t === 'food' || t === 'med') { let v = t === 'med' ? 45 : 22; if (u.ch.id === 'junhee' && t === 'food') v *= 1.5; u.hp = Math.min(u.maxHp, u.hp + v);
    floatText(u.x, u.z, `${PICKNAME[t]} +${Math.round(v)}`, '#7dff7d', 16); if (t === 'food') G.units.forEach(o => { if (o.state === 'active' && D2(o, u) < 10) o.hp = Math.min(o.maxHp, o.hp + 8); }); }
  else if (t === 'bat') { I.bat = (I.bat || 0) + 1; equipTeam(); }
  else if (t === 'extinguisher') I.ext = (I.ext || 0) + 3;
  else if (t === 'molotov') I.molotov = (I.molotov || 0) + 2;
  else if (t === 'storage') { if (p.sub === 'bat') { I.bat = (I.bat || 0) + 2; equipTeam(); } else I.ext = (I.ext || 0) + 3; }
  else if (t === 'pipe') { I.pipe = (I.pipe || 0) + 1; equipTeam(); }
  else I[t] = (I[t] || 0) + 1;
  if (t !== 'food' && t !== 'med') floatText(u.x, u.z, `${PICKNAME[t]} 획득`, '#ffe066', 16);
  if (p.mission) MISSIONS.complete(p.mission, u);
  STORY.onCollect(t, p);
  UI.refreshInv();
}
// 무기 분배: 배트 → 지후, 설우, 주은, 준희 순 / 쇠파이프 → 유준
function equipTeam() {
  const I = G.inv; let bats = I.bat || 0;
  for (const id of ['jihu', 'seolwoo', 'jueun', 'junhee']) { const u = unitByCh(id); if (u && bats > 0) { setWeapon(u, 'bat'); bats--; } }
  if (I.pipe) { const u = unitByCh('yujun'); if (u) setWeapon(u, 'pipe'); }
  const ex = unitByCh('juwon'); if (ex && I.ext > 0 && !ex.weapon) setWeapon(ex, 'extinguisher');
  for (const u of G.units) if (!u.weapon) setWeapon(u, ['umbrella', 'mop'][u.slot % 2]);
}
function weaponBonus(w) { return { bat: 8, pipe: 7, umbrella: 2, mop: 2, extinguisher: 4 }[w] || 0; }

// ---------------- 기본 공격 ----------------
function meleeAttack(u, face) {
  if (u.atkT > 0 || u.state !== 'active') return false;
  u.face = face; u.atkAnim = 1;
  const haste = G.buffs.haste > 0 ? 0.6 : 1;
  u.atkT = (0.62 - u.ch.spd * 0.015) * haste;
  const reach = 2.0 + (u.weapon === 'bat' || u.weapon === 'pipe' || u.weapon === 'mop' ? 0.6 : 0);
  const dmg = 8 + u.ch.atk * 2.2 + weaponBonus(u.weapon);
  let hit = 0;
  for (const z of G.zombies) {
    if (z.dead || !sameFl(z, u)) continue; const d = D2(u, z); if (d > reach + z.r) continue;
    if (Math.abs(angDiff(angTo(u, z), face)) > 1.0) continue;
    hurtZombie(z, dmg * (u.hidden > 0 ? 3 : 1), (z.x - u.x) / (d || 1) * 0.8, (z.z - u.z) / (d || 1) * 0.8, u); hit++;
    if (hit >= 3) break;
  }
  if (hit) sfx('hit'); else sfx('swing');
  return true;
}

// ---------------- 스킬 ----------------
function skillReady(u) {
  const need = u.ch.skill.need, I = G.inv;
  if (need === 'bat' && !(I.bat > 0)) return '야구배트 필요';
  if (need === 'extinguisher' && !(I.ext > 0)) return '소화기 필요';
  if (need === 'molotov' && !(I.molotov > 0)) return '소주병·휴지 필요';
  return null;
}
function castSkill(u, tx, tz) {
  if (u.skillCd > 0 || u.state !== 'active') return false;
  const why = skillReady(u); if (why) { if (u === G.me) floatText(u.x, u.z, why, '#ff9a9a', 15); return false; }
  G.ctxFl = u.fl || 0; const ZS = G.zombies.filter(z => sameFl(z, u));
  const id = u.ch.skill.id, face = Math.atan2(tx - u.x, tz - u.z), dm = (0.6 + u.ch.atk * 0.08) * (u.ctrl === 'ai' ? 0.75 : 1);
  u.face = face; u.skillCd = u.ch.skill.cd * (u.ctrl === 'ai' ? 1.5 : 1); u.atkAnim = 1;
  sfx('skill'); if (u.ctrl !== 'ai' && G.mode !== 'client') UI.cutin(u);
  floatText(u.x, u.z - 0.5, u.ch.skill.name, u.ch.color, 18);
  const team = () => G.units.filter(o => o.state === 'active' && sameFl(o, u));
  if (id === 'lure') {
    const d = Math.min(14, Math.hypot(tx - u.x, tz - u.z)) || 6, x = u.x + Math.sin(face) * d, z = u.z + Math.cos(face) * d;
    G.lure = { x, z, t: 6, fl: u.fl || 0 }; fx('trap', { x, z, r: 2.2, life: 6 }); fx('ring', { x, z, r: 9, life: 0.8, color: '#ffd36b' });
    floatText(x, z, '삐-삐-삐! (알람)', '#ffd36b', 18);
  } else if (id === 'heal') {
    for (const o of team()) if (D2(o, u) < 14) { o.hp = Math.min(o.maxHp, o.hp + 35); floatText(o.x, o.z, '+35', '#7dff7d', 16); }
    for (const o of G.units) if (o.state === 'down' && D2(o, u) < 14) reviveUnit(o, 0.5);
    fx('ring', { x: u.x, z: u.z, r: 14, life: 0.7, color: '#7dff7d' });
  } else if (id === 'swing') {
    fx('cone', { x: u.x, z: u.z, r: 3.4, a: face, life: 0.35, color: '#ffe9a0' });
    for (const z of ZS) { if (z.dead) continue; const d = D2(u, z); if (d > 3.4 + z.r) continue; if (Math.abs(angDiff(angTo(u, z), face)) > 1.31) continue;
      const kb = z.kind === 'brute' ? 2 : (z.kind === 'n1' || z.kind === 'mimic') ? 0.3 : 6;
      hurtZombie(z, 60 * dm, (z.x - u.x) / (d || 1) * kb, (z.z - u.z) / (d || 1) * kb, u); z.stun = Math.max(z.stun, z.kind === 'n1' ? 0.3 : 1); }
  } else if (id === 'pitch') {
    for (let k = 0; k < 3; k++) setTimeout(() => {
      if (u.state !== 'active') return;
      const a = u === G.me && !isTouch ? Math.atan2(mouse.world.x - u.x, mouse.world.z - u.z) : (nearestZombie(u, 22) ? angTo(u, nearestZombie(u, 22)) : u.face);
      projectile({ kind: 'ball', owner: u, x: u.x, z: u.z, vx: Math.sin(a) * 26, vz: Math.cos(a) * 26, dmg: 40 * dm, bounces: 2, life: 0.9 }); sfx('swing');
    }, k * 200);
  } else if (id === 'note') {
    G.buffs.haste = 5; fx('ring', { x: u.x, z: u.z, r: 16, life: 0.6, color: '#ffe066' });
    for (const o of team()) floatText(o.x, o.z, '✉ 쪽지', '#ffe066', 14);
  } else if (id === 'block') {
    u.block = 2.5; fx('cone', { x: u.x, z: u.z, r: 1.8, a: face, life: 2.5, color: '#b9a3ff' });
  } else if (id === 'molotov') {
    G.inv.molotov--; UI.refreshInv();
    const d = Math.min(12, Math.hypot(tx - u.x, tz - u.z)) || 8, x = u.x + Math.sin(face) * d, z = u.z + Math.cos(face) * d;
    projectile({ kind: 'bottle', owner: u, x: u.x, z: u.z, arc: true, tx: x, tz: z, t0: 0, dur: 0.55, life: 0.56, dm });
  } else if (id === 'supply') {
    ['med', 'food', 'food'].forEach((t, i) => { const a = face + i * 2.1; let x = u.x + Math.sin(a) * 1.6, z = u.z + Math.cos(a) * 1.6; if (!freeSpot(x, z, 0.3, u.fl)) { x = u.x; z = u.z; } dropPickup(t, x, z, { fl: u.fl || 0 }); });
    if (Math.random() < 0.5) { G.inv.molotov = (G.inv.molotov || 0) + (unitByCh('hyoseo') ? 1 : 0); UI.refreshInv(); }
    for (const o of team()) if (D2(o, u) < 9) { o.hp = Math.min(o.maxHp, o.hp + 12); floatText(o.x, o.z, '+12', '#7dff7d', 14); }
    fx('ring', { x: u.x, z: u.z, r: 9, life: 0.5, color: '#5ee0c8' });
  } else if (id === 'shuffle') {
    G.inv.ext--; UI.refreshInv();
    const d = Math.min(12, Math.hypot(tx - u.x, tz - u.z)) || 7, x = u.x + Math.sin(face) * d, z = u.z + Math.cos(face) * d;
    fx('smoke', { x, z, r: 5, life: 4 });
    for (const zb of ZS) if (!zb.dead && Math.hypot(zb.x - x, zb.z - z) < 5.5 && zb.kind !== 'n1') { zb.confused = zb.kind === 'mimic' ? 2 : 6; zb.target = null; }
  } else if (id === 'escape') {
    for (const z of ZS) { const d = D2(u, z); if (d < 7 && !z.dead) { const k = (z.kind === 'n1' || z.kind === 'mimic') ? 0.8 : 4.5; z.x += (z.x - u.x) / (d || 1) * k; z.z += (z.z - u.z) / (d || 1) * k; pushOut(z); z.stun = Math.max(z.stun, 0.6); } }
    G.buffs.guard = 3; fx('ring', { x: u.x, z: u.z, r: 7, life: 0.5, color: '#9fe86a' });
  } else if (id === 'ambush') {
    u.hidden = 4; u.ambushWait = 4;
    fx('ring', { x: u.x, z: u.z, r: 9, life: 4, color: '#aaaaaa', r0: 9 });
  }
  if (G.mode === 'host') NET.event({ e: 'skill', id: u.id });
  return true;
}
function ambushTrigger(u) {
  G.ctxFl = u.fl || 0; let n = 0; for (const z of G.zombies) if (!z.dead && sameFl(z, u) && D2(u, z) < 10) { z.mark = 4; n++; }
  G.buffs.ambush = 4; u.ambushWait = 0;
  fx('ring', { x: u.x, z: u.z, r: 10, life: 0.6, color: '#ff4a4a' });
  floatText(u.x, u.z, n ? `알림! ${n}마리 표식` : '알림!', '#ff6a6a', 18);
  UI.kakao(u.ch.id, n ? `가까이 왔어. 표시한 애들 집중!` : '……조용해. 일단 표시만 해둠', true);
}
function nearestZombie(u, range) { let b = null, bd = range; for (const z of G.zombies) { if (z.dead || !sameFl(z, u)) continue; const d = D2(u, z); if (d < bd) { bd = d; b = z; } } return b; }
function countNear(u, r) { let n = 0; for (const z of G.zombies) if (!z.dead && sameFl(z, u) && D2(u, z) < r) n++; return n; }

// ---------------- 이동/경로 ----------------
// 목표가 다른 건물 안/밖이면 가까운 문을 경유
function waypoint(e, tx, tz) {
  const ba = inBuilding(e.x, e.z), bb = inBuilding(tx, tz);
  if (ba === bb || (e.fl || 0) > 0) {
    if (ba && segBlocked(e.x, e.z, tx, tz, e.fl)) return roomRoute(e, tx, tz, ba);
    return { x: tx, z: tz };
  }
  const b = ba || bb, inside = !!ba;
  let best = null, bd = 1e9;
  for (const d of b.doorsW) { const c = Math.hypot(d.x - e.x, d.z - e.z) + Math.hypot(d.x - tx, d.z - tz); if (c < bd) { bd = c; best = d; } }
  if (!best) return { x: tx, z: tz };
  const near = inside ? { x: best.ix, z: best.iz } : { x: best.ox, z: best.oz };
  if (Math.hypot(near.x - e.x, near.z - e.z) < 1.2) return inside ? { x: best.ox, z: best.oz } : { x: best.ix, z: best.iz };
  return near;
}
function roomRoute(e, tx, tz, b) { return { x: tx, z: tz }; }
function steer(e, tx, tz, spd, dt) {
  const w = waypoint(e, tx, tz);
  let dx = w.x - e.x, dz = w.z - e.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  if (e.detour > 0) { e.detour -= dt; const px = -dz * e.dside, pz = dx * e.dside; dx = dx * 0.5 + px; dz = dz * 0.5 + pz; const l2 = Math.hypot(dx, dz) || 1; dx /= l2; dz /= l2; }
  const ox = e.x, oz = e.z, step = Math.min(spd * dt, l);
  e.x += dx * step; e.z += dz * step; pushOut(e);
  const moved = Math.hypot(e.x - ox, e.z - oz);
  if (step > 0.01 && moved < step * 0.3) { e.stuck += dt; if (e.stuck > 0.3) { e.detour = rand(0.5, 1.1); e.dside = Math.random() < 0.5 ? 1 : -1; e.stuck = 0; } } else e.stuck = 0;
  if (moved > 0.001) e.face = Math.atan2(e.x - ox, e.z - oz);
  return moved / dt;
}

// ---------------- 업데이트 ----------------
function updateGame(dt) {
  G.t += dt;
  for (const k in G.buffs) if (G.buffs[k] > 0) G.buffs[k] -= dt;
  if (G.lure) { G.lure.t -= dt; if (G.lure.t <= 0) G.lure = null; }
  const me = G.me;
  // 로컬 플레이어
  if (me && me.state === 'active' && !UI.dialog) controlLocal(me, dt);
  else if (me && me.state === 'down' && G.mode === 'solo') { /* 솔로: 쓰러지면 게임오버 */ STORY.fail(`${me.ch.name}이(가) 쓰러졌습니다`); }
  if (G.mode === 'client') return;   // 클라이언트는 나머지를 호스트 스냅샷으로 표시
  // 유닛 공통
  for (const u of G.units) {
    u.atkT -= dt; u.skillCd -= dt; u.inv -= dt; u.block -= dt; u.hurt -= dt; if (u.atkAnim > 0) u.atkAnim -= dt * 4;
    if (u.hidden > 0) { u.hidden -= dt; if (u.ambushWait > 0) { u.ambushWait -= dt; const nz = nearestZombie(u, 3.2); if (nz || u.ambushWait <= 0) ambushTrigger(u); } }
    if (u.say && (u.say.t -= dt) <= 0) u.say = null;
    if (u.state === 'down') {
      u.downT -= dt;
      const helper = G.units.find(o => o.state === 'active' && sameFl(o, u) && D2(o, u) < 2.2);
      if (helper) { u.reviveT += dt; if (u.reviveT > 1.6) reviveUnit(u, 0.5); } else u.reviveT = Math.max(0, u.reviveT - dt);
      if (u.downT <= 0 && !u.scripted) STORY.fail(`${u.ch.name}이(가) 감염되었습니다 — 출석 실패`);
    }
    if (u.state === 'active' && u.ctrl === 'ai') allyAI(u, dt);
    if (u.state === 'active' && G.t - (u.lastHit || 0) > 6 && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + 1.2 * dt);
  }
  populateFloors();
  updateZombies(dt);
  updateProjectiles(dt);
  // 아이템 줍기 (모든 플레이어/동료 중 플레이어 캐릭터만)
  for (const p of G.pickups) { if (p.got) continue; for (const u of G.units) if (u.ctrl !== 'ai' && u.state === 'active' && (p.fl || 0) === (u.fl || 0) && Math.hypot(u.x - p.x, u.z - p.z) < 1.3) { collectPickup(p, u); break; } }
  G.pickups = G.pickups.filter(p => !p.got);
}
function controlLocal(u, dt) {
  const gp = pollPad(dt);
  let fx_ = 0, fz_ = 0;   // 입력 (오른쪽 +x, 앞 +1)
  if (keys.KeyA || keys.ArrowLeft) fx_--; if (keys.KeyD || keys.ArrowRight) fx_++;
  if (keys.KeyW || keys.ArrowUp) fz_++; if (keys.KeyS || keys.ArrowDown) fz_--;
  if (joy.active) { fx_ = joy.x; fz_ = -joy.y; }
  if (gp && (gp.mx || gp.mz)) { fx_ = gp.mx; fz_ = -gp.mz; }
  let il = Math.hypot(fx_, fz_); if (il > 1) { fx_ /= il; fz_ /= il; il = 1; }
  let mx, mz;
  if (G.view === 'chase') { const fwx = Math.sin(G.yaw), fwz = Math.cos(G.yaw); mx = fwx * fz_ - fwz * fx_; mz = fwz * fz_ + fwx * fx_; }
  else { mx = fx_; mz = -fz_; }
  // 달리기 (스태미나)
  const running = (keys.ShiftLeft || keys.ShiftRight || G.run || (gp && gp.run)) && il > 0.1 && u.stamina > 0;
  u.stamina = clamp(u.stamina + (running ? -24 : 15) * dt, 0, 100); if (u.stamina <= 0) u.tired = 1.5; if (u.tired > 0) u.tired -= dt;
  const spd = (3.4 + u.ch.spd * 0.42) * (G.buffs.haste > 0 ? 1.35 : 1) * (u.hidden > 0 ? 0.6 : 1) * (running && !(u.tired > 0) ? 1.55 : 1);
  const ox = u.x, oz = u.z; u.x += mx * spd * dt; u.z += mz * spd * dt; pushOut(u);
  u.speed = Math.hypot(u.x - ox, u.z - oz) / dt; u.running = running;
  let aim;
  updateMouseWorld();
  if (isTouch || (gp && G.view === 'chase' && !mouse.down)) { const t = nearestZombie(u, 9); aim = t ? angTo(u, t) : (il > 0.1 ? Math.atan2(mx, mz) : u.face); }
  else if (G.view === 'chase') aim = (mouse.down || u.speed < 0.2) ? G.yaw : (Math.abs(angDiff(Math.atan2(mx, mz), G.yaw)) < 1.7 ? G.yaw : Math.atan2(mx, mz));
  else aim = Math.atan2(mouse.world.x - u.x, mouse.world.z - u.z);
  if (u.block <= 0) u.face = aim;
  const attack = mouse.down || (gp && gp.atk);
  if (attack) { const a2 = G.view === 'chase' && !isTouch && !gp ? G.yaw : aim; if (G.mode === 'client') { if (u.atkT <= 0) { u.atkT = 0.5; u.atkAnim = 1; NET.send({ t: 'act', a: 'atk', face: a2 }); sfx('swing'); } } else meleeAttack(u, a2); }
  const tgt = (isTouch || gp) ? (nearestZombie(u, 14) || { x: u.x + Math.sin(aim) * 8, z: u.z + Math.cos(aim) * 8 }) : mouse.world;
  if (pressSkill) { if (G.mode === 'client') { const why = skillReady(u); if (u.skillCd <= 0 && !why) { u.skillCd = u.ch.skill.cd; NET.send({ t: 'act', a: 'skill', tx: tgt.x, tz: tgt.z }); UI.cutin(u); } else if (why) floatText(u.x, u.z, why, '#ff9a9a', 15); } else castSkill(u, tgt.x, tgt.z); }
  pressSkill = false;
  if (pressInteract) { if (stairsNear(u) && !STORY.nearInteract(u)) UI.openFloors(u); else if (G.mode === 'client') NET.send({ t: 'act', a: 'use' }); else STORY.tryInteract(u); }
  pressInteract = false;
  if (G.mode === 'client') { u.atkT -= dt; u.skillCd -= dt; if (u.atkAnim > 0) u.atkAnim -= dt * 4; }
}
// 층 이동
function changeFloor(u, n) {
  const B = inBuilding(u.x, u.z); if (!B || !B.stairs || !B.stairs[n]) return;
  u.fl = n; u.x = B.stairs[n].x - 1.2; u.z = B.stairs[n].z; pushOut(u); sfx('pick');
  UI.banner(`${B.name} ${n + 1}층`, '#ffe066', 1.6);
}
// 처음 올라간 층에 감염자 배치
function populateFloors() {
  if (STORY.ending) return;
  for (const u of G.units) {
    if (u.ctrl === 'ai' || !(u.fl > 0)) continue; const B = inBuilding(u.x, u.z); if (!B) continue;
    const key = B.id + ':' + u.fl; if (G.floorSeen[key]) continue; G.floorSeen[key] = true;
    const R = B.id === 'seongsan' && u.fl >= 5 ? { x0: 24, x1: 36, z0: -66, z1: -54 } : B;
    const n = 1 + ((Math.random() * 3) | 0);
    for (let i = 0, k = 0; i < n && k < 40; k++) { const x = rand(R.x0 + 1.5, R.x1 - 1.5), z = rand(R.z0 + 1.5, R.z1 - 1.5);
      if (freeSpot(x, z, 0.8, u.fl) && Math.hypot(x - u.x, z - u.z) > 3.5) { spawnZombie(Math.random() < 0.25 ? 'runner' : 'walker', x, z, u.fl); i++; } }
    if (Math.random() < 0.6) for (let k = 0; k < 30; k++) { const x = rand(R.x0 + 1.5, R.x1 - 1.5), z = rand(R.z0 + 1.5, R.z1 - 1.5); if (freeSpot(x, z, 0.6, u.fl)) { dropPickup(Math.random() < 0.5 ? 'food' : 'med', x, z, { fl: u.fl }); break; } }
  }
}
function leaderFor(u) {
  let best = G.me, bd = 1e9;
  for (const o of G.units) if (o.ctrl !== 'ai' && o.state === 'active') { const d = D2(o, u); if (d < bd) { bd = d; best = o; } }
  return best;
}
function allyAI(u, dt) {
  if (u.scripted) { if (u.scriptMove) { const sp = steer(u, u.scriptMove.x, u.scriptMove.z, 4.5, dt); u.speed = sp; if (Math.hypot(u.x - u.scriptMove.x, u.z - u.scriptMove.z) < 0.6) u.scriptMove = null; } else u.speed = 0;
    const z = nearestZombie(u, 2.6); if (z) meleeAttack(u, angTo(u, z)); return; }
  const L = leaderFor(u); if (!L) return;
  if (!sameFl(u, L)) { u.flT = (u.flT || 0) + dt; if (u.flT > 1.2) { u.flT = 0; u.fl = L.fl || 0; u.x = L.x + rand(-1.5, 1.5); u.z = L.z + rand(-1.5, 1.5); pushOut(u); } return; }
  // 쓰러진 동료 우선
  const downed = G.units.find(o => o.state === 'down' && sameFl(o, u) && D2(o, u) < 12);
  const z = nearestZombie(u, 7);
  const spd = (3.2 + u.ch.spd * 0.4) * (G.buffs.haste > 0 ? 1.35 : 1);
  let tx, tz;
  if (downed && (!z || D2(z, u) > 3)) { tx = downed.x; tz = downed.z; }
  else if (z && D2(z, L) < 12) { tx = z.x; tz = z.z; if (D2(u, z) < 2.1 + z.r) { u.speed = 0; meleeAttack(u, angTo(u, z)); tx = null; } }
  else {
    const n = G.units.length, idx = G.units.indexOf(u), ang = idx / n * 6.283 + G.t * 0.05, rad = 2.6 + (idx % 3) * 0.9;
    tx = L.x + Math.sin(ang) * rad; tz = L.z + Math.cos(ang) * rad;
    if (Math.hypot(tx - u.x, tz - u.z) < 0.8) { tx = null; u.speed = 0; }
  }
  if (tx != null) u.speed = steer(u, tx, tz, spd * (D2(u, L) > 10 ? 1.3 : 1), dt);
  if (D2(u, L) > 40 && !segBlocked(L.x, L.z, L.x + 1, L.z + 1, L.fl)) { u.x = L.x + rand(-1.5, 1.5); u.z = L.z + rand(-1.5, 1.5); pushOut(u); }
  // 자동 스킬
  if (u.skillCd <= 0 && !skillReady(u)) {
    const id = u.ch.skill.id, nz = nearestZombie(u, 12); let use = false, tgt = nz;
    if (id === 'heal') use = G.units.some(o => (o.state === 'active' && o.hp < o.maxHp * 0.55 || o.state === 'down') && D2(o, u) < 13);
    else if (id === 'supply') use = G.units.some(o => o.state === 'active' && o.hp < o.maxHp * 0.5 && D2(o, u) < 9);
    else if (id === 'note' || id === 'escape') use = countNear(u, 6) >= 3;
    else if (id === 'block') use = countNear(u, 3) >= 2;
    else if (id === 'ambush') use = countNear(u, 12) >= 3 && u.hp < u.maxHp * 0.8;
    else if (id === 'lure') { use = countNear(L, 10) >= 4; if (use) tgt = { x: L.x + (L.x - (nz ? nz.x : L.x)) * 0.1 + rand(-6, 6), z: L.z + rand(-6, 6) }; }
    else use = nz && countNear(nz, 5) >= 2;
    if (use) castSkill(u, tgt ? tgt.x : u.x, tgt ? tgt.z : u.z);
  }
}
function updateZombies(dt) {
  const units = G.units.filter(u => u.state === 'active' && u.hidden <= 0 && !u.absent);
  const visible = (z, u) => { if (!sameFl(z, u)) return false; const d = D2(z, u); if (d > (inBuilding(z.x, z.z) || underground(z.x) ? 16 : 26)) return false; return true; };
  for (const z of G.zombies) {
    if (z.dead) continue;
    z.hitFlash -= dt; z.mark -= dt; z.atkCd -= dt; if (z.atkAnim > 0) z.atkAnim -= dt * 3;
    if (z.stun > 0) { z.stun -= dt; z.speedNow = 0; continue; }
    if (z.root > 0) { z.root -= dt; z.speedNow = 0; const t = units.find(u => sameFl(u, z) && D2(u, z) < z.r + u.r + 0.4); if (t && z.atkCd <= 0) { hurtUnit(t, z.dmg, z); z.atkCd = 1; z.atkAnim = 1; } continue; }
    // 불
    for (const f of G.fx) if (f.type === 'fire' && Math.abs((f.y || 0) - FY(z)) < 1 && Math.hypot(f.x - z.x, f.z - z.z) < f.r) { z.hp -= 22 * (f.dm || 1) * dt; z.hitFlash = 0.05; if (z.hp <= 0) killZombie(z); }
    if (z.dead) continue;
    // 혼란: 가까운 좀비를 공격
    if (z.confused > 0) {
      z.confused -= dt; let o = null, bd = 6;
      for (const q of G.zombies) if (q !== z && !q.dead && sameFl(q, z) && D2(q, z) < bd) { bd = D2(q, z); o = q; }
      if (o) { z.speedNow = steer(z, o.x, o.z, z.spd, dt); if (bd < z.r + o.r + 0.4 && z.atkCd <= 0) { hurtZombie(o, z.dmg * 1.5, 0, 0); z.atkCd = 0.9; z.atkAnim = 1; } }
      else { z.wander += dt; z.speedNow = steer(z, z.x + Math.sin(z.wander) * 4, z.z + Math.cos(z.wander * 1.3) * 4, z.spd * 0.7, dt); }
      continue;
    }
    z.retarget -= dt;
    if (z.retarget <= 0) { z.retarget = 0.4; let b = null, bd = 1e9; for (const u of units) { if (!visible(z, u)) continue; const d = D2(z, u); if (d < bd) { bd = d; b = u; } } z.target = b; }
    let tx, tz, spd = z.spd * (1 + G.night * 0.15) * (G.n1buff > 0 && z.kind !== 'n1' ? 1.25 : 1);
    if (G.lure && (G.lure.fl || 0) === (z.fl || 0) && Math.hypot(G.lure.x - z.x, G.lure.z - z.z) < 22 && z.kind !== 'n1') {
      tx = G.lure.x; tz = G.lure.z; if (Math.hypot(tx - z.x, tz - z.z) < 2.2) { z.root = 4; floatText(z.x, z.z, '함정!', '#ffd36b', 14); }
    } else if (z.target && z.target.state === 'active') { tx = z.target.x; tz = z.target.z; }
    else { z.wander += dt * 0.3; tx = z.x + Math.sin(z.wander) * 3; tz = z.z + Math.cos(z.wander * 1.3) * 3; spd *= 0.4; }
    if (z.kind === 'agent' && z.target) {
      // 거리 유지 + 사격
      const d = D2(z, z.target);
      if (d < 7) { tx = z.x - (z.target.x - z.x); tz = z.z - (z.target.z - z.z); } else if (d < 13) { tx = z.x; tz = z.z; }
      z.shotT -= dt;
      if (z.shotT <= 0 && d < 20 && !segBlocked(z.x, z.z, z.target.x, z.target.z, z.fl)) { z.shotT = rand(1.2, 1.8); const a = angTo(z, z.target) + rand(-0.08, 0.08);
        projectile({ kind: 'bullet', enemy: true, x: z.x, z: z.z, vx: Math.sin(a) * 30, vz: Math.cos(a) * 30, dmg: z.dmg, life: 0.8 }); z.face = a; sfx('shot'); }
    }
    z.speedNow = steer(z, tx, tz, spd, dt);
    if (z.kind === 'agent' && z.target) z.face = angTo(z, z.target);
    // 근접 공격
    const t = z.target;
    if (t && t.state === 'active' && sameFl(t, z) && z.kind !== 'agent' && z.atkCd <= 0 && D2(z, t) < z.r + t.r + 0.45) { hurtUnit(t, z.dmg, z); z.atkCd = z.kind === 'runner' ? 0.7 : 1.0; z.atkAnim = 1; }
    // 보스 행동
    if (z.kind === 'n1') bossN1(z, dt); if (z.kind === 'mimic') bossMimic(z, dt);
  }
  // 분리
  const Z = G.zombies;
  for (let i = 0; i < Z.length; i++) for (let j = i + 1; j < Z.length; j++) {
    const a = Z[i], b = Z[j], dx = b.x - a.x, dz = b.z - a.z, rr = a.r + b.r; if (Math.abs(dx) > rr || Math.abs(dz) > rr || !sameFl(a, b)) continue;
    const d = Math.hypot(dx, dz); if (d >= rr || d === 0) continue; const p = (rr - d) / 2, nx = dx / d, nz = dz / d;
    a.x -= nx * p; a.z -= nz * p; b.x += nx * p; b.z += nz * p;
  }
  for (const u of G.units) if (u.state === 'active') for (const z of Z) { if (!sameFl(u, z)) continue; const dx = u.x - z.x, dz = u.z - z.z, rr = u.r + z.r, d = Math.hypot(dx, dz); if (d < rr && d > 0) { u.x = z.x + dx / d * rr; u.z = z.z + dz / d * rr; } }
  for (const z of Z) if (z.dead) removeZombie(z);
  G.zombies = Z.filter(z => !z.dead);
}
function bossN1(z, dt) {
  z.summon = (z.summon || 6) - dt;
  if (z.summon <= 0) { z.summon = 9; for (let i = 0; i < 4; i++) spawnAround(Math.random() < 0.3 ? 'runner' : 'walker', z.x, z.z, 3, 7); G.n1buff = 4; say(z, '출석체크.', 2); }
  if (G.n1buff > 0) G.n1buff -= dt;
  z.dash = (z.dash || 4) - dt;
  if (z.dash <= 0 && z.target) { z.dash = 5; const a = angTo(z, z.target); fx('ring', { x: z.x, z: z.z, r: 4, life: 0.4, color: '#d14b4b' });
    for (let i = 0; i < 12; i++) { const aa = a + (i - 6) * 0.08; projectile({ kind: 'bullet', enemy: true, wave: true, x: z.x, z: z.z, vx: Math.sin(aa) * 16, vz: Math.cos(aa) * 16, dmg: 10, life: 0.9 }); } }
}
function bossMimic(z, dt) {
  z.voice = (z.voice || 3) - dt;
  if (z.voice <= 0) { z.voice = rand(4, 7); const lines = UI.recentLines(); const l = lines[(Math.random() * lines.length) | 0] || '도와주세요……'; say(z, `"${l}"`, 2.5); }
}
function updateProjectiles(dt) {
  for (const p of G.proj) {
    p.life -= dt;
    if (p.arc) { p.t0 = (p.t0 || 0) + dt; const k = Math.min(1, p.t0 / p.dur); p.mesh.position.set(p.x + (p.tx - p.x) * k, (p.fl || 0) * FH + 1.2 + Math.sin(k * Math.PI) * 3, p.z + (p.tz - p.z) * k);
      if (k >= 1 && !p.visual) { p.life = 0; G.ctxFl = p.fl || 0; fx('fire', { x: p.tx, z: p.tz, r: 3.4, life: 5, dm: p.dm }); fx('ring', { x: p.tx, z: p.tz, r: 4, life: 0.4, color: '#ff8a3a' }); sfx('boom');
        for (const z of G.zombies) { const d = Math.hypot(z.x - p.tx, z.z - p.tz); if (d < 3.6 && (z.fl || 0) === (p.fl || 0)) hurtZombie(z, 45 * p.dm, (z.x - p.tx) / (d || 1), (z.z - p.tz) / (d || 1)); } }
      continue; }
    const ox = p.x, oz = p.z; p.x += p.vx * dt; p.z += p.vz * dt; p.mesh.position.set(p.x, (p.fl || 0) * FH + 1.2, p.z);
    if (blockedAt(p.x, p.z, 0, p.fl)) { p.life = 0; continue; }
    if (p.visual) continue;
    if (p.enemy) { for (const u of G.units) if (u.state === 'active' && (u.fl || 0) === (p.fl || 0) && Math.hypot(u.x - p.x, u.z - p.z) < u.r + 0.3) { hurtUnit(u, p.dmg, { x: ox, z: oz }); p.life = 0; break; } continue; }
    for (const z of G.zombies) {
      if (z.dead || p.hit.has(z) || (z.fl || 0) !== (p.fl || 0)) continue;
      if (Math.hypot(z.x - p.x, z.z - p.z) < z.r + 0.3) {
        const sp = Math.hypot(p.vx, p.vz) || 1; hurtZombie(z, p.dmg, p.vx / sp * 1.6, p.vz / sp * 1.6, p.owner); z.stun = Math.max(z.stun, z.kind === 'n1' ? 0.15 : 0.7); p.hit.add(z); sfx('hit');
        let nx = null, nd = 9;
        if (p.bounces > 0) for (const q of G.zombies) { if (q.dead || p.hit.has(q) || (q.fl || 0) !== (p.fl || 0)) continue; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < nd) { nd = d; nx = q; } }
        if (nx) { p.bounces--; p.vx = (nx.x - p.x) / nd * 24; p.vz = (nx.z - p.z) / nd * 24; p.life = 0.5; } else p.life = 0;
        break;
      }
    }
  }
  for (const p of G.proj) if (p.life <= 0) scene.remove(p.mesh);
  G.proj = G.proj.filter(p => p.life > 0);
}

// ---------------- 렌더 동기화 ----------------
function syncModels(dt) {
  for (const u of G.units) {
    const m = u.model; m.visible = !u.absent && !(u === G.me && G.fp && G.view === 'chase') && (!G.me || sameFl(u, G.me)) && !(G.view === 'chase' && u !== G.me && Math.hypot(camera.position.x - u.x, camera.position.z - u.z) < 1.9);
    m.position.set(u.x, FY(u), u.z); m.rotation.y = u.face;
    if (u.state === 'down') { m.rotation.z = Math.PI / 2 * 0.9; m.position.y = FY(u) + 0.3; } else m.rotation.z = 0;
    animateModel(m, u.state === 'active' ? (u.speed || 0) : 0, dt, u.atkAnim);
    m.userData.body.position.y = u.hurt > 0 ? Math.sin(G.t * 60) * 0.04 : 0;
  }
  for (const z of G.zombies) {
    const m = z.model; m.visible = !G.me || sameFl(z, G.me); m.position.set(z.x, FY(z), z.z); m.rotation.y = z.face;
    animateModel(m, z.speedNow || 0, dt, z.atkAnim);
    if (m.userData.aura) m.userData.aura.rotation.z += dt * 2;
  }
  for (const p of G.pickups) { p.mesh.visible = !G.me || (p.fl || 0) === (G.me.fl || 0); p.mesh.rotation.y += dt * 1.5; p.mesh.position.y = (p.fl || 0) * FH + Math.sin(G.t * 3 + p.id) * 0.1; }
}
const camTmp = new THREE.Vector3(), lookTmp = new THREE.Vector3();
function updateCamera(dt) {
  const me = G.me; if (!me) return;
  const sh = G.shake || 0; G.shake = Math.max(0, sh - dt);
  const fy = FY(me), inB = inBuilding(me.x, me.z), indoor = !!inB && !underground(me.x);
  if (G.view === 'chase') {
    const pe = indoor ? Math.max(G.pitch, 0.66) : G.pitch;
    const cp = Math.cos(pe), sp = Math.sin(pe), fwx = Math.sin(G.yaw), fwz = Math.cos(G.yaw);
    const fov = innerHeight > innerWidth ? 72 : 58; if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    const hx = me.x, hz = me.z, hy = fy + 1.55;
    let dist = G.camDist * (innerHeight > innerWidth ? 1.15 : 1);
    // 벽에 막히면 카메라를 당김
    for (let d = 0.4; d <= dist; d += 0.25) { const x = hx - fwx * cp * d, z = hz - fwz * cp * d, y = hy + sp * d; if (y < fy + FH + 0.2 && blockedAt(x, z, 0.2, me.fl || 0)) { dist = Math.max(0.6, d - 0.35); break; } }
    G.fp = dist < 1.6;   // 너무 좁으면 1인칭으로
    if (G.fp) dist = 0.05;
    let cy = G.fp ? hy + 0.1 : hy + sp * dist;
    camTmp.set(hx - fwx * cp * dist + rand(-sh, sh) * 0.3, cy, hz - fwz * cp * dist + rand(-sh, sh) * 0.3);
    camera.position.lerp(camTmp, 1 - Math.pow(0.0005, dt));
    lookTmp.set(hx + fwx * 3, hy + 0.2 - (pe - 0.3) * (G.fp ? 2.4 : 1.2), hz + fwz * 3); camera.lookAt(lookTmp);
  } else {
    if (camera.fov !== 50) { camera.fov = 50; camera.updateProjectionMatrix(); }
    const portrait = innerHeight > innerWidth, D = G.zoom * (portrait ? 1.35 : 1);
    const tx = me.x + rand(-sh, sh), tz = me.z + rand(-sh, sh);
    camera.position.lerp(tmpV.set(tx, fy + D * 0.95, tz + D * 0.62), 1 - Math.pow(0.001, dt));
    camera.lookAt(tx, fy, tz - 1);
  }
  // 건물: 안에 있으면 외관/지붕 숨기고 현재 층만 표시, 시야를 가리는 건물은 반투명
  const cx = camera.position.x, cz = camera.position.z;
  for (const b of WORLD.buildings) {
    const inside = b === inB;
    const segHit = !inside && segRect(cx, cz, me.x, me.z, b);
    const camIn = !inside && cx > b.x0 && cx < b.x1 && cz > b.z0 && cz < b.z1;
    b.up.visible = !inside; b.label.visible = !inB && !segHit && (G.view !== 'chase' || D2(me, { x: b.x, z: b.z }) > 18);
    if (b.tower) b.tower.visible = !inside;
    const op = (segHit || camIn) ? 0.22 : 1; b.up.children.forEach(c => { const ms = Array.isArray(c.material) ? c.material : [c.material]; ms.forEach(m => { if (m) { m.opacity = op; m.transparent = true; } }); });
    if (b.floorGroups) b.floorGroups.forEach((g, n) => { if (g) g.visible = inside && n === (me.fl || 0); });
    b.group.visible = !(inside && (me.fl || 0) > 0) || true;
  }
  flash.position.set(me.x, fy + 3, me.z);
  const ug = underground(me.x);
  flash.intensity = (ug ? 2.2 : indoor ? 0.9 + G.night * 1.2 : G.night * 1.6) * (G.inv.flashlight ? 1.5 : 1);
  flash.distance = (ug ? 18 : 24) * (G.inv.flashlight ? 1.5 : 1);
}
function segRect(x1, z1, x2, z2, b) {
  for (let i = 1; i < 12; i++) { const t = i / 12, x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t; if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return true; }
  return false;
}

// ---------------- 사운드 ----------------
let AC = null, muted = false;
function sfx(type) {
  if (muted) return;
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.connect(g); g.connect(AC.destination);
    const P = { swing: ['triangle', 300, 120, .08, .03], hit: ['square', 160, 60, .08, .05], skill: ['sine', 300, 900, .25, .07], hurt: ['sawtooth', 150, 70, .15, .06],
      pick: ['sine', 600, 1100, .12, .06], boom: ['sawtooth', 120, 30, .4, .09], shot: ['square', 900, 200, .05, .04], msg: ['sine', 880, 1320, .12, .05] }[type];
    if (!P) return;
    o.type = P[0]; o.frequency.setValueAtTime(P[1], t); o.frequency.exponentialRampToValueAtTime(P[2], t + P[3]);
    g.gain.setValueAtTime(P[4], t); g.gain.exponentialRampToValueAtTime(0.0001, t + P[3]); o.start(t); o.stop(t + P[3] + 0.02);
  } catch (e) {}
}
