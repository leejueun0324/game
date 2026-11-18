'use strict';
// ============================================================
//  3D 모델: 사람(캐릭터별 외형), 좀비, 위협 인물
// ============================================================
const SKIN = '#f1c9a5', HAIR = '#1e1714';
function part(parent, x, y, z, w, h, d, color, opts) {
  const m = new THREE.Mesh(BOXG, mat(color, opts)); m.scale.set(w, h, d); m.position.set(x, y, z); parent.add(m); return m;
}
function limb(parent, x, y, z) { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; }

// 캐릭터 모델. ch: CHARS 항목
function makeHuman(ch, opt) {
  opt = opt || {};
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const s = ch.height / 172; body.scale.set(s, s, s);
  const fem = ch.gender === '여', sh = fem ? 0.46 : 0.54, skin = opt.skin || SKIN;
  const top = ch.top, bot = ch.bottom;
  // 다리
  const legL = limb(body, -0.13, 0.92, 0), legR = limb(body, 0.13, 0.92, 0);
  for (const L of [legL, legR]) {
    if (bot.type === 'shorts') { const sl = bot.len || 0.36; part(L, 0, -sl / 2, 0, 0.2, sl, 0.22, bot.color); part(L, 0, -(sl + 0.84) / 2, 0, 0.16, 0.84 - sl, 0.17, skin); }
    else { part(L, 0, -0.42, 0, bot.type === 'cargo' ? 0.23 : 0.19, 0.84, 0.21, bot.color);
      if (bot.type === 'cargo') part(L, 0, -0.42, 0.0, 0.25, 0.16, 0.15, bot.color); if (bot.type === 'training') part(L, 0.1, -0.42, 0, 0.02, 0.8, 0.22, '#e8e8e8'); }
    part(L, 0, -0.88, 0.04, 0.2, 0.1, 0.3, opt.shoe || ch.shoe || '#f0f0f0');
  }
  // 몸통
  const torso = new THREE.Group(); torso.position.y = 0.92; body.add(torso);
  if (top.type === 'cardigan') {
    part(torso, 0, 0.3, 0, sh - 0.02, 0.62, 0.26, top.color);                    // 안쪽 셔츠
    part(torso, -sh / 2 + 0.08, 0.3, 0.01, 0.17, 0.64, 0.27, top.over);          // 가디건 앞판
    part(torso, sh / 2 - 0.08, 0.3, 0.01, 0.17, 0.64, 0.27, top.over);
    part(torso, 0, 0.3, -0.02, sh, 0.64, 0.24, top.over);
  } else {
    const tl = top.len || 0.64; part(torso, 0, 0.62 - tl / 2, 0, sh + (tl > 0.7 ? 0.02 : 0), tl, 0.27 + (tl > 0.7 ? 0.01 : 0), top.color);
    if (top.type === 'hoodie') { part(torso, 0, 0.62, -0.13, sh * 0.7, 0.16, 0.14, top.color); part(torso, 0, 0.12, 0.14, sh * 0.6, 0.16, 0.02, top.color, { emissive: '#000' });
      part(torso, -0.06, 0.5, 0.14, 0.015, 0.16, 0.01, '#ddd'); part(torso, 0.06, 0.5, 0.14, 0.015, 0.16, 0.01, '#ddd'); }
    if (top.type === 'sweat') part(torso, 0, 0.6, 0, sh * 0.55, 0.05, 0.28, top.color);
  }
  // 팔
  const armC = top.type === 'cardigan' ? top.over : top.color;
  const armL = limb(torso, -sh / 2 - 0.07, 0.58, 0), armR = limb(torso, sh / 2 + 0.07, 0.58, 0);
  for (const A of [armL, armR]) { part(A, 0, -0.28, 0, 0.13, 0.58, 0.15, armC); part(A, 0, -0.62, 0, 0.11, 0.12, 0.12, skin); }
  // 머리
  const head = new THREE.Group(); head.position.y = 1.62; body.add(head);
  part(head, 0, 0.13, 0, 0.36, 0.38, 0.34, skin);
  part(head, -0.08, 0.14, 0.175, 0.05, 0.05, 0.01, '#222'); part(head, 0.08, 0.14, 0.175, 0.05, 0.05, 0.01, '#222');
  part(head, 0, 0.03, 0.175, 0.08, 0.02, 0.01, '#b5605a');
  // 머리카락
  const hc = opt.hair || ch.hairColor || HAIR, hl = ch.hairLen || 1;
  if (ch.forehead) part(head, 0, 0.34, -0.04, 0.4, 0.09, 0.35, hc); else part(head, 0, 0.33, -0.02, 0.4, 0.1, 0.39, hc);   // 정수리
  part(head, 0, 0.18, -0.19, 0.4, 0.3, 0.06, hc);                       // 뒤
  part(head, -0.2, 0.2, -0.02, 0.04, 0.28, 0.36, hc); part(head, 0.2, 0.2, -0.02, 0.04, 0.28, 0.36, hc);
  if (ch.hair === 'long') { const L = 0.62 * hl, S2 = 0.42 * hl; part(head, 0, 0.13 - L / 2, -0.2, 0.42, L, 0.08, hc); part(head, -0.21, 0.16 - S2 / 2, -0.05, 0.05, S2, 0.24, hc); part(head, 0.21, 0.16 - S2 / 2, -0.05, 0.05, S2, 0.24, hc); }
  if (ch.hair === 'bob') { part(head, 0, 0.02, -0.2, 0.44, 0.32, 0.08, hc); part(head, -0.22, 0.04, -0.02, 0.06, 0.3, 0.36, hc); part(head, 0.22, 0.04, -0.02, 0.06, 0.3, 0.36, hc); }
  if (ch.bangs) { const t = ch.bangs >= 2 ? 0.17 : ch.bangs < 1 ? 0.08 : 0.12; part(head, 0, 0.3 - t / 2 + 0.02, 0.17, 0.38, t, 0.05, hc); }
  else if (!ch.forehead) { part(head, -0.12, 0.29, 0.17, 0.14, 0.06, 0.04, hc); part(head, 0.12, 0.29, 0.17, 0.14, 0.06, 0.04, hc); }
  if (ch.glasses) { const gm = '#111'; part(head, -0.08, 0.14, 0.185, 0.12, 0.09, 0.01, gm, { transparent: true, opacity: 0.85 }); part(head, 0.08, 0.14, 0.185, 0.12, 0.09, 0.01, gm, { transparent: true, opacity: 0.85 });
    part(head, -0.08, 0.14, 0.19, 0.09, 0.06, 0.005, '#cfe8ff'); part(head, 0.08, 0.14, 0.19, 0.09, 0.06, 0.005, '#cfe8ff'); part(head, 0, 0.15, 0.185, 0.04, 0.015, 0.01, gm); }
  if (ch.headphones) { const hp = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 6, 16), mat('#111')); hp.rotation.x = Math.PI / 2; hp.position.set(0, 1.55, 0); body.add(hp);
    part(body, -0.17, 1.55, 0.03, 0.06, 0.12, 0.12, '#222'); part(body, 0.17, 1.55, 0.03, 0.06, 0.12, 0.12, '#222'); }
  // 손에 든 무기
  const hand = limb(armR, 0, -0.66, 0.06);
  root.userData = { body, legL, legR, armL, armR, torso, head, hand, scale: s, walk: Math.random() * 6 };
  return root;
}

function setWeaponModel(model, type) {
  const h = model.userData.hand; while (h.children.length) h.remove(h.children[0]);
  if (!type) return;
  if (type === 'bat') { part(h, 0, -0.05, 0.25, 0.06, 0.06, 0.6, '#c49a5a').rotation.x = 0; part(h, 0, -0.05, 0.62, 0.09, 0.09, 0.3, '#b08040'); }
  else if (type === 'pipe') part(h, 0, -0.05, 0.4, 0.05, 0.05, 0.9, '#9aa0a8');
  else if (type === 'umbrella') { part(h, 0, -0.05, 0.4, 0.04, 0.04, 0.85, '#222'); part(h, 0, -0.05, 0.75, 0.12, 0.12, 0.25, '#3a4a8a'); }
  else if (type === 'extinguisher') { part(h, 0, -0.2, 0.1, 0.16, 0.4, 0.16, '#c22'); }
  else if (type === 'mop') { part(h, 0, -0.05, 0.45, 0.04, 0.04, 1.0, '#c9b48a'); }
}

// 좀비: kind walker | runner | brute
const ZCLOTH = ['#5a6a7a', '#7a5a4a', '#4a5a3a', '#6a4a6a', '#8a8a8a', '#3a3a4a', '#9a7a5a'];
function makeZombie(kind) {
  const fake = { height: kind === 'brute' ? 200 : kind === 'runner' ? 165 : 172, gender: Math.random() < .5 ? '여' : '남',
    top: { type: Math.random() < .5 ? 'hoodie' : 'sweat', color: ZCLOTH[(Math.random() * 7) | 0] }, bottom: { type: 'jeans', color: ZCLOTH[(Math.random() * 7) | 0] },
    hair: Math.random() < .4 ? 'long' : 'short', bangs: Math.random() < .5 ? 1 : 0 };
  const m = makeHuman(fake, { skin: kind === 'runner' ? '#a7b796' : '#8aa07a', hair: '#2a2620', shoe: '#555' });
  const u = m.userData;
  if (kind === 'brute') u.body.scale.multiplyScalar(1.15), u.torso.scale.set(1.5, 1.1, 1.4);
  u.armL.rotation.x = -1.3; u.armR.rotation.x = -1.4; u.armL.userData.fixed = u.armR.userData.fixed = true; u.armR.userData.base = -1.4;
  // 붉은 눈 + 핏자국
  part(u.head, -0.08, 0.14, 0.18, 0.06, 0.05, 0.01, '#ff2020', { emissive: '#aa0000' });
  part(u.head, 0.08, 0.14, 0.18, 0.06, 0.05, 0.01, '#ff2020', { emissive: '#aa0000' });
  part(u.torso, 0.08, 0.35, 0.14, 0.18, 0.22, 0.01, '#6b0f0f');
  part(u.head, 0, 0.0, 0.18, 0.14, 0.08, 0.01, '#5a0a0a');
  return m;
}
// 모방체(4단계): 얼굴 없는 네 발 괴물
function makeMimic() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const sk = '#c8c0b8';
  part(body, 0, 0.9, 0, 0.6, 0.45, 1.5, sk);
  const head = new THREE.Group(); head.position.set(0, 1.1, 0.9); body.add(head);
  part(head, 0, 0, 0, 0.5, 0.5, 0.5, sk); part(head, 0, -0.08, 0.26, 0.38, 0.22, 0.02, '#300', { emissive: '#400' });
  for (let i = 0; i < 6; i++) part(head, -0.15 + i * 0.06, -0.02, 0.27, 0.03, 0.06, 0.01, '#eee');
  const legs = [];
  [[-0.35, 0.6], [0.35, 0.6], [-0.35, -0.6], [0.35, -0.6]].forEach(([x, z]) => { const L = limb(body, x, 1.0, z); part(L, 0, -0.5, 0, 0.14, 1.0, 0.14, sk); legs.push(L); });
  root.userData = { body, legs, head, armL: legs[0], armR: legs[1], legL: legs[2], legR: legs[3], walk: 0, mimic: true };
  return root;
}
// 1번
function makeNumberOne() {
  const ch = { height: 176, gender: '남', top: { type: 'hoodie', color: '#111' }, bottom: { type: 'jeans', color: '#111' }, hair: 'short', bangs: 1 };
  const m = makeHuman(ch, { shoe: '#111' }); const u = m.userData;
  part(u.head, 0, 0.06, 0.18, 0.34, 0.16, 0.02, '#222');   // 마스크
  part(u.armL, 0, -0.62, 0, 0.13, 0.14, 0.14, '#111'); part(u.armR, 0, -0.62, 0, 0.13, 0.14, 0.14, '#111');
  const aura = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 24), mat('#d14b4b', { transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  aura.rotation.x = -Math.PI / 2; aura.position.y = 0.05; m.add(aura); u.aura = aura;
  return m;
}
// K-13 요원: 검은 방호복 + 방독면 + 총
function makeAgent() {
  const ch = { height: 182, gender: '남', top: { type: 'sweat', color: '#1b1d20' }, bottom: { type: 'cargo', color: '#1b1d20' }, hair: 'short', bangs: 0 };
  const m = makeHuman(ch, { shoe: '#111', skin: '#1b1d20' }); const u = m.userData;
  part(u.head, 0, 0.18, 0, 0.42, 0.44, 0.4, '#24272b');
  part(u.head, -0.09, 0.16, 0.21, 0.12, 0.1, 0.02, '#7fb0c0', { emissive: '#204050' }); part(u.head, 0.09, 0.16, 0.21, 0.12, 0.1, 0.02, '#7fb0c0', { emissive: '#204050' });
  part(u.head, 0, 0.0, 0.24, 0.14, 0.14, 0.1, '#333');
  part(u.torso, 0, 0.35, 0.15, 0.3, 0.2, 0.02, '#d9b44a'); // K-13 패치
  u.armR.rotation.x = -1.4; u.armL.rotation.x = -1.2; u.armL.rotation.z = 0.4; u.armL.userData.fixed = u.armR.userData.fixed = true; u.armR.userData.base = -1.4;
  part(u.hand, 0, -0.05, 0.3, 0.08, 0.12, 0.7, '#222');
  return m;
}
// 헬기
function makeHeli() {
  const g = new THREE.Group();
  part(g, 0, 0, 0, 2.6, 2.2, 6, '#22262b'); part(g, 0, 0.3, 4.2, 0.5, 0.5, 4.5, '#22262b'); part(g, 0, 1.0, 6.2, 0.2, 1.6, 0.8, '#22262b');
  part(g, 0, 0.2, -2.4, 2.2, 1.2, 1.2, '#4a7a8a', { transparent: true, opacity: 0.8 });
  const rotor = new THREE.Group(); rotor.position.y = 1.4; g.add(rotor); part(rotor, 0, 0, 0, 12, 0.08, 0.4, '#111'); part(rotor, 0, 0, 0, 0.4, 0.08, 12, '#111');
  const lab = textSprite('K-13', 1.6, '#fff'); lab.position.set(1.45, 0.4, 0); g.add(lab);
  g.userData.rotor = rotor; return g;
}

// 걷기 애니메이션
function animateModel(m, speed, dt, attacking) {
  const u = m.userData; if (!u) return;
  u.walk += dt * (4 + speed * 1.6);
  const a = Math.min(1, speed / 3) * 0.7, sw = Math.sin(u.walk) * a;
  if (u.mimic) { u.legs.forEach((L, i) => L.rotation.x = Math.sin(u.walk + i * 1.6) * 0.6); return; }
  u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
  if (!u.zfix) { u.armL.rotation.x = u.armL.userData.fixed ? u.armL.rotation.x : -sw * 0.8; }
  if (attacking > 0) u.armR.rotation.x = -2.2 + (1 - attacking) * 3; else if (u.armR.userData.fixed) u.armR.rotation.x = u.armR.userData.base; else u.armR.rotation.x = sw * 0.8;
}
