// Режим «Чтение схем»: по схеме собрать сборку (build) и по сборке нарисовать схему (draw)
import { compare, checklist, summary } from './readmode.js';
import { READ_TASKS, DIFFS } from './readtasks.js';
import { TRANSPARENT } from './defs4.js';
import { SKILLS } from './levels2.js';
SKILLS.read = 'Чтение схем';

export function initRead({ game, $, modal, closeModal, toast, store, load, show, renderInspector, solved, mkCircuit, LEVELS, DEFS }) {
  let rd = null;
  const best = () => store.get('read', {}), key = (dir, t) => dir + ':' + t.lvl;
  function target(task) {
    const L = LEVELS.find(l => l.id === task.lvl), S = solved(L), drop = task.drop || [];
    const comps = S.comps.filter(c => !drop.includes(c[0])), wires = S.wires.filter(w => !drop.some(d => w.split(' ').slice(0, 2).some(e => e.startsWith(d + '.'))));
    const c = mkCircuit(comps, wires); if (S.patch) { try { S.patch({ circuit: c, c: id => c.comps.find(x => x.id === id), all: t => c.comps.filter(x => x.type === t) }); } catch { } }
    c.comps.forEach(x => { x.locked = true; x.fixed = true; }); return { c, comps };
  }
  function start(task, dir) {
    const t = target(task), diff = task.diff; rd = { task, dir, diff, target: t.c, tries: 0, t0: Date.now(), msg: '', won: false };
    game.level = null; show('game'); game.mode = dir;
    const pre = diff === 0 ? t.comps.map(c => c.slice(0, 5)) : [];       // новичку устройства уже расставлены
    if (dir === 'draw') {
      game.ref = t.c; game.sheet = { w: 130, h: 96 }; game.scene.readonly = true; game.scene.blind = diff === 2;
      game.scene.game = { circuit: t.c, selected: null, placeType: null, showVals: diff < 2, select(o) { this.selected = o; }, addComp() { }, addWire() { }, changed() { }, hud: x => game.hud(x) };
    } else game.sch.game = { circuit: t.c, selected: null, showVals: false, placeType: null, pendRef: null, scene: { clickTerm() { }, cancel() { }, items: new Map(), rewire() { } }, select() { }, changed() { }, termClick() { } };
    load({ comps: pre, wires: [] }, true); game.mode = dir; game.scene.resetView();
    const v = $('viewSel'); v.value = 'both'; $('views').className = ''; game.scene.resize();
    $('lvlTitle').textContent = `Чтение схем · ${dir === 'build' ? 'схема → сборка' : 'сборка → схема'} · ${DIFFS[diff].name}`; ['btnTask', 'btnHint', 'btnSolve'].forEach(b => $(b).classList.add('hidden')); renderInspector();
    toast('', dir === 'build' ? '🧩 Справа — схема-задание. Собери такую же сборку на панели слева.' : '🧩 Слева — готовая сборка (её можно вращать и щёлкать аппаратами). Нарисуй её схему на листе справа: выбери обозначение в палитре, кликни по листу, соединяй выводы кликами.', 9000);
  }
  function check() {
    const r = compare(rd.target, game.circuit);
    if (r.ok) return win();
    rd.tries++; const d = rd.diff, parts = [];
    if (d < 2) { if (r.missing.length) parts.push('не хватает: ' + r.missing.join(', ')); if (r.extra.length) parts.push('лишнее: ' + r.extra.join(', ')); }
    if (!parts.length) {
      if (d === 0) { const c = checklist(rd.target, game.circuit); parts.push(`совпало соединений ${c.done} из ${c.list.length}` + (c.extra ? `, лишних или неверных — ${c.extra}` : '')); }
      else if (d === 1) { const a = summary(rd.target), b = summary(game.circuit); parts.push(`устройства те же, но соединения отличаются: в задании ${a.nodes} узлов и ${a.pins} подключённых выводов, у тебя — ${b.nodes} и ${b.pins}`); }
      else parts.push('не совпадает с заданием');
    }
    rd.msg = '✘ ' + parts.join('; '); toast('warn', 'Проверка: ' + parts.join('; '), 7000); renderInspector();
  }
  function win() {
    const stars = Math.max(1, 3 - rd.tries), b = best(), k = key(rd.dir, rd.task); b[k] = Math.max(b[k] || 0, stars); store.set('read', b); rd.won = true; rd.msg = '✔ Совпадает с заданием';
    const sec = Math.round((Date.now() - rd.t0) / 1000), list = READ_TASKS.filter(t => true), i = list.indexOf(rd.task), next = list[i + 1], other = rd.dir === 'build' ? 'draw' : 'build';
    modal(`<h2>Верно! ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</h2><p>${rd.dir === 'build' ? 'Сборка соответствует схеме' : 'Схема соответствует сборке'}: тот же набор устройств и те же соединения. Время — ${Math.floor(sec / 60)} мин ${sec % 60} с, неудачных проверок — ${rd.tries}.</p>
      <p style="color:#9fb0c3">${rd.dir === 'build' ? 'Сборка живая: включи автоматы, понажимай кнопки и убедись, что она работает как задумано.' : 'Твоя схема тоже живая — аппараты на ней можно переключать.'}</p>
      <div class="actions">${next ? '<button class="primary" id="rdNext">Следующее задание →</button>' : ''}<button id="rdFlip">То же задание наоборот</button><button id="rdStay">Остаться</button><button id="rdMenu">В меню</button></div>`);
    if (next) $('rdNext').onclick = () => { closeModal(); start(next, rd.dir); }; $('rdFlip').onclick = () => { closeModal(); start(rd.task, other); }; $('rdStay').onclick = () => { closeModal(); renderInspector(); }; $('rdMenu').onclick = () => { closeModal(); show('menu'); };
  }
  const listHtml = () => { const c = checklist(rd.target, game.circuit); return `<div style="font-size:12px;color:#9fb0c3;margin:4px 0">Соединения: ${c.done} из ${c.list.length}${c.extra ? ` · лишних: ${c.extra}` : ''}</div>` + c.list.map(r => `<div style="font:11.5px Consolas,monospace;color:${r.ok ? '#3fbf6a' : r.part ? '#ffb35c' : '#c4cfdb'}">${r.ok ? '✔' : r.part ? '≈' : '○'} ${r.text}</div>`).join(''); };
  return {
    get active() { return !!rd; }, quit() { rd = null; }, restart() { if (rd) start(rd.task, rd.dir); },
    palette() { if (!rd || rd.diff === 0) return []; if (rd.diff === 2) return Object.keys(DEFS); return [...new Set([...rd.target.comps.map(c => c.type), 'xt', 'bus'])]; },
    panel() {
      if (!rd) return ''; const d = DIFFS[rd.diff], n = rd.target.comps.filter(c => !TRANSPARENT[c.type]).length;
      return `<h3>🧩 ${rd.task.title}</h3><div style="font-size:12px;color:#c4cfdb">${d.icon} ${d.name} · ${rd.dir === 'build' ? 'по схеме собрать сборку' : 'по сборке нарисовать схему'} · устройств: ${n}</div>
        <p style="font-size:13px;color:#c4cfdb;margin:6px 0">${d[rd.dir]}</p><div class="labsec"><button id="rdCheck" class="primary">✅ Проверить</button> <small style="color:#9fb0c3">неудачных попыток: ${rd.tries}</small>
        ${rd.msg ? `<div style="margin-top:4px;color:${rd.won ? '#3fbf6a' : '#ffb35c'};font-size:13px">${rd.msg}</div>` : ''}${rd.diff === 0 ? `<div id="rdList">${listHtml()}</div>` : ''}</div>
        <details><summary>Что считается верным</summary><p>Сравниваются не расположение и не длина проводов, а <b>соединения</b>: тот же набор устройств и те же узлы. Симметричные выводы взаимозаменяемы (лампа, контакт, полюса автомата). Клеммы и шины считаются проводом. Перестановка двух фаз двигателя — уже другая схема.</p></details><hr style="border-color:#2c3a4a">`;
    },
    bind() { if (rd && $('rdCheck')) $('rdCheck').onclick = check; },
    refresh() { if (rd && rd.diff === 0 && $('rdList')) $('rdList').innerHTML = listHtml(); },
    xp() { return Object.values(best()).reduce((a, s) => a + s * 10, 0); }, max: () => READ_TASKS.length * 2 * 30,
    menuHtml() {
      const b = best(), col = (dir, title, sub) => `<div><h3 style="color:#ffd23f;margin:8px 0 2px">${title}</h3><p style="color:#9fb0c3;margin:0 0 8px;font-size:13px">${sub}</p>` + DIFFS.map((d, di) => `<div style="margin:6px 0 4px;color:#c4cfdb;font-size:13px">${d.icon} ${d.name}</div><div class="rdrow">` + READ_TASKS.map((t, i) => t.diff === di ? `<button class="rdtask ${b[key(dir, t)] ? 'done' : ''}" data-rd="${dir}:${i}">${t.title}${b[key(dir, t)] ? ' ' + '★'.repeat(b[key(dir, t)]) : ''}</button>` : '').join('') + '</div>').join('') + '</div>';
      return `<div class="rdgrid">${col('build', '📐 → 🔧 По схеме собрать сборку', 'Дана принципиальная схема. Поставь устройства на панель и соедини проводами.')}${col('draw', '🔧 → 📐 По сборке нарисовать схему', 'Дан собранный щит. Проследи провода и начерти его схему.')}</div>`;
    },
    bindMenu(root) { root.querySelectorAll('[data-rd]').forEach(b => b.onclick = () => { const [dir, i] = b.dataset.rd.split(':'); start(READ_TASKS[+i], dir); }); },
  };
}
