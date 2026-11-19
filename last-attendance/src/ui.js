'use strict';
// ============================================================
//  UI: 표지, 모드/캐릭터 선택, HUD, 대화, 카톡/DM, 캐릭터 카드, 관계도
// ============================================================
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PORTRAIT = {}, FULLBODY = {};
const SPECIAL = { '재난문자': { name: '긴급재난문자', color: '#ffd23a', icon: '⚠' }, '???': { name: '저장되지 않은 번호', color: '#aaa', icon: '?' },
  '방송': { name: '교내 방송', color: '#ff9a3a', icon: '📢' }, '12번': { name: '12번', color: '#59a5ff', icon: '12' }, '13': { name: '13 (ARCHIVE)', color: '#a26bff', icon: '13' } };

// --- 초상화 렌더 (오프스크린) ---
function renderPortraits() {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setSize(256, 256); r.setPixelRatio(1);
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight('#fff', '#666', 1.1)); const dl = new THREE.DirectionalLight('#fff', 0.5); dl.position.set(2, 3, 4); sc.add(dl);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  for (const ch of CHARS) {
    const m = makeHuman(ch); sc.add(m); const s = ch.height / 172;
    cam.position.set(0.5, 1.6 * s + 0.1, 1.6); cam.lookAt(0, 1.62 * s + 0.05, 0); r.render(sc, cam); PORTRAIT[ch.id] = r.domElement.toDataURL();
    m.rotation.y = 0.35; cam.position.set(1.2, 1.1, 5.2); cam.lookAt(0, 0.95, 0); r.render(sc, cam); FULLBODY[ch.id] = r.domElement.toDataURL();
    sc.remove(m);
  }
  r.dispose();
  for (const ch of CHARS) { const im = new Image(); im.src = PORTRAIT[ch.id]; PORTRAIT_IMG[ch.id] = im; }
}
const PORTRAIT_IMG = {};
function avatarHTML(id, cls) {
  if (CHAR[id]) return `<img class="av ${cls || ''}" src="${PORTRAIT[id]}" style="background:${CHAR[id].color}">`;
  const s = SPECIAL[id] || { color: '#888', icon: '?' }; return `<div class="av ${cls || ''} sp" style="background:${s.color}">${s.icon}</div>`;
}
function whoName(id) { return CHAR[id] ? CHAR[id].name : (SPECIAL[id] ? SPECIAL[id].name : id); }

const UI = {
  dialog: null, chat: { group: [], dm: {} }, unread: 0, phoneView: 'group', lines: [],
  init() {
    renderPortraits();
    // 표지
    const roll = $('coverRoll'); roll.innerHTML = NAME_ORDER.map((id, i) => `<div class="${id === 'jueun' ? 'zero' : ''}" style="animation-delay:${0.5 + i * 0.16}s"><i>${String(i + 1).padStart(2, '0')}</i><span>${CHAR[id].name}</span><b>${id === 'jueun' ? '……있어' : '✓'}</b></div>`).join('');
    const save = loadProgress();
    if (save && save.ch > 0) { $('btnContinue').classList.remove('hidden'); $('btnContinue').textContent = `이어하기 — ${CHAPTERS[save.ch].title.split('—')[0].trim()}`; }
    $('btnStart').onclick = () => this.show('modeSel');
    $('btnContinue').onclick = () => { this.pendingContinue = save; this.show('modeSel'); };
    document.querySelectorAll('[data-cards]').forEach(b => b.onclick = () => this.openCards());
    document.querySelectorAll('[data-rel]').forEach(b => b.onclick = () => this.openRelations());
    $('btnSolo').onclick = () => { G.mode = 'solo'; this.openCharSelect(); };
    $('btnCoop').onclick = () => { NET.detectRoom(); this.show('coopSel'); if (NET.useRoom) $('coopBlocked').classList.remove('hidden'); };
    $('btnBack1').onclick = () => this.show('cover'); $('btnBack2').onclick = () => this.show('modeSel'); $('btnBack3').onclick = () => this.show('modeSel');
    $('btnHost').onclick = () => NET.host($('nick').value.trim() || '플레이어');
    $('btnJoin').onclick = () => NET.join($('roomCode').value.trim().toUpperCase(), $('nick').value.trim() || '플레이어');
    $('btnLobbyStart').onclick = () => NET.startGame();
    // 상단 버튼
    $('tPhone').onclick = () => this.togglePhone(); $('tCards').onclick = () => this.openCards(); $('tRel').onclick = () => this.openRelations();
    $('tPause').onclick = () => this.togglePause(); $('tView').onclick = () => toggleView(); $('tSound').onclick = () => { muted = !muted; $('tSound').textContent = muted ? '🔇' : '🔊'; };
    $('modalClose').onclick = () => this.closeModal(); $('modal').onclick = e => { if (e.target.id === 'modal') this.closeModal(); };
    // 폰
    $('phoneClose').onclick = () => this.togglePhone(false);
    $('tabGroup').onclick = () => { this.phoneView = 'group'; this.renderPhone(); };
    $('tabDM').onclick = () => { this.phoneView = 'dmlist'; this.renderPhone(); };
    $('phoneSend').onclick = () => this.sendChat();
    $('phoneInput').addEventListener('keydown', e => { if (e.key === 'Enter') this.sendChat(); e.stopPropagation(); });
    $('dialog').onclick = () => this.advanceDialog();
    $('btnResume').onclick = () => this.togglePause(false);
    $('btnRetry').onclick = () => { $('failScr').classList.add('hidden'); if (G.mode === 'client') return; STORY.retry(); if (G.mode === 'host') NET.event({ e: 'retry' }); };
    document.querySelectorAll('[data-home]').forEach(b => b.onclick = () => location.reload());
  },
  show(id) { ['cover', 'modeSel', 'coopSel', 'lobby', 'charSel'].forEach(s => $(s).classList.toggle('hidden', s !== id)); },
  hideScreens() { ['cover', 'modeSel', 'coopSel', 'lobby', 'charSel'].forEach(s => $(s).classList.add('hidden')); },

  // ---------- 캐릭터 카드 ----------
  cardHTML(ch, small) {
    const bar = v => `<i style="width:${v * 10}%"></i>`;
    return `<div class="ccard ${small ? 'small' : ''}" data-id="${ch.id}" style="--c:${ch.color}">
      <div class="cimg"><img src="${small ? PORTRAIT[ch.id] : FULLBODY[ch.id]}"></div>
      <div class="cbody"><div class="cname">${ch.name}</div><div class="ctags">${ch.tags}</div>
      <div class="stats"><span>체력</span><b>${bar(ch.hp)}</b><em>${ch.hp}/10</em><span>공격력</span><b>${bar(ch.atk)}</b><em>${ch.atk}/10</em><span>스피드</span><b>${bar(ch.spd)}</b><em>${ch.spd}/10</em></div>
      <div class="cskill">★ ${ch.skill.name} <small>쿨타임 ${ch.skill.cd}초</small></div>
      ${small ? '' : `<div class="cdesc"><b>스킬</b> ${ch.skill.intro}</div><div class="cdesc"><b>효과</b> ${ch.skill.effect}</div>`}
      </div></div>`;
  },
  openCards(pick) {
    const html = `<h2>캐릭터 카드</h2><p class="sub">카드를 누르면 자세히 볼 수 있어요</p><div class="cgrid">${CHARS.map(c => this.cardHTML(c, true)).join('')}</div>`;
    this.modal(html);
    $('modalBody').querySelectorAll('.ccard').forEach(el => el.onclick = () => this.openCard(el.dataset.id, pick));
  },
  openCard(id, pick) {
    const ch = CHAR[id];
    this.modal(`<div class="cdetail">${this.cardHTML(ch)}</div><div class="row">${pick ? `<button class="go" id="pickThis">이 캐릭터로 시작</button>` : ''}<button id="backCards">← 카드 목록</button></div>`);
    $('backCards').onclick = () => pick ? this.openCharSelect() : this.openCards();
    if (pick) $('pickThis').onclick = () => { this.closeModal(); pick(id); };
  },
  openCharSelect() {
    this.show('charSel');
    const grid = $('charGrid'); grid.innerHTML = CHARS.map(c => this.cardHTML(c, true)).join('');
    const go = id => { this.hideScreens(); startGame([{ pid: 'me', ch: id }], 'me', this.pendingContinue && this.pendingContinue.me === id ? this.pendingContinue.ch : (this.pendingContinue ? this.pendingContinue.ch : 0)); };
    grid.querySelectorAll('.ccard').forEach(el => el.onclick = () => this.openCard(el.dataset.id, go));
  },
  // ---------- 관계도 ----------
  openRelations() {
    const W = 760, H = 640, cx = W / 2, cy = H / 2 + 10, R = 215;
    const pos = {};
    NAME_ORDER.forEach((id, i) => { const a = -Math.PI / 2 + i / 11 * Math.PI * 2; pos[id] = [cx + Math.cos(a) * R, cy + Math.sin(a) * R]; });
    pos.n1 = [cx - 70, cy - 30]; pos.n12 = [cx + 70, cy - 30]; pos.n13 = [cx, cy + 70]; pos.k13 = [cx, cy - 110];
    const node = id => CHAR[id] || EXTRA_NODES.find(n => n.id === id);
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="rel"><defs><clipPath id="cc"><circle r="26"/></clipPath></defs>`;
    RELATIONS.forEach(([a, b, t], i) => { const [x1, y1] = pos[a], [x2, y2] = pos[b];
      svg += `<g class="edge" data-i="${i}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><line class="hit" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/></g>`; });
    Object.keys(pos).forEach(id => { const n = node(id), [x, y] = pos[id], ch = CHAR[id];
      svg += `<g class="node" data-id="${id}" transform="translate(${x},${y})"><circle r="${ch ? 29 : 24}" fill="${n.color}" />` +
        (ch ? `<image href="${PORTRAIT[id]}" x="-26" y="-26" width="52" height="52" clip-path="url(#cc)"/>` : `<text class="num" y="6">${n.name.split(' ')[0]}</text>`) +
        `<text class="lab" y="${ch ? 46 : 40}">${ch ? ch.name : n.name}</text></g>`; });
    svg += '</svg>';
    this.modal(`<h2>인물 관계도</h2><p class="sub">인물이나 선을 누르면 관계가 보여요</p><div class="relwrap">${svg}<div id="relInfo" class="relinfo">《마지막 출석》 — 대구대학교 문헌정보학과 열한 명과 K-13</div></div>`);
    const info = $('relInfo');
    $('modalBody').querySelectorAll('.edge').forEach(el => el.onclick = () => { const [a, b, t] = RELATIONS[+el.dataset.i]; info.innerHTML = `<b>${node(a).name} ↔ ${node(b).name}</b><br>${esc(t)}`;
      $('modalBody').querySelectorAll('.edge').forEach(e => e.classList.remove('on')); el.classList.add('on'); });
    $('modalBody').querySelectorAll('.node').forEach(el => el.onclick = () => { const id = el.dataset.id, n = node(id);
      const rel = RELATIONS.filter(r => r[0] === id || r[1] === id).map(([a, b, t]) => `· ${node(a === id ? b : a).name}: ${esc(t)}`).join('<br>');
      info.innerHTML = `<b>${n.name}</b> ${CHAR[id] ? `<small>${n.tags}</small> <button class="mini" id="relCard">카드 보기</button>` : `<br>${esc(n.desc)}`}<br>${rel}`;
      $('modalBody').querySelectorAll('.edge').forEach(e => { const [a, b] = RELATIONS[+e.dataset.i]; e.classList.toggle('on', a === id || b === id); });
      const rc = $('relCard'); if (rc) rc.onclick = () => this.openCard(id); });
  },
  modal(html) { $('modalBody').innerHTML = html; $('modal').classList.remove('hidden'); if (G.mode === 'solo' && G.running) G.paused = true; },
  closeModal() { $('modal').classList.add('hidden'); if (G.mode === 'solo' && G.running && !this.pausedByUser && !STORY.failed) G.paused = false; },
  openFloors(u) {
    const B = inBuilding(u.x, u.z); if (!B || !B.stairs) return;
    const el = $('floorPanel'); el.classList.remove('hidden');
    el.innerHTML = `<b>${esc(B.name)}</b><small>${B.floors > 5 ? '엘리베이터' : '계단'} · 층을 고르세요</small><div class="fl">${Array.from({ length: B.floors }, (_, i) => `<button data-f="${i}" class="${i === (u.fl || 0) ? 'on' : ''}">${i + 1}F</button>`).join('')}</div><button class="x">닫기</button>`;
    if (G.mode === 'solo') G.paused = true;
    const close = () => { el.classList.add('hidden'); if (G.mode === 'solo' && !this.pausedByUser) G.paused = false; };
    el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { close(); changeFloor(u, +b.dataset.f); });
    el.querySelector('.x').onclick = close;
    if (document.exitPointerLock) document.exitPointerLock();
  },
  saved() { const el = $('saveInd'); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); },
  togglePause(v) {
    if (!G.running) return; const on = v === undefined ? $('pauseScr').classList.contains('hidden') : v;
    $('pauseScr').classList.toggle('hidden', !on); this.pausedByUser = on; if (G.mode === 'solo') G.paused = on;
  },

  // ---------- 대화 ----------
  dialog: null,
  dialogLines(lines, done) {
    const out = [];
    for (const [who, text] of lines) {
      if (text === '__ROLLCALL__' || text === '__ROLLCALL10__') out.push({ roll: text === '__ROLLCALL10__' ? 10 : 11 });
      else out.push({ who, text });
    }
    return out;
  },
  advanceDialog() {
    const D = this.dialog; if (!D || (D.cur && D.cur.roll) || (G.mode === 'client' && !D.local)) return;
    if (D.typing) { D.shown = D.cur.text.length; return; }
    D.i++; this.showLine();
  },
  showLine() {
    const D = this.dialog;
    if (G.mode === 'host') NET.event(D.i >= D.list.length ? { e: 'dlgend' } : { e: 'dlgi', i: D.i });
    if (D.i >= D.list.length) { $('dialog').classList.add('hidden'); $('rollcall').classList.add('hidden'); const d = D.done; this.dialog = null; if (G.mode === 'solo') G.paused = false; d && d(); return; }
    const L = D.list[D.i]; D.cur = L;
    if (L.roll) { $('dialog').classList.add('hidden'); this.rollcall(L.roll, () => { if (this.dialog !== D) return; D.i++; this.showLine(); }); return; }
    const box = $('dialog'); box.classList.remove('hidden');
    const narr = L.who === '*'; box.classList.toggle('narr', narr);
    $('dlgAv').innerHTML = narr ? '' : avatarHTML(L.who);
    $('dlgWho').textContent = narr ? '' : whoName(L.who); $('dlgWho').style.color = CHAR[L.who] ? CHAR[L.who].color : '#fff';
    D.shown = 0; D.typing = true; this.lines.push(L.text.replace(/["“”]/g, ''));
    if (this.lines.length > 30) this.lines.shift();
    if (D.auto && G.mode !== 'client') { clearTimeout(D.autoT); D.autoT = setTimeout(() => this.advanceDialog() || this.advanceDialog(), 1500 + L.text.length * 55); }
  },
  tickDialog(dt) {
    const D = this.dialog; if (!D || !D.cur || D.cur.roll) return;
    if (D.typing) { D.shown = Math.min(D.cur.text.length, D.shown + dt * 45); if (D.shown >= D.cur.text.length) D.typing = false; $('dlgTxt').textContent = D.cur.text.slice(0, Math.floor(D.shown)); }
  },
  rollcall(n, done) {
    const el = $('rollcall'); el.classList.remove('hidden');
    const order = n === 10 ? ['hyoseo', 'suyeon', 'seolwoo', 'eunbit', 'chaeyun', 'jihu', 'junhee', 'bonwoo', 'juwon', 'jueun'] : ROLL_ORDER;
    el.innerHTML = `<h3>출석체크</h3><div class="rl">${order.map((id, i) => `<div style="animation-delay:${i * 0.35}s">${avatarHTML(id)}<span>${CHAR[id].name}</span><b>${id === 'yujun' ? '있음' : id === 'seolwoo' ? '있습니다' : id === 'jihu' || id === 'chaeyun' ? '여기' : '있어'}</b></div>`).join('')}</div>
      <div class="cnt" style="animation-delay:${order.length * 0.35 + 0.2}s">${n}명</div>`;
    const fin = () => { el.onclick = null; el.classList.add('hidden'); done(); };
    const t = setTimeout(fin, order.length * 350 + 2200); el.onclick = () => { clearTimeout(t); fin(); };
  },
  chapterCard(ch, done) {
    const el = $('chapterCard'); el.innerHTML = `<div class="ct">${ch.title}</div><div class="cl">${ch.time} · ${ch.loc}</div>`;
    el.classList.remove('hidden'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    setTimeout(() => { el.classList.add('hidden'); done && done(); }, 2600);
  },
  banner(text, color, t) {
    const el = document.createElement('div'); el.className = 'bn'; el.textContent = text; el.style.color = color || '#fff';
    $('banners').appendChild(el); setTimeout(() => el.remove(), (t || 3.2) * 1000);
    while ($('banners').children.length > 3) $('banners').firstChild.remove();
    if (G.mode === 'host') NET.event({ e: 'banner', text, color, t });
  },
  cutin(u) {
    const el = $('cutin'); el.innerHTML = `${avatarHTML(u.ch.id)}<div><small>${u.ch.name} · SKILL</small><b style="color:${u.ch.color}">${u.ch.skill.name}</b></div>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  },
  refreshQuest() {
    const ch = CHAPTERS[G.chapterIdx]; if (!ch) return;
    const qs = ch.quests.map((q, i) => (STORY.questOverride && STORY.questOverride[i]) || q);
    const prog = q => q.type === 'collect' || (q.type === 'interact' && q.count) || q.type === 'kill' ? ` (${Math.min(G.qprog, q.count)}/${q.count})` : q.type === 'survive' ? ` (${Math.min(G.qprog, q.sec)}/${q.sec}초)` : q.type === 'gather' ? ` (${G.qprog}/${G.units.filter(u => !u.absent).length}명)` : '';
    $('questBox').innerHTML = `<div class="qt">${ch.title}</div>` + qs.map((q, i) => `<div class="q ${i < G.questIdx ? 'done' : i === G.questIdx ? 'cur' : ''}">${i < G.questIdx ? '✔' : i === G.questIdx ? '▶' : '·'} ${q.text}${i === G.questIdx ? prog(q) : ''}</div>`).join('') +
      `<details class="bm" ${this.bmOpen ? 'open' : ''}><summary>건물 미션 ${Object.keys(G.missionsDone).length}/${BUILDING_MISSIONS.length}</summary>${BUILDING_MISSIONS.map(m => `<div class="q ${G.missionsDone[m.id] ? 'done' : ''}">${G.missionsDone[m.id] ? '✔' : '★'} <b>${m.bld}</b> ${m.text}</div>`).join('')}</details>`;
    const d = $('questBox').querySelector('details'); d.ontoggle = () => this.bmOpen = d.open;
  },
  refreshInv() {
    const I = G.inv, items = [['bat', '🏏 배트'], ['ext', '🧯 소화기'], ['molotov', '🍾 화염병 재료'], ['fuse', '🔌 퓨즈'], ['supply', '📦 물자'], ['flashlight', '🔦 손전등'], ['radio', '📻 무전기'], ['pipe', '🔧 쇠파이프'], ['battery', '🔋 배터리']];
    $('invBox').innerHTML = items.filter(([k]) => I[k] > 0).map(([k, n]) => `<span>${n} ${I[k] > 1 ? '×' + I[k] : ''}</span>`).join('') || '<span class="dim">팀 소지품 없음</span>';
  },

  // ---------- 폰 / 카톡 ----------
  togglePhone(v) { const el = $('phone'); const on = v === undefined ? el.classList.contains('hidden') : v; el.classList.toggle('hidden', !on); if (on) { this.unread = 0; this.renderBadge(); this.renderPhone(); } },
  renderBadge() { const b = $('badge'); b.textContent = this.unread; b.classList.toggle('hidden', !this.unread); },
  kakao(from, text, isChat, to, remote) {
    const time = CHAPTERS[G.chapterIdx] ? CHAPTERS[G.chapterIdx].time.replace(/^.*?(오[전후]|새벽)/, '$1') : '';
    const msg = { from, text, time, sys: !CHAR[from] };
    const myc = G.me && G.me.ch.id;
    if (to) { if (from === myc || to === myc) { const other = from === myc ? to : from; (this.chat.dm[other] = this.chat.dm[other] || []).push(msg); } else { if (G.mode === 'host' && !remote) NET.event({ e: 'chat', from, text, to }); return; } }
    else this.chat.group.push(msg);
    this.lines.push(text); if (this.lines.length > 30) this.lines.shift();
    if (from !== (G.me && G.me.ch.id)) { if ($('phone').classList.contains('hidden')) { this.unread++; this.renderBadge(); this.toast(from, text); } sfx('msg'); }
    if (!$('phone').classList.contains('hidden')) this.renderPhone();
    if (G.mode === 'host' && !remote) NET.event({ e: 'chat', from, text, to });
  },
  toast(from, text) { const el = $('toast'); el.innerHTML = `${avatarHTML(from)}<div><b>${esc(whoName(from))}</b><span>${esc(text)}</span></div>`; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); },
  renderPhone() {
    const me = G.me ? G.me.ch.id : null, body = $('phoneBody');
    $('tabGroup').classList.toggle('on', this.phoneView === 'group'); $('tabDM').classList.toggle('on', this.phoneView !== 'group');
    $('phoneInputRow').classList.toggle('hidden', this.phoneView === 'dmlist');
    const bubble = m => m.sys ? `<div class="sysmsg" style="border-color:${(SPECIAL[m.from] || {}).color}">${esc(whoName(m.from))}<br>${esc(m.text)}</div>`
      : m.from === me ? `<div class="msg mine"><div class="bb">${esc(m.text)}</div><small>${m.time}</small></div>`
        : `<div class="msg">${avatarHTML(m.from)}<div><b>${whoName(m.from)}</b><div class="bb">${esc(m.text)}</div></div><small>${m.time}</small></div>`;
    if (this.phoneView === 'group') { $('phoneTitle').textContent = '공구방 (11)'; body.innerHTML = this.chat.group.map(bubble).join(''); }
    else if (this.phoneView === 'dmlist') {
      $('phoneTitle').textContent = '1:1 메시지';
      body.innerHTML = CHARS.filter(c => c.id !== me).map(c => { const l = (this.chat.dm[c.id] || []).slice(-1)[0];
        return `<div class="dmrow" data-id="${c.id}">${avatarHTML(c.id)}<div><b>${c.name}</b><span>${l ? esc(l.text) : c.tags}</span></div>${this.isPlayer(c.id) ? '<em>플레이어</em>' : ''}</div>`; }).join('');
      body.querySelectorAll('.dmrow').forEach(el => el.onclick = () => { this.phoneView = 'dm:' + el.dataset.id; this.renderPhone(); });
    } else { const id = this.phoneView.slice(3); $('phoneTitle').textContent = '← ' + CHAR[id].name; $('phoneTitle').onclick = () => { this.phoneView = 'dmlist'; this.renderPhone(); };
      body.innerHTML = (this.chat.dm[id] || []).map(bubble).join('') || `<div class="sysmsg">${CHAR[id].name}에게 메시지를 보내보세요</div>`; }
    body.scrollTop = body.scrollHeight;
  },
  isPlayer(id) { return G.units.some(u => u.ch.id === id && u.ctrl !== 'ai'); },
  sendChat() {
    const inp = $('phoneInput'), text = inp.value.trim(); if (!text || !G.me) return; inp.value = '';
    const me = G.me.ch.id, to = this.phoneView.startsWith('dm:') ? this.phoneView.slice(3) : null;
    if (G.mode === 'client') { NET.send({ t: 'chat', from: me, text, to }); this.kakao(me, text, true, to, true); return; }
    this.kakao(me, text, true, to);
    // NPC 응답
    if (to && !this.isPlayer(to)) setTimeout(() => this.kakao(to, DM_REPLY[to][(Math.random() * 3) | 0], true, me), 1200 + Math.random() * 1500);
    else if (!to && Math.random() < 0.7) { const ais = G.units.filter(u => u.ctrl === 'ai' && !u.absent); const u = ais[(Math.random() * ais.length) | 0]; if (u) setTimeout(() => this.kakao(u.ch.id, IDLE_CHAT[u.ch.id][(Math.random() * 3) | 0], true), 1500 + Math.random() * 2000); }
  },
  idleChat(dt) {
    if (G.mode === 'client' || !G.running || this.dialog) return;
    this.idleT = (this.idleT || 25) - dt; if (this.idleT > 0) return; this.idleT = rand(40, 75);
    const ais = G.units.filter(u => u.ctrl === 'ai' && !u.absent); const u = ais[(Math.random() * ais.length) | 0];
    if (u) this.kakao(u.ch.id, IDLE_CHAT[u.ch.id][(Math.random() * 3) | 0], true);
  },
  recentLines() { return this.lines.slice(-8); },

  // ---------- 실패 / 엔딩 ----------
  fail(reason) { $('failReason').textContent = reason; $('failScr').classList.remove('hidden'); $('btnRetry').classList.toggle('hidden', G.mode === 'client'); },
  ending() {
    if (G.mode === 'host') NET.broadcast({ t: 'ending' });
    G.running = false; this.togglePhone(false);
    const el = $('ending'); el.classList.remove('hidden');
    el.innerHTML = `<div class="etitle">마지막 출석</div><div class="rl">${ROLL_ORDER.map((id, i) => `<div style="animation-delay:${0.5 + i * 0.45}s">${avatarHTML(id)}<span>${CHAR[id].name}</span><b>${id === 'jueun' ? '……있어' : '있어'}</b></div>`).join('')}</div>
      <p class="epi" style="animation-delay:6s">그날 이후, 열한 명은 다시는 출석을 두려워하지 않았다.<br>그들에게 출석이란 더 이상 누가 살아 있는지를 확인하는 말이 아니었다.<br><b>그것은 서로를 기억하고 있다는 증거였다.</b></p>
      <p class="stat" style="animation-delay:7s">처치한 감염자 ${G.kills} · 건물 미션 ${Object.keys(G.missionsDone).length}/${BUILDING_MISSIONS.length}</p>
      <button class="go" data-home style="animation-delay:7.5s">처음으로</button>`;
    el.querySelector('[data-home]').onclick = () => { try { localStorage.removeItem('lastAttendance'); } catch (e) {} location.reload(); };
  },

  // ---------- HUD (캔버스) ----------
  drawHUD() {
    const c = hctx, W = innerWidth, H = innerHeight, portrait = H > W;
    c.clearRect(0, 0, W, H);
    if (!G.running) return;
    const scr = (x, y, z) => { tmpV.set(x, y, z).project(camera); return { x: (tmpV.x + 1) / 2 * W, y: (1 - tmpV.y) / 2 * H, ok: tmpV.z < 1 }; };
    c.textAlign = 'center'; c.textBaseline = 'middle';
    // 이름/체력
    for (const u of G.units) {
      if (u.absent || !sameFl(u, G.me || u)) continue; const p = scr(u.x, FY(u) + 2.25 * (u.ch.height / 172), u.z); if (!p.ok) continue;
      c.font = `800 ${u === G.me ? 13 : 11}px sans-serif`; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.75)'; c.strokeText(u.ch.name, p.x, p.y); c.fillStyle = u === G.me ? '#fff' : u.ch.color; c.fillText(u.ch.name, p.x, p.y);
      if (u.ctrl !== 'ai' && u !== G.me) { c.fillStyle = '#ffe066'; c.fillText('▼', p.x, p.y - 12); }
      if (u.hp < u.maxHp && u.state === 'active') this.bar(c, p.x - 18, p.y + 8, 36, 4, u.hp / u.maxHp, '#6be06b');
      if (u.state === 'down') { c.fillStyle = '#ff6b6b'; c.font = '800 12px sans-serif'; c.fillText(`쓰러짐 ${Math.ceil(u.downT)}s`, p.x, p.y + 12);
        c.strokeStyle = '#7dff7d'; c.lineWidth = 4; c.beginPath(); c.arc(p.x, p.y + 32, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (u.reviveT / 1.6)); c.stroke(); }
      if (u.hidden > 0) { c.fillStyle = '#ccc'; c.font = '700 11px sans-serif'; c.fillText('(숨는 중)', p.x, p.y + 12); }
      if (u.say) this.bubble(c, p.x, p.y - 26, u.say.text);
    }
    for (const z of G.zombies) {
      if (G.me && !sameFl(z, G.me)) continue; const p = scr(z.x, FY(z) + (z.kind === 'brute' ? 2.6 : 2.1), z.z); if (!p.ok || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) continue;
      if (z.hp < z.maxHp && z.kind !== 'n1' && z.kind !== 'mimic') this.bar(c, p.x - 15, p.y, 30, 4, z.hp / z.maxHp, '#e44');
      if (z.mark > 0) { c.strokeStyle = '#ff4a4a'; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y + 25, 14, 0, 7); c.stroke(); c.fillStyle = '#ff4a4a'; c.font = '900 12px sans-serif'; c.fillText('표식', p.x, p.y - 8); }
      if (z.stun > 0) { c.fillStyle = '#ffe066'; c.font = '900 13px sans-serif'; c.fillText('★', p.x, p.y - 8); }
      if (z.confused > 0) { c.fillStyle = '#fff'; c.font = '900 13px sans-serif'; c.fillText('?', p.x, p.y - 8); }
      if (z.root > 0) { c.fillStyle = '#ffd36b'; c.font = '900 11px sans-serif'; c.fillText('함정', p.x, p.y - 8); }
      if (z.kind === 'agent') { c.fillStyle = '#ffd36b'; c.font = '800 10px sans-serif'; c.fillText('K-13', p.x, p.y - 8); }
      if (z.say) { this.bubble(c, p.x, p.y - 22, z.say.text, '#ffdada'); z.say.t -= 1 / 60; if (z.say.t <= 0) z.say = null; }
    }
    // 떠다니는 글자
    for (const f of G.fx) if (f.type === 'text') { if (G.me && Math.abs((f.y || 0) - FY(G.me)) > 1) continue; const p = scr(f.x, (f.y || 0) + 2.4 + f.t * 1.2, f.z); if (!p.ok) continue; c.globalAlpha = Math.max(0, 1 - f.t / f.life); c.font = `900 ${f.size}px sans-serif`; c.lineWidth = 3; c.strokeStyle = '#000'; c.strokeText(f.text, p.x, p.y); c.fillStyle = f.color; c.fillText(f.text, p.x, p.y); c.globalAlpha = 1; }
    // 상호작용 / 목표
    const me = G.me;
    if (me && me.state === 'active') {
      const it = STORY.nearInteract(me);
      const stB = !it && stairsNear(me);
      if (stB) { const p = scr(me.x, FY(me) + 2.9, me.z); c.font = '800 14px sans-serif'; const t = `${isTouch ? '[사용]' : '[E]'} 계단 · 층 이동 (지금 ${(me.fl || 0) + 1}층 / ${stB.floors}층)`; const w = c.measureText(t).width + 18;
        c.fillStyle = 'rgba(0,0,0,.7)'; this.rr(c, p.x - w / 2, p.y - 13, w, 26, 8); c.fill(); c.fillStyle = '#ffe066'; c.fillText(t, p.x, p.y); }
      // 출입문 표시
      if (!(me.fl > 0) && !underground(me.x)) for (const b of WORLD.buildings) for (const d of b.doorsW) { const dd = Math.hypot(d.x - me.x, d.z - me.z); if (dd > 26) continue;
        const p = scr(d.x, 3.3, d.z); if (!p.ok || p.x < 0 || p.x > W || p.y < 0 || p.y > H) continue; c.font = '800 12px sans-serif'; c.fillStyle = 'rgba(0,0,0,.6)'; const t = '🚪 출입문', w = c.measureText(t).width + 12;
        this.rr(c, p.x - w / 2, p.y - 10, w, 20, 6); c.fill(); c.fillStyle = '#5dff8f'; c.fillText(t, p.x, p.y); }
      if (it) { const p = scr(it.x, FY(me) + 1.6, it.z); c.font = '800 14px sans-serif'; const t = `${isTouch ? '[사용]' : '[E]'} ${it.label}`; const w = c.measureText(t).width + 18;
        c.fillStyle = 'rgba(0,0,0,.7)'; this.rr(c, p.x - w / 2, p.y - 13, w, 26, 8); c.fill(); c.fillStyle = '#ffe066'; c.fillText(t, p.x, p.y); }
      for (const it of STORY.allInteracts()) { if (it.used || (it.enabled && !it.enabled()) || (it.fl || 0) !== (me.fl || 0)) continue; const p = scr(it.x, 1.2, it.z); if (!p.ok) continue; c.fillStyle = '#ffe066'; c.font = '900 16px sans-serif'; c.fillText('◆', p.x, p.y + Math.sin(G.t * 4) * 3); }
      for (const p0 of G.pickups) { if ((p0.fl || 0) !== (me.fl || 0)) continue; const p = scr(p0.x, FY(p0) + 1.3, p0.z); if (!p.ok || p.x < 0 || p.x > W || p.y < 0 || p.y > H) continue; c.font = '700 10px sans-serif'; c.fillStyle = p0.mission ? '#ffe066' : '#fff'; c.fillText((p0.mission ? '★ ' : '') + PICKNAME[p0.type], p.x, p.y); }
      const tgt = this.objectiveTarget();
      if (tgt) { const p = scr(tgt.x, 0.5, tgt.z), dist = Math.round(Math.hypot(tgt.x - me.x, tgt.z - me.z));
        const off = p.x < 30 || p.x > W - 30 || p.y < 80 || p.y > H - 60 || !p.ok;
        if (off) { const mp = scr(me.x, 1, me.z); let a = Math.atan2(p.y - mp.y, p.x - mp.x); if (!p.ok) a += Math.PI; const ex = clamp(W / 2 + Math.cos(a) * W, 40, W - 40), ey = clamp(H / 2 + Math.sin(a) * H, 90, H - 70);
          c.save(); c.translate(ex, ey); c.rotate(a); c.fillStyle = '#ffe066'; c.beginPath(); c.moveTo(16, 0); c.lineTo(-8, -10); c.lineTo(-8, 10); c.fill(); c.restore();
          c.font = '800 11px sans-serif'; c.fillStyle = '#ffe066'; c.fillText(`${tgt.label} ${dist}m`, ex - Math.cos(a) * 30, ey - Math.sin(a) * 22); }
        else { c.strokeStyle = '#ffe066'; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y, 16 + Math.sin(G.t * 5) * 3, 0, 7); c.stroke(); c.font = '800 12px sans-serif'; c.fillStyle = '#ffe066'; c.fillText(tgt.label, p.x, p.y - 26); }
      }
    }
    // 보스 체력
    const boss = G.zombies.find(z => z.kind === 'n1' || z.kind === 'mimic');
    if (boss) { const bw = Math.min(460, W - 40), y = H - (portrait ? 190 : 34); c.fillStyle = 'rgba(0,0,0,.65)'; this.rr(c, W / 2 - bw / 2 - 6, y - 22, bw + 12, 36, 8); c.fill();
      c.fillStyle = boss.kind === 'n1' ? '#ff8080' : '#ffb0b0'; c.font = '800 12px sans-serif'; c.fillText(boss.kind === 'n1' ? '1번 — 첫 번째 실험체' : '모방체 (4단계 감염자)', W / 2, y - 10); this.bar(c, W / 2 - bw / 2, y, bw, 8, boss.hp / boss.maxHp, '#d14b4b'); }
    this.drawParty(c, W, H, portrait); this.drawMinimap(c, W, H, portrait); this.drawSkill(c, W, H, portrait);
    // 조준점 (캐릭터 시점)
    if (G.view === 'chase' && !isTouch && me) { const cy = H / 2 - H * 0.04; c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2; c.beginPath(); c.moveTo(W / 2 - 9, cy); c.lineTo(W / 2 - 3, cy); c.moveTo(W / 2 + 3, cy); c.lineTo(W / 2 + 9, cy); c.moveTo(W / 2, cy - 9); c.lineTo(W / 2, cy - 3); c.moveTo(W / 2, cy + 3); c.lineTo(W / 2, cy + 9); c.stroke(); }
    // 스태미나 (달리기)
    if (me) { const bw = Math.min(220, W * 0.4), x = W / 2 - bw / 2, y = H - (portrait ? 150 : 44); c.font = '700 11px sans-serif'; c.fillStyle = me.running ? '#ffe066' : '#ccc'; c.fillText(`🏃 달리기 ${Math.round(me.stamina)}`, W / 2, y - 9);
      this.bar(c, x, y, bw, 5, me.stamina / 100, me.tired > 0 ? '#ff7b7b' : '#ffe066'); }
    if (G.night > 0.3 || (me && underground(me.x))) { const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,10,.55)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    if (me && me.hurt > 0) { c.fillStyle = `rgba(200,0,0,${me.hurt * 0.8})`; c.fillRect(0, 0, W, H); }
  },
  objectiveTarget() {
    const q = STORY.quest(); if (!q) return null;
    const A = q.area ? WORLD.areas[q.area] : q.at ? WORLD.areas[q.at] : null; if (A) return { x: A.x, z: A.z, label: A.label };
    if (q.type === 'interact') { const it = STORY.allInteracts().find(i => i.id === q.id && !i.used); if (it) return { x: it.x, z: it.z, label: it.label }; }
    if (q.type === 'collect') { const p = G.pickups.filter(p => p.type === q.item || (q.item === 'storage' && p.type === 'storage')).sort((a, b) => D2(a, G.me) - D2(b, G.me))[0]; if (p) return { x: p.x, z: p.z, label: PICKNAME[p.type] }; }
    if (q.type === 'revive') { const u = unitByCh(q.id); if (u) return { x: u.x, z: u.z, label: u.ch.name }; }
    if (q.type === 'boss') { const b = G.zombies.find(z => z.kind === 'n1'); if (b) return { x: b.x, z: b.z, label: '1번' }; }
    if (q.type === 'kill') { const z = nearestZombie(G.me, 80); if (z) return { x: z.x, z: z.z, label: '감염자' }; }
    return null;
  },
  drawParty(c, W, H, portrait) {
    const list = G.units.filter(u => !u.absent), rowH = portrait ? 0 : H < 520 ? 21 : 30, x0 = 10, y0 = 60;
    if (portrait || H < 520) { // 세로/낮은 화면: 상단 가로줄
      const n = list.length, w = Math.min(34, (W - 20) / n);
      list.forEach((u, i) => { const x = 10 + i * w, y = 52; const im = PORTRAIT_IMG[u.ch.id];
        c.globalAlpha = u.state === 'active' ? 1 : 0.4; if (im && im.complete) c.drawImage(im, x, y, w - 4, w - 4); c.globalAlpha = 1;
        this.bar(c, x, y + w - 2, w - 4, 3, u.hp / u.maxHp, u.state === 'down' ? '#f55' : '#6be06b');
        if (u === G.me) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(x, y, w - 4, w - 4); } });
      return;
    }
    list.forEach((u, i) => { const y = y0 + i * rowH; const im = PORTRAIT_IMG[u.ch.id];
      c.fillStyle = u === G.me ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.45)'; this.rr(c, x0, y, 150, rowH - 3, 6); c.fill();
      c.globalAlpha = u.state === 'active' ? 1 : 0.45; if (im && im.complete) c.drawImage(im, x0 + 2, y + 1, rowH - 5, rowH - 5); c.globalAlpha = 1;
      c.textAlign = 'left'; c.font = '700 11px sans-serif'; c.fillStyle = u.state === 'down' ? '#ff8080' : '#fff'; c.fillText(u.ch.name + (u.ctrl !== 'ai' && u !== G.me ? ' ●' : ''), x0 + rowH, y + 9);
      this.bar(c, x0 + rowH, y + 17, 150 - rowH - 22, 5, u.hp / u.maxHp, u.state === 'down' ? '#f55' : '#6be06b');
      const rdy = u.skillCd <= 0 && !skillReady(u); c.fillStyle = rdy ? '#7dff7d' : '#555'; c.beginPath(); c.arc(x0 + 140, y + 13, 4, 0, 7); c.fill(); c.textAlign = 'center'; });
  },
  drawMinimap(c, W, H, portrait) {
    const me = G.me; if (!me) return; const ug = underground(me.x);
    const mw = portrait ? 110 : 170, mh = mw * 0.85, mx = W - mw - 10, my = portrait ? 92 : 52;
    const bx0 = ug ? UG_X - 45 : MAP.x0, bx1 = ug ? UG_X + 45 : MAP.x1, bz0 = ug ? (me.z > 70 ? 95 : -30) : MAP.z0, bz1 = ug ? (me.z > 70 ? 165 : 30) : MAP.z1;
    const k = Math.min(mw / (bx1 - bx0), mh / (bz1 - bz0)), P = (x, z) => [mx + (x - bx0) * k, my + (z - bz0) * k];
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(mx - 3, my - 3, mw + 6, mh + 6); c.fillStyle = ug ? '#2a2c30' : '#3d5a2e'; c.fillRect(mx, my, (bx1 - bx0) * k, (bz1 - bz0) * k);
    if (!ug) { for (const b of WORLD.buildings) { const [x, z] = P(b.x0, b.z0); c.fillStyle = b === inBuilding(me.x, me.z) ? '#d9c79a' : '#9c8d74'; c.fillRect(x, z, b.w * k, b.d * k); }
      const F = WORLD.field, [fx0, fz0] = P(F.x - F.w / 2, F.z - F.d / 2); c.fillStyle = '#8a4a32'; c.fillRect(fx0, fz0, F.w * k, F.d * k);
      c.fillStyle = '#3f7fb5'; for (const W2 of WORLD.walls) if (W2.tag === 'lake') { const [x, z] = P(W2.x, W2.z); c.fillRect(x, z, W2.w * k, W2.d * k); } }
    else { c.fillStyle = '#555'; for (const W2 of WORLD.walls) if (W2.x > UG_X - 60) { const [x, z] = P(W2.x, W2.z); c.fillRect(x, z, Math.max(1, W2.w * k), Math.max(1, W2.d * k)); } }
    if (!ug) { c.fillStyle = '#5dff8f'; for (const b of WORLD.buildings) for (const d of b.doorsW) { const [x, y] = P(d.x, d.z); c.fillRect(x - 1.5, y - 1.5, 3, 3); } }
    c.fillStyle = '#ff4040'; for (const z of G.zombies) { if (z.kind === 'agent' && !G.inv.radio && D2(z, me) > 30) continue; const [x, y] = P(z.x, z.z); if (x < mx || x > mx + mw || y < my || y > my + mh) continue; const s = z.kind === 'n1' || z.kind === 'mimic' ? 4 : 1.6; c.fillStyle = z.kind === 'agent' ? '#ffd36b' : '#ff4040'; c.fillRect(x - s / 2, y - s / 2, s, s); }
    for (const p of G.pickups) if (p.mission && !ug) { const [x, y] = P(p.x, p.z); c.fillStyle = '#ffe066'; c.font = '9px sans-serif'; c.fillText('★', x, y); }
    for (const u of G.units) { if (u.absent) continue; const [x, y] = P(u.x, u.z); c.fillStyle = u === G.me ? '#fff' : u.ctrl !== 'ai' ? '#ffe066' : u.state === 'down' ? '#f55' : '#7dff7d'; c.beginPath(); c.arc(x, y, u === G.me ? 3.5 : 2.3, 0, 7); c.fill(); }
    const t = this.objectiveTarget(); if (t) { const [x, y] = P(t.x, t.z); c.strokeStyle = '#ffe066'; c.lineWidth = 2; c.beginPath(); c.arc(clamp(x, mx, mx + mw), clamp(y, my, my + mh), 5 + Math.sin(G.t * 5) * 1.5, 0, 7); c.stroke(); }
    c.font = '700 10px sans-serif'; c.fillStyle = '#fff'; c.fillText(ug ? (me.z > 70 ? 'K-13 연구소 (지하)' : '지하 주차장') : (inBuilding(me.x, me.z) ? inBuilding(me.x, me.z).name + ` · ${(me.fl || 0) + 1}층` : '대구대 경산캠퍼스'), mx + mw / 2, my + mh + 11);
  },
  drawSkill(c, W, H, portrait) {
    const me = G.me; if (!me) return; const el = $('bSkill'); const cd = Math.max(0, me.skillCd), why = skillReady(me);
    el.style.setProperty('--p', `${(1 - cd / me.ch.skill.cd) * 360}deg`); el.innerHTML = `<b>${me.ch.skill.name}</b><small>${why ? why : cd > 0 ? Math.ceil(cd) + '초' : (isTouch ? '준비' : 'Space')}</small>`;
    el.classList.toggle('ready', cd <= 0 && !why);
  },
  bar(c, x, y, w, h, k, col) { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x - 1, y - 1, w + 2, h + 2); c.fillStyle = col; c.fillRect(x, y, w * clamp(k, 0, 1), h); },
  rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); },
  bubble(c, x, y, text, bg) { c.font = '700 12px sans-serif'; const w = Math.min(220, c.measureText(text).width + 16); c.fillStyle = bg || 'rgba(255,255,255,.95)'; this.rr(c, x - w / 2, y - 12, w, 24, 8); c.fill(); c.fillStyle = '#111'; c.fillText(text, x, y, 206); },
};
// dialog() 진입점 (STORY에서 호출)
UI.dialogStart = function (lines, done, auto) {
  this.dialog = { list: this.dialogLines(lines), i: 0, done, auto: auto || G.mode !== 'solo' };
  if (G.mode === 'solo') G.paused = true;
  if (G.mode === 'host') NET.event({ e: 'dialog', lines });
  this.showLine();
};
