'use strict';
// ============================================================
//  협동 모드: 실시간 P2P (PeerJS/WebRTC). ?local=1 이면 같은 브라우저 탭끼리(BroadcastChannel)
// ============================================================
const NET = {
  role: null, pid: null, code: null, players: [], conns: {}, link: null, snapT: 0, inT: 0, events: [], zModels: {}, pModels: {},
  local: /[?&]local=1/.test(location.search),
  status(t) { $('netStatus').textContent = t; },
  // ---- 연결 ----
  host(name) {
    this.role = 'host'; this.pid = 'host'; this.code = Math.random().toString(36).slice(2, 7).toUpperCase();
    this.players = [{ pid: 'host', name, ch: null }];
    this.openLobby();
    if (this.local) { this.bc = new BroadcastChannel('lastatt-' + this.code); this.bc.onmessage = e => { const m = e.data; if (m._to && m._to !== 'host') return; if (m._from === 'host') return; this.onHost(m._from, m); }; this.status('방이 열렸어요 (로컬 테스트)'); return; }
    try {
      this.peer = new Peer('lastatt-' + this.code);
      this.peer.on('open', () => this.status('방이 열렸어요. 친구에게 방 코드를 알려주세요.'));
      this.peer.on('error', e => this.status('연결 오류: ' + (e.type || e)));
      this.peer.on('connection', c => { c.on('data', m => this.onHost(c.peer, m)); c.on('close', () => this.leave(c.peer)); this.conns[c.peer] = c; });
    } catch (e) { this.status('P2P 연결을 시작할 수 없어요: ' + e.message); }
  },
  join(code, name) {
    if (!code) { alert('방 코드를 입력하세요'); return; }
    this.role = 'client'; this.code = code; this.name = name;
    this.pid = 'p' + Math.random().toString(36).slice(2, 8);
    this.openLobby(); this.status('접속 중…');
    if (this.local) { this.bc = new BroadcastChannel('lastatt-' + code); this.bc.onmessage = e => { const m = e.data; if (m._from !== 'host') return; if (m._to && m._to !== this.pid) return; this.onClient(m); };
      this.send({ t: 'hello', name }); return; }
    try {
      this.peer = new Peer();
      this.peer.on('open', id => { this.pid = id; const c = this.peer.connect('lastatt-' + code, { reliable: true }); this.link = c;
        c.on('open', () => { this.status('연결됨!'); this.send({ t: 'hello', name }); }); c.on('data', m => this.onClient(m)); c.on('close', () => this.status('호스트와 연결이 끊겼어요')); });
      this.peer.on('error', e => this.status('연결 오류: ' + (e.type === 'peer-unavailable' ? '방을 찾을 수 없어요' : e.type || e)));
    } catch (e) { this.status('P2P 연결을 시작할 수 없어요: ' + e.message); }
  },
  send(m) { // 클라이언트 → 호스트
    if (this.local) { this.bc.postMessage(Object.assign({ _from: this.pid, _to: 'host' }, m)); return; }
    if (this.link && this.link.open) this.link.send(m);
  },
  broadcast(m, to) { // 호스트 → 클라이언트
    if (this.local) { this.bc && this.bc.postMessage(Object.assign({ _from: 'host', _to: to }, m)); return; }
    for (const k in this.conns) if ((!to || k === to) && this.conns[k].open) this.conns[k].send(m);
  },
  event(ev) { if (this.role === 'host') this.events.push(ev); },
  leave(pid) { const p = this.players.find(q => q.pid === pid); this.players = this.players.filter(q => q.pid !== pid); delete this.conns[pid];
    if (G.running && p) { const u = unitByCh(p.ch); if (u) { u.ctrl = 'ai'; UI.banner(`${p.name}(${CHAR[p.ch].name}) 연결 끊김 — AI가 대신 움직여요`, '#ffb0b0'); } }
    this.renderLobby(); this.broadcast({ t: 'lobby', players: this.players }); },
  // ---- 로비 ----
  openLobby() {
    UI.show('lobby'); $('lobbyCode').textContent = this.code || '-'; $('btnLobbyStart').classList.toggle('hidden', this.role !== 'host');
    this.renderLobby();
  },
  renderLobby() {
    const taken = {}; this.players.forEach(p => { if (p.ch) taken[p.ch] = p; });
    const mine = this.players.find(p => p.pid === this.pid);
    $('lobbyPlayers').innerHTML = this.players.map(p => `<div class="lp">${p.ch ? avatarHTML(p.ch) : '<div class="av sp">?</div>'}<b>${esc(p.name)}${p.pid === 'host' ? ' (방장)' : ''}</b><span>${p.ch ? CHAR[p.ch].name : '캐릭터 선택 중'}</span></div>`).join('');
    $('lobbyChars').innerHTML = CHARS.map(c => `<div class="lc ${taken[c.id] ? (taken[c.id].pid === this.pid ? 'mine' : 'taken') : ''}" data-id="${c.id}">${avatarHTML(c.id)}<span>${c.short}</span></div>`).join('');
    $('lobbyChars').querySelectorAll('.lc').forEach(el => el.onclick = () => {
      if (el.classList.contains('taken')) return; const id = el.dataset.id;
      if (this.role === 'host') { this.players[0].ch = id; this.renderLobby(); this.broadcast({ t: 'lobby', players: this.players }); }
      else this.send({ t: 'pick', ch: id });
    });
    $('lobbyHint').textContent = `${this.players.length}명 접속 · 비어 있는 캐릭터는 AI 동료가 함께해요 (최대 11명)`;
  },
  startGame() {
    if (this.players.some(p => !p.ch)) { alert('모든 플레이어가 캐릭터를 골라야 해요'); return; }
    this.broadcast({ t: 'start', players: this.players });
    G.mode = 'host'; UI.hideScreens(); startGame(this.players, 'host', 0);
  },
  // ---- 호스트 수신 ----
  onHost(from, m) {
    if (m.t === 'hello') { if (!this.players.find(p => p.pid === from)) this.players.push({ pid: from, name: m.name, ch: null }); this.renderLobby(); this.broadcast({ t: 'lobby', players: this.players }); return; }
    if (m.t === 'pick') { const p = this.players.find(q => q.pid === from); if (p && !this.players.some(q => q.ch === m.ch && q.pid !== from)) p.ch = m.ch; this.renderLobby(); this.broadcast({ t: 'lobby', players: this.players }); return; }
    const p = this.players.find(q => q.pid === from); if (!p || !G.running) return;
    const u = unitByCh(p.ch); if (!u) return;
    if (m.t === 'in') { if (u.state === 'active') { u.x = m.x; u.z = m.z; u.fl = m.fl || 0; } u.face = m.face; u.speed = m.speed; }
    else if (m.t === 'act') { if (m.a === 'atk') meleeAttack(u, m.face); else if (m.a === 'skill') { u.skillCd = 0; castSkill(u, m.tx, m.tz); } else if (m.a === 'use') STORY.tryInteract(u); }
    else if (m.t === 'chat') { UI.kakao(m.from, m.text, true, m.to);
      if (m.to && !UI.isPlayer(m.to)) setTimeout(() => UI.kakao(m.to, DM_REPLY[m.to][(Math.random() * 3) | 0], true, m.from), 1500); }
  },
  hostTick(dt) {
    this.snapT -= dt; if (this.snapT > 0) return; this.snapT = 0.1;
    const r = v => Math.round(v * 100) / 100;
    const snap = { t: 'snap',
      u: G.units.map(u => [u.id, r(u.x), r(u.z), r(u.face), Math.round(u.hp), u.state, r(u.speed || 0), u.atkAnim > 0 ? 1 : 0, u.absent ? 1 : 0, u.hidden > 0 ? 1 : 0, r(u.downT), u.weapon || '', r(u.reviveT), u.fl || 0]),
      z: G.zombies.map(z => [z.id, z.kind, r(z.x), r(z.z), r(z.face), Math.round(z.hp), z.maxHp, z.stun > 0 ? 1 : 0, z.mark > 0 ? 1 : 0, z.confused > 0 ? 1 : 0, z.root > 0 ? 1 : 0, r(z.speedNow || 0), z.atkAnim > 0 ? 1 : 0, z.fl || 0]),
      p: G.pickups.map(p => [p.id, p.type, r(p.x), r(p.z), p.mission || '', p.fl || 0]),
      it: STORY.allInteracts().map(i => [i.id, r(i.x), r(i.z), i.label, !i.used && (!i.enabled || i.enabled()) ? 1 : 0]),
      q: [G.chapterIdx, G.questIdx, G.qprog, STORY.questOverride || null], inv: G.inv, env: [ENV.hour, ENV.curW], buffs: G.buffs, md: G.missionsDone, ev: this.events };
    this.events = [];
    this.broadcast(snap);
  },
  // ---- 클라이언트 수신 ----
  onClient(m) {
    if (m.t === 'lobby') { this.players = m.players; if (!this.players.find(p => p.pid === this.pid)) { /* 로컬 모드에서 pid 정합 */ } this.renderLobby(); this.status('연결됨! 캐릭터를 골라주세요'); return; }
    if (m.t === 'start') { this.players = m.players; G.mode = 'client'; UI.hideScreens(); startGame(this.players, this.pid, 0); return; }
    if (m.t === 'snap' && G.running) this.applySnap(m);
    if (m.t === 'ending') UI.ending();
  },
  applySnap(s) {
    if (s.u) for (const a of s.u) { const u = unitById(a[0]); if (!u) continue;
      if (u !== G.me) { u.x = a[1]; u.z = a[2]; u.face = a[3]; u.speed = a[6]; u.fl = a[13]; if (a[7]) u.atkAnim = 1; } else if (a[5] !== 'active' || u.state !== 'active') { u.x = a[1]; u.z = a[2]; }
      u.hp = a[4]; u.state = a[5]; u.absent = !!a[8]; u.hidden = a[9] ? 1 : 0; u.downT = a[10]; u.reviveT = a[12]; if (u.weapon !== (a[11] || null)) setWeapon(u, a[11] || null); }
    if (s.z) { const seen = new Set();
    for (const a of s.z) { seen.add(a[0]); let z = this.zModels[a[0]];
      if (!z) { const model = a[1] === 'agent' ? makeAgent() : a[1] === 'mimic' ? makeMimic() : a[1] === 'n1' ? makeNumberOne() : makeZombie(a[1]); scene.add(model);
        z = this.zModels[a[0]] = { id: a[0], kind: a[1], model, r: ZDEF[a[1]].r }; G.zombies.push(z); }
      Object.assign(z, { fl: a[13], x: a[2], z: a[3], face: a[4], hp: a[5], maxHp: a[6], stun: a[7], mark: a[8], confused: a[9], root: a[10], speedNow: a[11] }); if (a[12]) z.atkAnim = 1; }
    for (const id in this.zModels) if (!seen.has(+id)) { scene.remove(this.zModels[id].model); G.zombies = G.zombies.filter(z => z !== this.zModels[id]); delete this.zModels[id]; } }
    if (s.p) { const pseen = new Set();
    for (const a of s.p) { pseen.add(a[0]); if (!this.pModels[a[0]]) { const p = dropPickup(a[1], a[2], a[3], { mission: a[4] || undefined, fl: a[5] }); G.nextId--; p.id = a[0]; p.remote = true; this.pModels[a[0]] = p; } }
    for (const id in this.pModels) if (!pseen.has(+id)) { scene.remove(this.pModels[id].mesh); G.pickups = G.pickups.filter(p => p !== this.pModels[id]); delete this.pModels[id]; } }
    if (s.it) STORY.interacts = s.it.map(a => ({ id: a[0], x: a[1], z: a[2], label: a[3], used: !a[4], r: 2.4 }));
    if (!s.q) { for (const ev of s.ev || []) this.applyEvent(ev); return; }
    const qChanged = G.chapterIdx !== s.q[0] || G.questIdx !== s.q[1] || G.qprog !== s.q[2];
    G.chapterIdx = s.q[0]; G.questIdx = s.q[1]; G.qprog = s.q[2]; STORY.questOverride = s.q[3];
    G.inv = s.inv; G.buffs = s.buffs; G.missionsDone = s.md; if (s.env) { if (Math.abs(ENV.hour - s.env[0]) > 0.05) ENV.hour = s.env[0]; if (ENV.curW !== s.env[1]) setWeather(s.env[1]); }
    if (qChanged) { UI.refreshQuest(); UI.refreshInv(); }
    for (const ev of s.ev || []) this.applyEvent(ev);
  },
  applyEvent(ev) {
    if (ev.e === 'fx') { const f = Object.assign({}, ev.f); f.t = 0; G.fx.push(f); }
    else if (ev.e === 'proj') visualProjectile(ev.p);
    else if (ev.e === 'say') { const u = unitById(ev.id) || this.zModels[ev.id]; if (u) u.say = { text: ev.text, t: ev.tt }; }
    else if (ev.e === 'banner') UI.banner(ev.text, ev.color, ev.t);
    else if (ev.e === 'chat') { if (ev.from === G.me.ch.id) return; UI.kakao(ev.from, ev.text, true, ev.to, true); }
    else if (ev.e === 'dialog') UI.dialogStart(ev.lines, null, true);
    else if (ev.e === 'dlgi') { const D = UI.dialog; if (D && ev.i !== D.i && ev.i < D.list.length) { D.i = ev.i; $('rollcall').classList.add('hidden'); UI.showLine(); } }
    else if (ev.e === 'dlgend') { if (UI.dialog) { UI.dialog.i = UI.dialog.list.length; UI.dialog.local = true; $('rollcall').classList.add('hidden'); UI.showLine(); } }
    else if (ev.e === 'chapter') { const ch = CHAPTERS[ev.idx]; G.chapterIdx = ev.idx; const sp = WORLD.spawns[ch.start]; G.me.x = sp.x + rand(-1, 1); G.me.z = sp.z + rand(-1, 1); G.me.state = 'active'; setChapterEnv(ch.id); UI.chapterCard(ch); UI.refreshQuest(); }
    else if (ev.e === 'fail') UI.fail(ev.reason);
    else if (ev.e === 'retry') $('failScr').classList.add('hidden');
    else if (ev.e === 'ending') UI.ending();
  },
  clientTick(dt) {
    this.inT -= dt; if (this.inT > 0 || !G.me) return; this.inT = 0.066;
    const u = G.me; this.send({ t: 'in', x: u.x, z: u.z, face: u.face, speed: u.speed || 0, fl: u.fl || 0 });
  },
};

// ============================================================
//  Claude 링크(아티팩트) 안: room 기능으로 실시간 협동
//  - 방장 → 모두: 'h' 토픽 (스냅샷 조각, 이벤트), 로비/시작은 방장 presence
//  - 참가자 → 방장: presence (이름·캐릭터·위치·행동 큐)
// ============================================================
const ROOMNET = {
  api: null, R: null, seq: 0, acts: [], lastSeq: {}, started: false, zbuf: {}, tick: 0,
  async ready() { for (let i = 0; i < 100 && this.api === null && NET.roomPending; i++) await new Promise(r => setTimeout(r, 100)); return this.api; },
  async host(name) {
    const api = await this.ready(); if (!api) return NET.status('이 화면에서는 협동 연결을 쓸 수 없어요 (로그인이 필요하거나 권한이 없어요)');
    NET.role = 'host'; NET.pid = 'host'; NET.code = Math.random().toString(36).slice(2, 7).toUpperCase(); NET.players = [{ pid: 'host', name, ch: null }];
    NET.openLobby(); NET.status('방을 여는 중…');
    try { this.R = await api.join('la-' + NET.code.toLowerCase()); } catch (e) { return NET.status('방을 열 수 없어요: ' + (e.code || e.message)); }
    this.R.presence({ h: 1, name, players: NET.players, started: 0 });
    this.R.onPeers(ch => this.hostPeers(ch.peers), e => NET.status('연결 오류: ' + e.code));
    NET.status('방이 열렸어요. 친구에게 방 코드를 알려주세요.');
  },
  hostPeers(peers) {
    const here = new Set();
    for (const p of peers) {
      if (p.sameTab || !p.presence || !p.presence.c) continue; const pid = p.peer; here.add(pid); const P = p.presence;
      let pl = NET.players.find(q => q.pid === pid);
      if (!pl) { pl = { pid, name: String(P.name || '친구').slice(0, 12), ch: null }; NET.players.push(pl); this.lastSeq[pid] = 0; this.pushLobby(); }
      if (P.ch && P.ch !== pl.ch && CHAR[P.ch] && !NET.players.some(q => q.ch === P.ch && q.pid !== pid) && !G.running) { pl.ch = P.ch; this.pushLobby(); }
      if (G.running && P.st) NET.onHost(pid, Object.assign({ t: 'in' }, P.st));
      if (Array.isArray(P.acts)) for (const a of P.acts) if (a && a.n > (this.lastSeq[pid] || 0)) { this.lastSeq[pid] = a.n; NET.onHost(pid, a.m); }
    }
    for (const pl of NET.players.slice()) if (pl.pid !== 'host' && !here.has(pl.pid)) NET.leave(pl.pid);
  },
  pushLobby() { NET.renderLobby(); if (this.R) this.R.presence({ players: NET.players.map(p => ({ pid: p.pid, name: p.name, ch: p.ch })), started: this.started ? 1 : 0 }); },
  async join(code, name) {
    const api = await this.ready(); if (!api) return NET.status('이 화면에서는 협동 연결을 쓸 수 없어요 (로그인이 필요하거나 권한이 없어요)');
    if (!code) return NET.status('방 코드를 입력하세요');
    NET.role = 'client'; NET.code = code; NET.name = name; NET.openLobby(); NET.status('접속 중…');
    try { this.R = await api.join('la-' + code.toLowerCase()); } catch (e) { return NET.status('방에 들어갈 수 없어요: ' + (e.code || e.message)); }
    this.R.presence({ c: 1, name, ch: null, acts: [], st: null });
    this.R.onPeers(ch => this.clientPeers(ch.peers), e => NET.status('연결 오류: ' + e.code));
    this.R.on('h', msg => this.onHostMsg(msg.data));
  },
  clientPeers(peers) {
    const me = peers.find(p => p.isMe && p.sameTab); if (me) NET.pid = me.peer;
    const h = peers.find(p => p.presence && p.presence.h);
    if (!h) { if (!this.waitShown) { this.waitShown = true; NET.status('방장을 기다리는 중… (방 코드를 확인하세요)'); } return; }
    const pl = (h.presence.players || []).map(p => ({ pid: p.pid, name: String(p.name || '').slice(0, 12), ch: CHAR[p.ch] ? p.ch : null }));
    const key = JSON.stringify(pl) + NET.pid; if (!G.running && key !== this.lastLobby) { this.lastLobby = key; NET.onClient({ t: 'lobby', players: pl }); }
    if (h.presence.started && !this.started) { this.started = true; NET.onClient({ t: 'start', players: pl }); }
  },
  onHostMsg(d) {
    if (!d || typeof d !== 'object') return;
    if (d.t === 'ending') return UI.ending();
    if (d.t !== 'snap' || !G.running) return;
    if (d.k === 'z') { const b = this.zbuf[d.id] = this.zbuf[d.id] || []; b[d.i] = d.z;
      if (b.filter(Boolean).length === d.n) { NET.applySnap({ z: [].concat(...b) }); for (const k in this.zbuf) if (+k <= d.id) delete this.zbuf[k]; } return; }
    NET.applySnap(d);
  },
  // 참가자 → 방장
  send(m) {
    if (!this.R) return;
    if (m.t === 'hello') return;
    if (m.t === 'pick') return void this.R.presence({ ch: m.ch });
    if (m.t === 'in') return void this.R.presence({ st: { x: +m.x.toFixed(2), z: +m.z.toFixed(2), face: +m.face.toFixed(2), speed: +(m.speed || 0).toFixed(1), fl: m.fl || 0 } });
    if (m.t === 'chat') m = Object.assign({}, m, { text: String(m.text).slice(0, 200) });
    this.acts.push({ n: ++this.seq, m }); if (this.acts.length > 8) this.acts.shift();
    this.R.presence({ acts: this.acts });
  },
  // 방장 → 모두
  broadcast(m) {
    if (!this.R) return;
    if (m.t === 'lobby') return this.pushLobby();
    if (m.t === 'start') { this.started = true; return this.pushLobby(); }
    if (m.t === 'ending') return void this.R.emit('h', { t: 'ending' }).catch(() => {});
  },
  hostTick(dt) {
    NET.snapT -= dt; if (NET.snapT > 0 || !this.R) return; NET.snapT = 0.15; this.tick++;
    const r = v => Math.round(v * 10) / 10, emit = d => this.R.emit('h', d).catch(() => {});
    const a = { t: 'snap', k: 'a', u: G.units.map(u => [u.id, r(u.x), r(u.z), r(u.face), Math.round(u.hp), u.state, r(u.speed || 0), u.atkAnim > 0 ? 1 : 0, u.absent ? 1 : 0, u.hidden > 0 ? 1 : 0, Math.round(u.downT), u.weapon || '', r(u.reviveT), u.fl || 0]),
      q: [G.chapterIdx, G.questIdx, G.qprog, STORY.questOverride || null], inv: G.inv, env: [ENV.hour, ENV.curW], buffs: G.buffs, md: G.missionsDone, ev: [] };
    let evs = NET.events; NET.events = [];
    const fit = [], rest = []; let size = JSON.stringify(a).length;
    for (const ev of evs) { const l = JSON.stringify(ev).length; if (size + l < 3600) { fit.push(ev); size += l; } else rest.push(ev); }
    a.ev = fit; emit(a);
    while (rest.length) { const part = []; let sz = 40; while (rest.length && sz + JSON.stringify(rest[0]).length < 3600) { const e = rest.shift(); sz += JSON.stringify(e).length; part.push(e); } if (!part.length) rest.shift(); else emit({ t: 'snap', k: 'e', ev: part }); }
    const zs = G.zombies.map(z => [z.id, z.kind, r(z.x), r(z.z), r(z.face), Math.round(z.hp), z.maxHp, z.stun > 0 ? 1 : 0, z.mark > 0 ? 1 : 0, z.confused > 0 ? 1 : 0, z.root > 0 ? 1 : 0, r(z.speedNow || 0), z.atkAnim > 0 ? 1 : 0, z.fl || 0]);
    const n = Math.max(1, Math.ceil(zs.length / 45));
    for (let i = 0; i < n; i++) emit({ t: 'snap', k: 'z', id: this.tick, i, n, z: zs.slice(i * 45, i * 45 + 45) });
    if (this.tick % 3 === 0) emit({ t: 'snap', k: 'p', p: G.pickups.slice(0, 40).map(p => [p.id, p.type, r(p.x), r(p.z), p.mission || '', p.fl || 0]),
      it: STORY.allInteracts().slice(0, 20).map(i => [i.id, r(i.x), r(i.z), String(i.label).slice(0, 24), !i.used && (!i.enabled || i.enabled()) ? 1 : 0]) });
  },
};
// NET이 room 전송을 쓰도록 연결
['host', 'join', 'send', 'broadcast', 'hostTick'].forEach(k => { const orig = NET[k].bind(NET); NET[k] = function (...a) { return (NET.useRoom ? ROOMNET[k].apply(ROOMNET, a) : orig(...a)); }; });
NET.detectRoom = function () {
  if (NET.useRoom || !(window.claude && typeof window.claude.use === 'function')) return;
  NET.useRoom = true; NET.roomPending = true; ROOMNET.api = null;
  window.claude.use('room').then(r => { ROOMNET.api = r || false; NET.roomPending = false; }).catch(() => { ROOMNET.api = false; NET.roomPending = false; });
};
NET.detectRoom(); window.addEventListener('load', () => NET.detectRoom());
