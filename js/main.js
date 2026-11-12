// Главный модуль: состояние игры, интерфейс, цикл моделирования
import { simulate, fmt, cabs, IZ, MM2 } from './sim.js';
import { DEFS, CATS, newComp } from './defs.js';
import { Scene3D } from './scene3d.js';
import { Schematic } from './schematic.js';
import { LEVELS } from './levels.js';
import { ARTICLES, BOOK_ORDER } from './articles.js';
import './defs2.js';
import { CHAPTERS, SKILLS, RANKS, quizQuestion } from './levels2.js';
import { EXPLAIN, SECTIONS } from './explain.js';
import { ARTICLES2, BOOK2 } from './articles2.js';
import './levels3.js';
import './defs3.js';
import { CH_ORDER } from './levels4.js';
import './content4.js';
import './defs4.js';
import { initRead } from './readui.js';
import { diagnose } from './diag.js';
import { initLabs } from './labui.js';
Object.assign(ARTICLES, ARTICLES2);

const $ = id => document.getElementById(id);
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem('elab.' + k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem('elab.' + k, JSON.stringify(v)); } catch { } } };
let progress = store.get('progress', {});

const game = {
  circuit: { comps: [], wires: [] }, selected: null, placeType: null, showVals: true, level: null, mode: 'menu',
  flags: new Set(), done: 0, hold: 0, burns: 0, usedSol: false, hintN: 0, wn: 0, un: 0,
  select(o) { this.selected = o; updateFab(); if (this.scene.inspectId && (!o || o.id !== this.scene.inspectId)) this.scene.inspect(null); renderInspector(); },
  hud(t) { $('hud').textContent = t || defaultHud(); },
  changed(light) { if (!light) { renderInspector(); if (this.mode === 'sandbox') saveSandbox(); } },
  addComp(type, x, y) {
    const d = DEFS[type], nums = this.circuit.comps.filter(c => DEFS[c.type].mark === d.mark).map(c => +c.label.replace(/\D/g, '') || 0);
    const c = newComp(type, 'u' + (++this.un) + 'x' + Date.now() % 100000, x, y, (this.level && this.level.defaults && this.level.defaults[type]) || {});
    c.label = d.mark + (Math.max(0, ...nums) + 1);
    this.circuit.comps.push(c); this.scene.addComp(c); this.placeType = null; this.scene.ghost.visible = false; renderPalette(); this.select(c); this.changed(); this.hud('');
  },
  addWire(a, b) {
    const ws = this.circuit.wires; if (ws.some(w => (same(w.a, a) && same(w.b, b)) || (same(w.a, b) && same(w.b, a)))) return;
    const w = { a, b, mm2: (this.level && this.level.wire) || 2.5, n: this.wn++ }; ws.push(w); this.scene.addWire(w); this.select(w); this.changed();
  },
  remove(o) {
    if (!o) return; const ci = this.circuit;
    if (o.type) { if (o.fixed) { toast('warn', 'Это устройство — часть задания, удалить нельзя (но можно передвинуть)'); return; } ci.wires.filter(w => w.a.c === o.id || w.b.c === o.id).forEach(w => this.scene.removeWire(w)); ci.wires = ci.wires.filter(w => w.a.c !== o.id && w.b.c !== o.id); ci.comps = ci.comps.filter(c => c !== o); this.scene.removeComp(o.id); }
    else { ci.wires = ci.wires.filter(w => w !== o); this.scene.removeWire(o); }
    this.select(null); this.changed();
  },
};
const same = (p, q) => p.c === q.c && p.t === q.t;
const defaultHud = () => game.placeType ? `Кликни по панели, чтобы поставить: ${DEFS[game.placeType].name} (Esc — отмена)` : game.scene && game.scene.pend ? 'Теперь кликни по второй клемме (Esc — отмена)' : '';
game.termClick = function (ref) {   // клик по выводу на листе схемы
  if (this.mode !== 'draw') return this.scene.clickTerm(ref);
  if (!this.pendRef) { this.pendRef = ref; this.hud('Теперь кликни по второму выводу (Esc — отмена)'); return; }
  const a = this.pendRef; this.pendRef = null; this.hud(''); if (!same(a, ref)) this.addWire(a, ref);
};
window.game = game;

// ---------- загрузка схем ----------
const parseWire = s => { const [a, b, mm, len] = s.split(' '), i = a.indexOf('.'), j = b.indexOf('.'); return { a: { c: a.slice(0, i), t: a.slice(i + 1) }, b: { c: b.slice(0, j), t: b.slice(j + 1) }, mm2: +mm || 2.5, n: game.wn++, ...(len ? { len: +len } : {}) }; };
const mkComps = (list, fixed) => (list || []).map(([id, type, x, y, p, st]) => { const c = newComp(type, id, x, y, p); c.fixed = fixed; if (st) Object.assign(c.state, st); return c; });
function load(spec, fixed) {
  game.wn = 0; game.circuit = { comps: mkComps(spec.comps, fixed), wires: (spec.wires || []).map(parseWire) };
  game.selected = null; game.placeType = null; game.diag = []; game.seen = new Set(); game.diagReady = false; game.blocked = false; game.flags = new Set(); game.done = 0; game.hold = 0; game.burns = 0; game.usedSol = false; game.hintN = 0;
  game.scene.rebuild(); game.sch.vb = null; renderPalette(); renderInspector();
}
function show(screen) {
  if (screen === 'menu') { labs.quit(); rd.quit(); }
  game.scene.game = game; game.scene.readonly = false; game.scene.blind = false; game.sch.game = game; game.ref = null; game.pendRef = null; game.sheet = null;   // после «Чтения схем» панели снова показывают одну цепь
  $('menu').classList.toggle('hidden', screen !== 'menu'); $('game').classList.toggle('hidden', screen === 'menu'); if (screen === 'menu') { game.mode = 'menu'; renderMenu(); } }
function setXray(on) { game.scene.setXray(on); $('btnXray').classList.toggle('on', on); }
function startLevel(i) {
  const L = LEVELS[i]; game.level = L; game.li = i; game.mode = 'level'; show('game'); load(L, true); setXray(false); game.scene.resetView();
  $('lvlTitle').textContent = `${i + 1}. ${L.title} · ${L.u}`; ['btnTask', 'btnHint', 'btnSolve'].forEach(b => $(b).classList.remove('hidden')); showTask();
}
function startSandbox(spec, title) {
  game.level = null; game.mode = spec ? 'demo' : 'sandbox'; show('game');
  const s = spec || store.get('sandbox', { comps: [], wires: [] }); load({ comps: s.comps, wires: s.wires }, false);
  if (!spec && s.labels) game.circuit.comps.forEach((c, k) => c.label = s.labels[k] || c.label);
  setXray(!!(spec && spec.xray)); if (spec && spec.focus) game.scene.focus(...spec.focus); else game.scene.resetView();
  $('lvlTitle').textContent = title || 'Свободная сборка'; ['btnTask', 'btnHint', 'btnSolve'].forEach(b => $(b).classList.add('hidden'));
  if (!spec && !s.comps.length) toast('', 'Выбери устройство слева и кликни по панели. Клеммы соединяются кликами: одна → другая.');
}
function saveSandbox() { const c = game.circuit; store.set('sandbox', { comps: c.comps.map(k => [k.id, k.type, k.x, k.y, k.p]), labels: c.comps.map(k => k.label), wires: c.wires.map(w => `${w.a.c}.${w.a.t} ${w.b.c}.${w.b.t} ${w.mm2}`) }); }
// собранная схема уровня: исходные устройства + решение
function solved(L) {
  const s = L.sol; let comps = [...L.comps], wires = [...(L.wires || [])];
  if (Array.isArray(s)) wires = s; else { if (s.comps) comps = [...comps, ...s.comps]; if (s.drop) wires = wires.slice(0, -s.drop); if (s.wires) wires = s.drop ? [...wires, ...s.wires] : s.wires; if (s.add) wires = [...wires, ...s.add]; }
  return { comps, wires, patch: s.patch, skip: s.skip || 0 };
}
function applySolution() {
  const L = game.level, S = solved(L); load({ comps: S.comps, wires: S.wires }, true); game.usedSol = true;
  game.circuit.comps.forEach(c => c.fixed = L.comps.some(x => x[0] === c.id)); if (S.patch) S.patch(helper); game.done = S.skip;
  game.scene.rebuild(); renderInspector();
  toast('', '🧩 Схема собрана. Остальные шаги (кнопки, параметры) выполни сам — смотри список целей справа.');
}

// ---------- помощник для проверок целей ----------
const helper = {
  get circuit() { return game.circuit; }, get flags() { return game.flags; }, IZ,
  c: id => game.circuit.comps.find(c => c.id === id), all: t => game.circuit.comps.filter(c => c.type === t),
  v(c, t) { const n = game.circuit.net; return n ? cabs(n.v(n.node(c.id + '.' + t))) : 0; },
  wired: (c, t) => game.circuit.wires.some(w => (w.a.c === c.id && w.a.t === t) || (w.b.c === c.id && w.b.t === t)),
  grounded(c, t) { const n = game.circuit.net; return n ? n.grounded(n.node(c.id + '.' + t)) : false; },
  diag: () => game.diag || [],
};

// ---------- сообщения ----------
function toast(kind, msg, ms = 6500) { const d = document.createElement('div'); d.className = 'toast ' + (kind === 'warn' ? '' : kind); d.textContent = msg; $('toasts').appendChild(d); while ($('toasts').children.length > 4) $('toasts').firstChild.remove(); setTimeout(() => d.remove(), ms); }
function emit(kind, msg, flag) { toast(kind, msg); if (flag) game.flags.add(flag); if (flag === 'burn') { game.burns++; labs.burn(); } if (flag === 'short' || flag === 'burn') { const f = $('flash'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 60); } }
function modal(html) { $('modalBody').innerHTML = html; $('modal').classList.remove('hidden'); $('modalBox').scrollTop = 0; }
const closeModal = () => $('modal').classList.add('hidden');
$('modalClose').onclick = closeModal; $('modal').addEventListener('pointerdown', e => { if (e.target === $('modal')) closeModal(); });

function goalsHtml() {
  const L = game.level; if (!L) return '';
  return '<ol style="padding-left:20px;margin:6px 0">' + L.goals.map((g, i) => `<li style="margin:5px 0;color:${i < game.done ? '#3fbf6a' : i === game.done ? '#fff' : '#7f93a8'}">${i < game.done ? '✔ ' : ''}${g.t}</li>`).join('') + '</ol>';
}
function showTask() { const L = game.level; modal(`<h2>${L.title} <small style="color:#9fb0c3">· ${L.u}</small></h2>${L.theory}<h3>Задание</h3>${goalsHtml()}<div class="actions"><button class="primary" id="mGo">Начать</button><button id="mArt">📖 Подробнее в справочнике</button></div>`); $('mGo').onclick = closeModal; $('mArt').onclick = () => showArticle(L.art); }
function win() {
  if (game.mode !== 'level' || !game.level || game.done < game.level.goals.length) return;   // пока шёл таймер, игрок мог уйти в меню
  const L = game.level, stars = Math.max(1, 3 - (game.burns ? 1 : 0) - (game.usedSol ? 1 : 0)); progress[L.id] = Math.max(progress[L.id] || 0, stars); store.set('progress', progress);
  const next = game.li + 1 < LEVELS.length, r = rank();
  modal(`<h2>Уровень пройден! ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</h2><p>${game.burns ? 'Что-то сгорело по дороге — минус звезда. ' : ''}${game.usedSol ? 'Использовано готовое решение — минус звезда. ' : ''}${stars === 3 ? 'Чистая работа: ничего не сгорело, решено самостоятельно.' : ''}</p><p>Навыки: ${(L.sk || []).map(k => `<b style="color:#8cc8ff">${SKILLS[k]}</b> +${stars * 10}`).join(', ')}. Разряд: <b style="color:#ffd23f">${r.name}</b> (${r.xp} очков опыта)</p>
    <div class="actions">${next ? '<button class="primary" id="mNext">Следующий уровень →</button>' : ''}<button id="mStay">Остаться и поэкспериментировать</button><button id="mMenu">В меню</button></div>`);
  if (next) $('mNext').onclick = () => { closeModal(); startLevel(game.li + 1); }; $('mStay').onclick = closeModal; $('mMenu').onclick = () => { closeModal(); show('menu'); };
}
function checkGoals() {
  const L = game.level; if (!L || game.done >= L.goals.length) return; let ok = false; try { ok = !!L.goals[game.done].ok(helper); } catch { ok = false; }
  const last = game.done === L.goals.length - 1, crit = (game.diag || []).filter(x => x.sev === 'crit');
  if (ok && last && crit.length && !L.lax) { if (!game.blocked) { game.blocked = true; toast('warn', '🕵 Схема работает, но Инспектор её не принимает: ' + crit[0].text + '. Исправь замечания в правой панели.', 9000); updateDiag(true); } game.hold = 0; return; }
  game.blocked = false; game.hold = ok ? game.hold + 1 : 0;
  if (game.hold >= 6) { game.hold = 0; game.done++; toast('good', '✔ Цель выполнена: ' + L.goals[game.done - 1].t.slice(0, 70) + '…', 4000); renderInspector(); if (game.done >= L.goals.length) setTimeout(win, 900); }
}

// ---------- справочник ----------
function showBook() { const li = a => a.map(k => `<button data-a="${k}">${ARTICLES[k].title}</button>`).join(''); modal('<h2>📖 Справочник</h2><h3>Разборы схем: что, зачем и почему именно так</h3><div class="booklist">' + li(BOOK2) + '</div><h3>Законы и устройства</h3><div class="booklist">' + li(BOOK_ORDER) + '</div>'); $('modalBody').querySelectorAll('[data-a]').forEach(b => b.onclick = () => showArticle(b.dataset.a)); }
function showArticle(k) {
  const a = ARTICLES[k]; if (!a) return showBook(); const DL = a.lvl && LEVELS.find(l => l.id === a.lvl);
  modal(`<h2>${a.title}</h2>${a.html}<div class="actions">${a.demo || DL ? '<button class="primary" id="mDemo">🔍 Показать в 3D (живая схема)</button>' : ''}<button id="mBook">← Все статьи</button></div>`);
  $('mBook').onclick = showBook; if (a.demo || DL) $('mDemo').onclick = () => { closeModal(); if (a.demo) startSandbox(a.demo, 'Демо: ' + a.title); else { const S = solved(DL); startSandbox({ comps: S.comps, wires: S.wires }, 'Демо: ' + a.title); if (S.patch) { S.patch(helper); game.scene.rebuild(); } } toast('', 'Это живая схема: кликай по аппаратам, меняй параметры, добавляй своё. «Разрез» показывает внутренности.'); };
}

// ---------- меню, палитра, инспектор ----------
function skillXp() { const xp = {}; for (const k in SKILLS) xp[k] = [0, 0]; for (const L of LEVELS) for (const k of L.sk || []) { xp[k][0] += (progress[L.id] || 0) * 10; xp[k][1] += 30; } const q = store.get('quiz', 0); xp.calc[0] += Math.min(60, q); xp.calc[1] += 60; return xp; }
function rank() { const x = skillXp(); let xp = 0; for (const L of LEVELS) xp += (progress[L.id] || 0) * 10; xp += Math.min(60, store.get('quiz', 0)) + labs.xp() + rd.xp(); x.read[0] += rd.xp(); x.read[1] += rd.max(); let i = 0; while (i + 1 < RANKS.length && xp >= RANKS[i + 1][0]) i++; return { xp, name: RANKS[i][1], next: RANKS[i + 1], skills: x }; }
function renderMenu() {
  const r = rank(), card = (L, i) => `<div class="lvl ${progress[L.id] ? 'done' : ''}" data-i="${i}"><span class="u">${L.u}</span><div class="n">Квест ${i + 1} ${progress[L.id] ? '★'.repeat(progress[L.id]) + '☆'.repeat(3 - progress[L.id]) : ''}</div><div class="t">${L.title}</div><div class="d">${L.desc}</div><div class="sk">${(L.sk || []).map(k => SKILLS[k]).join(' · ')}</div></div>`;
  $('rankBox').innerHTML = `<div class="rank">🎓 ${r.name} <small>${r.xp} оп.${r.next ? ' · до «' + r.next[1] + '» ещё ' + (r.next[0] - r.xp) : ''}</small></div><div class="skills">` + Object.keys(SKILLS).map(k => `<div class="skill"><span>${SKILLS[k]}</span><div class="bar"><i style="width:${Math.round(100 * r.skills[k][0] / Math.max(1, r.skills[k][1]))}%"></i></div></div>`).join('') + '</div>';
  let qn = 0; const num = {}; for (const ci of CH_ORDER) LEVELS.forEach((L, i) => { if (L.ch === ci) num[i] = ++qn; });
  $('levelGrid').innerHTML = CH_ORDER.map(ci => `<h2>${CHAPTERS[ci]}</h2><div class="lgrid">` + LEVELS.map((L, i) => L.ch === ci ? card(L, i).replace('Квест ' + (i + 1), 'Квест ' + num[i]) : '').join('') + '</div>').join('');
  $('levelGrid').innerHTML += '<h2>🔬 Лабораторные работы · как в университете</h2><p style="color:#9fb0c3;margin:-4px 0 10px">Допуск → расчёт до опыта → измерения → обработка → защита. 12 вариантов у каждой работы, оценка по 100-балльной шкале.</p><div class="lgrid">' + labs.menuHtml() + '</div>';
  $('levelGrid').innerHTML += '<h2>🧩 Чтение схем · новичок, средний, хардкор</h2>' + rd.menuHtml();
  $('levelGrid').querySelectorAll('.lvl[data-i]').forEach(d => d.onclick = () => startLevel(+d.dataset.i)); labs.bindMenu($('levelGrid')); rd.bindMenu($('levelGrid'));
}
// ---------- экзамен ----------
function quiz(n = 0, score = 0) {
  if (n >= 5) { const add = score * 3; store.set('quiz', store.get('quiz', 0) + add); modal(`<h2>Экзамен: ${score} из 5</h2><p>Навык «Расчёты» +${add} (за экзамены засчитывается до 60 очков).</p><div class="actions"><button class="primary" id="qAgain">Ещё 5 вопросов</button><button id="qClose">Закрыть</button></div>`); $('qAgain').onclick = () => quiz(); $('qClose').onclick = () => { closeModal(); renderMenu(); }; return; }
  const q = quizQuestion();
  modal(`<h2>Экзамен · вопрос ${n + 1} из 5</h2><p style="font-size:17px">${q.q}</p><div class="actions" id="qOpts">${q.opts.map((o, i) => `<button data-i="${i}" style="min-width:110px;font-size:16px">${o}</button>`).join('')}</div><div id="qRes"></div>`);
  $('qOpts').querySelectorAll('button').forEach(b => b.onclick = () => {
    const ok = +b.dataset.i === q.a; $('qOpts').querySelectorAll('button').forEach((x, i) => { x.disabled = true; if (i === q.a) x.classList.add('primary'); }); if (!ok) b.classList.add('danger');
    $('qRes').innerHTML = `<p>${ok ? '✔ Верно.' : '✘ Неверно.'} <span class="f">${q.expl}</span></p><div class="actions"><button class="primary" id="qNext">Дальше →</button></div>`; $('qNext').onclick = () => quiz(n + 1, score + (ok ? 1 : 0));
  });
}
function renderPalette() {
  const L = game.level, allow = game.mode === 'lab' ? labs.palette() : game.mode === 'build' || game.mode === 'draw' ? rd.palette() : L ? L.palette : Object.keys(DEFS); let h = '';
  for (const cat of CATS) { const ts = allow.filter(t => DEFS[t].cat === cat); if (ts.length) h += `<h4>${cat}</h4>` + ts.map(t => `<button data-t="${t}" class="${game.placeType === t ? 'active' : ''}">${DEFS[t].name}</button>`).join(''); }
  $('palette').innerHTML = h || '<p style="color:#7f93a8;font-size:12px">Всё нужное уже на панели. Соединяй клеммы проводами.</p>';
  $('palette').querySelectorAll('button').forEach(b => b.onclick = () => { game.placeType = game.placeType === b.dataset.t ? null : b.dataset.t; game.scene.cancel(); renderPalette(); game.hud(''); if (game.placeType && $('viewSel').value === 'sch') { game.addComp(b.dataset.t, 0, 0); } });
}
const wireRead = w => { const r = 0.0175 * (w.len || 2) / w.mm2, iz = IZ[w.mm2]; return [['Ток', fmt(w.i || 0) + 'А'], ['Допустимый ток', iz + ' А'], ['Сопротивление', fmt(r) + 'Ом'], ['Падение напряжения ΔU=I·R', fmt((w.i || 0) * r) + 'В'], ['Нагрев', w.burned ? 'СГОРЕЛ' : Math.round((w.heat || 0) * 100) + ' %']]; };
const rows = a => a.map(([k, v]) => `<div class="row"><span>${k}</span><span class="val">${v}</span></div>`).join('');
const sel = (id, opts, cur, unit = '') => `<select id="${id}">${opts.map(o => `<option value="${o}" ${o == cur ? 'selected' : ''}>${o} ${unit}</option>`).join('')}</select>`;
function renderInspector() {
  const s = game.selected, L = game.level; let h = '';
  if (L) h += `<h3>🎯 Цели</h3>${goalsHtml()}<div id="live" class="val" style="font-size:12px;margin-bottom:8px"></div><hr style="border-color:#2c3a4a">`;
  if (game.mode === 'lab') h += labs.panel(); else h += (game.mode === 'build' || game.mode === 'draw' ? rd.panel() : '') + '<div id="diagBox"></div>';
  if (!s) h += '<p style="color:#7f93a8">Кликни по устройству или проводу, чтобы увидеть параметры и показания.</p><p style="color:#7f93a8;font-size:12px">Цвет провода = потенциал: <b style="color:#f2c400">L1</b> <b style="color:#2faa4a">L2</b> <b style="color:#d03030">L3 / «+»</b> <b style="color:#2a6fd6">N / «−»</b> <b style="color:#9acd32">PE</b> <b style="color:#8a8f96">без напряжения</b>.<br>Точки на проводе — ток: дрожат при переменном, текут при постоянном.</p>';
  else if (s.type) {
    const d = DEFS[s.type]; h += `<h3>${s.label} — ${d.name}</h3>`;
    for (const k in d.params) if (!(s.secret || []).includes(k)) h += `<div class="row"><span>${d.params[k].label}</span>${sel('p_' + k, d.params[k].opts, s.p[k], d.params[k].unit)}</div>`;
    const ex = EXPLAIN[s.type];
    h += `<div id="insRead"></div><div class="actions"><button id="iLook" class="primary">🔍 Как устроено</button>${ARTICLES[d.art] ? '<button id="iArt">📖 Статья</button>' : ''}</div><div class="how">${d.how}</div>${ex ? SECTIONS.map(([k, t], i) => `<details ${i === 1 ? 'open' : ''}><summary>${t}</summary><p>${ex[k]}</p></details>`).join('') : ''}<div class="actions">${s.fixed ? '' : '<button id="iDel" class="danger">Удалить</button>'}</div>`;
  } else {
    h += `<h3>Провод</h3><div class="row"><span>Сечение</span>${sel('w_mm', MM2, s.mm2, 'мм²')}</div><div class="row"><span>Длина</span>${sel('w_len', [...new Set([s.len, 1, 2, 5, 10, 25, 50, 100])].sort((a, b) => a - b), s.len, 'м')}</div><div id="insRead"></div>
      <div class="how">Сопротивление провода R = ρ·L/S. Чем тоньше и длиннее — тем больше греется и тем больше «теряет» напряжения.</div><div class="actions">${s.burned ? '<button id="wFix" class="primary">Заменить сгоревший</button>' : ''}<button id="iArt">📖 Кабели</button><button id="iDel" class="danger">Удалить</button></div>`;
  }
  $('inspBody').innerHTML = h; if (game.mode === 'lab') labs.bind(); else { rd.bind(); updateDiag(true); } refreshInspector();
  if (!s) return;
  if (s.type) {
    const d = DEFS[s.type]; for (const k in d.params) if ($('p_' + k)) $('p_' + k).onchange = e => { const v = e.target.value; s.p[k] = isNaN(+v) ? v : +v; game.scene.addComp(s); game.scene.rewire(s.id); game.changed(); };
    if ($('iArt')) $('iArt').onclick = () => showArticle(d.art);
    $('iLook').onclick = () => { if ($('viewSel').value === 'sch') { $('viewSel').value = 'both'; $('viewSel').onchange({ target: $('viewSel') }); } game.scene.inspect(game.scene.inspectId === s.id ? null : s); if (game.scene.inspectId && !game.lookTip) { game.lookTip = true; toast('', '🔍 Корпус прозрачный, детали подписаны. Вращай вид правой кнопкой мыши. Повторный клик по кнопке — закрыть корпус.', 5000); } };
  } else {
    $('w_mm').onchange = e => { s.mm2 = +e.target.value; game.scene.addWire(s); game.changed(); }; $('w_len').onchange = e => { s.len = +e.target.value; game.changed(); };
    if ($('wFix')) $('wFix').onclick = () => { s.burned = false; s.heat = 0; game.changed(); }; $('iArt').onclick = () => showArticle('cable');
  }
  if ($('iDel')) $('iDel').onclick = () => game.remove(s);
}
let lastBurn = null, diagSig = '';
function updateDiag(force) {
  const box = $('diagBox'); if (!box) return; const list = game.diag || [], sig = list.map(x => x.code + (x.comp ? x.comp.id : '')).join('|') + (game.blocked ? '!' : '');
  if (!force && sig === diagSig) return; diagSig = sig;
  if (!list.length) { box.innerHTML = game.circuit.comps.some(c => c.type === 'src1' || c.type === 'src3') && game.circuit.wires.length > 1 ? '<div class="diag ok">🕵 Инспектор: замечаний нет</div>' : ''; return; }
  box.innerHTML = `<div class="diag"><b>🕵 Инспектор: замечаний — ${list.length}</b>${game.blocked ? '<div class="warn" style="font-size:12px">Работа не принята, пока есть критические замечания</div>' : ''}` + list.map((x, i) => `<details class="${x.sev}"><summary>${x.sev === 'crit' ? '⛔' : '⚠'} ${x.text}</summary><p>${x.why}</p><button data-diag="${i}">Показать на схеме</button></details>`).join('') + '</div>';
  box.querySelectorAll('[data-diag]').forEach(b => b.onclick = () => { const x = list[+b.dataset.diag]; game.select(x.wire || x.comp); });
}
function refreshInspector() {
  const s = game.selected, r = $('insRead'), L = game.level;
  if (s && !s.type && s.burned !== lastBurn) { lastBurn = s.burned; return renderInspector(); }
  if (r && s) r.innerHTML = s.secret ? '<div class="row"><span>Параметры скрыты</span><span class="val">определи измерением</span></div>' : rows(s.type ? DEFS[s.type].read(s) : wireRead(s));
  if (L && L.live && $('live')) { try { $('live').textContent = L.live(helper); } catch { } }
}

// ---------- кнопки ----------
$('btnSandbox').onclick = () => startSandbox(); $('btnQuiz').onclick = () => quiz(); $('btnBook').onclick = showBook; $('btnBook2').onclick = showBook; $('btnMenu').onclick = () => show('menu');
$('btnTask').onclick = showTask; $('btnSolve').onclick = () => { if (confirm('Собрать схему автоматически? За уровень будет на одну звезду меньше.')) applySolution(); };
$('btnHint').onclick = () => { const L = game.level; if (L) toast('', '💡 ' + L.hints[game.hintN++ % L.hints.length], 9000); };
$('btnXray').onclick = () => setXray(!game.scene.xray);
$('btnVals').onclick = () => { game.showVals = !game.showVals; $('btnVals').classList.toggle('on', game.showVals); };
// ---------- плавающие кнопки поверх рабочей области: удалить, вид, показать всё ----------
const VIEWS = ['3d', 'sch', 'both'], VNAME = { '3d': '🧊 3D', sch: '📐 Схема', both: '◫ Оба' };
function updateFab() { const s = game.selected; $('fabDel').classList.toggle('hidden', !s || !!(s.type && s.fixed)); $('fabDesel').classList.toggle('hidden', !s); $('fabView').textContent = VNAME[VIEWS[(VIEWS.indexOf($('viewSel').value) + 1) % 3]]; }
$('fabDel').onclick = () => game.remove(game.selected); $('fabDesel').onclick = () => { game.scene.cancel(); game.pendRef = null; game.select(null); };
$('fabView').onclick = () => { const v = $('viewSel'); v.value = VIEWS[(VIEWS.indexOf(v.value) + 1) % 3]; v.onchange({ target: v }); };
$('fabFit').onclick = () => { game.scene.resetView(); game.sch.vb = null; game.sch.render(); };
$('viewSel').onchange = e => { $('views').className = e.target.value === '3d' ? 'v3d' : e.target.value === 'sch' ? 'vsch' : ''; game.scene.resize(); game.scene.resetView(); game.sch.render(); updateFab(); };
$('btnReset').onclick = () => { if (game.mode === 'build' || game.mode === 'draw') { if (confirm('Начать задание заново?')) rd.restart(); } else if (game.mode === 'lab') { if (confirm('Начать лабораторную работу заново? Таблица измерений будет очищена.')) labs.restart(); } else if (game.mode === 'level') { if (confirm('Начать уровень заново?')) startLevel(game.li); } else if (confirm('Очистить панель?')) { load({ comps: [], wires: [] }); if (game.mode === 'sandbox') saveSandbox(); } };
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
  if (e.key === 'Escape') { if (!$('modal').classList.contains('hidden')) return closeModal(); game.placeType = null; game.pendRef = null; game.scene.cancel(); renderPalette(); game.hud(''); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && game.mode !== 'menu' && game.selected) { e.preventDefault(); game.remove(game.selected); }
});

const mkCircuit = (comps, wires) => ({ comps: mkComps(comps, true), wires: wires.map(parseWire) });
const rd = initRead({ game, $, modal, closeModal, toast, store, load, show, renderInspector, solved, mkCircuit, LEVELS, DEFS });
const labs = initLabs({ game, $, modal, closeModal, toast, store, load, show, helper, setXray, renderInspector });
// ---------- телефоны и планшеты ----------
const MOBILE = matchMedia('(max-width: 760px)').matches;
$('inspToggle').onclick = () => { const m = $('inspector').classList.toggle('min'); $('inspToggle').textContent = m ? '☰ Панель' : '▾ Свернуть панель'; game.scene.resize(); };
if (MOBILE) { $('viewSel').value = '3d'; $('views').className = 'v3d'; $('statusbar').textContent = ''; }
updateFab();
window.addEventListener('orientationchange', () => setTimeout(() => { game.scene.resize(); game.sch.render(); }, 300));
if ('serviceWorker' in navigator && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) navigator.serviceWorker.register('sw.js').catch(() => { });
// ---------- запуск ----------
game.scene = new Scene3D($('view3d'), game); game.sch = new Schematic($('viewSch'), game);
$('statusbar').textContent = 'Клик по клемме → клик по другой клемме: провод · перетаскивание: двигать устройство · левая кнопка по фону: сдвиг вида · правая: поворот · колесо: масштаб · Delete: удалить выбранное';
renderMenu();
// Расчёт идёт по таймеру (20 раз в секунду) и не зависит от частоты кадров отрисовки
let last = performance.now(), tSim = performance.now(), nTick = 0;
setInterval(() => {
  if (game.mode === 'menu') { tSim = performance.now(); return; }
  const now = performance.now(); let n = 0;
  while (now - tSim >= 50 && n++ < 4) { tSim += 50; try { simulate(game.circuit, DEFS, 0.05, emit); if (game.ref) simulate(game.ref, DEFS, 0.05, () => { }); } catch (err) { console.error(err); } checkGoals(); nTick++; }
  if (now - tSim > 500) tSim = now;
  if (n && nTick % 3 === 0) game.sch.render(); if (n && nTick % 5 === 0) refreshInspector();
  if (n && nTick % 8 === 0) { const was = new Set((game.diag || []).map(x => x.code + (x.comp ? x.comp.id : '')));
    if (nTick % 16 === 0) rd.refresh();
    try { game.diag = game.mode === 'lab' || game.mode === 'draw' ? [] : diagnose(game.circuit); } catch (err) { console.error(err); game.diag = []; }
    const fresh = game.diag.filter(x => x.sev === 'crit' && !was.has(x.code + (x.comp ? x.comp.id : '')) && !(game.seen || (game.seen = new Set())).has(x.code + (x.comp ? x.comp.id : '')));
    if (fresh.length && game.diagReady) { fresh.forEach(x => game.seen.add(x.code + (x.comp ? x.comp.id : ''))); toast('warn', '🕵 Инспектор: ' + fresh[0].text + (fresh.length > 1 ? ` (и ещё ${fresh.length - 1})` : '') + ' — подробности в правой панели', 7000); }
    game.diagReady = true; updateDiag(); }
}, 25);
function frame(now) {
  requestAnimationFrame(frame); const dt = Math.min(0.1, (now - last) / 1000); last = now; if (game.mode === 'menu') return;
  game.scene.update(now / 1000, dt);
}
requestAnimationFrame(frame);
