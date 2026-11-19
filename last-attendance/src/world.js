'use strict';
// ============================================================
//  월드: 대구대 경산캠퍼스(재구성), 건물 내부, 지하, 충돌
// ============================================================
const WORLD = { walls: [], buildings: [], areas: {}, spawns: {}, interact: [], doors: [], labels: [], upper: [], trees: [], shift: {}, roads: [] };
function at(id, x, z) { const s = WORLD.shift[id] || [0, 0]; return [x + s[0], z + s[1]]; }
const UG_X = 520;           // 지하 구역 x 오프셋
const MAP = { x0: -168, x1: 168, z0: -138, z1: 142 };

const MATS = {};
function mat(color, opts) {
  const k = color + JSON.stringify(opts || {});
  if (!MATS[k]) MATS[k] = new THREE.MeshLambertMaterial(Object.assign({ color }, opts || {}));
  return MATS[k];
}
const BOXG = new THREE.BoxGeometry(1, 1, 1);
function box(parent, x, y, z, w, h, d, color, opts, material) {
  const m = new THREE.Mesh(BOXG, material || mat(color, opts));
  m.scale.set(w, h, d); m.position.set(x, y + h / 2, z); parent.add(m); return m;
}
const FH = 3.4;                 // 층 높이
let SR = [0, 0];                // solid()가 적용될 층 범위
function solid(x, z, w, d, tag) { const W = { x: x - w / 2, z: z - d / 2, w, d, tag, f0: SR[0], f1: SR[1] }; WORLD.walls.push(W); return W; }
const onFl = (W, fl) => W.f0 <= fl && fl <= W.f1;

// 축 정렬 벽(문 구멍 포함). gaps: [{at: 중심(0~1), w: 폭}]
function wallLine(parent, x1, z1, x2, z2, h, color, gaps, tag) {
  const horiz = Math.abs(z2 - z1) < 1e-6, L = horiz ? Math.abs(x2 - x1) : Math.abs(z2 - z1), t = 0.35;
  const sx = Math.min(x1, x2), sz = Math.min(z1, z2);
  const segs = []; let cur = 0;
  (gaps || []).slice().sort((a, b) => a.at - b.at).forEach(g => { const c = g.at * L; segs.push([cur, c - g.w / 2]); cur = c + g.w / 2; });
  segs.push([cur, L]);
  const out = [];
  for (const [a, b] of segs) {
    if (b - a < 0.05) continue;
    const mid = (a + b) / 2, len = b - a;
    const cx = horiz ? sx + mid : x1, cz = horiz ? z1 : sz + mid, w = horiz ? len : t, d = horiz ? t : len;
    out.push(box(parent, cx, 0, cz, w, h, d, color)); solid(cx, cz, w, d, tag);
  }
  // 문 위 상인방
  (gaps || []).forEach(g => { const c = g.at * L; const cx = horiz ? sx + c : x1, cz = horiz ? z1 : sz + c;
    box(parent, cx, 2.6, cz, horiz ? g.w : t, h - 2.6, horiz ? t : g.w, color); });
  return out;
}
function textSprite(text, size, color, bg) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), fs = 48;
  g.font = `900 ${fs}px "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + 40; c.width = w; c.height = fs + 30;
  g.font = `900 ${fs}px "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif`;
  if (bg) { g.fillStyle = bg; g.beginPath(); g.roundRect ? g.roundRect(0, 0, w, c.height, 18) : g.rect(0, 0, w, c.height); g.fill(); }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.75)';
  g.strokeText(text, w / 2, c.height / 2); g.fillStyle = color || '#fff'; g.fillText(text, w / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }));
  s.scale.set(size * w / c.height, size, 1); s.renderOrder = 10; return s;
}
function area(id, x, z, r, label) { WORLD.areas[id] = { id, x, z, r, label }; }
function addInteract(id, x, z, label, opts) { const o = Object.assign({ id, x, z, label, used: false, r: 2.2 }, opts || {}); WORLD.interact.push(o); return o; }

// ---------- 건물 ----------
const STYLE = {
  brick: { wall: '#a8644a', roof: '#4b4b50', parapet: '#d8d0c4', trim: '#d8d0c4' },
  redbrick: { wall: '#9c4a34', roof: '#3f3f44', parapet: '#cfc6b8', trim: '#cfc6b8' },
  stone: { wall: '#d9ccb2', roof: '#7a3b2e', parapet: '#efe6d2', trim: '#8a6a4a' },
  glass: { wall: '#9aa9b6', roof: '#59636e', parapet: '#c9d2da', trim: '#59636e' },
  white: { wall: '#e8e4dc', roof: '#6a7480', parapet: '#f5f2ec', trim: '#6a7480' },
};
const FACADE = {};
function facadeTex(style) {
  if (FACADE[style]) return FACADE[style];
  const c = document.createElement('canvas'); c.width = 128; c.height = 96; const g = c.getContext('2d'); g.scale(2, 2);
  if (style === 'glass') { g.fillStyle = '#5d7d96'; g.fillRect(0, 0, 64, 48); g.fillStyle = '#86a9c4'; g.fillRect(0, 6, 64, 30); g.fillStyle = '#c9d6df'; g.fillRect(0, 36, 64, 12); g.fillRect(0, 0, 64, 6);
    g.fillStyle = '#3b4a58'; for (let x = 0; x < 64; x += 16) g.fillRect(x, 6, 2, 30); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(4, 8, 10, 12); }
  else {
    const base = { brick: '#a8644a', redbrick: '#9c4a34', stone: '#d9ccb2', white: '#e8e4dc' }[style];
    g.fillStyle = base; g.fillRect(0, 0, 64, 48);
    if (style === 'brick' || style === 'redbrick') { g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1; for (let y = 0; y < 48; y += 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke(); for (let x = (y / 4) % 2 ? 0 : 4; x < 64; x += 8) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 4); g.stroke(); } } }
    g.fillStyle = style === 'stone' ? '#efe6d2' : '#e9e2d4'; g.fillRect(0, 40, 64, 4);     // 층 띠
    g.fillStyle = '#f2efe8'; g.fillRect(14, 9, 36, 24);                                   // 창틀
    g.fillStyle = style === 'white' ? '#34495e' : '#41617a'; g.fillRect(17, 12, 14, 18); g.fillRect(33, 12, 14, 18);
    g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(18, 13, 4, 7); g.fillRect(34, 13, 4, 7);
  }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; FACADE[style] = t; return t;
}
let DISCG = null; const FXMESH_DISC = () => DISCG || (DISCG = new THREE.CircleGeometry(1, 24));
const FMASK = {};
function facadeMask(style) {
  if (FMASK[style]) return FMASK[style];
  const c = document.createElement('canvas'); c.width = 128; c.height = 96; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 128, 96);
  for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) { const ox = tx * 64, oy = ty * 48;
    if (Math.random() < 0.55) { g.fillStyle = Math.random() < 0.5 ? '#ffd27a' : '#fff0c8'; if (style === 'glass') g.fillRect(ox, oy + 6, 64, 30); else { g.fillRect(ox + 17, oy + 12, 14, 18); g.fillRect(ox + 33, oy + 12, 14, 18); } } }
  const t = new THREE.CanvasTexture(c); FMASK[style] = t; return t;
}
// doors: {side:'n'|'s'|'e'|'w', at, w}
function building(scene, def) {
  def.wallStart = WORLD.walls.length;
  def.floors = def.floors || 5; def.h = Math.min(def.floors, 5) * FH + 0.4;
  const g = new THREE.Group(); scene.add(g);
  const { x, z, w, d } = def, x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, H = 3.4;
  const gaps = s => (def.doors || []).filter(o => o.side === s);
  const wc = STYLE[def.style || 'brick'].wall;
  SR = [0, Math.min(def.floors, 5) - 1];
  wallLine(g, x0, z0, x1, z0, H, wc, gaps('n'), def.id);
  wallLine(g, x0, z1, x1, z1, H, wc, gaps('s'), def.id);
  wallLine(g, x0, z0, x0, z1, H, wc, gaps('w'), def.id);
  wallLine(g, x1, z0, x1, z1, H, wc, gaps('e'), def.id);
  SR = [0, 0];
  // 실내 바닥
  const fl = box(g, x, 0.01, z, w - 0.4, 0.04, d - 0.4, def.floor || '#a89a86');
  // 윗층(외관) + 지붕: 내부에 들어가면 숨김
  const up = new THREE.Group(); g.add(up);
  const upH = def.h - H;
  const st = STYLE[def.style || 'brick'];
  // 외관: 스타일별 파사드 텍스처 (면마다 비율 맞춤)
  const faceMat = (len) => { const t = facadeTex(def.style || 'brick').clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.max(1, Math.round(len / 4)), Math.max(1, Math.round(upH / 3)));
    const em = facadeMask(def.style || 'brick').clone(); em.needsUpdate = true; em.wrapS = em.wrapT = THREE.RepeatWrapping; em.repeat.set(t.repeat.x / 2, t.repeat.y / 2);
    const m = new THREE.MeshLambertMaterial({ map: t, transparent: true, opacity: 1, emissive: new THREE.Color('#ffd9a0'), emissiveMap: em, emissiveIntensity: 0 }); ENV.facades.push(m); return m; };
  const capM = new THREE.MeshLambertMaterial({ color: st.roof, transparent: true, opacity: 1 });
  const um = new THREE.Mesh(BOXG, [faceMat(d), faceMat(d), capM, capM, faceMat(w), faceMat(w)]);
  um.scale.set(w + 0.2, upH, d + 0.2); um.position.set(x, H + upH / 2, z); up.add(um);
  const roofM = new THREE.MeshLambertMaterial({ color: st.roof, transparent: true, opacity: 1 });
  const rf = new THREE.Mesh(BOXG, roofM); rf.scale.set(w + 0.8, 0.6, d + 0.8); rf.position.set(x, def.h + 0.3, z); up.add(rf);
  if (st.parapet) { const pm = new THREE.MeshLambertMaterial({ color: st.parapet, transparent: true, opacity: 1 });
    [[x, z0 - 0.3, w + 1, 0.4], [x, z1 + 0.3, w + 1, 0.4], [x0 - 0.3, z, 0.4, d + 1], [x1 + 0.3, z, 0.4, d + 1]].forEach(([px, pz, pw, pd]) => { const m = new THREE.Mesh(BOXG, pm); m.scale.set(pw, 1, pd); m.position.set(px, def.h + 0.9, pz); up.add(m); }); }
  // 1층 외벽 띠 / 입구 캐노피
  (def.doors || []).forEach(o => { if (o.side !== 's') return; const cx = x0 + o.at * w; const c = box(g, cx, 3.0, z1 + 1.2, o.w + 2.4, 0.25, 2.6, st.trim); });
  (def.doors || []).forEach(o => {   // 출입문 표시: 초록 문틀 + 바닥 매트
    const hz = o.side === 'n' || o.side === 's', cx = hz ? x0 + o.at * w : (o.side === 'w' ? x0 : x1), cz = hz ? (o.side === 'n' ? z0 : z1) : z0 + o.at * d;
    const fm = mat('#2ee86b', { emissive: '#0f6a2c' }), out = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[o.side];
    [-1, 1].forEach(sg => box(g, cx + (hz ? sg * (o.w / 2 + 0.12) : 0), 0, cz + (hz ? 0 : sg * (o.w / 2 + 0.12)), 0.22, 2.7, 0.22, null, null, fm));
    box(g, cx, 2.6, cz, hz ? o.w + 0.5 : 0.24, 0.22, hz ? 0.24 : o.w + 0.5, null, null, fm);
    const mt = new THREE.Mesh(new THREE.PlaneGeometry(hz ? o.w : 1.6, hz ? 1.6 : o.w), new THREE.MeshBasicMaterial({ color: '#2ee86b', transparent: true, opacity: 0.45, depthWrite: false }));
    mt.rotation.x = -Math.PI / 2; mt.position.set(cx + out[0] * 0.9, 0.06, cz + out[1] * 0.9); g.add(mt);
  });
  const lab = textSprite(def.name, 3.2, '#fff'); lab.position.set(x, def.h + 3, z); scene.add(lab);
  const B = Object.assign({ x0, x1, z0, z1, group: g, up, label: lab, doorsW: [] }, def);
  (def.doors || []).forEach(o => {
    const p = o.side === 'n' || o.side === 's' ? { x: x0 + o.at * w, z: o.side === 'n' ? z0 : z1 } : { x: o.side === 'w' ? x0 : x1, z: z0 + o.at * d };
    const out = { n: [0, -2.5], s: [0, 2.5], w: [-2.5, 0], e: [2.5, 0] }[o.side];
    B.doorsW.push({ x: p.x, z: p.z, ox: p.x + out[0], oz: p.z + out[1], ix: p.x - out[0], iz: p.z - out[1] });
  });
  WORLD.buildings.push(B);
  const w0 = WORLD.walls.length - 0;
  if (def.inner) def.inner(g, B);
  if (def.to) {   // 설계 좌표 → 실제 캠퍼스 위치로 이동
    const dx = def.to[0] - def.x, dz = def.to[1] - def.z; WORLD.shift[def.id] = [dx, dz];
    for (let i = def.wallStart; i < WORLD.walls.length; i++) { WORLD.walls[i].x += dx; WORLD.walls[i].z += dz; }
    g.position.set(dx, 0, dz); lab.position.x += dx; lab.position.z += dz;
    B.x += dx; B.z += dz; B.x0 += dx; B.x1 += dx; B.z0 += dz; B.z1 += dz;
    B.doorsW.forEach(o => { o.x += dx; o.ox += dx; o.ix += dx; o.z += dz; o.oz += dz; o.iz += dz; });
  }
  return B;
}
// ---------- 층 (2층 이상) ----------
function addFloors(scene) {
  for (const B of WORLD.buildings) {
    const nF = B.floors; B.floorGroups = []; B.stairs = [];
    const tower = B.id === 'seongsan' ? { x0: 24, x1: 36, z0: -66, z1: -54 } : null;
    const rect = n => (tower && n >= 5) ? tower : { x0: B.x0, x1: B.x1, z0: B.z0, z1: B.z1 };
    // 1층 계단 위치
    let sx = tower ? 30 : B.x1 - 2.4, sz = tower ? -59 : (B.z0 + B.z1) / 2;
    if (blockedAt(sx, sz, 1.1, 0)) { let best = null; for (let gx = B.x1 - 2.5; gx > B.x0 + 2 && !best; gx -= 1.5) for (let gz = B.z0 + 2; gz < B.z1 - 2; gz += 1.5) if (!blockedAt(gx, gz, 1.1, 0)) { best = [gx, gz]; break; } if (best) [sx, sz] = best; }
    B.stairs[0] = { x: sx, z: sz };
    stairMesh(B.group.parent === scene ? scene : scene, sx, sz, 0);
    // 2층부터 출입문 막기
    SR = [1, Math.min(nF, 5) - 1];
    (B.doors || []).forEach((o, i) => { const D = B.doorsW[i]; const hz = o.side === 'n' || o.side === 's'; solid(D.x, D.z, hz ? o.w + 0.4 : 0.5, hz ? 0.5 : o.w + 0.4, 'doorfill'); });
    SR = [0, 0];
    for (let n = 1; n < nF; n++) {
      const R = rect(n), g = new THREE.Group(); g.position.y = n * FH; g.visible = false; scene.add(g); B.floorGroups[n] = g;
      const w = R.x1 - R.x0, d = R.z1 - R.z0, cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
      box(g, cx, -0.12, cz, w, 0.12, d, '#b9ad98');                                   // 바닥
      const wcol = STYLE[B.style || 'brick'].wall;
      if (tower && n >= 5) { SR = [5, nF - 1]; [[R.x0, R.z0, R.x1, R.z0], [R.x0, R.z1, R.x1, R.z1], [R.x0, R.z0, R.x0, R.z1], [R.x1, R.z0, R.x1, R.z1]].forEach(([a, b2, c2, d2]) => wallLine(g, a, b2, c2, d2, FH - 0.2, '#c9d3dc')); SR = [0, 0]; }
      else [[cx, R.z0, w, 0.35], [cx, R.z1, w, 0.35], [R.x0, cz, 0.35, d], [R.x1, cz, 0.35, d]].forEach(([px, pz, pw, pd]) => { box(g, px, 0, pz, pw, FH - 0.2, pd, wcol); });
      // 창문
      for (let k = R.x0 + 2; k < R.x1 - 1; k += 3.5) { box(g, k, 1.1, R.z1 + 0.05, 1.8, 1.2, 0.3, '#8fc1e0'); box(g, k, 1.1, R.z0 - 0.05, 1.8, 1.2, 0.3, '#8fc1e0'); }
      // 복도 + 방
      SR = [n, n];
      const alongX = w >= d, half = 1.5;
      if (alongX) {
        const nR = Math.max(1, Math.round((w - 4) / 7)), step = (w - 4) / nR;
        const gapsN = [], gapsS = [];
        for (let i = 0; i < nR; i++) { const rx = R.x0 + step * (i + 0.5); gapsN.push({ at: (rx - R.x0) / w, w: 1.6 }); gapsS.push({ at: (rx - R.x0) / w, w: 1.6 }); }
        if (cz - half - R.z0 > 2.5) { wallLine(g, R.x0, cz - half, R.x1 - 4, cz - half, FH - 0.2, '#e8e2d6', gapsN.map(o => ({ at: o.at * w / (w - 4), w: o.w }))); }
        if (R.z1 - cz - half > 2.5) { wallLine(g, R.x0, cz + half, R.x1 - 4, cz + half, FH - 0.2, '#e8e2d6', gapsS.map(o => ({ at: o.at * w / (w - 4), w: o.w }))); }
        for (let i = 1; i < nR; i++) { const px = R.x0 + step * i; if (cz - half - R.z0 > 2.5) wallLine(g, px, R.z0, px, cz - half, FH - 0.2, '#e8e2d6'); if (R.z1 - cz - half > 2.5) wallLine(g, px, cz + half, px, R.z1, FH - 0.2, '#e8e2d6'); }
        for (let i = 0; i < nR; i++) { const rx = R.x0 + step * (i + 0.5);
          if (cz - half - R.z0 > 3.5) { box(g, rx, 0, (R.z0 + cz - half) / 2, 1.6, 0.75, 0.8, '#8a6a48'); solid(rx, (R.z0 + cz - half) / 2, 1.6, 0.8); }
          if (R.z1 - cz - half > 3.5) { box(g, rx, 0, (R.z1 + cz + half) / 2, 1.6, 0.75, 0.8, '#8a6a48'); solid(rx, (R.z1 + cz + half) / 2, 1.6, 0.8); } }
      } else {
        const nR = Math.max(1, Math.round((d - 4) / 7)), step = (d - 4) / nR;
        const gaps = []; for (let i = 0; i < nR; i++) gaps.push({ at: (step * (i + 0.5)) / (d - 4), w: 1.6 });
        wallLine(g, cx - half, R.z0, cx - half, R.z1 - 4, FH - 0.2, '#e8e2d6', gaps); wallLine(g, cx + half, R.z0, cx + half, R.z1 - 4, FH - 0.2, '#e8e2d6', gaps);
        for (let i = 1; i < nR; i++) { const pz = R.z0 + step * i; wallLine(g, R.x0, pz, cx - half, pz, FH - 0.2, '#e8e2d6'); wallLine(g, cx + half, pz, R.x1, pz, FH - 0.2, '#e8e2d6'); }
      }
      SR = [0, 0];
      const st = alongX ? { x: tower && n >= 5 ? 30 : R.x1 - 2, z: cz } : { x: cx, z: R.z1 - 2 };
      if (tower && n < 5) { st.x = 30; st.z = cz; }
      B.stairs[n] = st; stairMesh(g, st.x, st.z, n, true);
    }
  }
}
function stairMesh(parent, x, z, n, local) {
  const g = new THREE.Group(); g.position.set(x, local ? 0 : 0, z); parent.add(g);
  for (let i = 0; i < 5; i++) box(g, -0.8 + i * 0.4, 0, 0, 0.4, 0.15 + i * 0.12, 1.8, '#8d8476');
  const sm = new THREE.Mesh(new THREE.CircleGeometry(1.3, 24), new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.25, depthWrite: false })); sm.rotation.x = -Math.PI / 2; sm.position.y = 0.05; g.add(sm);
  if (!local) { const lab = textSprite('계단 ⇅', 0.9, '#ffe066'); lab.material.depthTest = true; lab.position.set(0, 2.4, 0); g.add(lab); }
}
function stairsNear(e) { const B = inBuilding(e.x, e.z); if (!B || !B.stairs) return null; const s = B.stairs[e.fl || 0]; if (s && Math.hypot(s.x - e.x, s.z - e.z) < 2) return B; return null; }
function inBuilding(px, pz) { for (const b of WORLD.buildings) if (px > b.x0 && px < b.x1 && pz > b.z0 && pz < b.z1) return b; return null; }

// 소품
function desk(g, x, z, rot) { const d = box(g, x, 0, z, rot ? 0.8 : 1.6, 0.75, rot ? 1.6 : 0.8, '#8a6a48'); solid(x, z, rot ? 0.8 : 1.6, rot ? 1.6 : 0.8); return d; }
function shelf(g, x, z, len, horiz) {
  const w = horiz ? len : 0.7, d = horiz ? 0.7 : len;
  box(g, x, 0, z, w, 2.2, d, '#6b4f36'); solid(x, z, w, d);
  const cols = ['#b44', '#3a6ea5', '#d9b44a', '#5a8a4a', '#8a5aa5'];
  for (let i = 0; i < 6; i++) { const t = (i + 0.5) / 6 - 0.5;
    box(g, x + (horiz ? t * len : 0), 0.3 + (i % 3) * 0.6, z + (horiz ? 0 : t * len), horiz ? len / 7 : 0.75, 0.4, horiz ? 0.75 : len / 7, cols[i % 5]); }
}
function car(g, x, z, rot, color) {
  const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = rot || 0; g.add(c);
  box(c, 0, 0.3, 0, 1.8, 0.7, 4.2, color || '#556'); box(c, 0, 1.0, -0.2, 1.6, 0.6, 2.2, '#2b3540');
  const r = rot || 0, w = Math.abs(Math.sin(r)) > .5 ? 4.2 : 1.8, d = Math.abs(Math.sin(r)) > .5 ? 1.8 : 4.2; solid(x, z, w, d);
}

function buildWorld(scene) {
  // 땅 / 호수
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP.x1 - MAP.x0 + 120, MAP.z1 - MAP.z0 + 120), new THREE.MeshLambertMaterial({ map: TEX.grass }));
  ground.rotation.x = -Math.PI / 2; ground.userData.noCast = true; scene.add(ground);
  const flat = (x, z, w, d, c, y, rot, tex) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), tex ? new THREE.MeshLambertMaterial({ map: tex }) : mat(c)); m.rotation.x = -Math.PI / 2; if (rot) m.rotation.z = rot; m.position.set(x, y || 0.015, z); m.userData.noCast = true; scene.add(m); return m; };
  const texR = (t, rx, ry) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(rx, ry); return c; };
  // 호수 (지도 남서쪽)
  WORLD.lakeTex = TEX.water;
  [[-122, 92, 92, 100], [-66, 118, 26, 48]].forEach(([x, z, w, d]) => { const m = flat(x, z, w, d, '#3f7fb5', 0.02, 0, TEX.water); m.material.transparent = true; m.material.opacity = 0.92; solid(x, z, w, d, 'lake'); });
  flat(-122, 92, 96, 104, '#c9b98a', 0.012);
  // 도로 (선분)
  const dashes = [], walks = [], junc = {};
  const seg = (pts, w, c) => { pts.forEach(([x, z], i) => { const k = Math.round(x) + ',' + Math.round(z); junc[k] = (junc[k] || 0) + (i === 0 || i === pts.length - 1 ? 1 : 2); });
    for (let i = 0; i < pts.length - 1; i++) { const [x1, z1] = pts[i], [x2, z2] = pts[i + 1], L = Math.hypot(x2 - x1, z2 - z1), rot = -Math.atan2(x2 - x1, z2 - z1);
      flat((x1 + x2) / 2, (z1 + z2) / 2, w + 5.2, L + w * 0.6 + 4, null, 0.012, rot, texR(TEX.walk, (w + 5.2) / 2.2, (L + w) / 2.2));       // 인도
      flat((x1 + x2) / 2, (z1 + z2) / 2, w, L + w * 0.6, null, 0.016, rot, texR(TEX.asphalt, w / 5, (L + w) / 5));                         // 도로
      [-1, 1].forEach(sd => { const nx = -(z2 - z1) / L * sd * (w / 2 - 0.25), nz = (x2 - x1) / L * sd * (w / 2 - 0.25); const m = flat((x1 + x2) / 2 + nx, (z1 + z2) / 2 + nz, 0.15, L, '#e9e6dc', 0.018, rot); });
      if (w >= 8) for (let d = 3; d < L - 2; d += 6) dashes.push([x1 + (x2 - x1) * d / L, z1 + (z2 - z1) * d / L, rot]);
      walks.push([x1, z1, x2, z2, w]); WORLD.roads.push([x1, z1, x2, z2, w]); } };
  seg([[-40, 132], [-36, 100], [-22, 58], [-4, 22], [14, -12], [30, -42]], 11);          // 정문 → 사랑광장 → 성산홀
  seg([[-66, -8], [-20, -8], [60, -6], [100, -2], [150, 2]], 9);                          // 동서 중앙로
  seg([[14, -12], [60, -30], [100, -32], [150, -32]], 8);                                 // 동쪽 공학관 길
  seg([[-66, -8], [-84, -36], [-112, -62], [-146, -66]], 8);                             // 사회과학대 길
  seg([[-66, -8], [-62, 30]], 8); seg([[-4, 22], [16, 54]], 8);                           // 주차장 / 행복기숙사
  seg([[-34, -48], [-46, -70], [-62, -88]], 7); seg([[-20, -8], [-34, -48], [-20, -86]], 7);
  { const dg = new THREE.PlaneGeometry(0.22, 2.6), dm = new THREE.InstancedMesh(dg, mat('#f2d64b'), dashes.length), mx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    dashes.forEach(([x, z, r], i) => { e.set(-Math.PI / 2, 0, r); q.setFromEuler(e); mx.compose(new THREE.Vector3(x, 0.02, z), q, new THREE.Vector3(1, 1, 1)); dm.setMatrixAt(i, mx); }); dm.userData.noCast = true; scene.add(dm);
    const stripes = [];
    for (const [x1, z1, x2, z2, w] of walks) { const L = Math.hypot(x2 - x1, z2 - z1); if (L < 14) continue; const ux = (x2 - x1) / L, uz = (z2 - z1) / L, rot = -Math.atan2(x2 - x1, z2 - z1);
      [[x1, z1, 1], [x2, z2, -1]].forEach(([jx, jz, sg]) => { if ((junc[Math.round(jx) + ',' + Math.round(jz)] || 0) < 2) return; const cx = jx + ux * sg * (w / 2 + 3), cz = jz + uz * sg * (w / 2 + 3);
        for (let o = -w / 2 + 0.6; o < w / 2 - 0.3; o += 1.0) stripes.push([cx - uz * o, cz + ux * o, rot]); }); }
    const sg2 = new THREE.PlaneGeometry(0.5, 3), sm = new THREE.InstancedMesh(sg2, mat('#f4f2ea'), stripes.length);
    stripes.forEach(([x, z, r], i) => { e.set(-Math.PI / 2, 0, r); q.setFromEuler(e); mx.compose(new THREE.Vector3(x, 0.021, z), q, new THREE.Vector3(1, 1, 1)); sm.setMatrixAt(i, mx); }); sm.userData.noCast = true; scene.add(sm); }
  flat(24, -30, 30, 18, null, 0.017, 0, texR(TEX.walk, 12, 8)); flat(24, -30, 20, 10, '#6a9a4e', 0.018);       // 사랑광장
  const sq = textSprite('사랑광장', 2.2, '#fff'); sq.position.set(24, 3, -30); scene.add(sq);
  flat(-30, -50, 14, 12, '#b8ad97', 0.017); const fq = textSprite('자유광장', 2, '#fff'); fq.position.set(-30, 3, -50); scene.add(fq);
  // 정문
  box(scene, -48, 0, 104, 2, 6, 2, '#35456b'); box(scene, -28, 0, 100, 2, 6, 2, '#35456b'); box(scene, -38, 6, 102, 22, 1.4, 2, '#35456b');
  solid(-48, 104, 2, 2); solid(-28, 100, 2, 2);
  const gl = textSprite('대구대학교 정문', 2.6, '#ffe9a8'); gl.position.set(-38, 9, 102); scene.add(gl);
  // 경계
  [[0, MAP.z0, MAP.x1 - MAP.x0, 1], [MAP.x0, 0, 1, MAP.z1 - MAP.z0], [MAP.x1, 0, 1, MAP.z1 - MAP.z0]].forEach(([x, z, w, d]) => { box(scene, x, 0, z, w, 1.6, d, '#7a7468'); solid(x, z, w, d); });
  solid(60, MAP.z1, MAP.x1 - 40, 1); box(scene, 60, 0, MAP.z1, MAP.x1 - 40, 1.6, 1, '#7a7468');
  // 제1운동장 (헬기 착륙) / 제2운동장
  const F = WORLD.field = { x: -100, z: 0, w: 66, d: 38 };
  flat(F.x, F.z, F.w + 18, F.d + 18, null, 0.014, 0, TEX.track); const fg = flat(F.x, F.z, F.w, F.d, null, 0.016, 0, texR(TEX.grass, 9, 5));
  for (let i = 0; i < 8; i++) flat(F.x - F.w / 2 + 4 + i * (F.w - 8) / 7, F.z, 0.15, F.d - 2, '#f2f2ea', 0.018);
  const fl = textSprite('제1운동장', 3, '#fff'); fl.position.set(F.x, 4, F.z - 24); scene.add(fl);
  area('field_center', F.x, F.z, 10, '제1운동장 중앙');
  flat(72, -18, 30, 20, '#4f8c3a', 0.016); const f2 = textSprite('제2운동장', 2.2, '#fff'); f2.position.set(72, 3, -18); scene.add(f2);
  // 지하 주차장 입구 (제1운동장 옆)
  const RX = -60, RZ = 34;
  box(scene, RX, 0, RZ - 10, 12, 3, 1, '#4a4c50'); box(scene, RX - 5.5, 0, RZ, 1, 3, 20, '#4a4c50'); box(scene, RX + 5.5, 0, RZ, 1, 3, 20, '#4a4c50');
  flat(RX, RZ, 10, 20, '#3c3d40', 0.02); solid(RX - 5.5, RZ, 1, 20); solid(RX + 5.5, RZ, 1, 20);
  const pl = textSprite('지하 주차장 ↓', 2.2, '#ffd36b'); pl.position.set(RX, 5, RZ - 8); scene.add(pl);
  area('parking_ramp', RX, RZ + 4, 4, '지하 주차장 입구');

  // --- 성산홀 (본관) ---
  building(scene, { id: 'seongsan', name: '성산홀 (본관)', style: 'stone', floors: 20, to: [30, -60], x: 0, z: -48, w: 58, d: 28, h: 15, color: '#d8cbb3', roof: '#7a3b2e', wall: '#cbbd9f', floor: '#9b8e7a',
    doors: [{ side: 's', at: 0.5, w: 4 }, { side: 'n', at: 0.2, w: 2.4 }, { side: 'e', at: 0.5, w: 2.4 }, { side: 'w', at: 0.5, w: 2.4 }],
    inner(g, B) {
      // 강당
      wallLine(g, -12, -62, -12, -44, 3.4, '#cbbd9f', [{ at: 0.8, w: 3 }]); wallLine(g, 12, -62, 12, -44, 3.4, '#cbbd9f', [{ at: 0.8, w: 3 }]);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { box(g, -6 + c * 4, 0, -58 + r * 3, 3, 0.5, 0.8, '#7b2d2d'); }
      box(g, 0, 0, -61, 16, 0.8, 2.5, '#6b4f36'); solid(0, -61, 16, 2.5);
      // 방송실
      wallLine(g, 18, -62, 18, -54, 3.4, '#cbbd9f', [{ at: 0.5, w: 2 }]); wallLine(g, 18, -54, 29, -54, 3.4, '#cbbd9f');
      desk(g, 24, -59); box(g, 24, 0.75, -59, 1, 0.4, 0.4, '#222');
      desk(g, -22, -40); desk(g, -22, -52); desk(g, 22, -40);
      // 정면 계단
      for (let i = 0; i < 4; i++) box(g, 0, 0, -32.5 + i * 1.2, 18, 0.07 * (4 - i), 1.2, '#b8ad97');
    } });
  area('ss_stairs', 0, -30, 5, '성산홀 정면 계단'); area('ss_back', -17, -61, 3.5, '성산홀 뒤편 계단');
  WORLD.spawns.room_seongsan = { x: 0, z: -42 };

  // --- 중앙도서관 ---
  building(scene, { id: 'library', name: '창파도서관 (W2-2)', style: 'glass', to: [-14, -28], x: -72, z: -30, w: 42, d: 32, h: 13, color: '#c7c2b8', roof: '#4b5563', wall: '#bdb6a8', floor: '#8f8577',
    doors: [{ side: 's', at: 0.75, w: 4 }, { side: 'e', at: 0.75, w: 2.4 }, { side: 'n', at: 0.15, w: 2.4 }],
    inner(g, B) {
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) shelf(g, -84 + c * 7, -38 + r * 5, 5, true);
      // 자료실
      wallLine(g, -93, -24, -80, -24, 3.4, '#bdb6a8', [{ at: 0.7, w: 2.4 }]); wallLine(g, -80, -24, -80, -14, 3.4, '#bdb6a8');
      desk(g, -88, -20); desk(g, -85, -18); shelf(g, -91.5, -19, 6, false);
      desk(g, -60, -38); desk(g, -60, -34); desk(g, -56, -38); desk(g, -56, -34);
    } });
  area('lib_door', -61.5, -10.5, 5, '창파도서관 입구');
  area('lib_archive', -87, -19, 3, '자료실');
  WORLD.spawns.room_library = { x: -62, z: -20 }; WORLD.spawns.out_library = { x: -62, z: -6 };

  // --- 인문대 (과방) ---
  building(scene, { id: 'humanities', name: '사회과학1관 (W3-5) · 문헌정보학과', style: 'brick', to: [-108, -41], x: -80, z: 38, w: 38, d: 22, h: 11, color: '#c9a98a', roof: '#6c4a3a', wall: '#c2a588', floor: '#98846c',
    doors: [{ side: 's', at: 0.3, w: 4 }, { side: 'n', at: 0.9, w: 1.8 }, { side: 'w', at: 0.5, w: 2.4 }],
    inner(g, B) {
      // 복도 / 과방(동쪽) / 창고(북동)
      wallLine(g, -71, 27, -71, 49, 3.4, '#c2a588', [{ at: 0.65, w: 2 }]);       // 과방 서쪽 벽(문)
      wallLine(g, -71, 33, -61, 33, 3.4, '#c2a588', [{ at: 0.3, w: 1.6 }]);      // 창고 경계(창고문)
      desk(g, -66, 40); desk(g, -66, 43); box(g, -64, 0, 46, 3, 0.9, 0.9, '#6b4f36'); solid(-64, 46, 3, 0.9);
      box(g, -62, 0, 29, 0.8, 1.8, 0.8, '#c22'); // 창고 소화기 자리
      shelf(g, -69.5, 30, 4, false);
      desk(g, -90, 34); desk(g, -90, 42); desk(g, -84, 34); desk(g, -84, 42);
    } });
  WORLD.spawns.room_kwabang = { x: -66, z: 37 };
  area('kw_exit', -64.8, 24.5, 2.5, '비상구');
  WORLD.spawns.out_humanities = { x: -64, z: 22 };

  // --- 학생회관 · 편의점 ---
  building(scene, { id: 'union', name: '웅지관 (W2-4) · 편의점', style: 'brick', to: [-55, -30], x: 62, z: 30, w: 34, d: 22, h: 9, color: '#9fbfa8', roof: '#3f5a48', wall: '#93b39c', floor: '#a2a596',
    doors: [{ side: 'n', at: 0.3, w: 4 }, { side: 's', at: 0.7, w: 2.4 }],
    inner(g, B) { wallLine(g, 62, 19, 62, 41, 3.4, '#93b39c', [{ at: 0.5, w: 2.4 }]);
      for (let i = 0; i < 3; i++) shelf(g, 66 + i * 4, 30, 8, false); box(g, 52, 0, 23, 6, 1, 1, '#ddd'); solid(52, 23, 6, 1); } });
  // --- 행복기숙사 ---
  building(scene, { id: 'dorm', name: '행복기숙사 (E1-10)', style: 'white', to: [16, 80], x: 100, z: -55, w: 28, d: 44, h: 34, color: '#e6dccd', roof: '#5b6b80', wall: '#d8cdbd', floor: '#a49884',
    doors: [{ side: 'w', at: 0.5, w: 3 }],
    inner(g, B) { for (let i = 0; i < 4; i++) { wallLine(g, 104, -75 + i * 10, 114, -75 + i * 10, 3.4, '#d8cdbd'); wallLine(g, 104, -75 + i * 10, 104, -65 + i * 10, 3.4, '#d8cdbd', [{ at: 0.5, w: 1.8 }]);
      box(g, 110, 0, -71 + i * 10, 2, 0.6, 4, '#6a7fa0'); solid(110, -71 + i * 10, 2, 4); } } });
  // --- 비호생활관 ---
  building(scene, { id: 'biho', name: '비호생활관', style: 'redbrick', to: [-50, -96], x: 45, z: -95, w: 42, d: 20, h: 22, color: '#d9c7b0', roof: '#5a4a3a', wall: '#cdbba3', floor: '#a49884',
    doors: [{ side: 's', at: 0.5, w: 3 }],
    inner(g, B) { wallLine(g, 24, -95, 66, -95, 3.4, '#cdbba3', [{ at: 0.5, w: 3 }, { at: 0.2, w: 1.8 }, { at: 0.8, w: 1.8 }]); desk(g, 40, -90); desk(g, 50, -90); } });
  // --- 공과대학 ---
  building(scene, { id: 'eng', name: '공학1관 (E3-5)', style: 'glass', to: [124, 18], x: -80, z: -95, w: 44, d: 22, h: 14, color: '#a7adb5', roof: '#3d434b', wall: '#9aa1aa', floor: '#8c8f93',
    doors: [{ side: 's', at: 0.6, w: 3 }, { side: 'e', at: 0.5, w: 2.4 }],
    inner(g, B) { wallLine(g, -80, -106, -80, -84, 3.4, '#9aa1aa', [{ at: 0.5, w: 2.4 }]); for (let i = 0; i < 3; i++) { desk(g, -94 + i * 4, -98); desk(g, -70 + i * 4, -98); } } });
  // --- 사범대학 ---
  building(scene, { id: 'edu', name: '사범1관 (W1-7)', style: 'redbrick', to: [-44, 8], x: -45, z: 95, w: 36, d: 20, h: 12, color: '#d1b9a5', roof: '#704a3a', wall: '#c5ad99', floor: '#9c8a78',
    doors: [{ side: 'n', at: 0.5, w: 3 }, { side: 'e', at: 0.5, w: 2.4 }],
    inner(g, B) { wallLine(g, -63, 95, -27, 95, 3.4, '#c5ad99', [{ at: 0.5, w: 3 }]); desk(g, -55, 100); desk(g, -35, 100); } });


  // 성산홀 타워
  { const SS = WORLD.buildings.find(b => b.id === 'seongsan'); const tg = new THREE.Group(); scene.add(tg); SS.tower = tg;
    const tb = 5 * FH, th = 15 * FH; box(tg, 30, tb, -60, 12, th, 12, '#c9d3dc'); box(tg, 30, tb + th, -60, 13, 1.5, 13, '#7a8a9a');
    for (let y = tb + 1; y < tb + th - 1; y += FH) { box(tg, 30, y, -53.9, 10, 1.4, 0.2, '#6f9fc0'); box(tg, 23.9, y, -60, 0.2, 1.4, 10, '#6f9fc0'); box(tg, 36.1, y, -60, 0.2, 1.4, 10, '#6f9fc0'); }
    const tl = textSprite('성산홀 20F', 2.4, '#fff'); tl.position.set(30, tb + th + 4, -60); tg.add(tl); }
  // 지도 속 다른 건물들 (들어갈 수 있는 단순한 건물)
  const GEN = [
    ['W3-6', '사회과학3관 (W3-6)', -100, -76, 22, 16, 11, 'brick'], ['W3-4', '사회과학2관 (W3-4)', -148, -42, 18, 22, 10, 'brick'],
    ['W3-2', '장애학생지원센터 (W3-2)', -78, -64, 16, 12, 8, 'white'], ['W2-8', '디자인예술2관 (W2-8)', -36, -68, 20, 14, 10, 'glass'],
    ['hyangto', '향토생활관', -74, -116, 24, 14, 20, 'redbrick'], ['E2-1', '경영1관 (E2-1)', 64, -46, 22, 14, 11, 'brick'],
    ['E1-1', '인문1관 (E1-1)', 2, 42, 20, 14, 10, 'redbrick'], ['E1-6', '체육관 (E1-6)', 36, 18, 26, 18, 9, 'white'],
    ['E1-9', '복지관 (E1-9)', 62, 20, 18, 14, 8, 'brick'], ['E1-7', '산학협력관 (E1-7)', 70, 64, 22, 16, 12, 'glass'],
    ['E3-1', '공학2관 (E3-1)', 92, 26, 16, 14, 11, 'glass'], ['E3-6', '공학3관 (E3-6)', 112, -14, 22, 14, 12, 'glass'],
    ['E3-10', '생명과학3관 (E3-10)', 90, -58, 22, 14, 11, 'brick'], ['W1-1', '생명과학1관 (W1-1)', -26, 30, 16, 12, 10, 'redbrick'],
  ];
  for (const [id, name, x, z, w, d, h, style] of GEN) building(scene, { id, name, x, z, w, d, h, style, floor: '#9a8f80',
    doors: [{ side: 's', at: 0.5, w: 2.6 }], inner(g, B) { desk(g, x - w / 4, z); desk(g, x + w / 4, z); } });
  // 위치 이동된 건물의 지점들
  const mv = (o, id) => { const [x, z] = at(id, o.x, o.z); o.x = x; o.z = z; };
  [['kw_exit', 'humanities'], ['lib_door', 'library'], ['lib_archive', 'library'], ['ss_stairs', 'seongsan'], ['ss_back', 'seongsan']].forEach(([a, id]) => mv(WORLD.areas[a], id));
  [['room_kwabang', 'humanities'], ['out_humanities', 'humanities'], ['room_library', 'library'], ['out_library', 'library'], ['room_seongsan', 'seongsan']].forEach(([a, id]) => mv(WORLD.spawns[a], id));

  // ---- 조경 ----
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const TREES = { pine: [], round: [], cherry: [], autumn: [] };
  const nearRoad = (x, z, pad) => WORLD.roads.some(([x1, z1, x2, z2, w]) => { const dx = x2 - x1, dz = z2 - z1, L2 = dx * dx + dz * dz, t = clamp(((x - x1) * dx + (z - z1) * dz) / L2, 0, 1); return Math.hypot(x - x1 - t * dx, z - z1 - t * dz) < w / 2 + pad; });
  const open = (x, z) => !(blockedAt(x, z, 3.5) || (Math.abs(x - F.x) < F.w / 2 + 12 && Math.abs(z - F.z) < F.d / 2 + 12) || Math.hypot(x - 24, z + 30) < 17
      || (Math.abs(x - RX) < 8 && Math.abs(z - RZ) < 14) || Math.hypot(x + 38, z - 102) < 12 || Math.hypot(x + 30, z + 50) < 9 || (x < -30 && z > 38 && x > -168 && z < 142 && blockedAt(x, z, 6)));
  const tree = (x, z, type, s) => { TREES[type].push([x, z, s || 1, rnd() * 6.28]); solid(x, z, 0.9, 0.9); };
  // 1) 벚나무 가로수 (지도 속 분홍 길)
  for (const [x1, z1, x2, z2, w] of WORLD.roads.slice(0, 9)) {
    const L = Math.hypot(x2 - x1, z2 - z1), nx = -(z2 - z1) / L, nz = (x2 - x1) / L;
    for (let d = 4; d < L - 2; d += 9) for (const sd of [-1, 1]) { const x = x1 + (x2 - x1) * d / L + nx * sd * (w / 2 + 2.6), z = z1 + (z2 - z1) * d / L + nz * sd * (w / 2 + 2.6);
      if (!blockedAt(x, z, 2.5) && !nearRoad(x, z, 1.5)) tree(x, z, 'cherry', 0.85); }
  }
  // 2) 숲과 잔디밭 나무
  for (let i = 0, tries = 0; i < 230 && tries < 8000; tries++) {
    const x = MAP.x0 + 5 + rnd() * (MAP.x1 - MAP.x0 - 10), z = MAP.z0 + 5 + rnd() * (MAP.z1 - MAP.z0 - 10);
    if (!open(x, z) || nearRoad(x, z, 3)) continue;
    const edge = Math.min(x - MAP.x0, MAP.x1 - x, z - MAP.z0) < 22, r = rnd();
    tree(x, z, edge ? (r < 0.6 ? 'pine' : 'round') : r < 0.45 ? 'round' : r < 0.7 ? 'pine' : r < 0.85 ? 'cherry' : 'autumn', 0.8 + rnd() * 0.5); i++;
  }
  // 2-1) 인도 옆 관목
  const bushes = [];
  for (const [x1, z1, x2, z2, w] of WORLD.roads) { const L = Math.hypot(x2 - x1, z2 - z1), nx = -(z2 - z1) / L, nz = (x2 - x1) / L;
    for (let d = 2; d < L - 2; d += 2.6) for (const sd of [-1, 1]) { if (rnd() < 0.35) continue; const off = w / 2 + 3.6 + rnd() * 0.6, x = x1 + (x2 - x1) * d / L + nx * sd * off, z = z1 + (z2 - z1) * d / L + nz * sd * off;
      if (blockedAt(x, z, 1.2) || nearRoad(x, z, 2.4) || Math.hypot(x - 24, z + 30) < 16) continue; bushes.push([x, z, 0.8 + rnd() * 0.6, rnd() * 6]); } }
  // 나무·관목 인스턴스 생성 (바람에 흔들림)
  { const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), V = (a, b, c) => new THREE.Vector3(a, b, c);
    const inst = (geo, matl, list, fn) => { if (!list.length) return; const im = new THREE.InstancedMesh(geo, matl, list.length); list.forEach((t, i) => { fn(t, mx); im.setMatrixAt(i, mx); }); im.castShadow = true; im.receiveShadow = true; scene.add(im); return im; };
    const all = [].concat(...Object.values(TREES));
    inst(new THREE.CylinderGeometry(0.22, 0.38, 2.6, 7), mat('#5b3e2a'), all, ([x, z, s, r], m) => m.compose(V(x, 1.3 * s, z), q.setFromAxisAngle(up, r), V(s, s, s)));
    const blob = new THREE.IcosahedronGeometry(2.2, 1), cone = new THREE.ConeGeometry(2.3, 4.6, 9);
    const LEAF = { round: ['#4f8f3a', '#3f7a30', '#5d9c43'], cherry: ['#f4b6c8', '#f8cfdc', '#efa6bc'], autumn: ['#d9902e', '#c9752a', '#e5a843'] };
    for (const type of ['round', 'cherry', 'autumn']) {
      const L2 = TREES[type]; if (!L2.length) continue;
      [[0, 3.9, 0, 1], [1.1, 4.7, 0.5, 0.62], [-0.9, 4.5, -0.6, 0.58]].forEach(([ox, oy, oz, k], j) =>
        inst(blob, swayMaterial(LEAF[type][j]), L2, ([x, z, s, r], m) => { const c = Math.cos(r), sn = Math.sin(r); m.compose(V(x + (ox * c - oz * sn) * s, oy * s, z + (ox * sn + oz * c) * s), q.setFromAxisAngle(up, r), V(s * k, s * k * 0.9, s * k)); }));
    }
    [[3.6, 1, '#2f6a2a'], [5.4, 0.72, '#3a7a32'], [6.8, 0.46, '#448a3a']].forEach(([oy, k, col]) => inst(cone, swayMaterial(col), TREES.pine, ([x, z, s, r], m) => m.compose(V(x, oy * s, z), q.setFromAxisAngle(up, r), V(s * k, s * k, s * k))));
    inst(new THREE.IcosahedronGeometry(1, 1), swayMaterial('#3d7330'), bushes, ([x, z, s, r], m) => m.compose(V(x, 0.55 * s, z), q.setFromAxisAngle(up, r), V(s * 1.4, s * 0.9, s * 1.2)));
    const fl = bushes.filter((b, i) => i % 3 === 0), FC = ['#e8425a', '#f7c948', '#f28fb0', '#ffffff', '#9b6fd6'];
    FC.forEach((c, j) => inst(new THREE.IcosahedronGeometry(0.22, 0), mat(c), fl.filter((b, i) => i % 5 === j), ([x, z, s, r], m) => m.compose(V(x + Math.cos(r) * 0.9, 1.05 * s, z + Math.sin(r) * 0.9), q, V(1, 1, 1))));
  }
  // 3) 캠퍼스를 둘러싼 산 (지도 북·동쪽 숲)
  const hillM = mat('#3d6e34'), hillM2 = mat('#4a7d3c');
  for (let i = 0; i < 26; i++) { const a = -Math.PI * 1.05 + i / 25 * Math.PI * 1.25, R = 205 + rnd() * 30;
    const h = new THREE.Mesh(new THREE.ConeGeometry(40 + rnd() * 25, 34 + rnd() * 30, 7), i % 2 ? hillM : hillM2); h.position.set(Math.cos(a) * R * 1.05, 12, Math.sin(a) * R * 0.85 - 10); scene.add(h); }
  const bh = textSprite('비호동산', 2.4, '#e9f5d8'); bh.position.set(-20, 10, -128); scene.add(bh);
  // 4) 사랑광장 분수
  const fc = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.4, 0.8, 24), mat('#c9c2b4')); fc.position.set(24, 0.4, -30); scene.add(fc); solid(24, -30, 9, 9);
  const fw = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 0.1, 24), mat('#5fa9d6')); fw.position.set(24, 0.82, -30); scene.add(fw);
  const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 3, 10), mat('#d9d2c4')); fp.position.set(24, 1.5, -30); scene.add(fp);
  const fs = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), mat('#bfe3f5', { transparent: true, opacity: 0.7 })); fs.position.set(24, 3.4, -30); scene.add(fs);
  // 5) 화단 (성산홀 앞) / 벤치 / 가로등
  const flowers = ['#e8425a', '#f7c948', '#f28fb0', '#ffffff', '#9b6fd6'];
  for (let i = 0; i < 10; i++) { const fx = 6 + i * 5; box(scene, fx, 0, -38.5, 3.6, 0.35, 1.6, '#6b4a32'); box(scene, fx, 0.35, -38.5, 3.2, 0.25, 1.2, flowers[i % 5]); }
  const bench = (x, z, r) => { const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = r; box(b, 0, 0.45, 0, 1.8, 0.12, 0.55, '#8a6a48'); box(b, 0, 0.6, -0.25, 1.8, 0.5, 0.1, '#8a6a48'); box(b, -0.8, 0, 0, 0.1, 0.45, 0.5, '#333'); box(b, 0.8, 0, 0, 0.1, 0.45, 0.5, '#333'); scene.add(b); };
  [[14, -22, 0], [34, -22, 0], [14, -38, Math.PI], [34, -38, Math.PI], [-30, -44, 0], [-24, -56, Math.PI]].forEach(([x, z, r]) => bench(x, z, r));
  const lampM = mat('#2f3338'), bulbM = mat('#fff6d0', { emissive: '#ffe9a0' });
  for (const [x1, z1, x2, z2, w] of WORLD.roads) { const L = Math.hypot(x2 - x1, z2 - z1); for (let d = 8; d < L; d += 18) { const x = x1 + (x2 - x1) * d / L + (z2 - z1) / L * (w / 2 + 1.0), z = z1 + (z2 - z1) * d / L - (x2 - x1) / L * (w / 2 + 1.0);
    if (blockedAt(x, z, 0.5)) continue; const p = new THREE.Mesh(BOXG, lampM); p.scale.set(0.16, 5, 0.16); p.position.set(x, 2.5, z); scene.add(p); const bl = new THREE.Mesh(BOXG, bulbM); bl.scale.set(0.7, 0.25, 0.4); bl.position.set(x, 5.05, z); scene.add(bl);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: '#ffd9a0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.set(5, 5, 1); gl.position.set(x, 5, z); gl.visible = false; scene.add(gl); ENV.glows.push(gl);
    const pool = new THREE.Mesh(FXMESH_DISC(), new THREE.MeshBasicMaterial({ color: '#ffcf80', transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending })); pool.rotation.x = -Math.PI / 2; pool.position.set(x, 0.03, z); pool.scale.set(3.6, 3.6, 3.6); pool.userData.pool = true; pool.visible = false; pool.userData.noShadow = true; scene.add(pool); ENV.glows.push(pool); } }
  // 6) 운동장 스탠드 / 골대
  for (let i = 0; i < 4; i++) { box(scene, F.x, i * 0.6, F.z - F.d / 2 - 12 - i * 1.2, F.w * 0.8, 0.6, 1.2, i % 2 ? '#b9bec6' : '#8e96a2'); }
  solid(F.x, F.z - F.d / 2 - 13.8, F.w * 0.8, 4.8);
  [[F.x - F.w / 2 + 2, 1], [F.x + F.w / 2 - 2, -1]].forEach(([gx]) => { box(scene, gx, 0, F.z - 3.6, 0.15, 2.4, 0.15, '#fff'); box(scene, gx, 0, F.z + 3.6, 0.15, 2.4, 0.15, '#fff'); box(scene, gx, 2.4, F.z, 0.15, 0.15, 7.4, '#fff'); });
  // 7) 호숫가 데크와 정자
  box(scene, -100, 0, 50, 4, 0.3, 26, '#9a7a52'); box(scene, -100, 0, 64, 10, 0.3, 8, '#9a7a52');
  const gz = new THREE.Group(); gz.position.set(-100, 0, 64); scene.add(gz); [[-4, -3], [4, -3], [-4, 3], [4, 3]].forEach(([px, pz]) => box(gz, px, 0.3, pz, 0.35, 3, 0.35, '#7a5232'));
  const groof = new THREE.Mesh(new THREE.ConeGeometry(7, 2.4, 4), mat('#6a3a2a')); groof.rotation.y = Math.PI / 4; groof.position.y = 4.4; gz.add(groof);
  const lk = textSprite('호수', 2, '#dff1ff'); lk.position.set(-125, 3, 95); scene.add(lk);
  // 8) 산책로 울타리 (호수 경계)
  for (let x = -164; x < -52; x += 3) box(scene, x, 0, 41.2, 0.15, 0.9, 0.15, '#6b4f36');
  car(scene, -30, 72, 0.3, '#8a2a2a'); car(scene, -10, 30, 0.5, '#2a4a8a'); car(scene, 40, -6, Math.PI / 2, '#666'); car(scene, -80, -20, 0.6, '#c9c9c9'); car(scene, 4, 2, 0.4, '#d2b04a');

  addFloors(scene);
  buildUnderground(scene);
}

function buildUnderground(scene) {
  const g = new THREE.Group(); scene.add(g);
  const floor = (x, z, w, d, c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(c)); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, z); g.add(m); };
  // 주차장
  const X = UG_X, Z = 0, W = 72, D = 50;
  floor(X, Z, W, D, '#3b3d40');
  wallLine(g, X - W / 2, Z - D / 2, X + W / 2, Z - D / 2, 4, '#55585c');
  wallLine(g, X - W / 2, Z + D / 2, X + W / 2, Z + D / 2, 4, '#55585c');
  wallLine(g, X - W / 2, Z - D / 2, X - W / 2, Z + D / 2, 4, '#55585c');
  wallLine(g, X + W / 2, Z - D / 2, X + W / 2, Z + D / 2, 4, '#55585c', [{ at: 0.2, w: 2.6 }]);
  for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) { box(g, X + i * 13, 0, Z + j * 14, 1.2, 4, 1.2, '#6a6d70'); solid(X + i * 13, Z + j * 14, 1.2, 1.2); }
  for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 5), mat('#d8d8c0')); m.rotation.x = -Math.PI / 2; m.position.set(X - 30 + i * 5, 0.05, Z - 20); g.add(m); }
  car(g, X - 20, Z + 18, 0.1, '#444'); car(g, X + 10, Z - 19, 0, '#6a2222');
  const wl = textSprite('K-13   11   10', 2, '#b31010'); wl.position.set(X - 10, 2.5, Z - D / 2 + 0.6); g.add(wl);
  box(g, X + W / 2 - 0.6, 0, Z + 6, 0.6, 2, 1.6, '#3d5a3d'); // 배전함
  area('pk_exit', X + W / 2 + 2.5, Z - D / 2 + D * 0.2, 2.6, '철문');
  WORLD.spawns.room_parking = { x: X - 28, z: Z + 18 };
  // 철문 바깥 짧은 통로
  floor(X + W / 2 + 6, Z - D / 2 + D * 0.2, 12, 4, '#3b3d40');

  // 연구소 (Z+130)
  const LZ = 130;
  floor(X, LZ, 80, 60, '#d7dbe0');
  const wc = '#e8ecf0';
  wallLine(g, X - 40, LZ - 30, X + 40, LZ - 30, 4, wc); wallLine(g, X - 40, LZ + 30, X + 40, LZ + 30, 4, wc);
  wallLine(g, X - 40, LZ - 30, X - 40, LZ + 30, 4, wc); wallLine(g, X + 40, LZ - 30, X + 40, LZ + 30, 4, wc);
  // 방 3개 + 중앙 코어
  wallLine(g, X - 40, LZ - 10, X - 16, LZ - 10, 4, wc, [{ at: 0.5, w: 3 }]); wallLine(g, X - 16, LZ - 30, X - 16, LZ - 10, 4, wc);
  wallLine(g, X + 16, LZ - 10, X + 40, LZ - 10, 4, wc, [{ at: 0.5, w: 3 }]); wallLine(g, X + 16, LZ - 30, X + 16, LZ - 10, 4, wc);
  wallLine(g, X - 40, LZ + 12, X - 16, LZ + 12, 4, wc, [{ at: 0.5, w: 3 }]); wallLine(g, X - 16, LZ + 12, X - 16, LZ + 30, 4, wc);
  wallLine(g, X - 9, LZ - 9, X + 9, LZ - 9, 4, '#9aa5b5', [{ at: 0.5, w: 4 }]); wallLine(g, X - 9, LZ + 9, X + 9, LZ + 9, 4, '#9aa5b5', [{ at: 0.5, w: 4 }]);
  wallLine(g, X - 9, LZ - 9, X - 9, LZ + 9, 4, '#9aa5b5'); wallLine(g, X + 9, LZ - 9, X + 9, LZ + 9, 4, '#9aa5b5');
  const core = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 3.5, 12), mat('#5a3d9a', { emissive: '#2a1060' })); core.position.set(X, 1.75, LZ); g.add(core); solid(X, LZ, 4, 4);
  WORLD.core = core;
  [[X - 28, LZ - 20], [X + 28, LZ - 20], [X - 28, LZ + 21]].forEach(([tx, tz]) => { box(g, tx, 0, tz, 2, 1.1, 1, '#2c3440'); box(g, tx, 1.1, tz - 0.3, 1.6, 0.9, 0.1, '#5fd1ff', { emissive: '#1f6f99' }); solid(tx, tz, 2, 1); });
  const sl = textSprite('K-13 / SUBJECT LEVEL', 2, '#5fd1ff'); sl.position.set(X, 5, LZ - 28); g.add(sl);
  area('lab_core', X, LZ - 11, 3.5, '중앙 장치');
  WORLD.spawns.room_lab = { x: X + 28, z: LZ + 22 };
}

// 충돌 질의 (fl: 층)
function blockedAt(x, z, r, fl) {
  fl = fl || 0;
  for (const W of WORLD.walls) if (onFl(W, fl) && x > W.x - r && x < W.x + W.w + r && z > W.z - r && z < W.z + W.d + r) return true;
  return false;
}
function pushOut(e) {
  let hit = false; const fl = e.fl || 0;
  for (const W of WORLD.walls) {
    if (!onFl(W, fl) || e.x < W.x - e.r || e.x > W.x + W.w + e.r || e.z < W.z - e.r || e.z > W.z + W.d + e.r) continue;
    const cx = Math.max(W.x, Math.min(e.x, W.x + W.w)), cz = Math.max(W.z, Math.min(e.z, W.z + W.d));
    let dx = e.x - cx, dz = e.z - cz; const d2 = dx * dx + dz * dz;
    if (d2 >= e.r * e.r) continue;
    hit = true;
    if (d2 < 1e-8) {
      const l = e.x - W.x, rr = W.x + W.w - e.x, t = e.z - W.z, b = W.z + W.d - e.z, m = Math.min(l, rr, t, b);
      if (m === l) e.x = W.x - e.r; else if (m === rr) e.x = W.x + W.w + e.r; else if (m === t) e.z = W.z - e.r; else e.z = W.z + W.d + e.r;
    } else { const d = Math.sqrt(d2); e.x = cx + dx / d * e.r; e.z = cz + dz / d * e.r; }
  }
  return hit;
}
function segBlocked(x1, z1, x2, z2, fl) {
  const steps = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 0.8);
  for (let i = 1; i < steps; i++) { const t = i / steps; if (blockedAt(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, 0, fl)) return true; }
  return false;
}
function freeSpot(x, z, r, fl) { return !blockedAt(x, z, r, fl) && ((x > MAP.x0 + 2 && x < MAP.x1 - 2 && z > MAP.z0 + 2 && z < MAP.z1 - 2) || x > UG_X - 60); }
function underground(x) { return x > UG_X - 60; }
