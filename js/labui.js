// Интерфейс лабораторных работ: допуск → расчёт до опыта → измерения → обработка → защита → отчёт
import { LABS } from './labs.js';

const f = (x, c) => c && c.fmt ? c.fmt(x) : !isFinite(x) ? '∞' : Math.abs(x) >= 100 ? x.toFixed(0) : Math.abs(x) >= 10 ? x.toFixed(1) : Math.abs(x) >= 1 ? x.toFixed(2) : x.toFixed(3);
const parse = s => parseFloat(String(s || '').replace(',', '.'));
const GRADES = [[85, '5 — отлично'], [70, '4 — хорошо'], [50, '3 — удовлетворительно'], [0, '2 — не зачтено']];

export function initLabs({ game, $, modal, closeModal, toast, store, load, show, helper, setXray, renderInspector }) {
  let lab = null;
  const best = () => store.get('labs', {});
  const qHtml = (qs, name) => qs.map((q, i) => `<div class="labq" data-q="${i}"><p><b>${i + 1}.</b> ${q.q}</p>${q.opts.map((o, j) => `<label><input type="radio" name="${name}${i}" value="${j}"> ${o}</label>`).join('')}</div>`).join('');
  const qScore = (qs, name, mark) => qs.reduce((n, q, i) => { const el = document.querySelector(`input[name="${name}${i}"]:checked`), ok = el && +el.value === q.a; if (mark) document.querySelectorAll(`input[name="${name}${i}"]`).forEach(r => { r.disabled = true; if (+r.value === q.a) r.parentElement.classList.add('right'); else if (r.checked) r.parentElement.classList.add('wrong'); }); return n + (ok ? 1 : 0); }, 0);
  const allAnswered = (qs, name) => qs.every((q, i) => document.querySelector(`input[name="${name}${i}"]:checked`));

  function admit(def) {
    const v0 = store.get('labv_' + def.id, 1 + Math.floor(Math.random() * 12));
    modal(`<h2>🔬 ${def.title}</h2><p><b>Цель работы.</b> ${def.goal}</p><h3>Порядок выполнения</h3><ol>${def.steps.map(s => `<li>${s}</li>`).join('')}</ol>
      <p>Вариант задания: <select id="labVar">${Array.from({ length: 12 }, (_, i) => `<option ${i + 1 === v0 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select> <small style="color:#9fb0c3">— у каждого варианта свои номиналы; часть из них скрыта, их и нужно найти</small></p>
      <h3>Допуск к работе</h3><p style="color:#9fb0c3">Как в настоящей лаборатории: сначала ответь на вопросы. Ошибки не закрывают допуск, но снижают оценку.</p>${qHtml(def.pre, 'pre')}<div id="admRes"></div>
      <div class="actions"><button class="primary" id="admGo">Получить допуск</button></div>`);
    $('admGo').onclick = () => {
      if (!allAnswered(def.pre, 'pre')) return toast('warn', 'Ответь на все вопросы допуска');
      const n = qScore(def.pre, 'pre', true), v = +$('labVar').value; store.set('labv_' + def.id, v);
      $('admRes').innerHTML = `<p>${n === def.pre.length ? '✔ Допуск получен.' : `Верно ${n} из ${def.pre.length} — правильные ответы подсвечены зелёным. Допуск получен условно.`}</p>`;
      $('admGo').textContent = 'Приступить к работе →'; $('admGo').onclick = () => { closeModal(); begin(def, v, n); };
    };
  }
  function begin(def, v, preQ) {
    const data = def.make(v); lab = { def, v, data, rows: [], vals: {}, preQ, locked: !def.answers.some(a => a.pre), burns: 0, auto: false, checked: null };
    game.level = null; game.mode = 'lab'; show('game'); load({ comps: data.comps, wires: data.wires }, true);
    for (const id in data.secret || {}) { const c = helper.c(id); if (c) c.secret = data.secret[id]; }
    game.scene.rebuild(); setXray(false); game.scene.resetView();
    $('lvlTitle').textContent = `Лаб. работа · вариант ${v}`; ['btnTask', 'btnHint', 'btnSolve'].forEach(b => $(b).classList.add('hidden')); renderInspector();
  }
  const truth = a => a.truth(lab.data, lab.rows);
  const isOk = a => { const x = parse(lab.vals[a.k]), t = truth(a); return isFinite(x) && Math.abs(x - t) <= Math.abs(t) * a.tol + 1e-9; };

  function chart(def, rows, w = 250, h = 140) {
    const c = def.chart; if (!c || rows.length < 2) return ''; const p = rows.map(r => [r[c.x], r[c.y] ?? def.cols.find(k => k.k === c.y).calc(r)]).filter(q => isFinite(q[0]) && isFinite(q[1])).sort((a, b) => a[0] - b[0]);
    if (p.length < 2) return ''; const xm = Math.max(...p.map(q => q[0])) * 1.1 || 1, ym = Math.max(...p.map(q => q[1])) * 1.15 || 1, X = x => 34 + x / xm * (w - 44), Y = y => h - 22 - y / ym * (h - 32);
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="background:#f4f1e8;border-radius:6px;margin:6px 0"><path d="M 34 8 V ${h - 22} H ${w - 8}" stroke="#222" fill="none"/><polyline points="${p.map(q => X(q[0]) + ',' + Y(q[1])).join(' ')}" fill="none" stroke="#1d5fa8" stroke-width="1.5"/>${p.map(q => `<circle cx="${X(q[0])}" cy="${Y(q[1])}" r="3" fill="#d03030"/>`).join('')}
      <text x="${w - 8}" y="${h - 6}" font-size="10" text-anchor="end">${c.xl}</text><text x="4" y="12" font-size="10">${c.yl}</text><text x="34" y="${h - 8}" font-size="9" text-anchor="middle">0</text><text x="${X(xm / 1.1)}" y="${h - 8}" font-size="9" text-anchor="middle">${f(xm / 1.1)}</text><text x="30" y="${Y(ym / 1.15) + 3}" font-size="9" text-anchor="end">${f(ym / 1.15)}</text></svg>`;
  }
  const table = (def, rows, del) => `<table class="labt"><tr><th>№</th>${def.cols.map(c => `<th>${c.label}</th>`).join('')}${del ? '<th></th>' : ''}</tr>${rows.map((r, i) => `<tr><td>${i + 1}</td>${def.cols.map(c => `<td>${f(c.calc ? c.calc(r) : r[c.k], c)}</td>`).join('')}${del ? `<td><a data-del="${i}" title="Удалить строку">✕</a></td>` : ''}</tr>`).join('') || `<tr><td colspan="${def.cols.length + 2}" style="color:#7f93a8">измерений пока нет</td></tr>`}</table>`;
  const inputs = (list, dis) => list.map(a => `<div class="row"><span>${a.label}</span><span><input class="labin" data-k="${a.k}" value="${lab.vals[a.k] ?? ''}" ${dis ? 'disabled' : ''} placeholder="?"> ${a.unit}</span></div>`).join('');

  function panel() {
    if (!lab) return ''; const d = lab.def, pre = d.answers.filter(a => a.pre), post = d.answers.filter(a => !a.pre), enough = lab.rows.length >= d.minRows;
    let h = `<h3>🔬 Лабораторная работа</h3><div style="font-size:12px;color:#c4cfdb;margin-bottom:6px">${d.title} · вариант ${lab.v}</div><details><summary>Порядок выполнения</summary><ol style="padding-left:18px;margin:4px 0">${d.steps.map(s => `<li>${s}</li>`).join('')}</ol></details>`;
    if (pre.length) h += `<div class="labsec"><b>1. Расчёт до опыта</b>${inputs(pre, lab.locked)}${lab.locked ? '<small style="color:#3fbf6a">✔ расчёт зафиксирован — после опыта сравним</small>' : '<button id="labLock" class="primary">Зафиксировать расчёт</button>'}</div>`;
    h += `<div class="labsec"><b>${pre.length ? 2 : 1}. Измерения</b> <small style="color:#9fb0c3">нужно строк: ${d.minRows}</small><br><button id="labRec" class="primary" ${lab.locked ? '' : 'disabled title="Сначала зафиксируй расчёт"'}>📝 Записать измерение</button> ${d.make(lab.v).sol ? '<button id="labAuto" title="Оценка будет ниже">Собрать схему за меня</button>' : ''}${table(d, lab.rows, true)}${chart(d, lab.rows)}</div>`;
    h += `<div class="labsec"><b>${pre.length ? 3 : 2}. Обработка результатов</b>${inputs(post, !enough)}<button id="labDone" class="primary" ${enough ? '' : 'disabled'}>Сдать отчёт →</button></div><hr style="border-color:#2c3a4a">`;
    return h;
  }
  function bind() {
    if (!lab) return; const d = lab.def;
    document.querySelectorAll('.labin').forEach(i => i.oninput = () => { lab.vals[i.dataset.k] = i.value; });
    if ($('labLock')) $('labLock').onclick = () => { if (d.answers.filter(a => a.pre).some(a => !isFinite(parse(lab.vals[a.k])))) return toast('warn', 'Впиши все расчётные значения числами'); lab.locked = true; renderInspector(); toast('good', 'Расчёт зафиксирован. Теперь собери схему и проверь себя измерением.'); };
    $('labRec').onclick = () => {
      const r = {}; for (const c of d.cols) if (c.get) r[c.k] = c.get(helper, lab.data);
      const err = Object.values(r).some(x => Number.isNaN(x)) ? (d.rowCheck(r) || 'Не все приборы подключены') : d.rowCheck(r); if (err) return toast('warn', err);
      if (lab.rows.some(x => d.rowKey(x) === d.rowKey(r))) return toast('warn', 'Такая точка уже записана — измени режим (напряжение, нагрузку, сечение или положение выключателя)');
      lab.rows.push(r); renderInspector(); if (lab.rows.length === d.minRows) toast('good', 'Измерений достаточно. Можно добавить ещё точки или переходить к обработке.');
    };
    if ($('labAuto')) $('labAuto').onclick = () => { if (!confirm('Собрать схему автоматически? Оценка будет снижена на 15 %.')) return; lab.auto = true; const s = d.make(lab.v); load({ comps: s.comps, wires: s.sol }, true); for (const id in s.secret || {}) helper.c(id).secret = s.secret[id]; game.mode = 'lab'; game.scene.rebuild(); renderInspector(); };
    document.querySelectorAll('[data-del]').forEach(a => a.onclick = () => { lab.rows.splice(+a.dataset.del, 1); renderInspector(); });
    $('labDone').onclick = defend;
  }
  function defend() {
    const d = lab.def; if (d.answers.filter(a => !a.pre).some(a => !isFinite(parse(lab.vals[a.k])))) return toast('warn', 'Впиши все результаты числами');
    modal(`<h2>Защита работы</h2><p style="color:#9fb0c3">Контрольные вопросы по итогам опыта.</p>${qHtml(d.post, 'post')}<div class="actions"><button class="primary" id="defGo">Ответить и получить оценку</button></div>`);
    $('defGo').onclick = () => { if (!allAnswered(d.post, 'post')) return toast('warn', 'Ответь на все вопросы'); report(qScore(d.post, 'post', false)); };
  }
  function report(postQ) {
    const d = lab.def, pre = d.answers.filter(a => a.pre), post = d.answers.filter(a => !a.pre), ratio = l => l.length ? l.filter(isOk).length / l.length : 1;
    const score = Math.max(0, Math.round(10 * lab.preQ / d.pre.length + 20 * ratio(pre) + 20 * Math.min(1, lab.rows.length / d.minRows) + 30 * ratio(post) + 20 * postQ / d.post.length - 10 * lab.burns - (lab.auto ? 15 : 0)));
    const grade = GRADES.find(g => score >= g[0])[1], b = best(); b[d.id] = Math.max(b[d.id] || 0, score); store.set('labs', b);
    const cmp = a => { const x = parse(lab.vals[a.k]), t = truth(a), e = (x - t) / t * 100; return `<tr><td>${a.label}</td><td>${f(x)} ${a.unit}</td><td>${f(t)} ${a.unit}</td><td style="color:${isOk(a) ? '#3fbf6a' : '#ff6b6b'}">${e >= 0 ? '+' : ''}${e.toFixed(1)} % ${isOk(a) ? '✔' : '✘'}</td></tr>`; };
    modal(`<h2>Отчёт по лабораторной работе</h2><p><b>${d.title}</b> · вариант ${lab.v}</p><p><b>Цель.</b> ${d.goal}</p>
      <h3>Таблица измерений</h3>${table(d, lab.rows, false)}${chart(d, lab.rows, 420, 200).replace('width="100%"', 'width="420"')}
      <h3>Сравнение с истинными значениями</h3><table><tr><th>Величина</th><th>Твой результат</th><th>Точное значение</th><th>Отклонение</th></tr>${[...pre, ...post].map(cmp).join('')}</table>
      <h3>Вывод</h3><p>${d.conclusion}</p>
      <h3>Оценка: ${grade} <small style="color:#9fb0c3">(${score} баллов из 100)</small></h3>
      <p style="color:#9fb0c3;font-size:13px">Допуск ${lab.preQ}/${d.pre.length} · расчёт до опыта ${pre.length ? pre.filter(isOk).length + '/' + pre.length : '—'} · измерений ${lab.rows.length}/${d.minRows} · результаты ${post.filter(isOk).length}/${post.length} · защита ${postQ}/${d.post.length}${lab.burns ? ' · сгорело элементов: ' + lab.burns + ' (−' + 10 * lab.burns + ')' : ''}${lab.auto ? ' · схема собрана автоматически (−15)' : ''}</p>
      <div class="actions"><button class="primary" id="repMenu">В меню</button><button id="repAgain">Другой вариант</button><button id="repStay">Остаться у стенда</button></div>`);
    $('repMenu').onclick = () => { closeModal(); lab = null; show('menu'); }; $('repStay').onclick = closeModal;
    $('repAgain').onclick = () => { store.set('labv_' + d.id, lab.v % 12 + 1); lab = null; admit(d); };
  }
  return {
    get active() { return !!lab; }, panel, bind, burn() { if (lab) lab.burns++; }, palette: () => [], quit() { lab = null; },
    xp() { const b = best(); return Object.values(b).reduce((a, s) => a + Math.round(s * 0.3), 0); },
    restart() { if (lab) begin(lab.def, lab.v, lab.preQ); },
    menuHtml() { const b = best(); return LABS.map((l, i) => `<div class="lvl ${b[l.id] ? 'done' : ''}" data-lab="${i}"><span class="u">${l.u}</span><div class="n">Лаб. работа ${i + 1} ${b[l.id] ? '· лучший результат ' + b[l.id] + ' б.' : ''}</div><div class="t">${l.title}</div><div class="d">${l.goal}</div></div>`).join(''); },
    bindMenu(root) { root.querySelectorAll('[data-lab]').forEach(d => d.onclick = () => admit(LABS[+d.dataset.lab])); },
  };
}
