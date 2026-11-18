'use strict';
// ============================================================
//  시작 / 메인 루프
// ============================================================
function startGame(players, myPid, chIdx) {
  clearZombies(); G.units.forEach(u => scene.remove(u.model)); G.units = []; G.nextId = 1; G.inv = {}; G.kills = 0;
  const save = loadProgress(); if (save && save.missions && chIdx > 0) G.missionsDone = save.missions;
  CHARS.forEach((ch, i) => makeUnit(ch, 0, 0));
  for (const p of players) { const u = unitByCh(p.ch); if (!u) continue; u.ctrl = p.pid === myPid ? 'local' : 'remote'; u.player = p.name; if (p.pid === myPid) G.me = u; }
  if (chIdx > 0) { G.inv = { bat: 2, ext: 3, molotov: 2 }; }
  equipTeam();
  G.running = true; G.paused = false; document.body.classList.add('playing');
  if (isTouch) document.body.classList.add('touch');
  G.zoom = innerHeight > innerWidth ? 24 : 26;
  if (G.mode === 'client') { G.chapterIdx = chIdx; const ch = CHAPTERS[chIdx]; const sp = WORLD.spawns[ch.start]; G.me.x = sp.x; G.me.z = sp.z; setNight(ch.night); UI.refreshQuest(); UI.refreshInv(); }
  else STORY.start(chIdx);
  camera.position.set(G.me.x, 40, G.me.z + 30);
}
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G.running) {
    UI.tickDialog(dt);
    const hostWait = G.mode === 'host' && UI.dialog;
    if (G.mode === 'client') { updateGame(dt); updateProjectiles(dt); updateFx(dt); NET.clientTick(dt); for (const u of G.units) if (u.say && (u.say.t -= dt) <= 0) u.say = null; }
    else if (!G.paused && !hostWait) { updateGame(dt); STORY.tick(dt); updateFx(dt); UI.idleChat(dt); }
    if (G.mode === 'host') NET.hostTick(dt);
    if (G.questIdxShown !== G.questIdx + '/' + G.qprog) { G.questIdxShown = G.questIdx + '/' + G.qprog; UI.refreshQuest(); }
  }
  if (!G.running) { const t = now / 1000 * 0.05; camera.position.set(Math.sin(t) * 95, 46, -40 + Math.cos(t) * 95); camera.lookAt(0, 4, -40); updateZombies(dt); }
  syncModels(dt); updateCamera(dt);
  renderer.render(scene, camera);
  UI.drawHUD();
  requestAnimationFrame(loop);
}
window.addEventListener('load', () => {
  initRenderer(); initInput(); UI.init();
  G.me = null; setNight(0.55); for (let i = 0; i < 40; i++) spawnAround(i % 4 ? 'walker' : 'runner', 0, -10, 5, 70);
  requestAnimationFrame(loop);
});
