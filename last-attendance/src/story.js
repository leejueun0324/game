'use strict';
// ============================================================
//  스토리 진행: 장 설정, 퀘스트, 상호작용, 건물 미션, 실패/재시도
// ============================================================
const BARRIERS = [];
function addBarrier(x, z, w, d, color) {
  const W = solid(x, z, w, d, 'barrier'); const m = box(scene, x, 0, z, Math.max(w, 0.3), 2.6, Math.max(d, 0.3), color || '#7a5a34');
  const b = { W, m }; BARRIERS.push(b); return b;
}
function removeBarrier(b) { if (!b) return; scene.remove(b.m); const i = WORLD.walls.indexOf(b.W); if (i >= 0) WORLD.walls.splice(i, 1); const j = BARRIERS.indexOf(b); if (j >= 0) BARRIERS.splice(j, 1); }
function clearBarriers() { while (BARRIERS.length) removeBarrier(BARRIERS[0]); }

const MISSION_SPOTS = { bm_kwabang: ['humanities', -63, 47.5], bm_library: ['library', -91, -16], bm_store: ['union', 72, 24], bm_dorm: ['dorm', 110, -66], bm_biho: ['biho', 40, -100], bm_eng: ['eng', -95, -102], bm_edu: ['edu', -55, 101], bm_seongsan: ['seongsan', 24, -57] };
const MISSIONS = {
  place() {
    for (const m of BUILDING_MISSIONS) {
      if (G.missionsDone[m.id] || G.pickups.some(p => p.mission === m.id)) continue;
      const [bid, mx, mz] = MISSION_SPOTS[m.id], [x, z] = at(bid, mx, mz); dropPickup(m.item, x, z, { mission: m.id });
    }
  },
  complete(id, u) {
    if (G.missionsDone[id]) return; G.missionsDone[id] = true; const m = BUILDING_MISSIONS.find(q => q.id === id);
    UI.banner(`건물 미션 완료 — ${m.bld}: ${m.rewardText}`, '#ffe066');
    if (m.reward === 'heal') G.units.forEach(o => { if (o.state === 'active') o.hp = o.maxHp; });
    if (m.reward === 'phone') UI.kakao('jueun', '배터리 찾았다! 이제 폰 좀 버틸 듯', true);
    if (m.reward === 'radio') UI.kakao('???', '……치직…… K-13 각 조…… 생존자 위치 확인……', false);
    UI.refreshQuest(); saveProgress();
  },
};

const STORY = {
  interacts: [], amb: null, failed: false, ending: false,
  start(idx) {
    G.chapterIdx = idx; G.questIdx = 0; G.qprog = 0; G.qtimer = 0; this.failed = false; this.amb = null; this.timers = [];
    const ch = CHAPTERS[idx];
    clearZombies(); clearPickups(true); clearBarriers(); this.interacts = []; this.questOverride = null; this.bossDead = false; this.yujunHold = false;
    G.fx.forEach(f => f.mesh && scene.remove(f.mesh)); G.fx = []; G.proj.forEach(p => scene.remove(p.mesh)); G.proj = []; G.lure = null; G.buffs = {};
    if (this.heli) { scene.remove(this.heli); this.heli = null; }
    const sp = WORLD.spawns[ch.start];
    G.units.forEach((u, i) => { const a = i / G.units.length * 6.283; u.x = sp.x + Math.sin(a) * 1.8; u.z = sp.z + Math.cos(a) * 1.8; pushOut(u);
      u.state = 'active'; u.hp = u.maxHp; u.absent = false; u.scripted = false; u.scriptMove = null; u.skillCd = 2; u.hidden = 0; });
    if (G.me) { G.me.x = sp.x; G.me.z = sp.z; }
    setNight(ch.night);
    (CH_SETUP[ch.id] || (() => {}))(this);
    if (!underground(sp.x) && idx <= 4) MISSIONS.place();
    UI.chapterCard(ch, () => {
      UI.dialogStart(ch.intro, () => { (ch.kakao || []).forEach((k, i) => setTimeout(() => UI.kakao(k[0], k[1], false), 400 + i * 900)); UI.refreshQuest(); });
    });
    UI.refreshQuest(); UI.refreshInv(); saveProgress();
    if (G.mode === 'host') NET.event({ e: 'chapter', idx });
  },
  quest() { const ch = CHAPTERS[G.chapterIdx]; return (this.questOverride && this.questOverride[G.questIdx]) || ch.quests[G.questIdx]; },
  advance() {
    const ch = CHAPTERS[G.chapterIdx]; const q = this.quest();
    UI.banner(`✔ ${q.text}`, '#7dff7d'); sfx('pick');
    G.questIdx++; G.qprog = 0; G.qtimer = 0; G.killBase = G.kills;
    (CH_ONQUEST[ch.id] || (() => {}))(this, G.questIdx);
    if (G.questIdx >= ch.quests.length) { this.finish(); return; }
    const nq = this.quest(); if (nq.type === 'talk') { UI.dialogStart(nq.lines, () => this.advance()); }
    UI.refreshQuest(); saveProgress();
  },
  finish() {
    const ch = CHAPTERS[G.chapterIdx];
    UI.dialogStart(ch.outro, () => {
      if (G.chapterIdx + 1 < CHAPTERS.length) this.start(G.chapterIdx + 1);
      else this.ending = true, UI.ending();
    });
  },
  fail(reason) {
    if (this.failed || this.ending) return; this.failed = true; G.paused = true;
    UI.fail(reason); if (G.mode === 'host') NET.event({ e: 'fail', reason });
  },
  retry() { G.paused = false; this.start(G.chapterIdx); },
  onKill(z) { if (z.kind === 'n1') { this.bossDead = true; UI.banner('1번이 쓰러졌다', '#ff9a9a'); } },
  onCollect(type, p) {
    const q = this.quest(); if (!q || q.type !== 'collect') return;
    if (q.item === type || (q.item === 'supply' && type === 'supply')) { G.qprog++; UI.refreshQuest(); }
  },
  allInteracts() { return WORLD.interact.concat(this.interacts); },
  nearInteract(u) { let b = null, bd = 1e9; for (const it of this.allInteracts()) { if (it.used || (it.enabled && !it.enabled())) continue; const d = Math.hypot(it.x - u.x, it.z - u.z); if (d < it.r && d < bd) { bd = d; b = it; } } return b; },
  tryInteract(u) { const it = this.nearInteract(u); if (!it) return; if (it.use(u) !== false) { if (!it.multi) it.used = true; sfx('pick'); } },
  addInteract(id, x, z, label, use, opts) { const it = Object.assign({ id, x, z, label, use, r: 2.4, used: false }, opts || {}); this.interacts.push(it); return it; },
  questInteract(id) { const q = this.quest(); if (q && q.type === 'interact' && q.id === id) { G.qprog++; if (G.qprog >= (q.count || 1)) this.advance(); else UI.refreshQuest(); return true; } return false; },
  tick(dt) {
    if (this.failed || UI.dialog || !G.running) return;
    const ch = CHAPTERS[G.chapterIdx], q = this.quest(); if (!q) return;
    (CH_TICK[ch.id] || (() => {}))(this, dt);
    if (this.amb) this.ambient(dt);
    const players = G.units.filter(u => u.ctrl !== 'ai' && u.state === 'active');
    const inArea = (u, id, pad) => { const A = WORLD.areas[id]; return Math.hypot(u.x - A.x, u.z - A.z) < A.r + (pad || 0); };
    if (q.type === 'reach' && players.some(u => inArea(u, q.area))) this.advance();
    else if (q.type === 'gather') {
      const A = WORLD.areas[q.area]; const missing = G.units.filter(u => !u.absent && (u.state !== 'active' || Math.hypot(u.x - A.x, u.z - A.z) > A.r + 7));
      G.qprog = G.units.filter(u => !u.absent).length - missing.length;
      if (players.some(u => inArea(u, q.area)) && missing.length === 0) this.advance();
    }
    else if (q.type === 'collect' && G.qprog >= q.count) this.advance();
    else if (q.type === 'kill') { G.qprog = G.kills - (G.killBase || 0); if (G.qprog >= q.count) this.advance(); }
    else if (q.type === 'survive') {
      const ok = !q.at || players.some(u => Math.hypot(u.x - WORLD.areas[q.at].x, u.z - WORLD.areas[q.at].z) < 14);
      if (ok) G.qtimer += dt; G.qprog = Math.floor(G.qtimer);
      if (G.qtimer >= q.sec) this.advance();
    }
    else if (q.type === 'revive') { const u = unitByCh(q.id); if (u && u.state === 'active' && u.wasDown) { u.scripted = false; this.advance(); } }
    else if (q.type === 'boss' && this.bossDead) this.advance();
    // 쓰러진 사람이 플레이어면 협동에서는 대기, 전원 쓰러지면 실패
    if (G.mode !== 'solo' && players.length === 0 && G.units.some(u => u.ctrl !== 'ai')) this.fail('모든 플레이어가 쓰러졌습니다');
  },
  // 주변 좀비 유지
  ambient(dt) {
    const A = this.amb; A.t = (A.t || 0) - dt; if (A.t > 0) return; A.t = A.every || 1.2;
    const me = G.me; if (!me) return;
    const outdoor = G.zombies.filter(z => z.kind !== 'agent' && z.kind !== 'n1' && z.kind !== 'mimic').length;
    if (outdoor >= A.n) return;
    const r = Math.random(), kind = r < (A.brute || 0) ? 'brute' : r < (A.brute || 0) + (A.runner || 0) ? 'runner' : 'walker';
    const ref = A.at || me;
    for (let k = 0; k < (A.burst || 1); k++) spawnAround(kind, ref.x, ref.z, A.min || 22, A.max || 40);
  },
  setTimer(t, fn) { const id = setTimeout(() => { if (!this.failed) fn(); }, t * 1000); this.timers.push(id); },
};

// ---------- 장별 설정 ----------
const CH_SETUP = {
  prologue(S) {
    S.storeDoor = addBarrier(...at('humanities', -68, 33), 1.6, 0.3, '#6b4f36');
    S.addInteract('kw_door', ...at('humanities', -71.8, 41.3), '과방 문 잠그기', u => {
      S.door = addBarrier(...at('humanities', -71, 41.3), 0.4, 2.1, '#5a4430'); S.questInteract('kw_door');
      for (let i = 0; i < 5; i++) spawnZombie('walker', ...at('humanities', -78 - (i % 3) * 1.5, 39 + (i % 2) * 3));
      UI.banner('쾅! 쾅! 문 밖에서 무언가 두드린다', '#ff8080');
    }, { enabled: () => G.questIdx === 0 });
    S.addInteract('kw_key', ...at('humanities', -66, 41.2), '책상 위 열쇠 집기', u => {
      S.questInteract('kw_key'); removeBarrier(S.storeDoor);
      dropPickup('storage', ...at('humanities', -63.5, 29.8), { sub: 'bat' }); dropPickup('storage', ...at('humanities', -62, 30.8), { sub: 'ext' });
      say(unitByCh('hyoseo'), '과방 창고 열쇠. 창고 열었어!', 3);
    }, { enabled: () => G.questIdx === 1 });
    { const [ax, az] = at('humanities', -60, 10); S.amb = { n: 16, min: 25, max: 60, at: { x: ax, z: az } }; }
    setTimeout(() => { const z = spawnZombie('walker', ...at('humanities', -90, 41)); z.target = null; }, 500);
  },
  ch1(S) { dropPickup('molotov', ...at('humanities', -70, 12)); S.amb = { n: 34, min: 16, max: 40, runner: 0.25, every: 0.6, burst: 2 }; for (let i = 0; i < 18; i++) spawnAround(Math.random() < 0.3 ? 'runner' : 'walker', ...at('humanities', -64, 22), 10, 40); },
  ch2(S) {
    for (let i = 0; i < 6; i++) spawnZombie('walker', ...at('library', -88 + (i % 3) * 7 + rand(-1, 1), -40.5 + (i < 3 ? 0 : 5) + 2.5));
    for (let i = 0; i < 10; i++) spawnAround('walker', ...at('library', -61, -6), 4, 14);
    let n = 0;
    [[-61.5, -15.8, -61.5, -14, 4.2, 0.4], [-52.6, -22, -51, -22, 0.4, 2.6]].map(([ix, iz, bx, bz, bw, bd]) => [...at('library', ix, iz), ...at('library', bx, bz), bw, bd]).forEach(([ix, iz, bx, bz, bw, bd]) => {
      S.addInteract('lib_barricade', ix, iz, '책상으로 입구 막기', u => { addBarrier(bx, bz, bw, bd); S.questInteract('lib_barricade'); }, { enabled: () => G.questIdx === 0 });
    });
    const sup = [[-90, -21.5], [-86, -16], [-82.5, -21.5], [-89, -15.5]]; sup.forEach(([x, z]) => dropPickup('supply', ...at('library', x, z)));
    { const [ax, az] = at('library', -60, -4); S.amb = { n: 14, min: 12, max: 30, at: { x: ax, z: az } }; }
  },
  ch3(S) { dropPickup('molotov', ...at('union', 70, 24)); dropPickup('molotov', ...at('union', 56, 36));
    S.amb = { n: 34, min: 18, max: 40, runner: 0.3, brute: 0.06, every: 0.7, burst: 2 };
    S.addInteract('ss_door', ...at('seongsan', 0, -36), '성산홀 정문 잠그기', u => { addBarrier(...at('seongsan', 0, -34), 4.4, 0.45, '#5a4430'); S.questInteract('ss_door'); UI.banner('정문을 잠갔다. 하지만 옆문이 아직 열려 있다', '#ffb0b0'); }, { enabled: () => G.questIdx === 2 });
    const e = unitByCh('eunbit'); if (e && e.ctrl !== 'ai') S.questOverride = { 1: { text: '계단에서 넘어진 이주원 일으켜 세우기', type: 'revive', id: 'juwon' } }; },
  ch4(S) {
    const y = unitByCh('yujun'); if (y && y !== G.me && y.ctrl === 'ai') { [y.x, y.z] = at('seongsan', -17, -60.5); y.scripted = true; }
    S.amb = { n: 14, min: 25, max: 45, every: 1.2 };
  },
  ch5(S) {
    S.door = addBarrier(UG_X + 36, -15, 0.4, 2.8, '#4a4f55');
    [[UG_X - 32, -21], [UG_X + 30, 21], [UG_X + 2, 22]].forEach(([x, z]) => dropPickup('fuse', x, z));
    for (let i = 0; i < 6; i++) spawnAround('walker', UG_X, 0, 10, 26);
    S.setTimer(4, () => { S.mimic = spawnZombie('mimic', UG_X + 25, -8); UI.banner('어둠 속에서 무언가 네 발로 달려온다', '#ff8080'); });
    S.addInteract('pk_panel', UG_X + 34.6, 6, '배전함에 퓨즈 넣기', u => {
      if ((G.inv.fuse || 0) < 3) { floatText(u.x, u.z, `퓨즈 ${(G.inv.fuse || 0)}/3`, '#ffd36b', 16); return false; }
      G.inv.fuse -= 3; UI.refreshInv(); removeBarrier(S.door); UI.banner('철문이 열렸다!', '#7dff7d'); S.questInteract('pk_panel');
    }, { enabled: () => G.questIdx === 1 });
    S.amb = { n: 10, min: 10, max: 25, every: 2 };
    const y = unitByCh('yujun');
    if (y && y.ctrl !== 'ai') S.questOverride = { 2: { text: '괴물을 붙잡고 30초 버티기 — 동기들이 탈출할 시간을 벌어라', type: 'survive', sec: 30 } };
    else S.questOverride = null;
  },
  ch6(S) {
    S.questOverride = null; S.bossDead = false;
    const terms = [[UG_X - 28, 109], [UG_X + 28, 109], [UG_X - 28, 152]];
    const lines = ['K13_011: 11번은 감염자를 통제한다. 그러나 통제 능력의 근원은 바이러스가 아니다.',
      'ORIGIN_00: 0번은 감염 이후에도 자아를 유지했다. 0번의 감정에 따라 감염체의 행동이 변화한다.',
      'SUBJECT_13: NOT A HUMAN SUBJECT. 나는 13번이 아니라 13번째 기록이다.'];
    terms.forEach(([x, z], i) => S.addInteract('lab_term', x, z + 1.3, '단말기 조사', u => { UI.banner(lines[i], '#5fd1ff', 6); UI.kakao(i === 2 ? '13' : '12번', lines[i], false); S.questInteract('lab_term'); }, { enabled: () => G.questIdx === 0 }));
    for (let i = 0; i < 8; i++) spawnAround('walker', UG_X, 130, 8, 26);
    S.amb = { n: 12, min: 10, max: 26, every: 1.5 };
  },
};
const CH_ONQUEST = {
  prologue(S, qi) {
    if (qi === 3) { S.setTimer(2.5, () => { removeBarrier(S.door); UI.banner('쩌적— 과방 문이 부서졌다! 뛰어!', '#ff6060'); for (let i = 0; i < 4; i++) spawnZombie(i ? 'walker' : 'runner', ...at('humanities', -76, 40 + i)); }); equipTeam(); }
  },
  ch3(S, qi) {
    if (qi === 1) { const e = unitByCh(S.quest().id); if (e) { [e.x, e.z] = at('seongsan', 2, -29.5); e.state = 'down'; e.hp = 0; e.downT = 60; e.scripted = true; e.wasDown = true; say(e, '꺄악!', 2);
      for (let i = 0; i < 6; i++) spawnAround('walker', ...at('seongsan', 0, -26), 8, 16); } }
    if (qi === 3) { S.amb = { n: 40, min: 8, max: 22, at: { x: at('seongsan', 0, -48)[0], z: at('seongsan', 0, -48)[1] }, runner: 0.35, brute: 0.08, every: 0.5, burst: 2 }; UI.banner('밤이 깊어진다. 옆문과 뒷문을 지켜!', '#9aa8ff'); setNight(0.9); }
  },
  ch4(S, qi) {
    if (qi === 2) { const y = unitByCh('yujun'); if (y) y.scripted = false; setNight(0.45); UI.banner('오전 5시 56분. 운동장으로.', '#ffe9a8'); }
    if (qi === 3) {
      UI.banner('헬리콥터 소리가 들린다— K-13', '#ffd36b');
      const h = makeHeli(); h.position.set(WORLD.field.x + 18, 40, WORLD.field.z + 10); h.rotation.y = 0.6; scene.add(h); S.heli = h; S.heliT = 0;
      S.setTimer(3, () => { UI.dialogStart([['*', '"학생들은 움직이지 마십시오."'], ['*', '"감염자는 앞으로 나오십시오."'], ['jihu', '뛰어야 해.'], ['*', '탕!']], () => {
        for (let i = 0; i < 5; i++) spawnZombie('agent', WORLD.field.x + rand(-6, 6), WORLD.field.z + rand(-6, 6));
        S.agentWave = 3; S.amb = { n: 30, min: 18, max: 34, runner: 0.5, every: 0.5, burst: 2 };
      }); });
    }
  },
  ch5(S, qi) {
    if (qi === 2) {
      const y = unitByCh('yujun');
      if (y && y.ctrl === 'ai') { y.scripted = true; say(y, '내가 막을게. 가!', 3); S.yujunHold = true; }
      else UI.banner('유준: "……출석체크 해."', '#7dd87d');
    }
  },
  ch6(S, qi) {
    if (qi === 1) { const n1 = spawnZombie('n1', UG_X, 113); say(n1, '이번에는 내가 출석을 부를게.', 3); for (let i = 0; i < 6; i++) spawnAround('runner', UG_X, 113, 4, 10); UI.banner('1번 등장 — 감염자를 통제하는 첫 번째 실험체', '#ff6060'); }
    if (qi === 2) { S.amb = { n: 34, min: 8, max: 22, at: { x: UG_X, z: 120 }, runner: 0.4, brute: 0.1, every: 0.45, burst: 2 }; UI.banner('주은과 유준이 중앙 장치에 손을 올렸다. 버텨!', '#a26bff'); }
  },
};
const CH_TICK = {
  ch4(S, dt) {
    if (S.heli) { S.heliT += dt; S.heli.position.y = Math.max(3, 40 - S.heliT * 9); S.heli.userData.rotor.rotation.y += dt * 25; }
    if (S.agentWave > 0) { S.agentT = (S.agentT || 10) - dt; if (S.agentT <= 0) { S.agentT = 10; S.agentWave--; for (let i = 0; i < 3; i++) spawnZombie('agent', WORLD.field.x + rand(-5, 5), WORLD.field.z + rand(-5, 5)); } }
  },
  ch5(S, dt) {
    if (S.yujunHold && S.mimic && !S.mimic.dead) { const y = unitByCh('yujun'); if (y && y.state === 'active') { y.scriptMove = { x: S.mimic.x, z: S.mimic.z }; S.mimic.target = y; S.mimic.retarget = 1; y.inv = 1; } }
  },
  ch6(S, dt) { if (WORLD.core) WORLD.core.rotation.y += dt * (G.questIdx === 2 ? 3 : 0.5); },
};
// 5장 → 6장 사이: 유준 이탈 후 복귀
const _finish = STORY.finish.bind(STORY);
STORY.finish = function () {
  const ch = CHAPTERS[G.chapterIdx];
  if (ch.id === 'ch5') { const y = unitByCh('yujun'); if (y && y.ctrl === 'ai') { y.absent = true; y.scripted = false; } this.yujunHold = false; }
  _finish();
};

function saveProgress() { try { localStorage.setItem('lastAttendance', JSON.stringify({ ch: G.chapterIdx, me: G.me && G.me.ch.id, missions: G.missionsDone })); } catch (e) {} }
function loadProgress() { try { return JSON.parse(localStorage.getItem('lastAttendance') || 'null'); } catch (e) { return null; } }
