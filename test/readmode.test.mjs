// Проверка сравнения схем для режима «Чтение схем»: node test/readmode.test.mjs
import { DEFS, newComp } from '../js/defs.js';
import '../js/defs2.js';
import '../js/defs3.js';
import '../js/defs4.js';
import { LEVELS } from '../js/levels.js';
import '../js/levels4.js';
import { compare, checklist, netlist } from '../js/readmode.js';
import { READ_TASKS } from '../js/readtasks.js';

let fails = 0, wn = 0;
const ok = (n, c, x = '') => { if (!c) { console.log('FAIL ' + n, x); fails++; } };
const pw = s => { const [a, b, mm] = s.split(' '), i = a.indexOf('.'), j = b.indexOf('.'); return { a: { c: a.slice(0, i), t: a.slice(i + 1) }, b: { c: b.slice(0, j), t: b.slice(j + 1) }, mm2: +mm || 2.5, n: wn++ }; };
function solved(L, drop = []) {
  const s = L.sol; let comps = [...L.comps], wires = [...(L.wires || [])];
  if (Array.isArray(s)) wires = s; else { if (s.comps) comps = [...comps, ...s.comps]; if (s.drop) wires = wires.slice(0, -s.drop); if (s.wires) wires = s.drop ? [...wires, ...s.wires] : s.wires; if (s.add) wires = [...wires, ...s.add]; }
  comps = comps.filter(c => !drop.includes(c[0]));
  return { comps: comps.map(([id, type, x, y, p]) => newComp(type, id, x, y, p)), wires: wires.map(pw).filter(w => !drop.includes(w.a.c) && !drop.includes(w.b.c)) };
}
const clone = c => ({ comps: c.comps.map(k => ({ ...k })), wires: c.wires.map(w => ({ a: { ...w.a }, b: { ...w.b } })) });
const rename = c => { const d = clone(c); d.comps = d.comps.map(k => ({ ...k, id: 'z' + k.id, label: 'Z' + k.label })).reverse(); d.wires.forEach(w => { w.a.c = 'z' + w.a.c; w.b.c = 'z' + w.b.c; }); d.wires.reverse(); return d; };
const swapT = (c, id, a, b) => { const d = clone(c); for (const w of d.wires) for (const e of [w.a, w.b]) if (e.c === id) e.t = e.t === a ? b : e.t === b ? a : e.t; return d; };

for (const task of READ_TASKS) {
  const L = LEVELS.find(l => l.id === task.lvl); if (!L) { ok('нет уровня ' + task.lvl, false); continue; }
  const T = solved(L, task.drop), t0 = Date.now();
  ok(task.lvl + ': схема равна самой себе', compare(T, T).ok);
  ok(task.lvl + ': переименование и перестановка устройств', compare(T, rename(T)).ok);
  const cl = checklist(T, T); ok(task.lvl + ': чек-лист полностью отмечен', cl.done === cl.list.length && cl.extra === 0, cl.done + '/' + cl.list.length);
  let falseOk = 0; for (let i = 0; i < T.wires.length; i++) { const d = clone(T); d.wires.splice(i, 1); if (compare(T, d).ok) { falseOk++; console.log('     избыточный провод в ' + task.lvl + ':', T.wires[i].a.c + '.' + T.wires[i].a.t, T.wires[i].b.c + '.' + T.wires[i].b.t); } }
  ok(task.lvl + ': удаление любого провода обнаруживается', falseOk === 0, falseOk);
  const d = clone(T); d.comps.pop(); ok(task.lvl + ': нехватка устройства', !compare(T, d).ok && compare(T, d).missing.length === 1);
  // симметричные выводы
  const lamp = T.comps.find(k => k.type === 'el'); if (lamp) ok(task.lvl + ': лампу можно подключить любой стороной', compare(T, swapT(T, lamp.id, '1', '2')).ok);
  const mot = T.comps.find(k => k.type === 'm3'); if (mot && task.lvl !== 'rev') ok(task.lvl + ': перестановка двух фаз двигателя — это уже другая схема', !compare(T, swapT(T, mot.id, 'U', 'V')).ok);
  const km = T.comps.find(k => k.type === 'km'); if (km) { ok(task.lvl + ': блок-контакт 13–14 можно подключить любой стороной', compare(T, swapT(T, km.id, '13', '14')).ok); ok(task.lvl + ': катушка вместо блок-контакта — ошибка', !compare(T, swapT(T, km.id, 'A1', '13')).ok); }
  const dt = Date.now() - t0; console.log(`OK   ${task.lvl.padEnd(6)} ${task.diff}: устройств ${netlist(T).comps.length}, соединений ${cl.list.length}, ${dt} мс`); if (dt > 3000) ok(task.lvl + ': слишком медленно', false, dt);
}
// шина в нуле не меняет схему
const L = LEVELS.find(l => l.id === 'light'), T = solved(L), U = clone(T); U.comps.push(newComp('bus', 'b1', 0, 0)); const nw = U.wires.find(w => (w.a.c === 'g1' && w.a.t === 'N') || (w.b.c === 'g1' && w.b.t === 'N'));
const other = nw.a.c === 'g1' ? nw.b : nw.a; U.wires = U.wires.filter(w => w !== nw); U.wires.push({ a: { c: 'g1', t: 'N' }, b: { c: 'b1', t: '1' } }, { a: { c: 'b1', t: '5' }, b: other });
ok('ноль через шину N — та же схема', compare(T, U).ok); if (compare(T, U).ok) console.log('OK   шина N считается проводом');
console.log(fails ? `\n${fails} FAILED` : '\nСравнение схем работает верно'); process.exit(fails ? 1 : 0);
