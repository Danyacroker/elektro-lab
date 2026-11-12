// Проверка «Инспектора»: node test/diag.test.mjs
import { simulate, cabs, IZ } from '../js/sim.js';
import { DEFS, newComp } from '../js/defs.js';
import '../js/defs2.js';
import { LEVELS } from '../js/levels.js';
import '../js/levels3.js';
import '../js/defs3.js';
import '../js/levels4.js';
import { diagnose } from '../js/diag.js';

let wn = 0, fails = 0;
const ok = (n, c, x = '') => { console.log((c ? 'OK   ' : 'FAIL ') + n, x); if (!c) fails++; };
const pw = s => { const [a, b, mm, len] = s.split(' '), i = a.indexOf('.'), j = b.indexOf('.'); return { a: { c: a.slice(0, i), t: a.slice(i + 1) }, b: { c: b.slice(0, j), t: b.slice(j + 1) }, mm2: +mm || 2.5, len: +len || 2, n: wn++ }; };
const mk = l => (l || []).map(([id, type, x, y, p, st]) => { const c = newComp(type, id, x, y, p); if (st) Object.assign(c.state, st); return c; });
const build = (comps, wires) => ({ comps: mk(comps), wires: wires.map(pw) });
const run = (c, sec = 1) => { for (let i = 0; i < sec * 20; i++) simulate(c, DEFS, 0.05, () => { }); return c; };
const codes = c => diagnose(run(c)).map(d => d.code + ':' + (d.comp ? d.comp.label : '')).sort().join(' ');
function solved(L) {
  const s = L.sol; let comps = [...L.comps], wires = [...(L.wires || [])];
  if (Array.isArray(s)) wires = s; else { if (s.comps) comps = [...comps, ...s.comps]; if (s.drop) wires = wires.slice(0, -s.drop); if (s.wires) wires = s.drop ? [...wires, ...s.wires] : s.wires; if (s.add) wires = [...wires, ...s.add]; }
  const c = build(comps, wires); if (s.patch) s.patch({ circuit: c, c: id => c.comps.find(x => x.id === id), all: t => c.comps.filter(x => x.type === t) }); return c;
}
// 1. Скриншоты пользователя: лампа на PE вместо N; автомат и выключатель в нуле
const base = [['g1', 'src1'], ['qf1', 'qf1'], ['sa1', 'sa', 0, 0, {}, { on: true }], ['el1', 'el']];
ok('Правильная схема — без замечаний', codes(build(base, ['g1.L qf1.1', 'qf1.2 sa1.1', 'sa1.2 el1.1', 'el1.2 g1.N'])) === '');
ok('Лампа на PE вместо нуля', codes(build(base, ['g1.L qf1.1', 'qf1.2 sa1.1', 'sa1.2 el1.1', 'el1.2 g1.PE'])) === 'peN:EL1', codes(build(base, ['g1.L qf1.1', 'qf1.2 sa1.1', 'sa1.2 el1.1', 'el1.2 g1.PE'])));
ok('Автомат и выключатель в нуле, фаза напрямую', codes(build(base, ['g1.N qf1.1', 'qf1.2 sa1.1', 'sa1.2 el1.2', 'el1.1 g1.L'])) === 'inN:QF1 inN:SA1 noprot:EL1', codes(build(base, ['g1.N qf1.1', 'qf1.2 sa1.1', 'sa1.2 el1.2', 'el1.1 g1.L'])));
ok('Только выключатель в нуле', codes(build(base, ['g1.L qf1.1', 'qf1.2 el1.1', 'el1.2 sa1.1', 'sa1.2 g1.N'])) === 'inN:SA1');
ok('Автомат больше, чем держит провод', codes(build([...base.slice(0, 1), ['qf1', 'qf1', 0, 0, { In: 32 }], ...base.slice(2)], ['g1.L qf1.1', 'qf1.2 sa1.1 1.5', 'sa1.2 el1.1', 'el1.2 g1.N'])) === 'thin:QF1');
ok('УЗО с нулём через него — не ошибка', codes(build([...base, ['qd1', 'rcd2']], ['g1.L qf1.1', 'qf1.2 qd1.1', 'g1.N qd1.N1', 'qd1.2 sa1.1', 'sa1.2 el1.1', 'el1.2 qd1.N2'])) === '');
ok('Двигатель без PE', codes(build([['g1', 'src3'], ['qf1', 'qf3'], ['m1', 'm3']], ['g1.L1 qf1.1', 'g1.L2 qf1.3', 'g1.L3 qf1.5', 'qf1.2 m1.U', 'qf1.4 m1.V', 'qf1.6 m1.W'])) === 'noPE:M1');
// 2. Собранные решения всех квестов не должны иметь критических замечаний
for (const L of LEVELS) { if (L.lax) continue; const d = diagnose(run(solved(L))).filter(x => x.sev === 'crit'); ok('решение чисто: ' + L.id, d.length === 0, d.map(x => x.text).join(' | ')); }
// 3. Квесты «Приёмка»
for (const id of ['audit1', 'audit2']) {
  const L = LEVELS.find(l => l.id === id), pre = diagnose(run(build(L.comps, L.wires)));
  console.log(`     ${id}: в исходной схеме замечаний ${pre.length}: ` + pre.map(d => d.code).join(', '));
  ok(id + ': исходная схема с нарушениями', pre.length >= 4);
  const c = solved(L), h = { circuit: c, c: i => c.comps.find(x => x.id === i), all: t => c.comps.filter(x => x.type === t), diag: () => diagnose(c), IZ, v: (x, t) => cabs(c.net.v(c.net.node(x.id + '.' + t))) };
  if (id === 'audit2') { h.c('sb2').state.pressed = true; run(c, 0.5); h.c('sb2').state.pressed = false; }
  run(c, 4); ok(id + ': после исправления все цели выполняются', L.goals.every(g => g.ok(h)), diagnose(c).map(d => d.text).join(' | '));
}
console.log(fails ? `\n${fails} FAILED` : '\nИнспектор работает верно'); process.exit(fails ? 1 : 0);
