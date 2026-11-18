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
function box(parent, x, y, z, w, h, d, color, opts) {
  const m = new THREE.Mesh(BOXG, mat(color, opts));
  m.scale.set(w, h, d); m.position.set(x, y + h / 2, z); parent.add(m); return m;
}
function solid(x, z, w, d, tag) { const W = { x: x - w / 2, z: z - d / 2, w, d, tag }; WORLD.walls.push(W); return W; }

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
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(size * w / c.height, size, 1); s.renderOrder = 10; return s;
}
function area(id, x, z, r, label) { WORLD.areas[id] = { id, x, z, r, label }; }
function addInteract(id, x, z, label, opts) { const o = Object.assign({ id, x, z, label, used: false, r: 2.2 }, opts || {}); WORLD.interact.push(o); return o; }

// ---------- 건물 ----------
// doors: {side:'n'|'s'|'e'|'w', at, w}
function building(scene, def) {
  def.wallStart = WORLD.walls.length;
  const g = new THREE.Group(); scene.add(g);
  const { x, z, w, d } = def, x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, H = 3.4;
  const gaps = s => (def.doors || []).filter(o => o.side === s);
  const wc = def.wall || '#c9b9a0';
  wallLine(g, x0, z0, x1, z0, H, wc, gaps('n'), def.id);
  wallLine(g, x0, z1, x1, z1, H, wc, gaps('s'), def.id);
  wallLine(g, x0, z0, x0, z1, H, wc, gaps('w'), def.id);
  wallLine(g, x1, z0, x1, z1, H, wc, gaps('e'), def.id);
  // 실내 바닥
  const fl = box(g, x, 0.01, z, w - 0.4, 0.04, d - 0.4, def.floor || '#a89a86');
  // 윗층(외관) + 지붕: 내부에 들어가면 숨김
  const up = new THREE.Group(); g.add(up);
  const upH = def.h - H;
  const upper = box(up, x, H, z, w + 0.2, upH, d + 0.2, def.color, { transparent: true, opacity: 1 });
  box(up, x, def.h, z, w + 1, 0.5, d + 1, def.roof, { transparent: true, opacity: 1 });
  // 창문 줄
  const winMat = mat('#9fc3d8', { transparent: true, opacity: 1 });
  for (let fy = H + 0.8; fy < def.h - 1; fy += 3) {
    for (let k = 3; k < w - 2; k += 4) { const m = new THREE.Mesh(BOXG, winMat); m.scale.set(2, 1.4, 0.1); m.position.set(x0 + k, fy + 0.7, z1 + 0.16); up.add(m); }
  }
  const lab = textSprite(def.name, 3.2, '#fff'); lab.position.set(x, def.h + 3, z); scene.add(lab);
  const B = Object.assign({ x0, x1, z0, z1, group: g, up, upMats: [upper.material], label: lab, doorsW: [] }, def);
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
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP.x1 - MAP.x0 + 120, MAP.z1 - MAP.z0 + 120), mat('#5d8a45'));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const flat = (x, z, w, d, c, y, rot) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(c)); m.rotation.x = -Math.PI / 2; if (rot) m.rotation.z = rot; m.position.set(x, y || 0.015, z); scene.add(m); return m; };
  // 호수 (지도 남서쪽)
  [[-122, 92, 92, 100], [-66, 118, 26, 48]].forEach(([x, z, w, d]) => { flat(x, z, w, d, '#3f7fb5', 0.02); solid(x, z, w, d, 'lake'); });
  flat(-122, 92, 96, 104, '#c9b98a', 0.012);
  // 도로 (선분)
  const seg = (pts, w, c) => { for (let i = 0; i < pts.length - 1; i++) { const [x1, z1] = pts[i], [x2, z2] = pts[i + 1], L = Math.hypot(x2 - x1, z2 - z1);
    flat((x1 + x2) / 2, (z1 + z2) / 2, w, L + w * 0.6, c || '#6e6f6a', 0.016, -Math.atan2(x2 - x1, z2 - z1)); WORLD.roads.push([x1, z1, x2, z2, w]); } };
  seg([[-40, 132], [-36, 100], [-22, 58], [-4, 22], [14, -12], [30, -42]], 11);          // 정문 → 사랑광장 → 성산홀
  seg([[-66, -8], [-20, -8], [60, -6], [100, -2], [150, 2]], 9);                          // 동서 중앙로
  seg([[14, -12], [60, -30], [100, -32], [150, -32]], 8);                                 // 동쪽 공학관 길
  seg([[-66, -8], [-84, -36], [-112, -62], [-146, -66]], 8);                             // 사회과학대 길
  seg([[-66, -8], [-62, 30]], 8); seg([[-4, 22], [16, 54]], 8);                           // 주차장 / 행복기숙사
  seg([[-34, -48], [-46, -70], [-62, -88]], 7); seg([[-20, -8], [-34, -48], [-20, -86]], 7);
  flat(24, -30, 30, 18, '#b8ad97', 0.017); flat(24, -30, 20, 10, '#6a9a4e', 0.018);       // 사랑광장
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
  flat(F.x, F.z, F.w + 18, F.d + 18, '#a85a3e', 0.014); flat(F.x, F.z, F.w, F.d, '#4f8c3a', 0.016);
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
  building(scene, { id: 'seongsan', name: '성산홀 (본관)', to: [30, -60], x: 0, z: -48, w: 58, d: 28, h: 15, color: '#d8cbb3', roof: '#7a3b2e', wall: '#cbbd9f', floor: '#9b8e7a',
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
  building(scene, { id: 'library', name: '창파도서관 (W2-2)', to: [-14, -28], x: -72, z: -30, w: 42, d: 32, h: 13, color: '#c7c2b8', roof: '#4b5563', wall: '#bdb6a8', floor: '#8f8577',
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
  building(scene, { id: 'humanities', name: '사회과학1관 (W3-5) · 문헌정보학과', to: [-108, -41], x: -80, z: 38, w: 38, d: 22, h: 11, color: '#c9a98a', roof: '#6c4a3a', wall: '#c2a588', floor: '#98846c',
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
  building(scene, { id: 'union', name: '웅지관 (W2-4) · 편의점', to: [-55, -30], x: 62, z: 30, w: 34, d: 22, h: 9, color: '#9fbfa8', roof: '#3f5a48', wall: '#93b39c', floor: '#a2a596',
    doors: [{ side: 'n', at: 0.3, w: 4 }, { side: 's', at: 0.7, w: 2.4 }],
    inner(g, B) { wallLine(g, 62, 19, 62, 41, 3.4, '#93b39c', [{ at: 0.5, w: 2.4 }]);
      for (let i = 0; i < 3; i++) shelf(g, 66 + i * 4, 30, 8, false); box(g, 52, 0, 23, 6, 1, 1, '#ddd'); solid(52, 23, 6, 1); } });
  // --- 행복기숙사 ---
  building(scene, { id: 'dorm', name: '행복기숙사 (E1-10)', to: [16, 80], x: 100, z: -55, w: 28, d: 44, h: 20, color: '#e6dccd', roof: '#5b6b80', wall: '#d8cdbd', floor: '#a49884',
    doors: [{ side: 'w', at: 0.5, w: 3 }],
    inner(g, B) { for (let i = 0; i < 4; i++) { wallLine(g, 104, -75 + i * 10, 114, -75 + i * 10, 3.4, '#d8cdbd'); wallLine(g, 104, -75 + i * 10, 104, -65 + i * 10, 3.4, '#d8cdbd', [{ at: 0.5, w: 1.8 }]);
      box(g, 110, 0, -71 + i * 10, 2, 0.6, 4, '#6a7fa0'); solid(110, -71 + i * 10, 2, 4); } } });
  // --- 비호생활관 ---
  building(scene, { id: 'biho', name: '비호생활관', to: [-50, -96], x: 45, z: -95, w: 42, d: 20, h: 16, color: '#d9c7b0', roof: '#5a4a3a', wall: '#cdbba3', floor: '#a49884',
    doors: [{ side: 's', at: 0.5, w: 3 }],
    inner(g, B) { wallLine(g, 24, -95, 66, -95, 3.4, '#cdbba3', [{ at: 0.5, w: 3 }, { at: 0.2, w: 1.8 }, { at: 0.8, w: 1.8 }]); desk(g, 40, -90); desk(g, 50, -90); } });
  // --- 공과대학 ---
  building(scene, { id: 'eng', name: '공학1관 (E3-5)', to: [124, 18], x: -80, z: -95, w: 44, d: 22, h: 14, color: '#a7adb5', roof: '#3d434b', wall: '#9aa1aa', floor: '#8c8f93',
    doors: [{ side: 's', at: 0.6, w: 3 }, { side: 'e', at: 0.5, w: 2.4 }],
    inner(g, B) { wallLine(g, -80, -106, -80, -84, 3.4, '#9aa1aa', [{ at: 0.5, w: 2.4 }]); for (let i = 0; i < 3; i++) { desk(g, -94 + i * 4, -98); desk(g, -70 + i * 4, -98); } } });
  // --- 사범대학 ---
  building(scene, { id: 'edu', name: '사범1관 (W1-7)', to: [-44, 8], x: -45, z: 95, w: 36, d: 20, h: 12, color: '#d1b9a5', roof: '#704a3a', wall: '#c5ad99', floor: '#9c8a78',
    doors: [{ side: 'n', at: 0.5, w: 3 }, { side: 'e', at: 0.5, w: 2.4 }],
    inner(g, B) { wallLine(g, -63, 95, -27, 95, 3.4, '#c5ad99', [{ at: 0.5, w: 3 }]); desk(g, -55, 100); desk(g, -35, 100); } });


  // 성산홀 타워
  box(scene, 30, 0, -82, 11, 46, 11, '#c9d3dc'); box(scene, 30, 46, -82, 12, 2, 12, '#7a8a9a'); solid(30, -82, 11, 11);
  for (let y = 4; y < 44; y += 3) box(scene, 30, y, -76.4, 9, 1.2, 0.2, '#6f9fc0');
  // 지도 속 다른 건물들 (들어갈 수 있는 단순한 건물)
  const GEN = [
    ['W3-6', '사회과학3관 (W3-6)', -100, -76, 22, 16, 11, '#cdb79e'], ['W3-4', '사회과학2관 (W3-4)', -148, -42, 18, 22, 10, '#c8b296'],
    ['W3-2', '장애학생지원센터 (W3-2)', -78, -64, 16, 12, 8, '#d6c9b4'], ['W2-8', '디자인예술2관 (W2-8)', -36, -68, 20, 14, 10, '#b9c4cf'],
    ['hyangto', '향토생활관', -74, -116, 24, 14, 14, '#d9c7b0'], ['E2-1', '경영1관 (E2-1)', 64, -46, 22, 14, 11, '#c9b6a6'],
    ['E1-1', '인문1관 (E1-1)', 2, 42, 20, 14, 10, '#c7a68c'], ['E1-6', '체육관 (E1-6)', 36, 18, 26, 18, 9, '#9fb0c0'],
    ['E1-9', '복지관 (E1-9)', 62, 20, 18, 14, 8, '#cfc3ae'], ['E1-7', '산학협력관 (E1-7)', 70, 64, 22, 16, 12, '#a9b8c6'],
    ['E3-1', '공학2관 (E3-1)', 92, 26, 16, 14, 11, '#a7adb5'], ['E3-6', '공학3관 (E3-6)', 112, -14, 22, 14, 12, '#a7adb5'],
    ['E3-10', '생명과학3관 (E3-10)', 90, -58, 22, 14, 11, '#b8c2a8'], ['W1-1', '생명과학1관 (W1-1)', -12, 30, 18, 12, 10, '#b8c2a8'],
  ];
  for (const [id, name, x, z, w, d, h, color] of GEN) building(scene, { id, name, x, z, w, d, h, color, roof: '#4d4a46', wall: '#c4b8a4', floor: '#9a8f80',
    doors: [{ side: 's', at: 0.5, w: 2.6 }], inner(g, B) { desk(g, x - w / 4, z); desk(g, x + w / 4, z); } });
  // 위치 이동된 건물의 지점들
  const mv = (o, id) => { const [x, z] = at(id, o.x, o.z); o.x = x; o.z = z; };
  [['kw_exit', 'humanities'], ['lib_door', 'library'], ['lib_archive', 'library'], ['ss_stairs', 'seongsan'], ['ss_back', 'seongsan']].forEach(([a, id]) => mv(WORLD.areas[a], id));
  [['room_kwabang', 'humanities'], ['out_humanities', 'humanities'], ['room_library', 'library'], ['out_library', 'library'], ['room_seongsan', 'seongsan']].forEach(([a, id]) => mv(WORLD.spawns[a], id));

  // 나무
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const trunkM = mat('#5b3e2a'), leafM = mat('#3f7a30'), leaf2 = mat('#4f8f3a');
  const coneG = new THREE.ConeGeometry(2.2, 5, 7), cylG = new THREE.CylinderGeometry(0.3, 0.4, 2, 6);
  const nearRoad = (x, z) => WORLD.roads.some(([x1, z1, x2, z2, w]) => { const dx = x2 - x1, dz = z2 - z1, L2 = dx * dx + dz * dz, t = clamp(((x - x1) * dx + (z - z1) * dz) / L2, 0, 1); return Math.hypot(x - x1 - t * dx, z - z1 - t * dz) < w / 2 + 3; });
  for (let i = 0, tries = 0; i < 170 && tries < 5000; tries++) {
    const x = MAP.x0 + 6 + rnd() * (MAP.x1 - MAP.x0 - 12), z = MAP.z0 + 6 + rnd() * (MAP.z1 - MAP.z0 - 12);
    if (blockedAt(x, z, 4) || nearRoad(x, z) || (Math.abs(x - F.x) < F.w / 2 + 12 && Math.abs(z - F.z) < F.d / 2 + 12) || Math.hypot(x - 24, z - 30 + 60) < 16
      || (Math.abs(x - RX) < 8 && Math.abs(z - RZ) < 14) || Math.hypot(x + 38, z - 102) < 12) continue;
    const t = new THREE.Group(); t.position.set(x, 0, z);
    const tr = new THREE.Mesh(cylG, trunkM); tr.position.y = 1; t.add(tr);
    const lf = new THREE.Mesh(coneG, i % 2 ? leafM : leaf2); lf.position.y = 4.2; t.add(lf);
    scene.add(t); solid(x, z, 1, 1); WORLD.trees.push(t); i++;
  }
  car(scene, -30, 72, 0.3, '#8a2a2a'); car(scene, -10, 30, 0.5, '#2a4a8a'); car(scene, 40, -6, Math.PI / 2, '#666'); car(scene, -80, -20, 0.6, '#c9c9c9'); car(scene, 4, 2, 0.4, '#d2b04a');

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

// 충돌 질의
function blockedAt(x, z, r) {
  for (const W of WORLD.walls) if (x > W.x - r && x < W.x + W.w + r && z > W.z - r && z < W.z + W.d + r) return true;
  return false;
}
function pushOut(e) {
  let hit = false;
  for (const W of WORLD.walls) {
    if (e.x < W.x - e.r || e.x > W.x + W.w + e.r || e.z < W.z - e.r || e.z > W.z + W.d + e.r) continue;
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
function segBlocked(x1, z1, x2, z2) {
  const steps = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 0.8);
  for (let i = 1; i < steps; i++) { const t = i / steps; if (blockedAt(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, 0)) return true; }
  return false;
}
function freeSpot(x, z, r) { return !blockedAt(x, z, r) && ((x > MAP.x0 + 2 && x < MAP.x1 - 2 && z > MAP.z0 + 2 && z < MAP.z1 - 2) || x > UG_X - 60); }
function underground(x) { return x > UG_X - 60; }
